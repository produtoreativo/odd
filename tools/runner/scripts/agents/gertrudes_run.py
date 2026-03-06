#!/usr/bin/env python3
# /opt/scripts/agents/gertrudes_run.py
#
# Gertrudes (Requirements Agent)
# - Lê agent.json + system.md + template_prompt.md
# - Lê intention.md + context.json do produto
# - Faz RAG na base (Qdrant coarse+fine) usando embeddings do Ollama
# - Gera JSON de saída (ou aceita fallback em “bundle markdown”)
# - Escreve arquivos:
#   requirements.md, non_functional.md, glossary.md, assumptions.md, handoff_to_corrinha.md
#
# Correções incluídas:
# - default agent-root = /opt/agents (porque você montou no compose)
# - idempotência com --force
# - parser robusto: extrai JSON mesmo com lixo antes/depois e fenced ```json
# - fallback: se vier bundle markdown, split em 5 docs
# - fallback extra: se não houver header de handoff, detecta seções “Próximo passo / Pontos críticos”
# - normalização: nunca falha com list/None, nunca gera arquivo vazio silenciosamente
# - logs mais explicativos + debug artifacts (prompt.txt, raw_llm.txt, parsed_llm.json)

import argparse
import hashlib
import json
import os
import re
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests
from qdrant_client import QdrantClient


# -----------------------------
# Logging
# -----------------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


def log(msg: str) -> None:
    print(f"[gertrudes] {now_iso()} {msg}", flush=True)


# -----------------------------
# IO helpers
# -----------------------------
def read_text(p: Path) -> str:
    return p.read_text(encoding="utf-8", errors="ignore")


def write_text(p: Path, s: str) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(s, encoding="utf-8")


def read_json(p: Path) -> Any:
    return json.loads(p.read_text(encoding="utf-8"))


def write_json(p: Path, obj: Any) -> None:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def sha256_text(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def normalize_llm_text(v: Any) -> str:
    """
    Normaliza valores vindos do LLM para string.
    - list -> junta com \n
    - None -> ""
    - dict -> json
    - outros -> str
    """
    if v is None:
        return ""
    if isinstance(v, str):
        return v
    if isinstance(v, list):
        parts = []
        for x in v:
            if x is None:
                continue
            parts.append(str(x))
        return "\n".join(parts)
    if isinstance(v, dict):
        return json.dumps(v, ensure_ascii=False, indent=2)
    return str(v)


# -----------------------------
# Ollama API
# -----------------------------
def ollama_embeddings(base_url: str, model: str, text: str, timeout_sec: int = 600) -> List[float]:
    """
    POST /api/embeddings
    body: { "model": "...", "prompt": "..." }
    """
    url = base_url.rstrip("/") + "/api/embeddings"
    t0 = time.time()
    r = requests.post(url, json={"model": model, "prompt": text}, timeout=timeout_sec)
    r.raise_for_status()
    data = r.json()
    vec = data.get("embedding")
    if not isinstance(vec, list):
        raise RuntimeError(f"Ollama embeddings response missing 'embedding'. keys={list(data.keys())}")
    dt = time.time() - t0
    log(f"Embedding ok (dim={len(vec)}) em {dt:.1f}s")
    return vec


def ollama_generate(base_url: str, model: str, system: str, prompt: str, timeout_sec: int = 900) -> str:
    """
    POST /api/generate
    body: { "model": "...", "system": "...", "prompt": "...", "stream": false }
    """
    url = base_url.rstrip("/") + "/api/generate"
    t0 = time.time()
    r = requests.post(url, json={"model": model, "system": system, "prompt": prompt, "stream": False}, timeout=timeout_sec)
    r.raise_for_status()
    data = r.json()
    txt = data.get("response") or data.get("content") or ""
    dt = time.time() - t0
    log(f"Generate ok em {dt:.1f}s raw_chars={len(txt)}")
    return txt


# -----------------------------
# Qdrant / Evidence
# -----------------------------
@dataclass
class EvidenceHit:
    score: float
    source: str
    specialty: str
    doc: str
    chunk_id: str
    level: str  # coarse|fine
    text: str


def qdrant_client_from_env() -> QdrantClient:
    host = os.environ.get("QDRANT_HOST", "qdrant")
    port = int(os.environ.get("QDRANT_PORT", "6333"))
    return QdrantClient(host=host, port=port)


def qdrant_search(qc: QdrantClient, collection: str, query_vector: List[float], limit: int = 8) -> List[EvidenceHit]:
    t0 = time.time()
    res = qc.search(collection_name=collection, query_vector=query_vector, limit=limit, with_payload=True)
    dt = time.time() - t0
    log(f"Qdrant search col={collection} hits={len(res)} em {dt:.2f}s")

    hits: List[EvidenceHit] = []
    for p in res:
        payload = p.payload or {}
        text = payload.get("text_preview") or payload.get("text") or ""
        hits.append(
            EvidenceHit(
                score=float(getattr(p, "score", 0.0)),
                source=str(payload.get("source", "")),
                specialty=str(payload.get("specialty", "")),
                doc=str(payload.get("doc", payload.get("document", ""))),
                chunk_id=str(payload.get("chunk_id", payload.get("id", ""))),
                level=str(payload.get("level", "")),
                text=str(text),
            )
        )
    return hits


def build_evidence_pack(hits: List[EvidenceHit], max_chars: int = 9000) -> str:
    lines: List[str] = []
    used = 0
    hits_sorted = sorted(hits, key=lambda h: h.score, reverse=True)

    for h in hits_sorted:
        snippet = (h.text or "").strip()
        if not snippet:
            continue
        header = f"- ({h.score:.3f}) [{h.specialty}] {h.doc} :: {h.chunk_id}"
        block = header + "\n" + snippet
        if used + len(block) + 2 > max_chars:
            break
        lines.append(block)
        used += len(block) + 2

    return "\n\n".join(lines).strip()


# -----------------------------
# LLM output parsing
# -----------------------------
def extract_json_object(text: str) -> Optional[str]:
    if not text:
        return None

    fenced = re.search(r"```json\s*(\{.*?\})\s*```", text, flags=re.DOTALL | re.IGNORECASE)
    if fenced:
        return fenced.group(1).strip()

    candidates = re.findall(r"\{.*\}", text, flags=re.DOTALL)
    if not candidates:
        return None

    candidates.sort(key=len, reverse=True)
    return candidates[0].strip()


def safe_json_from_llm(raw: str) -> Dict[str, Any]:
    raw = (raw or "").strip()
    if not raw:
        return {"_raw": ""}

    jtxt = extract_json_object(raw)
    if not jtxt:
        return {"_raw": raw}

    try:
        obj = json.loads(jtxt)
        if isinstance(obj, dict):
            obj["_raw"] = raw
            return obj
        return {"_raw": raw, "_list": obj}
    except Exception:
        return {"_raw": raw}


def split_markdown_bundle(bundle: str) -> Dict[str, str]:
    bundle = (bundle or "").strip()
    if not bundle:
        return {}

    pattern = re.compile(r"^\s*\*\*(.+?)\*\*\s*$", re.MULTILINE)
    matches = list(pattern.finditer(bundle))
    if not matches:
        return {}

    def norm_name(s: str) -> str:
        s = s.strip().lower()
        s = re.sub(r"\s+", "", s)
        return s

    headers = {
        "requirements.md": "requirements_md",
        "non_functional.md": "non_functional_md",
        "glossary.md": "glossary_md",
        "assumptions.md": "assumptions_md",
        "handoff_to_corrinha.md": "handoff_md",
        "handoff.md": "handoff_md",
        "handoff_to_corrinha": "handoff_md",
        "handoff": "handoff_md",
    }

    pieces: Dict[str, str] = {}
    for i, m in enumerate(matches):
        name_raw = m.group(1)
        name = norm_name(name_raw)
        key = headers.get(name)

        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(bundle)
        content = bundle[start:end].strip()

        if key:
            pieces[key] = content

    return pieces


def handoff_fallback_from_raw(raw_bundle: str) -> str:
    raw_bundle = (raw_bundle or "").strip()
    if not raw_bundle:
        return ""

    m = re.search(
        r"(###\s+Entradas.*$|###\s+Pr[oó]ximo\s+passo.*$|###\s+Pontos\s+cr[ií]ticos.*$)",
        raw_bundle,
        flags=re.DOTALL | re.IGNORECASE,
    )
    if m:
        return m.group(0).strip()

    return raw_bundle[-2000:].strip()


# -----------------------------
# Agent files & product inputs
# -----------------------------
def load_agent_files(agent_dir: Path) -> Tuple[Dict[str, Any], str, str]:
    agent_json = read_json(agent_dir / "agent.json")
    system_md = read_text(agent_dir / "system.md")
    template_md = read_text(agent_dir / "template_prompt.md")
    return agent_json, system_md, template_md


def load_product_inputs(product_root: Path) -> Tuple[str, str]:
    intention = read_text(product_root / "0-intent" / "intention.md")
    context = read_text(product_root / "0-intent" / "context.json")
    return intention, context


def compute_input_hash(intention_md: str, context_json: str) -> str:
    return sha256_text(intention_md.strip() + "\n" + context_json.strip())


def render_prompt(template_md: str, intention_md: str, context_json: str, evidence_pack: str) -> str:
    prompt = template_md
    prompt = prompt.replace("{{INTENTION_MD}}", intention_md.strip())
    prompt = prompt.replace("{{CONTEXT_JSON}}", context_json.strip())
    prompt = prompt.replace("{{EVIDENCE_PACK}}", evidence_pack.strip())
    return prompt


# -----------------------------
# Main
# -----------------------------
def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--product", required=True, help="Nome do produto (ex: schola)")
    ap.add_argument("--root", required=True, help="Root dos produtos (ex: /opt/products)")
    # ✅ DEFAULT corrigido para o seu compose
    ap.add_argument("--agent-root", default="/opt/agents", help="Caminho base dos agentes (default: /opt/agents)")
    ap.add_argument("--force", action="store_true", help="Ignora idempotência e executa mesmo com mesmo input_hash")
    args = ap.parse_args()

    product = args.product.strip()
    root = Path(args.root).resolve()
    product_root = (root / product).resolve()

    agent_root = Path(args.agent_root).resolve()
    agent_dir = agent_root / "gertrudes"

    if not product_root.exists():
        raise SystemExit(f"Produto não encontrado: {product_root}")
    if not agent_dir.exists():
        raise SystemExit(f"Agent dir não encontrado: {agent_dir}")

    agent_cfg, system_md, template_md = load_agent_files(agent_dir)

    outputs = agent_cfg.get("outputs", {})
    out_dir_rel = outputs.get("output_dir", "1-requirements")
    out_dir = product_root / out_dir_rel

    requirements_path = out_dir / outputs.get("requirements_md", "requirements.md")
    nonfunc_path = out_dir / outputs.get("non_functional_md", "non_functional.md")
    glossary_path = out_dir / outputs.get("glossary_md", "glossary.md")
    assumptions_path = out_dir / outputs.get("assumptions_md", "assumptions.md")
    handoff_path = out_dir / outputs.get("handoff_md", "handoff_to_corrinha.md")

    state_dir = product_root / "_state"
    state_file = state_dir / "gertrudes.json"

    intention_md, context_json = load_product_inputs(product_root)
    input_hash = compute_input_hash(intention_md, context_json)

    if state_file.exists() and not args.force:
        try:
            st = read_json(state_file)
            if st.get("input_hash") == input_hash and st.get("status") == "ok":
                log(f"Skip: já executado com o mesmo input_hash para product={product}")
                return
        except Exception:
            pass

    ollama_url = os.environ.get("OLLAMA_BASE_URL", "http://host.docker.internal:11434")
    embed_model = os.environ.get("OLLAMA_EMBED_MODEL", "nomic-embed-text")
    gen_model = os.environ.get("OLLAMA_GEN_MODEL", "llama3.1:8b")

    query = f"Produto: {product}\n\nIntenção:\n{intention_md.strip()}\n\nContexto:\n{context_json.strip()}"
    log(f"Embedding query com model={embed_model} via {ollama_url}")
    qvec = ollama_embeddings(ollama_url, embed_model, query, timeout_sec=int(os.environ.get("EMBED_TIMEOUT_SEC", "600")))

    qc = QdrantClient(host=os.environ.get("QDRANT_HOST", "qdrant"), port=int(os.environ.get("QDRANT_PORT", "6333")))

    cols = [
        ("odd__product__coarse", 8),
        ("odd__requirements__coarse", 8),
        ("odd__product__fine", 18),
        ("odd__requirements__fine", 18),
    ]

    all_hits: List[EvidenceHit] = []
    for col, limit in cols:
        try:
            hits = qdrant_search(qc, col, qvec, limit=limit)
            all_hits.extend(hits)
        except Exception as e:
            log(f"WARNING: falha ao buscar no Qdrant collection={col}: {e}")

    evidence_pack = build_evidence_pack(all_hits, max_chars=12000)

    prompt = render_prompt(template_md, intention_md, context_json, evidence_pack)
    log(f"Generate com model={gen_model} via {ollama_url} prompt_chars={len(prompt)} evidence_chars={len(evidence_pack)}")

    raw = ollama_generate(ollama_url, gen_model, system_md, prompt, timeout_sec=int(os.environ.get("GEN_TIMEOUT_SEC", "1200")))

    debug_dir = product_root / "_debug" / "gertrudes"
    write_text(debug_dir / "prompt.txt", prompt)
    write_text(debug_dir / "raw_llm.txt", raw)

    out = safe_json_from_llm(raw)

    expected_keys = {"requirements_md", "non_functional_md", "glossary_md", "assumptions_md", "handoff_md"}
    if not any(k in out for k in expected_keys) and isinstance(out.get("_raw"), str):
        split = split_markdown_bundle(out["_raw"])
        if split:
            log("INFO: LLM retornou bundle markdown; splitando em 5 arquivos.")
            out.update(split)

    if not any(k in out for k in expected_keys):
        log("WARNING: LLM não retornou chaves esperadas. Usando fallback: raw_llm -> requirements_md")
        out["requirements_md"] = raw
        out.setdefault("non_functional_md", "")
        out.setdefault("glossary_md", "")
        out.setdefault("assumptions_md", "")
        out.setdefault("handoff_md", "")

    if not normalize_llm_text(out.get("handoff_md")).strip():
        hb = ""
        if isinstance(out.get("_raw"), str):
            hb = handoff_fallback_from_raw(out["_raw"])
        if hb:
            out["handoff_md"] = hb
            log("INFO: handoff_md preenchido via fallback (seções típicas detectadas no raw).")

    write_json(debug_dir / "parsed_llm.json", out)

    req = normalize_llm_text(out.get("requirements_md")).strip()
    nfr = normalize_llm_text(out.get("non_functional_md")).strip()
    glo = normalize_llm_text(out.get("glossary_md")).strip()
    ass = normalize_llm_text(out.get("assumptions_md")).strip()
    hof = normalize_llm_text(out.get("handoff_md")).strip()

    if not any([req, nfr, glo, ass, hof]):
        log("WARNING: todos os outputs vieram vazios após parsing. Salvando raw em requirements.md.")
        req = raw.strip()

    if req:
        req += "\n"
    if nfr:
        nfr += "\n"
    if glo:
        glo += "\n"
    if ass:
        ass += "\n"
    if hof:
        hof += "\n"

    write_text(requirements_path, req)
    write_text(nonfunc_path, nfr)
    write_text(glossary_path, glo)
    write_text(assumptions_path, ass)
    write_text(handoff_path, hof)

    state = {
        "agent": "gertrudes",
        "product": product,
        "status": "ok",
        "input_hash": input_hash,
        "generated_at": now_iso(),
        "ollama_url": ollama_url,
        "embed_model": embed_model,
        "gen_model": gen_model,
        "agent_dir": str(agent_dir),
        "outputs": {
            "requirements": str(requirements_path),
            "non_functional": str(nonfunc_path),
            "glossary": str(glossary_path),
            "assumptions": str(assumptions_path),
            "handoff": str(handoff_path),
        },
    }
    write_json(state_file, state)

    log(f"OK: arquivos gerados em {out_dir} (product={product})")


if __name__ == "__main__":
    main()