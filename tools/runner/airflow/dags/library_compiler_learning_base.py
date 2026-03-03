# tools/runner/airflow/dags/library_compiler_learning_base.py
from __future__ import annotations

import os
import re
import json
import hashlib
import time
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, List, Tuple, Optional

import requests
from airflow import DAG
from airflow.decorators import task
from airflow.exceptions import AirflowFailException


# =========================
# Config (env)
# =========================
LIBRARY_ROOT = Path(os.getenv("LIBRARY_ROOT", "/opt/library"))
RAW_DIR = Path(os.getenv("LIBRARY_RAW", str(LIBRARY_ROOT / "raw")))
PROCESSED_DIR = Path(os.getenv("LIBRARY_PROCESSED", str(LIBRARY_ROOT / "processed")))
PACKS_DIR = Path(os.getenv("LIBRARY_PACKS", str(LIBRARY_ROOT / "packs")))
CACHE_DIR = Path(os.getenv("LIBRARY_CACHE", str(LIBRARY_ROOT / "cache")))

OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")

QDRANT_HOST = os.getenv("QDRANT_HOST", "qdrant")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))

DEFAULT_CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "3500"))         # chars
DEFAULT_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "350"))          # chars
BATCH_UPSERT = int(os.getenv("QDRANT_UPSERT_BATCH", "128"))

EMBED_CONCURRENCY = int(os.getenv("EMBED_CONCURRENCY", "2"))
EMBED_TIMEOUT_SEC = int(os.getenv("EMBED_TIMEOUT_SEC", "600"))
EMBED_CACHE = os.getenv("EMBED_CACHE", "true").lower() == "true"

QDRANT_STORE_FULL_TEXT = os.getenv("QDRANT_STORE_FULL_TEXT", "false").lower() == "true"
QDRANT_TEXT_PREVIEW_CHARS = int(os.getenv("QDRANT_TEXT_PREVIEW_CHARS", "600"))

COLLECTION_PREFIX = "kb__"


# =========================
# FS helpers
# =========================
def ensure_dirs() -> None:
    for p in [LIBRARY_ROOT, RAW_DIR, PROCESSED_DIR, PACKS_DIR, CACHE_DIR]:
        p.mkdir(parents=True, exist_ok=True)
    (CACHE_DIR / "embeddings").mkdir(parents=True, exist_ok=True)


def write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def write_text(path: Path, txt: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(txt, encoding="utf-8")


# =========================
# Text helpers
# =========================
def sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def file_fingerprint(path: Path) -> str:
    st = path.stat()
    return sha256(str(path.resolve()) + "|" + str(st.st_size) + "|" + str(st.st_mtime_ns))


def normalize_ws(s: str) -> str:
    s = s.replace("\u00a0", " ")
    if len(s) > 2_000_000:
        parts = s.splitlines()
        parts = [" ".join(p.split()) for p in parts]
        s = "\n".join(parts)
        s = re.sub(r"\n{3,}", "\n\n", s)
        return s.strip()
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def drop_noise(text: str) -> str:
    """
    Remove lixo comum: páginas/headers repetidos simples, excesso de linhas curtas.
    Mantém conservador para não perder conteúdo.
    """
    text = text.replace("\r", "\n")
    lines = [ln.strip() for ln in text.split("\n")]
    kept: List[str] = []
    short_run = 0
    for ln in lines:
        if not ln:
            kept.append("")
            short_run = 0
            continue
        if len(ln) < 3:
            short_run += 1
            if short_run >= 4:
                continue
        else:
            short_run = 0
        kept.append(ln)
    out = "\n".join(kept)
    out = normalize_ws(out)
    return out


def detect_sections(paragraphs: List[str]) -> List[Tuple[str, List[str]]]:
    """
    Heurística simples de seções:
    - linha curta e com padrão de título (CAPS, ou começa com número, ou 'Chapter')
    """
    sections: List[Tuple[str, List[str]]] = []
    current_title = "untitled"
    current_buf: List[str] = []

    title_re = re.compile(r"^(chapter|cap[ií]tulo)\b", re.IGNORECASE)
    numbered_re = re.compile(r"^\d+(\.\d+)*\s+")
    caps_ratio_re = re.compile(r"[A-Z]")

    def is_title(p: str) -> bool:
        if len(p) > 140:
            return False
        if title_re.search(p):
            return True
        if numbered_re.search(p):
            return True
        # muita letra maiúscula em uma linha curta
        caps = len(caps_ratio_re.findall(p))
        letters = sum(ch.isalpha() for ch in p)
        if letters >= 10 and caps / max(letters, 1) > 0.6 and len(p.split()) <= 12:
            return True
        return False

    for p in paragraphs:
        if is_title(p):
            if current_buf:
                sections.append((current_title, current_buf))
            current_title = p.strip()
            current_buf = []
        else:
            current_buf.append(p)

    if current_buf:
        sections.append((current_title, current_buf))

    return sections


def chunk_by_paragraphs(
    paragraphs: List[str],
    chunk_size: int,
    overlap: int,
    ctx_prefix: str,
) -> List[Dict[str, Any]]:
    """
    Chunk por agregação de parágrafos até chunk_size (chars).
    Overlap é aplicado como reaproveitamento do final do chunk anterior (chars).
    Retorna dicts com {text, meta}.
    """
    chunks: List[Dict[str, Any]] = []
    buf: List[str] = []
    buf_len = 0
    last_tail = ""

    def flush():
        nonlocal buf, buf_len, last_tail
        if not buf:
            return
        body = normalize_ws("\n\n".join(buf))
        if not body or len(body) < 200:
            buf, buf_len = [], 0
            return
        text = normalize_ws(ctx_prefix + "\n\n" + (last_tail + "\n\n" if last_tail else "") + body)
        chunks.append({"text": text})
        # atualiza tail para overlap
        if overlap > 0:
            last_tail = text[-overlap:]
        else:
            last_tail = ""
        buf, buf_len = [], 0

    for p in paragraphs:
        p = p.strip()
        if not p:
            continue

        # parágrafo gigante: corta
        if len(p) > chunk_size:
            flush()
            start = 0
            while start < len(p):
                end = min(len(p), start + chunk_size)
                body = normalize_ws(p[start:end])
                if len(body) >= 200:
                    text = normalize_ws(ctx_prefix + "\n\n" + body)
                    chunks.append({"text": text})
                start = end - overlap if overlap > 0 else end
            continue

        if buf_len + len(p) + 2 <= chunk_size:
            buf.append(p)
            buf_len += len(p) + 2
        else:
            flush()
            buf = [p]
            buf_len = len(p)

    flush()
    return chunks


# =========================
# Extraction (PDF streaming + EPUB/MD/TXT)
# =========================
def read_text_file(file_path: Path) -> str:
    return normalize_ws(file_path.read_text(encoding="utf-8", errors="ignore"))


def read_epub_text(file_path: Path) -> str:
    from ebooklib import epub, ITEM_DOCUMENT  # type: ignore
    from bs4 import BeautifulSoup  # type: ignore

    book = epub.read_epub(str(file_path))
    parts: List[str] = []
    for it in book.get_items():
        if it.get_type() != ITEM_DOCUMENT:
            continue
        soup = BeautifulSoup(it.get_content(), "html.parser")
        t = soup.get_text(separator="\n")
        t = drop_noise(t)
        if t:
            parts.append(t)

    out = drop_noise("\n\n".join(parts))
    if not out:
        raise AirflowFailException(f"EPUB sem texto extraível: {file_path.name}")
    return out


def read_pdf_paragraphs_streaming(file_path: Path) -> List[str]:
    """
    PDF page streaming: extrai página a página, aplica limpeza e vira lista de parágrafos.
    Evita juntar o livro inteiro numa string gigante.
    """
    from pypdf import PdfReader  # lazy

    reader = PdfReader(str(file_path))
    paragraphs: List[str] = []
    page_count = len(reader.pages)

    for i, page in enumerate(reader.pages):
        try:
            t = page.extract_text() or ""
        except Exception:
            t = ""
        t = drop_noise(t)
        if len(t) < 200:
            continue

        # separa em "parágrafos" por blocos de linha vazia
        ps = [p.strip() for p in t.split("\n\n") if p.strip()]
        for p in ps:
            if len(p) >= 80:
                paragraphs.append(p)

        if (i + 1) % 25 == 0:
            print(f"PDF progress: {file_path.name} page {i+1}/{page_count} paragraphs={len(paragraphs)}")

        # corte opcional de bibliografia/index no final (heurística leve)
        if i > max(10, page_count - 15):
            tail = " ".join(ps[:2]).lower()
            if "references" in tail or "bibliograph" in tail or "index" in tail:
                print(f"PDF tail stop heuristic triggered at page {i+1}/{page_count}")
                break

    if not paragraphs:
        raise AirflowFailException(f"PDF sem texto extraível: {file_path.name}")
    return paragraphs


def extract_paragraphs(file_path: Path) -> List[str]:
    ext = file_path.suffix.lower()
    if ext == ".pdf":
        return read_pdf_paragraphs_streaming(file_path)
    if ext in [".md", ".markdown", ".txt"]:
        txt = drop_noise(read_text_file(file_path))
        return [p.strip() for p in txt.split("\n\n") if p.strip()]
    if ext == ".epub":
        txt = drop_noise(read_epub_text(file_path))
        return [p.strip() for p in txt.split("\n\n") if p.strip()]
    raise AirflowFailException(f"Formato não suportado: {file_path.name}")


# =========================
# Embeddings (cache + controlled concurrency)
# =========================
def embed_cache_path(model: str, chunk_hash: str) -> Path:
    return CACHE_DIR / "embeddings" / model / f"{chunk_hash}.json"


def load_embedding_from_cache(model: str, chunk_hash: str) -> Optional[List[float]]:
    if not EMBED_CACHE:
        return None
    p = embed_cache_path(model, chunk_hash)
    if not p.exists():
        return None
    try:
        obj = json.loads(p.read_text(encoding="utf-8"))
        emb = obj.get("embedding")
        if isinstance(emb, list) and emb:
            return emb
    except Exception:
        return None
    return None


def save_embedding_to_cache(model: str, chunk_hash: str, embedding: List[float]) -> None:
    if not EMBED_CACHE:
        return
    p = embed_cache_path(model, chunk_hash)
    p.parent.mkdir(parents=True, exist_ok=True)
    write_json(p, {"model": model, "chunk_hash": chunk_hash, "embedding": embedding})


def ollama_embed_one(text: str, model: str) -> List[float]:
    r = requests.post(
        f"{OLLAMA_BASE_URL}/api/embeddings",
        json={"model": model, "prompt": text},
        timeout=EMBED_TIMEOUT_SEC,
    )
    if r.status_code != 200:
        raise AirflowFailException(f"Ollama embeddings falhou: {r.status_code} {r.text[:400]}")
    data = r.json()
    emb = data.get("embedding")
    if not isinstance(emb, list) or not emb:
        raise AirflowFailException("Ollama embeddings retornou vetor inválido")
    return emb


def embed_texts_with_cache(texts: List[str], model: str, chunk_hashes: List[str]) -> List[List[float]]:
    """
    Embeds com cache + concorrência controlada.
    Mantém ordem de entrada.
    """
    from concurrent.futures import ThreadPoolExecutor, as_completed

    assert len(texts) == len(chunk_hashes)
    out: List[Optional[List[float]]] = [None] * len(texts)

    # 1) tenta cache
    missing: List[int] = []
    for i, h in enumerate(chunk_hashes):
        emb = load_embedding_from_cache(model, h)
        if emb is not None:
            out[i] = emb
        else:
            missing.append(i)

    if not missing:
        return [x for x in out if x is not None]  # type: ignore

    print(f"Embeddings: cache hit={len(texts)-len(missing)} missing={len(missing)} model={model}")

    # 2) embed missing com pool
    def work(idx: int) -> Tuple[int, List[float]]:
        emb = ollama_embed_one(texts[idx], model=model)
        save_embedding_to_cache(model, chunk_hashes[idx], emb)
        return idx, emb

    with ThreadPoolExecutor(max_workers=max(1, EMBED_CONCURRENCY)) as ex:
        futures = [ex.submit(work, idx) for idx in missing]
        done = 0
        total = len(missing)
        for f in as_completed(futures):
            idx, emb = f.result()
            out[idx] = emb
            done += 1
            if done % 25 == 0 or done == total:
                print(f"Embedding progress: {done}/{total}")

    return [x for x in out if x is not None]  # type: ignore


# =========================
# Qdrant
# =========================
def qdrant_client():
    from qdrant_client import QdrantClient  # type: ignore
    return QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)


def ensure_collection(client, name: str, vector_size: int):
    from qdrant_client.http import models as qmodels  # type: ignore
    existing = [c.name for c in client.get_collections().collections]
    if name in existing:
        return
    client.create_collection(
        collection_name=name,
        vectors_config=qmodels.VectorParams(size=vector_size, distance=qmodels.Distance.COSINE),
    )


# =========================
# Learning base templates
# =========================
def phase_blueprint() -> Dict[str, Any]:
    return {
        "schema_version": 1,
        "tracks": [
            {
                "phase": "1-discovery/1.1-inception",
                "outcomes": [
                    "Definir problema, objetivos e métricas de sucesso",
                    "Identificar stakeholders e atores",
                    "Mapear eventos do domínio e linguagem ubíqua",
                    "Gerar requisitos iniciais e critérios de aceite verificáveis",
                ],
                "agent_roles": ["Gertrudes", "Corrinha", "Creuza"],
            },
            {
                "phase": "1-discovery/1.2-elaboration",
                "outcomes": [
                    "Refinar requisitos, restrições, suposições e riscos",
                    "Propor limites de domínio e contratos",
                    "Definir critérios testáveis e rastreabilidade",
                ],
                "agent_roles": ["Gertrudes", "Corrinha"],
            },
            {
                "phase": "2-delivery/2.1-planning",
                "outcomes": [
                    "Quebrar em slices verticais",
                    "Definir backlog priorizado",
                    "Especificar contratos e critérios de aceite",
                ],
                "agent_roles": ["Corrinha"],
            },
            {
                "phase": "2-delivery/2.2-refinement",
                "outcomes": [
                    "Extrair Event Storming",
                    "Preparar base de eventos para ODD",
                    "Refinar contratos e observabilidade",
                ],
                "agent_roles": ["Creuza"],
            },
        ],
    }


def default_rubrics_by_specialty(specialty: str) -> Dict[str, Any]:
    return {
        "schema_version": 1,
        "specialty": specialty,
        "rubrics": [
            {"id": "clarity", "checks": ["Sem termos vagos", "Termos definidos quando necessários"]},
            {"id": "verifiability", "checks": ["Critério observável ou testável", "Condições de sucesso e falha claras"]},
            {"id": "atomicity", "checks": ["Uma intenção por item", "Sem conjunções escondendo múltiplos itens"]},
            {"id": "traceability", "checks": ["Referenciar arquivo e chunk_id quando usado"]},
        ],
    }


# =========================
# DAG
# =========================
default_args = {"owner": "odd", "retries": 1, "retry_delay": timedelta(minutes=2)}

with DAG(
    dag_id="library_compiler_learning_base",
    default_args=default_args,
    description="Compila biblioteca local em base de conhecimento (chunk hierárquico + cache embeddings + qdrant payload leve)",
    start_date=datetime(2025, 1, 1),
    schedule_interval=None,
    catchup=False,
    max_active_runs=1,
    tags=["library", "ollama", "qdrant", "packs"],
) as dag:

    @task
    def validate_environment() -> Dict[str, Any]:
        ensure_dirs()

        r = requests.get(f"{OLLAMA_BASE_URL}/api/tags", timeout=30)
        if r.status_code != 200:
            raise AirflowFailException(f"Ollama indisponível em {OLLAMA_BASE_URL} ({r.status_code})")

        _ = qdrant_client().get_collections()

        if not RAW_DIR.exists():
            raise AirflowFailException(f"Pasta RAW não existe: {RAW_DIR}")

        return {
            "raw_dir": str(RAW_DIR),
            "processed_dir": str(PROCESSED_DIR),
            "packs_dir": str(PACKS_DIR),
            "embed_model": OLLAMA_EMBED_MODEL,
        }

    @task
    def discover_books(env: Dict[str, Any]) -> List[Dict[str, Any]]:
        allowed = {".pdf", ".md", ".markdown", ".txt", ".epub"}
        items: List[Dict[str, Any]] = []

        for specialty_dir in sorted([p for p in RAW_DIR.iterdir() if p.is_dir()]):
            specialty = specialty_dir.name.strip()
            for f in sorted(specialty_dir.rglob("*")):
                if f.is_file() and f.suffix.lower() in allowed:
                    items.append(
                        {
                            "specialty": specialty,
                            "file": str(f),
                            "fingerprint": file_fingerprint(f),
                            "name": f.name,
                            "ext": f.suffix.lower(),
                        }
                    )

        if not items:
            raise AirflowFailException(f"Nenhum livro encontrado em {RAW_DIR}/<specialty>/")

        write_json(CACHE_DIR / "discovered_books.json", {"items": items, "at": datetime.utcnow().isoformat() + "Z"})
        return items

    @task
    def process_one_book(book: Dict[str, Any]) -> Dict[str, Any]:
        specialty = book["specialty"]
        file_path = Path(book["file"])
        fp = book["fingerprint"]
        ext = file_path.suffix.lower()

        t0 = time.time()
        print(f"Processing: specialty={specialty} file={file_path.name} ext={ext}")

        paragraphs = extract_paragraphs(file_path)
        paragraphs = [p for p in paragraphs if len(p) >= 80]
        if not paragraphs:
            raise AirflowFailException(f"Nenhum parágrafo útil extraído em {file_path.name}")

        # Detecta seções (heurística) e gera chunks por seção, com prefixo de contexto
        sections = detect_sections(paragraphs)
        chunks_out: List[Dict[str, Any]] = []

        for sec_title, sec_paras in sections:
            ctx = (
                f"source: {file_path.name}\n"
                f"specialty: {specialty}\n"
                f"section: {sec_title}"
            )
            sec_chunks = chunk_by_paragraphs(
                sec_paras,
                chunk_size=DEFAULT_CHUNK_SIZE,
                overlap=DEFAULT_OVERLAP,
                ctx_prefix=ctx,
            )
            for c in sec_chunks:
                c["meta"] = {"section": sec_title}
            chunks_out.extend(sec_chunks)

        if not chunks_out:
            raise AirflowFailException(f"Nenhum chunk gerado em {file_path.name}")

        doc_id = sha256(f"{specialty}|{file_path.name}|{fp}")
        out_path = PROCESSED_DIR / specialty / f"{doc_id}.json"

        # Chunk ids estáveis
        chunks_payload = []
        for i, c in enumerate(chunks_out):
            text = c["text"]
            chunk_hash = sha256(doc_id + ":" + sha256(text))
            chunks_payload.append(
                {
                    "i": i,
                    "chunk_id": sha256(doc_id + ":" + str(i)),
                    "chunk_hash": chunk_hash,  # usado para cache embeddings
                    "text": text,
                    "meta": c.get("meta", {}),
                }
            )

        payload = {
            "specialty": specialty,
            "doc_id": doc_id,
            "file": str(file_path),
            "name": file_path.name,
            "fingerprint": fp,
            "format": ext,
            "chunk_size": DEFAULT_CHUNK_SIZE,
            "chunk_overlap": DEFAULT_OVERLAP,
            "chunks": chunks_payload,
            "processed_at": datetime.utcnow().isoformat() + "Z",
        }
        write_json(out_path, payload)

        dt = time.time() - t0
        print(f"Processed OK: {file_path.name} chunks={len(chunks_payload)} out={out_path} dt={dt:.1f}s")
        return {"specialty": specialty, "doc_id": doc_id, "processed_path": str(out_path), "chunks_count": len(chunks_payload)}

    @task
    def index_one_book(processed: Dict[str, Any]) -> Dict[str, Any]:
        from qdrant_client.http import models as qmodels  # type: ignore

        specialty = processed["specialty"]
        processed_path = Path(processed["processed_path"])
        obj = json.loads(processed_path.read_text(encoding="utf-8"))

        collection = f"{COLLECTION_PREFIX}{specialty}"
        chunks = obj["chunks"]

        texts = [c["text"] for c in chunks]
        chunk_hashes = [c["chunk_hash"] for c in chunks]

        t0 = time.time()
        vectors = embed_texts_with_cache(texts, model=OLLAMA_EMBED_MODEL, chunk_hashes=chunk_hashes)
        vector_size = len(vectors[0])

        client = qdrant_client()
        ensure_collection(client, collection, vector_size)

        points: List[qmodels.PointStruct] = []
        for i, (c, v) in enumerate(zip(chunks, vectors)):
            # id numérico estável
            pid = int(hashlib.sha256((obj["doc_id"] + ":" + str(i)).encode("utf-8")).hexdigest()[:16], 16)
            preview = c["text"][:QDRANT_TEXT_PREVIEW_CHARS]

            payload = {
                "specialty": specialty,
                "doc_id": obj["doc_id"],
                "chunk_id": c["chunk_id"],
                "chunk_index": c["i"],
                "chunk_hash": c["chunk_hash"],
                "file": obj["file"],
                "name": obj["name"],
                "section": (c.get("meta") or {}).get("section", "untitled"),
                "preview": preview,
                "embed_model": OLLAMA_EMBED_MODEL,
                "indexed_at": datetime.utcnow().isoformat() + "Z",
            }
            if QDRANT_STORE_FULL_TEXT:
                payload["text"] = c["text"]

            points.append(qmodels.PointStruct(id=pid, vector=v, payload=payload))

        # Upsert em batches
        for start in range(0, len(points), BATCH_UPSERT):
            batch = points[start:start + BATCH_UPSERT]
            client.upsert(collection_name=collection, points=batch)
            print(f"Upsert progress: {obj['name']} {min(start+BATCH_UPSERT, len(points))}/{len(points)}")

        dt = time.time() - t0
        print(f"Indexed OK: collection={collection} points={len(points)} doc={obj['name']} dt={dt:.1f}s")
        return {"specialty": specialty, "doc_id": obj["doc_id"], "collection": collection, "points": len(points)}

    @task
    def build_knowledge_packs(indexed_results: List[Dict[str, Any]]) -> Dict[str, Any]:
        by_spec: Dict[str, List[Dict[str, Any]]] = {}
        for r in indexed_results:
            by_spec.setdefault(r["specialty"], []).append(r)

        write_json(PACKS_DIR / "_learning_base" / "learning_base.json", phase_blueprint())

        packs_built: List[Dict[str, Any]] = []
        for specialty, items in sorted(by_spec.items()):
            pack_root = PACKS_DIR / specialty
            prompts_dir = pack_root / "prompts"
            prompts_dir.mkdir(parents=True, exist_ok=True)

            collection = f"{COLLECTION_PREFIX}{specialty}"
            pack = {
                "schema_version": 2,
                "specialty": specialty,
                "created_at": datetime.utcnow().isoformat() + "Z",
                "qdrant_collection": collection,
                "embed_model": OLLAMA_EMBED_MODEL,
                "qdrant_payload": {
                    "stores_full_text": QDRANT_STORE_FULL_TEXT,
                    "preview_chars": QDRANT_TEXT_PREVIEW_CHARS,
                    "source_of_truth": "processed_json",
                    "processed_dir": str((PROCESSED_DIR / specialty).resolve()),
                },
                "docs_indexed": [{"doc_id": it["doc_id"], "points": it["points"]} for it in items],
                "learning_base_ref": str((PACKS_DIR / "_learning_base" / "learning_base.json").resolve()),
            }

            rubrics = default_rubrics_by_specialty(specialty)
            system_prompt = (
                f"Você é um agente especialista em {specialty}.\n"
                f"Use RAG com Qdrant na coleção {collection}.\n"
                "O payload contém preview e ponteiros (doc_id/chunk_id/chunk_index).\n"
                "Quando precisar do texto completo, leia do processed JSON local (source of truth).\n"
                "Produza saídas estruturadas, rastreáveis e aplique rubricas.\n"
            )

            write_json(pack_root / "pack.json", pack)
            write_json(pack_root / "rubrics.json", rubrics)
            write_text(prompts_dir / "system.txt", system_prompt)

            packs_built.append({"specialty": specialty, "pack_path": str(pack_root)})

        return {
            "packs_built": packs_built,
            "learning_base": str((PACKS_DIR / "_learning_base" / "learning_base.json").resolve()),
        }

    @task
    def smoke_test(packs_info: Dict[str, Any]) -> str:
        client = qdrant_client()
        for p in packs_info["packs_built"]:
            specialty = p["specialty"]
            collection = f"{COLLECTION_PREFIX}{specialty}"

            # query curta para teste
            q = f"Conceitos fundamentais de {specialty}"
            q_hash = sha256("query:" + q)
            q_emb = load_embedding_from_cache(OLLAMA_EMBED_MODEL, q_hash)
            if q_emb is None:
                q_emb = ollama_embed_one(q, OLLAMA_EMBED_MODEL)
                save_embedding_to_cache(OLLAMA_EMBED_MODEL, q_hash, q_emb)

            res = client.search(collection_name=collection, query_vector=q_emb, limit=3, with_payload=True)
            if not res:
                raise AirflowFailException(f"Smoke test falhou: coleção {collection} sem resultados")
            top = res[0].payload.get("name")
            print(f"Smoke OK {collection} top={top}")
        return "OK"

    env = validate_environment()
    books = discover_books(env)
    processed = process_one_book.expand(book=books)
    indexed = index_one_book.expand(processed=processed)
    packs = build_knowledge_packs(indexed)
    smoke_test(packs)