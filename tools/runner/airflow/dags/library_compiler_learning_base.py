# tools/runner/airflow/dags/library_compiler_learning_base.py
"""
Library Compiler - Base de conhecimento 2 níveis (coarse+fine), cache embeddings e Qdrant
- Paralelismo por livro + por shard (fine)
- Coarse robusto (input truncado + preview composition) para evitar 500 no Ollama
- Retry com backoff para embeddings
"""

from __future__ import annotations

import hashlib
import json
import logging
import os
import re
import time
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, Iterable, List, Optional, Tuple

import requests
from airflow import DAG
from airflow.decorators import task
from airflow.exceptions import AirflowFailException
from airflow.utils.dates import days_ago

# -----------------------------
# Config via env
# -----------------------------
LIBRARY_ROOT = Path(os.environ.get("LIBRARY_ROOT", "/opt/library"))
LIBRARY_RAW = Path(os.environ.get("LIBRARY_RAW", str(LIBRARY_ROOT / "raw")))
LIBRARY_PROCESSED = Path(os.environ.get("LIBRARY_PROCESSED", str(LIBRARY_ROOT / "processed")))
LIBRARY_PACKS = Path(os.environ.get("LIBRARY_PACKS", str(LIBRARY_ROOT / "packs")))
LIBRARY_CACHE = Path(os.environ.get("LIBRARY_CACHE", str(LIBRARY_ROOT / "cache")))

PRODUCTS_ROOT = Path(os.environ.get("PRODUCTS_ROOT", "/opt/products"))

OLLAMA_BASE_URL = os.environ.get("OLLAMA_BASE_URL", "http://ollama:11434")
OLLAMA_EMBED_MODEL = os.environ.get("OLLAMA_EMBED_MODEL", "nomic-embed-text")

# Robustez Ollama
OLLAMA_RETRIES = int(os.environ.get("OLLAMA_RETRIES", "5"))
OLLAMA_RETRY_BACKOFF_SEC = float(os.environ.get("OLLAMA_RETRY_BACKOFF_SEC", "2.0"))
OLLAMA_CONNECT_TIMEOUT_SEC = float(os.environ.get("OLLAMA_CONNECT_TIMEOUT_SEC", "10.0"))

# Limite de chars enviados pro embeddings (mitiga 500)
MAX_EMBED_CHARS = int(os.environ.get("MAX_EMBED_CHARS", "8000"))
# Para coarse, um limite um pouco menor costuma ser mais estável
MAX_COARSE_EMBED_CHARS = int(os.environ.get("MAX_COARSE_EMBED_CHARS", str(min(MAX_EMBED_CHARS, 7000))))

QDRANT_HOST = os.environ.get("QDRANT_HOST", "qdrant")
QDRANT_PORT = int(os.environ.get("QDRANT_PORT", "6333"))
COLLECTION_PREFIX = os.environ.get("QDRANT_COLLECTION_PREFIX", "odd__")

FINE_CHUNK_SIZE = int(os.environ.get("FINE_CHUNK_SIZE", os.environ.get("CHUNK_SIZE", "3500")))
FINE_CHUNK_OVERLAP = int(os.environ.get("FINE_CHUNK_OVERLAP", os.environ.get("CHUNK_OVERLAP", "350")))

COARSE_WINDOW = int(os.environ.get("COARSE_WINDOW", "3"))
COARSE_STRIDE = int(os.environ.get("COARSE_STRIDE", "2"))

EMBED_CONCURRENCY = int(os.environ.get("EMBED_CONCURRENCY", "2"))
EMBED_TIMEOUT_SEC = int(os.environ.get("EMBED_TIMEOUT_SEC", "900"))
EMBED_CACHE = os.environ.get("EMBED_CACHE", "true").lower() == "true"

QDRANT_UPSERT_BATCH = int(os.environ.get("QDRANT_UPSERT_BATCH", "128"))
QDRANT_STORE_FULL_TEXT = os.environ.get("QDRANT_STORE_FULL_TEXT", "false").lower() == "true"
QDRANT_TEXT_PREVIEW_CHARS = int(os.environ.get("QDRANT_TEXT_PREVIEW_CHARS", "600"))

# Sharding
FINE_SHARD_SIZE = int(os.environ.get("FINE_SHARD_SIZE", "256"))
FINE_INDEX_BATCH = int(os.environ.get("FINE_INDEX_BATCH", "64"))

# PDF progress
PDF_PROGRESS_EVERY_PAGES = int(os.environ.get("PDF_PROGRESS_EVERY_PAGES", "25"))

LOG_LEVEL = os.environ.get("LIBRARY_LOG_LEVEL", "INFO").upper()
logger = logging.getLogger("library_compiler_learning_base")
logger.setLevel(LOG_LEVEL)

SUPPORTED_EXT = {".pdf", ".epub"}
SECTION_RE = re.compile(r"^(chapter|cap[ií]tulo|parte|part|section|se[cç][aã]o)\b", re.IGNORECASE)


# -----------------------------
# Utils
# -----------------------------
def sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def now_utc() -> str:
    return datetime.utcnow().isoformat() + "Z"


def ensure_dir(p: Path) -> None:
    p.mkdir(parents=True, exist_ok=True)


def write_json(path: Path, obj: Any) -> None:
    ensure_dir(path.parent)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def append_jsonl(path: Path, obj: Any) -> None:
    ensure_dir(path.parent)
    with path.open("a", encoding="utf-8") as f:
        f.write(json.dumps(obj, ensure_ascii=False) + "\n")


def iter_jsonl(path: Path) -> Iterable[Dict[str, Any]]:
    with path.open("r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line:
                continue
            yield json.loads(line)


def human_mb(n_bytes: int) -> str:
    return f"{(n_bytes / 1024 / 1024):.1f}MB"


def file_size(path: Path) -> int:
    try:
        return path.stat().st_size
    except FileNotFoundError:
        return 0


def normalize_ws(s: str) -> str:
    s = s.replace("\u00a0", " ")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def stable_int_id(key: str) -> int:
    return int(hashlib.sha256(key.encode("utf-8")).hexdigest()[:16], 16)


def truncate_middle(text: str, max_chars: int) -> str:
    """
    Corta mantendo head+tail (melhor que só head) para embeddings.
    """
    if max_chars <= 0:
        return ""
    if len(text) <= max_chars:
        return text
    head = max_chars // 2
    tail = max_chars - head - 40
    if tail < 200:
        # fallback: só head
        return text[:max_chars]
    return text[:head] + "\n\n...<TRUNCATED>...\n\n" + text[-tail:]


def safe_embed_input(text: str, max_chars: int) -> str:
    text = normalize_ws(text)
    return truncate_middle(text, max_chars=max_chars)


# -----------------------------
# EPUB reader (robusto)
# -----------------------------
def read_epub_text(path: Path) -> List[str]:
    try:
        from ebooklib import epub as epub_mod  # type: ignore
        try:
            from ebooklib import ITEM_DOCUMENT  # type: ignore
            item_document = ITEM_DOCUMENT
        except Exception:
            item_document = getattr(epub_mod, "ITEM_DOCUMENT", None)
        from bs4 import BeautifulSoup  # type: ignore
    except Exception as e:
        raise AirflowFailException(f"Falha import EPUB deps: {e}")

    book = epub_mod.read_epub(str(path))
    paras: List[str] = []

    for it in book.get_items():
        is_doc = False
        if item_document is not None:
            try:
                is_doc = (it.get_type() == item_document)
            except Exception:
                is_doc = False
        if not is_doc:
            mt = getattr(it, "media_type", "") or ""
            if "html" in mt:
                is_doc = True
        if not is_doc:
            continue

        content = it.get_content()
        if not content:
            continue

        soup = BeautifulSoup(content, "html.parser")
        for tag in soup.find_all(["p", "li", "h1", "h2", "h3", "h4"]):
            text = normalize_ws(tag.get_text(" "))
            if text and len(text) >= 40:
                paras.append(text)

    return paras


# -----------------------------
# PDF reader
# -----------------------------
def read_pdf_paragraphs(path: Path) -> List[str]:
    try:
        from pypdf import PdfReader  # type: ignore
    except Exception as e:
        raise AirflowFailException(f"Falha import pypdf: {e}")

    t0 = time.time()
    reader = PdfReader(str(path))
    total_pages = len(reader.pages)
    paras: List[str] = []
    last_log = 0

    for i, page in enumerate(reader.pages, start=1):
        text = page.extract_text() or ""
        text = normalize_ws(text)
        if text:
            parts = re.split(r"\n{2,}|\.\s{2,}", text)
            for p in parts:
                p = normalize_ws(p)
                if len(p) >= 60:
                    paras.append(p)

        if i - last_log >= PDF_PROGRESS_EVERY_PAGES:
            last_log = i
            logger.info(
                "PDF progress: %s page %d/%d paragraphs=%d elapsed=%.1fs",
                path.name, i, total_pages, len(paras), (time.time() - t0),
            )

    logger.info(
        "PDF done: %s pages=%d paragraphs=%d total_elapsed=%.1fs",
        path.name, total_pages, len(paras), (time.time() - t0),
    )
    return paras


def extract_paragraphs(path: Path) -> List[str]:
    ext = path.suffix.lower()
    if ext == ".pdf":
        return read_pdf_paragraphs(path)
    if ext == ".epub":
        return read_epub_text(path)
    raise AirflowFailException(f"Formato não suportado: {ext}")


# -----------------------------
# Chunking por parágrafos
# -----------------------------
def chunk_by_paragraphs(
    paragraphs: List[str],
    chunk_size: int,
    overlap: int,
    ctx_prefix: Optional[str] = None,
) -> List[Dict[str, Any]]:
    if chunk_size <= 0:
        raise AirflowFailException("chunk_size inválido")

    chunks: List[Dict[str, Any]] = []
    buf: List[str] = []
    buf_len = 0

    def flush():
        nonlocal buf, buf_len
        if not buf:
            return
        text = "\n\n".join(buf)
        text = normalize_ws(text)
        if ctx_prefix:
            text = f"{ctx_prefix}\n\n{text}"
        if len(text) >= 200:
            chunks.append({"text": text})
        if overlap > 0 and len(text) > overlap:
            tail = text[-overlap:]
            buf = [tail]
            buf_len = len(tail)
        else:
            buf = []
            buf_len = 0

    for p in paragraphs:
        p = normalize_ws(p)
        if not p:
            continue
        if buf_len + len(p) + 2 > chunk_size:
            flush()
        buf.append(p)
        buf_len += len(p) + 2

    flush()
    return chunks


def detect_sections(paragraphs: List[str]) -> List[Tuple[str, List[str]]]:
    sections: List[Tuple[str, List[str]]] = []
    current_title = "untitled"
    current: List[str] = []

    for p in paragraphs:
        if len(p) <= 120 and SECTION_RE.match(p.strip()):
            if current:
                sections.append((current_title, current))
            current_title = p.strip()[:120]
            current = []
            continue
        current.append(p)

    if current:
        sections.append((current_title, current))

    if len(sections) == 0:
        return [("untitled", paragraphs)]
    return sections


# -----------------------------
# Descoberta de livros
# -----------------------------
def fingerprint_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        while True:
            b = f.read(1024 * 1024)
            if not b:
                break
            h.update(b)
    return h.hexdigest()


def discover_raw_books(raw_root: Path) -> List[Dict[str, Any]]:
    books: List[Dict[str, Any]] = []
    if not raw_root.exists():
        return books

    for specialty_dir in sorted([p for p in raw_root.iterdir() if p.is_dir()]):
        specialty = specialty_dir.name
        for f in sorted(specialty_dir.iterdir()):
            if not f.is_file():
                continue
            ext = f.suffix.lower()
            if ext not in SUPPORTED_EXT:
                continue
            fp = fingerprint_file(f)
            books.append(
                {
                    "specialty": specialty,
                    "file": str(f),
                    "name": f.name,
                    "ext": ext,
                    "fingerprint": fp,
                    "size_bytes": file_size(f),
                }
            )
    return books


# -----------------------------
# Embeddings (Ollama) com cache + retry/backoff + truncation
# -----------------------------
def embed_cache_path(model: str, chunk_hash: str) -> Path:
    safe_model = model.replace("/", "_").replace(":", "_")
    return LIBRARY_CACHE / "embeddings" / safe_model / f"{chunk_hash}.json"


def load_cached_embedding(model: str, chunk_hash: str) -> Optional[List[float]]:
    if not EMBED_CACHE:
        return None
    p = embed_cache_path(model, chunk_hash)
    if not p.exists():
        return None
    try:
        obj = json.loads(p.read_text(encoding="utf-8"))
        v = obj.get("embedding")
        if isinstance(v, list) and v:
            return v
    except Exception:
        return None
    return None


def save_cached_embedding(model: str, chunk_hash: str, embedding: List[float]) -> None:
    if not EMBED_CACHE:
        return
    p = embed_cache_path(model, chunk_hash)
    ensure_dir(p.parent)
    tmp = p.with_suffix(".tmp")
    tmp.write_text(json.dumps({"embedding": embedding}, ensure_ascii=False), encoding="utf-8")
    tmp.replace(p)


def _ollama_post_embeddings(prompt: str, model: str, timeout_sec: int) -> List[float]:
    url = f"{OLLAMA_BASE_URL.rstrip('/')}/api/embeddings"
    r = requests.post(
        url,
        json={"model": model, "prompt": prompt},
        timeout=(OLLAMA_CONNECT_TIMEOUT_SEC, timeout_sec),
    )
    if r.status_code >= 400:
        # log útil sem spammar tudo
        snippet = (r.text or "")[:400]
        raise requests.HTTPError(f"HTTP {r.status_code} from ollama embeddings. body_snippet={snippet}", response=r)
    j = r.json()
    emb = j.get("embedding")
    if not isinstance(emb, list) or len(emb) == 0:
        raise AirflowFailException("Embedding inválido retornado pelo Ollama")
    return emb


def ollama_embed_one_with_retry(text: str, model: str, timeout_sec: int, max_chars: int) -> List[float]:
    """
    - normaliza + trunca entrada
    - retry com backoff em 500/429/503/timeout
    """
    prompt = safe_embed_input(text, max_chars=max_chars)
    last_err: Optional[Exception] = None

    for attempt in range(1, OLLAMA_RETRIES + 1):
        try:
            return _ollama_post_embeddings(prompt=prompt, model=model, timeout_sec=timeout_sec)
        except Exception as e:
            last_err = e
            # backoff
            wait = OLLAMA_RETRY_BACKOFF_SEC * (2 ** (attempt - 1))
            wait = min(wait, 30.0)
            logger.warning(
                "Ollama embed failed (attempt %d/%d). len=%d max=%d err=%s. sleeping %.1fs",
                attempt, OLLAMA_RETRIES, len(prompt), max_chars, repr(e), wait
            )
            time.sleep(wait)

    raise AirflowFailException(
        f"Ollama embeddings failed after {OLLAMA_RETRIES} attempts. "
        f"prompt_len={len(prompt)} model={model} last_err={repr(last_err)}"
    )


def embed_texts_with_cache(texts: List[str], model: str, hashes: List[str], max_chars: int) -> List[List[float]]:
    if len(texts) != len(hashes):
        raise AirflowFailException("texts/hashes mismatch")

    vectors: List[Optional[List[float]]] = [None] * len(texts)
    missing_idx: List[int] = []

    for i, h in enumerate(hashes):
        v = load_cached_embedding(model, h)
        if v is not None:
            vectors[i] = v
        else:
            missing_idx.append(i)

    # embeddings faltantes: sequencial por batch para controlar RAM/CPU no Ollama
    if missing_idx:
        for start in range(0, len(missing_idx), FINE_INDEX_BATCH):
            batch_indices = missing_idx[start : start + FINE_INDEX_BATCH]
            for idx in batch_indices:
                vec = ollama_embed_one_with_retry(
                    text=texts[idx],
                    model=model,
                    timeout_sec=EMBED_TIMEOUT_SEC,
                    max_chars=max_chars,
                )
                vectors[idx] = vec
                save_cached_embedding(model, hashes[idx], vec)

    return [v for v in vectors if v is not None]  # type: ignore


# -----------------------------
# Qdrant helpers
# -----------------------------
def qdrant_client():
    try:
        from qdrant_client import QdrantClient  # type: ignore
    except Exception as e:
        raise AirflowFailException(f"Falha import qdrant-client: {e}")
    return QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)


def ensure_collection(client, name: str, vector_size: int) -> None:
    try:
        from qdrant_client.http import models as qmodels  # type: ignore
    except Exception as e:
        raise AirflowFailException(f"Falha import qdrant models: {e}")

    collections = client.get_collections().collections
    exists = any(c.name == name for c in collections)
    if not exists:
        logger.info("Creating Qdrant collection: %s (size=%d)", name, vector_size)
        client.create_collection(
            collection_name=name,
            vectors_config=qmodels.VectorParams(size=vector_size, distance=qmodels.Distance.COSINE),
        )
        return

    info = client.get_collection(name)
    size = info.config.params.vectors.size
    if size != vector_size:
        raise AirflowFailException(f"Collection {name} vector size mismatch: {size} != {vector_size}")


# -----------------------------
# Processing / sharding
# -----------------------------
def shard_fine_jsonl(fine_jsonl: Path, shard_size: int) -> List[Path]:
    shard_paths: List[Path] = []
    ensure_dir(fine_jsonl.parent)

    # limpa shards anteriores
    for p in fine_jsonl.parent.glob(f"{fine_jsonl.stem}.shard_*.jsonl"):
        try:
            p.unlink()
        except Exception:
            pass

    idx = 0
    shard_idx = 0
    current_path = fine_jsonl.parent / f"{fine_jsonl.stem}.shard_{shard_idx:04d}.jsonl"

    for obj in iter_jsonl(fine_jsonl):
        if idx % shard_size == 0 and idx != 0:
            shard_paths.append(current_path)
            shard_idx += 1
            current_path = fine_jsonl.parent / f"{fine_jsonl.stem}.shard_{shard_idx:04d}.jsonl"
        append_jsonl(current_path, obj)
        idx += 1

    if idx > 0:
        shard_paths.append(current_path)

    return shard_paths


def build_coarse_text_from_fine_parts(
    fine_parts: List[str],
    max_chars: int,
) -> str:
    """
    Coarse robusto:
    - Em vez de concatenar tudo bruto, cria um texto compacto:
      head do primeiro + previews intermediários + tail do último
    - Mantém contexto suficiente para recall sem estourar limite do Ollama.
    """
    if not fine_parts:
        return ""

    # previews por parte
    previews = []
    for p in fine_parts[:8]:
        p = normalize_ws(p)
        previews.append(p[: min(260, len(p))])
    if len(fine_parts) > 8:
        previews.append(f"... +{len(fine_parts) - 8} chunks ...")
        tail_preview = normalize_ws(fine_parts[-1])
        previews.append(tail_preview[: min(300, len(tail_preview))])

    coarse = "\n\n".join(previews)
    coarse = normalize_ws(coarse)
    return truncate_middle(coarse, max_chars=max_chars)


# -----------------------------
# DAG
# -----------------------------
default_args = {"owner": "odd", "retries": 1}

with DAG(
    dag_id="library_compiler_learning_base",
    description="Compila livros (raw) em base de conhecimento (processed + Qdrant coarse/fine), com cache e paralelismo",
    default_args=default_args,
    start_date=days_ago(1),
    schedule_interval=None,
    catchup=False,
    max_active_runs=1,
    tags=["odd", "library", "knowledge-base"],
) as dag:

    @task
    def validate_environment() -> Dict[str, Any]:
        ensure_dir(LIBRARY_RAW)
        ensure_dir(LIBRARY_PROCESSED)
        ensure_dir(LIBRARY_PACKS)
        ensure_dir(LIBRARY_CACHE)
        ensure_dir(PRODUCTS_ROOT)

        # Checa Ollama com retry leve
        last = None
        for attempt in range(1, 6):
            try:
                r = requests.get(
                    f"{OLLAMA_BASE_URL.rstrip('/')}/api/tags",
                    timeout=(OLLAMA_CONNECT_TIMEOUT_SEC, 10),
                )
                r.raise_for_status()
                break
            except Exception as e:
                last = e
                time.sleep(min(2 ** (attempt - 1), 10))
        else:
            raise AirflowFailException(f"Ollama indisponível em {OLLAMA_BASE_URL}: {repr(last)}")

        # Checa Qdrant
        try:
            client = qdrant_client()
            client.get_collections()
        except Exception as e:
            raise AirflowFailException(f"Qdrant indisponível em {QDRANT_HOST}:{QDRANT_PORT}: {e}")

        info = {
            "raw": str(LIBRARY_RAW),
            "processed": str(LIBRARY_PROCESSED),
            "packs": str(LIBRARY_PACKS),
            "cache": str(LIBRARY_CACHE),
            "products": str(PRODUCTS_ROOT),
            "ollama": OLLAMA_BASE_URL,
            "embed_model": OLLAMA_EMBED_MODEL,
            "qdrant": f"{QDRANT_HOST}:{QDRANT_PORT}",
            "fine_chunk": {"size": FINE_CHUNK_SIZE, "overlap": FINE_CHUNK_OVERLAP},
            "coarse": {"window": COARSE_WINDOW, "stride": COARSE_STRIDE},
            "shard_size": FINE_SHARD_SIZE,
            "max_embed_chars": MAX_EMBED_CHARS,
            "max_coarse_embed_chars": MAX_COARSE_EMBED_CHARS,
            "ollama_retries": OLLAMA_RETRIES,
        }
        logger.info("Environment OK: %s", json.dumps(info, ensure_ascii=False))
        return info

    @task
    def discover_books() -> List[Dict[str, Any]]:
        t0 = time.time()
        books = discover_raw_books(LIBRARY_RAW)
        books.sort(key=lambda x: int(x.get("size_bytes", 0)), reverse=True)

        logger.info("Discovered %d book(s) in %s (%.1fs)", len(books), str(LIBRARY_RAW), time.time() - t0)
        for b in books[:30]:
            logger.info("Book: specialty=%s name=%s ext=%s size=%s", b["specialty"], b["name"], b["ext"], human_mb(int(b["size_bytes"])))
        return books

    @task
    def process_one_book(book: Dict[str, Any]) -> Dict[str, Any]:
        specialty = book["specialty"]
        file_path = Path(book["file"])
        ext = file_path.suffix.lower()
        fp = book["fingerprint"]

        t0 = time.time()
        logger.info("Process start: specialty=%s file=%s ext=%s size=%s", specialty, file_path.name, ext, human_mb(int(book.get("size_bytes", 0))))

        paras = extract_paragraphs(file_path)
        paras = [p for p in paras if len(p) >= 80]
        if not paras:
            raise AirflowFailException(f"Nenhum parágrafo útil extraído em {file_path.name}")

        sections = detect_sections(paras)
        logger.info("Extracted: file=%s paragraphs=%d sections=%d elapsed=%.1fs", file_path.name, len(paras), len(sections), time.time() - t0)

        doc_id = sha256(f"{specialty}|{file_path.name}|{fp}")
        out_dir = LIBRARY_PROCESSED / specialty
        ensure_dir(out_dir)

        processed_path = out_dir / f"{doc_id}.json"
        fine_jsonl = out_dir / f"{doc_id}.fine.jsonl"
        if fine_jsonl.exists():
            fine_jsonl.unlink()

        fine_count = 0

        for sec_title, sec_paras in sections:
            ctx = f"source: {file_path.name}\nspecialty: {specialty}\nsection: {sec_title}"
            fine_chunks = chunk_by_paragraphs(sec_paras, FINE_CHUNK_SIZE, FINE_CHUNK_OVERLAP, ctx_prefix=ctx)
            for c in fine_chunks:
                text = c["text"]
                if not text or len(text) < 200:
                    continue
                chunk_hash = sha256(doc_id + ":fine:" + sha256(text))
                append_jsonl(
                    fine_jsonl,
                    {
                        "i": fine_count,
                        "chunk_id": sha256(f"{doc_id}:fine:{fine_count}"),
                        "chunk_hash": chunk_hash,
                        "text": text,
                        "meta": {"section": sec_title},
                    },
                )
                fine_count += 1

        if fine_count == 0:
            raise AirflowFailException(f"Fine chunks insuficientes em {file_path.name}")

        coarse_chunks: List[Dict[str, Any]] = []
        i = 0
        coarse_i = 0
        while i < fine_count:
            j = min(fine_count, i + COARSE_WINDOW)
            coarse_chunks.append(
                {
                    "i": coarse_i,
                    "chunk_id": sha256(f"{doc_id}:coarse:{coarse_i}"),
                    "chunk_hash": sha256(doc_id + ":coarse:" + f"{i}:{j}"),
                    "fine_from": i,
                    "fine_to": j,
                    "meta": {"section": "mixed"},
                }
            )
            coarse_i += 1
            if j == fine_count:
                break
            i += COARSE_STRIDE

        t_shard = time.time()
        shard_paths = shard_fine_jsonl(fine_jsonl, FINE_SHARD_SIZE)
        logger.info(
            "Sharded fine: file=%s fine_count=%d shards=%d shard_size=%d elapsed=%.1fs",
            file_path.name, fine_count, len(shard_paths), FINE_SHARD_SIZE, time.time() - t_shard
        )

        manifest = {
            "schema_version": 6,
            "specialty": specialty,
            "doc_id": doc_id,
            "file": str(file_path),
            "name": file_path.name,
            "fingerprint": fp,
            "format": ext,
            "fine": {
                "chunk_size": FINE_CHUNK_SIZE,
                "overlap": FINE_CHUNK_OVERLAP,
                "storage": "jsonl",
                "jsonl_path": str(fine_jsonl),
                "count": fine_count,
                "shards": [str(p) for p in shard_paths],
                "shard_size": FINE_SHARD_SIZE,
            },
            "coarse": {
                "window": COARSE_WINDOW,
                "stride": COARSE_STRIDE,
                "count": len(coarse_chunks),
                "chunks": coarse_chunks,
            },
            "processed_at": now_utc(),
        }
        write_json(processed_path, manifest)

        dt = time.time() - t0
        logger.info(
            "Process OK: file=%s fine=%d coarse=%d processed=%s fine_jsonl=%s (%s) elapsed=%.1fs",
            file_path.name,
            fine_count,
            len(coarse_chunks),
            str(processed_path),
            str(fine_jsonl),
            human_mb(file_size(fine_jsonl)),
            dt,
        )

        return {
            "specialty": specialty,
            "doc_id": doc_id,
            "processed_path": str(processed_path),
            "fine_jsonl_path": str(fine_jsonl),
            "fine_chunks_count": fine_count,
            "coarse_chunks_count": len(coarse_chunks),
            "fine_shards": [str(p) for p in shard_paths],
            "name": file_path.name,
        }

    @task
    def expand_fine_shards(processed_list: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        shards: List[Dict[str, Any]] = []
        for p in processed_list:
            for shard_path in p.get("fine_shards", []):
                shards.append(
                    {
                        "specialty": p["specialty"],
                        "doc_id": p["doc_id"],
                        "processed_path": p["processed_path"],
                        "shard_path": shard_path,
                        "name": p.get("name", ""),
                    }
                )
        logger.info("Prepared %d fine shard task(s) for indexing", len(shards))
        return shards

    @task
    def index_fine_shard(shard_task: Dict[str, Any]) -> Dict[str, Any]:
        try:
            from qdrant_client.http import models as qmodels  # type: ignore
        except Exception as e:
            raise AirflowFailException(f"Falha import qdrant models: {e}")

        specialty = shard_task["specialty"]
        doc_id = shard_task["doc_id"]
        shard_path = Path(shard_task["shard_path"])
        processed_path = Path(shard_task["processed_path"])

        if not shard_path.exists():
            raise AirflowFailException(f"Shard não encontrado: {shard_path}")

        manifest = json.loads(processed_path.read_text(encoding="utf-8"))
        fine_collection = f"{COLLECTION_PREFIX}{specialty}__fine"
        client = qdrant_client()

        t0 = time.time()
        texts: List[str] = []
        hashes: List[str] = []
        payloads: List[Dict[str, Any]] = []
        indexed = 0
        vector_size: Optional[int] = None

        def flush():
            nonlocal indexed, vector_size
            if not texts:
                return

            # fine: pode usar MAX_EMBED_CHARS
            vectors = embed_texts_with_cache(texts, OLLAMA_EMBED_MODEL, hashes, max_chars=MAX_EMBED_CHARS)
            if vector_size is None:
                vector_size = len(vectors[0])
                ensure_collection(client, fine_collection, vector_size)

            points: List[qmodels.PointStruct] = []
            for pl, v in zip(payloads, vectors):
                pid = stable_int_id(f"{doc_id}:fine:{pl['chunk_index']}")
                points.append(qmodels.PointStruct(id=pid, vector=v, payload=pl))

            for start in range(0, len(points), QDRANT_UPSERT_BATCH):
                client.upsert(collection_name=fine_collection, points=points[start : start + QDRANT_UPSERT_BATCH])

            indexed += len(points)
            texts.clear()
            hashes.clear()
            payloads.clear()

        for chunk in iter_jsonl(shard_path):
            text = chunk["text"]
            h = chunk["chunk_hash"]
            idx = int(chunk["i"])
            section = (chunk.get("meta") or {}).get("section", "untitled")
            preview = normalize_ws(text)[:QDRANT_TEXT_PREVIEW_CHARS]

            pl = {
                "level": "fine",
                "specialty": specialty,
                "doc_id": doc_id,
                "chunk_id": chunk["chunk_id"],
                "chunk_index": idx,
                "chunk_hash": h,
                "file": manifest["file"],
                "name": manifest["name"],
                "section": section,
                "preview": preview,
                "embed_model": OLLAMA_EMBED_MODEL,
                "indexed_at": now_utc(),
            }
            if QDRANT_STORE_FULL_TEXT:
                pl["text"] = text

            texts.append(text)
            hashes.append(h)
            payloads.append(pl)

            if len(texts) >= FINE_INDEX_BATCH:
                flush()

        flush()

        dt = time.time() - t0
        logger.info(
            "Fine shard indexed: doc=%s shard=%s points=%d elapsed=%.1fs",
            manifest["name"],
            shard_path.name,
            indexed,
            dt,
        )

        return {
            "specialty": specialty,
            "doc_id": doc_id,
            "collection": fine_collection,
            "points": indexed,
            "shard": str(shard_path),
        }

    @task
    def index_coarse_one_book(processed: Dict[str, Any]) -> Dict[str, Any]:
        """
        Coarse robusto:
        - NÃO envia concatenação gigante pro embeddings
        - cria "coarse text" compacto com previews + truncation
        """
        try:
            from qdrant_client.http import models as qmodels  # type: ignore
        except Exception as e:
            raise AirflowFailException(f"Falha import qdrant models: {e}")

        specialty = processed["specialty"]
        processed_path = Path(processed["processed_path"])
        manifest = json.loads(processed_path.read_text(encoding="utf-8"))

        coarse_collection = f"{COLLECTION_PREFIX}{specialty}__coarse"
        client = qdrant_client()

        doc_id = manifest["doc_id"]
        fine_jsonl = Path(manifest["fine"]["jsonl_path"])

        t0 = time.time()
        fine_text_by_i: Dict[int, str] = {}
        for c in iter_jsonl(fine_jsonl):
            fine_text_by_i[int(c["i"])] = c["text"]

        coarse_chunks = manifest["coarse"]["chunks"]
        logger.info(
            "Coarse build: doc=%s fine_loaded=%d coarse_chunks=%d",
            manifest["name"], len(fine_text_by_i), len(coarse_chunks)
        )

        coarse_texts: List[str] = []
        coarse_hashes: List[str] = []
        coarse_payloads: List[Dict[str, Any]] = []

        for c in coarse_chunks:
            f_from = int(c["fine_from"])
            f_to = int(c["fine_to"])
            parts = [fine_text_by_i[i] for i in range(f_from, f_to) if i in fine_text_by_i]
            # <<< AQUI é o ponto-chave: coarse compacto + truncado
            text = build_coarse_text_from_fine_parts(parts, max_chars=MAX_COARSE_EMBED_CHARS)
            if not text:
                continue

            coarse_texts.append(text)
            coarse_hashes.append(c["chunk_hash"])

            preview = text[:QDRANT_TEXT_PREVIEW_CHARS]
            pl = {
                "level": "coarse",
                "specialty": specialty,
                "doc_id": doc_id,
                "chunk_id": c["chunk_id"],
                "chunk_index": int(c["i"]),
                "chunk_hash": c["chunk_hash"],
                "fine_from": f_from,
                "fine_to": f_to,
                "file": manifest["file"],
                "name": manifest["name"],
                "section": (c.get("meta") or {}).get("section", "mixed"),
                "preview": preview,
                "embed_model": OLLAMA_EMBED_MODEL,
                "indexed_at": now_utc(),
            }
            if QDRANT_STORE_FULL_TEXT:
                pl["text"] = text
            coarse_payloads.append(pl)

        if not coarse_texts:
            raise AirflowFailException(f"Nenhum coarse text gerado para {manifest['name']}")

        # coarse: usa MAX_COARSE_EMBED_CHARS
        vectors = embed_texts_with_cache(coarse_texts, OLLAMA_EMBED_MODEL, coarse_hashes, max_chars=MAX_COARSE_EMBED_CHARS)
        ensure_collection(client, coarse_collection, len(vectors[0]))

        points: List[qmodels.PointStruct] = []
        for pl, v in zip(coarse_payloads, vectors):
            pid = stable_int_id(f"{doc_id}:coarse:{pl['chunk_index']}")
            points.append(qmodels.PointStruct(id=pid, vector=v, payload=pl))

        for start in range(0, len(points), QDRANT_UPSERT_BATCH):
            client.upsert(collection_name=coarse_collection, points=points[start : start + QDRANT_UPSERT_BATCH])

        dt = time.time() - t0
        logger.info("Coarse indexed: doc=%s points=%d elapsed=%.1fs", manifest["name"], len(points), dt)

        return {
            "specialty": specialty,
            "doc_id": doc_id,
            "collection": coarse_collection,
            "points": len(points),
        }

    @task
    def build_knowledge_packs(processed_list: List[Dict[str, Any]]) -> Dict[str, Any]:
        t0 = time.time()
        by_spec: Dict[str, List[Dict[str, Any]]] = {}
        for p in processed_list:
            by_spec.setdefault(p["specialty"], []).append(p)

        packs: Dict[str, Any] = {"generated_at": now_utc(), "specialties": {}}
        for spec, items in by_spec.items():
            pack_path = LIBRARY_PACKS / f"{spec}.pack.json"
            packs["specialties"][spec] = {
                "count": len(items),
                "processed": [x["processed_path"] for x in items],
                "fine_chunks_total": sum(int(x.get("fine_chunks_count", 0)) for x in items),
            }
            write_json(pack_path, packs["specialties"][spec])

        out_path = LIBRARY_PACKS / "knowledge_packs.index.json"
        write_json(out_path, packs)

        logger.info("Knowledge packs built: specialties=%d out=%s elapsed=%.1fs", len(by_spec), str(out_path), time.time() - t0)
        return {"packs_index": str(out_path), "specialties": list(by_spec.keys())}

    @task
    def smoke_test() -> Dict[str, Any]:
        client = qdrant_client()
        cols = client.get_collections().collections
        names = [c.name for c in cols]
        logger.info("Qdrant collections: %s", names)
        return {"collections": names, "checked_at": now_utc()}

    # Orquestração
    env_ok = validate_environment()
    books = discover_books()

    processed = process_one_book.expand(book=books)

    shard_tasks = expand_fine_shards(processed)
    fine_indexed = index_fine_shard.expand(shard_task=shard_tasks)

    coarse_indexed = index_coarse_one_book.expand(processed=processed)

    packs = build_knowledge_packs(processed)
    smk = smoke_test()

    env_ok >> books >> processed
    processed >> shard_tasks >> fine_indexed
    processed >> coarse_indexed
    [fine_indexed, coarse_indexed] >> packs >> smk