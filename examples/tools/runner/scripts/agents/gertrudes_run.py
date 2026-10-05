#!/usr/bin/env python3
"""
Gertrudes runner

Fluxo:
1. Lê intention.md e context.json
2. Lê agent.json, system.md, template_prompt.md, domain_summary_prompt.md,
   self_review_prompt.md, domain_repair_prompt.md, rubric.md e output_contracts.json
3. Faz RAG no Qdrant com filtragem semântica simples
4. Gera domain_summary.md
5. Gera primeira versão dos artefatos
6. Faz self review
7. Se necessário, faz domain repair
8. Valida domínio e contratos
9. Salva arquivos finais
"""

from __future__ import annotations

import argparse
import hashlib
import json
import os
import re
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import requests
from qdrant_client import QdrantClient


# ============================================================
# Helpers
# ============================================================

def now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


def log(msg: str) -> None:
    print(f"[gertrudes] {now_iso()} {msg}", flush=True)


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore")


def write_text(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content, encoding="utf-8")


def read_json(path: Path) -> Any:
    return json.loads(path.read_text(encoding="utf-8"))


def write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def sha256_text(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def normalize_ws(text: str) -> str:
    text = text.replace("\r\n", "\n").replace("\r", "\n")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def normalize_llm_text(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    if isinstance(value, list):
        return "\n".join(str(x) for x in value if x is not None)
    if isinstance(value, dict):
        return json.dumps(value, ensure_ascii=False, indent=2)
    return str(value)


# ============================================================
# Config loading
# ============================================================

@dataclass
class AgentFiles:
    cfg: Dict[str, Any]
    system_md: str
    template_md: str
    domain_summary_prompt_md: str
    self_review_prompt_md: str
    domain_repair_prompt_md: str
    contract_repair_prompt_md: str
    rubric_md: str
    output_contracts: Dict[str, Any]


def load_agent_files(agent_dir: Path) -> AgentFiles:
    return AgentFiles(
        cfg=read_json(agent_dir / "agent.json"),
        system_md=read_text(agent_dir / "system.md"),
        template_md=read_text(agent_dir / "template_prompt.md"),
        domain_summary_prompt_md=read_text(agent_dir / "domain_summary_prompt.md"),
        self_review_prompt_md=read_text(agent_dir / "self_review_prompt.md"),
        domain_repair_prompt_md=read_text(agent_dir / "domain_repair_prompt.md"),
        contract_repair_prompt_md=read_text(agent_dir / "contract_repair_prompt.md"),
        rubric_md=read_text(agent_dir / "rubric.md"),
        output_contracts=read_json(agent_dir / "output_contracts.json"),
    )


def render_contract_repair_prompt(
    repair_template: str,
    context_json: Dict[str, Any],
    domain_summary_md: str,
    current_output_json: Dict[str, Any],
    contract_errors: List[str],
) -> str:
    prompt = repair_template
    prompt = prompt.replace("{{CONTEXT_JSON}}", json.dumps(context_json, ensure_ascii=False, indent=2).strip())
    prompt = prompt.replace("{{DOMAIN_SUMMARY_MD}}", domain_summary_md.strip())
    prompt = prompt.replace("{{CURRENT_OUTPUT_JSON}}", json.dumps(current_output_json, ensure_ascii=False, indent=2))
    prompt = prompt.replace("{{CONTRACT_ERRORS_JSON}}", json.dumps(contract_errors, ensure_ascii=False, indent=2))
    return prompt

def load_product_inputs(product_root: Path, cfg: Dict[str, Any]) -> Tuple[str, Dict[str, Any]]:
    inputs = cfg.get("inputs", {})
    intent_rel = inputs.get("intent_markdown", "0-intent/intention.md")
    context_rel = inputs.get("context_json", "0-intent/context.json")

    intent_path = product_root / intent_rel
    context_path = product_root / context_rel

    if not intent_path.exists():
        raise FileNotFoundError(f"intention.md não encontrado: {intent_path}")
    if not context_path.exists():
        raise FileNotFoundError(f"context.json não encontrado: {context_path}")

    intention_md = read_text(intent_path)
    context_json = read_json(context_path)
    if not isinstance(context_json, dict):
        raise ValueError("context.json precisa ser um objeto JSON")

    return intention_md, context_json


def compute_input_hash(intention_md: str, context_json: Dict[str, Any], agent_cfg: Dict[str, Any]) -> str:
    payload = {
        "intention_md": intention_md,
        "context_json": context_json,
        "agent_version": agent_cfg.get("version"),
        "agent_name": agent_cfg.get("name"),
    }
    return sha256_text(json.dumps(payload, ensure_ascii=False, sort_keys=True))


# ============================================================
# Ollama
# ============================================================

def ollama_generate(base_url: str, model: str, system: str, prompt: str, timeout: int = 1200) -> str:
    url = base_url.rstrip("/") + "/api/generate"
    payload = {
        "model": model,
        "system": system,
        "prompt": prompt,
        "stream": False,
        "options": {
            "temperature": 0.1,
            "num_predict": 4096,
        },
    }
    r = requests.post(url, json=payload, timeout=timeout)
    r.raise_for_status()
    data = r.json()
    return data.get("response", "")


def ollama_embeddings(base_url: str, model: str, text: str, timeout: int = 600) -> List[float]:
    base = base_url.rstrip("/")

    try:
        r = requests.post(base + "/api/embed", json={"model": model, "input": text}, timeout=timeout)
        if r.status_code == 200:
            j = r.json()
            if isinstance(j.get("embeddings"), list) and j["embeddings"]:
                return j["embeddings"][0]
            if isinstance(j.get("embedding"), list) and j["embedding"]:
                return j["embedding"]
    except Exception:
        pass

    r2 = requests.post(base + "/api/embeddings", json={"model": model, "prompt": text}, timeout=timeout)
    r2.raise_for_status()
    j2 = r2.json()
    emb = j2.get("embedding")
    if not isinstance(emb, list) or not emb:
        raise RuntimeError("Embedding inválido retornado pelo Ollama")
    return emb


# ============================================================
# Qdrant / RAG
# ============================================================

@dataclass
class EvidenceHit:
    score: float
    collection: str
    specialty: str
    doc: str
    chunk_id: str
    level: str
    text: str


def qdrant_client_from_env() -> QdrantClient:
    host = os.environ.get("QDRANT_HOST", "qdrant")
    port = int(os.environ.get("QDRANT_PORT", "6333"))
    return QdrantClient(host=host, port=port)


def qdrant_search(qc: QdrantClient, collection: str, query_vector: List[float], limit: int) -> List[EvidenceHit]:
    res = qc.search(
        collection_name=collection,
        query_vector=query_vector,
        limit=limit,
        with_payload=True,
    )

    hits: List[EvidenceHit] = []
    for p in res:
        payload = p.payload or {}
        text = (
            payload.get("preview")
            or payload.get("text_preview")
            or payload.get("text")
            or payload.get("chunk")
            or ""
        )
        hits.append(
            EvidenceHit(
                score=float(getattr(p, "score", 0.0)),
                collection=collection,
                specialty=str(payload.get("specialty", "")),
                doc=str(payload.get("doc", payload.get("document", ""))),
                chunk_id=str(payload.get("chunk_id", payload.get("id", ""))),
                level=str(payload.get("level", "")),
                text=str(text),
            )
        )
    return hits


def build_query_profiles(product: str, intention_md: str, context_json: Dict[str, Any], cfg: Dict[str, Any]) -> List[Tuple[str, str]]:
    query_profiles = cfg.get("knowledge", {}).get("query_profiles", [])
    context_str = json.dumps(context_json, ensure_ascii=False)

    queries: List[Tuple[str, str]] = []
    for qp in query_profiles:
        tpl = qp.get("query_template", "")
        name = qp.get("name", "generic")
        q = tpl.replace("{{product}}", product)
        q = q.replace("{{intent}}", intention_md)
        q = q.replace("{{context}}", context_str)
        queries.append((name, normalize_ws(q)))

    if not queries:
        queries = [("generic", normalize_ws(f"{product}\n{intention_md}\n{context_str}"))]
    return queries


GOOD_TERMS_DOMAIN = [
    "actor", "actors", "entity", "entities", "domain", "workflow", "flow",
    "integration", "state", "states", "event", "events", "business", "process",
    "authentication", "authorization", "payment", "audit", "trace", "role",
    "user", "users", "requirement", "requirements"
]

GOOD_TERMS_NFR = [
    "non functional", "security", "privacy", "reliability", "availability",
    "audit", "trace", "observability", "performance", "compliance", "idempotent",
    "idempotency", "integrity", "legal"
]

BAD_TERMS = [
    "weather station", "roads", "road authorities", "worldcom", "enron",
    "html5", "french", "flemish", "icebreaker", "rosa weather", "transportation"
]


def lexical_score(text: str, good_terms: List[str], bad_terms: List[str]) -> int:
    text_l = text.lower()
    score = 0
    for t in good_terms:
        if t in text_l:
            score += 2
    for t in bad_terms:
        if t in text_l:
            score -= 5
    return score


def filter_hits(hits: List[EvidenceHit], kind: str) -> List[EvidenceHit]:
    filtered: List[EvidenceHit] = []

    for h in hits:
        text = normalize_ws(h.text)
        if not text:
            continue

        if kind == "domain":
            score = lexical_score(text, GOOD_TERMS_DOMAIN, BAD_TERMS)
        elif kind == "nfr":
            score = lexical_score(text, GOOD_TERMS_NFR, BAD_TERMS)
        else:
            score = lexical_score(text, GOOD_TERMS_DOMAIN + GOOD_TERMS_NFR, BAD_TERMS)

        if score >= 0 or h.score >= 0.73:
            filtered.append(h)

    return filtered


def dedup_hits(hits: List[EvidenceHit]) -> List[EvidenceHit]:
    seen: Dict[str, EvidenceHit] = {}
    for h in sorted(hits, key=lambda x: x.score, reverse=True):
        key = f"{h.collection}|{h.doc}|{h.chunk_id}"
        if key not in seen:
            seen[key] = h
    return list(seen.values())


def render_evidence_pack(hits: List[EvidenceHit], max_chars: int) -> str:
    lines: List[str] = []
    used = 0

    for h in sorted(hits, key=lambda x: x.score, reverse=True):
        snippet = normalize_ws(h.text)
        if not snippet:
            continue
        block = f"- ({h.score:.3f}) [{h.specialty}] {h.doc} :: {h.chunk_id}\n{snippet}"
        if used + len(block) + 2 > max_chars:
            break
        lines.append(block)
        used += len(block) + 2

    return "\n\n".join(lines).strip()


def retrieve_evidence(
    product: str,
    intention_md: str,
    context_json: Dict[str, Any],
    cfg: Dict[str, Any],
    ollama_url: str,
    embed_model: str,
) -> Tuple[List[EvidenceHit], str, str]:
    qc = qdrant_client_from_env()

    knowledge = cfg.get("knowledge", {})
    collections = knowledge.get("collections", {})
    limits = knowledge.get("limits", {})

    primary_coarse = collections.get("primary_coarse", [])
    primary_fine = collections.get("primary_fine", [])
    secondary_coarse = collections.get("secondary_coarse", [])
    secondary_fine = collections.get("secondary_fine", [])

    topk_primary_coarse = int(limits.get("topk_primary_coarse", 3))
    topk_primary_fine = int(limits.get("topk_primary_fine", 5))
    topk_secondary_coarse = int(limits.get("topk_secondary_coarse", 1))
    topk_secondary_fine = int(limits.get("topk_secondary_fine", 2))
    max_evidence_chars = int(limits.get("max_evidence_chars", 3500))

    queries = build_query_profiles(product, intention_md, context_json, cfg)
    all_hits: List[EvidenceHit] = []

    for profile_name, q in queries:
        qvec = ollama_embeddings(ollama_url, embed_model, q)
        log(f"Embedding query ok (profile={profile_name}, dim={len(qvec)})")

        for col in primary_coarse:
            hits = qdrant_search(qc, col, qvec, topk_primary_coarse)
            log(f"Qdrant search col={col} hits={len(hits)}")
            all_hits.extend(hits)

        for col in primary_fine:
            hits = qdrant_search(qc, col, qvec, topk_primary_fine)
            log(f"Qdrant search col={col} hits={len(hits)}")
            all_hits.extend(hits)

        for col in secondary_coarse:
            hits = qdrant_search(qc, col, qvec, topk_secondary_coarse)
            log(f"Qdrant search col={col} hits={len(hits)}")
            all_hits.extend(hits)

        for col in secondary_fine:
            hits = qdrant_search(qc, col, qvec, topk_secondary_fine)
            log(f"Qdrant search col={col} hits={len(hits)}")
            all_hits.extend(hits)

    deduped = dedup_hits(all_hits)

    domain_hits = filter_hits(deduped, kind="domain")
    synthesis_hits = filter_hits(deduped, kind="synthesis")

    domain_pack = render_evidence_pack(domain_hits, max_chars=max_evidence_chars)
    synthesis_pack = render_evidence_pack(synthesis_hits, max_chars=max_evidence_chars)

    return deduped, domain_pack, synthesis_pack


# ============================================================
# Parsing
# ============================================================

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


def split_markdown_bundle(raw: str) -> Dict[str, str]:
    if not raw.strip():
        return {}

    headers = {
        "requirements.md": "requirements_md",
        "non_functional.md": "non_functional_md",
        "glossary.md": "glossary_md",
        "assumptions.md": "assumptions_md",
        "handoff_to_corrinha.md": "handoff_md",
        "handoff.md": "handoff_md",
    }

    pattern = re.compile(r"^\s*\*\*(.+?\.md)\*\*\s*$", re.MULTILINE)
    matches = list(pattern.finditer(raw))
    if not matches:
        return {}

    out: Dict[str, str] = {}
    for i, m in enumerate(matches):
        name = m.group(1).strip().lower()
        key = headers.get(name)
        start = m.end()
        end = matches[i + 1].start() if i + 1 < len(matches) else len(raw)
        content = raw[start:end].strip()
        if key:
            out[key] = content
    return out


def safe_json_from_llm(raw: str) -> Dict[str, Any]:
    raw = (raw or "").strip()
    if not raw:
        return {"_raw": ""}

    jtxt = extract_json_object(raw)
    if jtxt:
        try:
            obj = json.loads(jtxt)
            if isinstance(obj, dict):
                obj["_raw"] = raw
                return obj
        except Exception:
            pass

    split = split_markdown_bundle(raw)
    if split:
        split["_raw"] = raw
        return split

    return {"_raw": raw}


# ============================================================
# Domain validation
# ============================================================

def required_domain_terms(cfg: Dict[str, Any]) -> List[str]:
    return cfg.get("generation", {}).get("quality_gates", {}).get("required_domain_terms", [])


def forbidden_terms(cfg: Dict[str, Any]) -> List[str]:
    return cfg.get("generation", {}).get("quality_gates", {}).get("forbidden_terms", [])


def minimum_required_terms_found(cfg: Dict[str, Any]) -> int:
    return int(cfg.get("generation", {}).get("quality_gates", {}).get("minimum_required_terms_found", 3))


def count_required_terms(text: str, terms: List[str]) -> int:
    text_l = text.lower()
    return sum(1 for t in terms if t.lower() in text_l)


def find_forbidden_terms(text: str, terms: List[str]) -> List[str]:
    text_l = text.lower()
    return [t for t in terms if t.lower() in text_l]


def validate_domain_adherence(text: str, cfg: Dict[str, Any]) -> Tuple[bool, Dict[str, Any]]:
    req_terms = required_domain_terms(cfg)
    forb_terms = forbidden_terms(cfg)
    min_hits = minimum_required_terms_found(cfg)

    hits = count_required_terms(text, req_terms)
    bad = find_forbidden_terms(text, forb_terms)

    ok = hits >= min_hits and len(bad) == 0
    return ok, {
        "required_terms_found": hits,
        "required_terms_needed": min_hits,
        "forbidden_terms_found": bad,
    }


# ============================================================
# Output contracts
# ============================================================

def section_present(text: str, section_name: str) -> bool:
    pattern = rf"(?im)^\s*#+\s*{re.escape(section_name)}\s*$"
    return re.search(pattern, text) is not None


def markdown_table_rows(text: str) -> int:
    rows = [ln for ln in text.splitlines() if "|" in ln]
    return max(0, len(rows) - 2)


def validate_output_contracts(final_docs: Dict[str, str], contracts: Dict[str, Any]) -> Tuple[bool, List[str]]:
    errors: List[str] = []
    files = contracts.get("files", {})

    for fname, rules in files.items():
        content = final_docs.get(fname, "").strip()

        if contracts.get("quality_rules", {}).get("reject_if_empty_files", True) and not content:
            errors.append(f"{fname}: vazio")
            continue

        min_chars = int(rules.get("minimum_chars", 0))
        if min_chars and len(content) < min_chars:
            errors.append(f"{fname}: menor que minimum_chars={min_chars}")

        for sec in rules.get("required_sections", []):
            if not section_present(content, sec):
                errors.append(f"{fname}: seção obrigatória ausente: {sec}")

        if "minimum_requirements" in rules:
            prefix = rules.get("requirement_prefix", "RF-")
            qty = len(re.findall(rf"(?im)^\s*{re.escape(prefix)}\d+", content))
            if qty < int(rules["minimum_requirements"]):
                errors.append(f"{fname}: quantidade insuficiente de requisitos com prefixo {prefix}")

        if "minimum_assumptions" in rules:
            prefix = rules.get("assumption_prefix", "AS-")
            qty = len(re.findall(rf"(?im)^\s*{re.escape(prefix)}\d+", content))
            if qty < int(rules["minimum_assumptions"]):
                errors.append(f"{fname}: quantidade insuficiente de suposições com prefixo {prefix}")

        if rules.get("must_be_table"):
            rows = markdown_table_rows(content)
            if rows < int(rules.get("minimum_rows", 1)):
                errors.append(f"{fname}: tabela markdown insuficiente")

    domain_rules = contracts.get("domain_rules", {})
    combined = "\n\n".join(final_docs.values()).lower()

    required_terms = [t.lower() for t in domain_rules.get("must_mention_terms", [])]
    found = sum(1 for t in required_terms if t in combined)
    if required_terms and found < int(domain_rules.get("minimum_terms_found", 1)):
        errors.append("domain_rules: termos centrais insuficientes")

    for term in domain_rules.get("forbidden_terms", []):
        if term.lower() in combined:
            errors.append(f"domain_rules: termo proibido encontrado: {term}")

    return len(errors) == 0, errors


# ============================================================
# Prompts
# ============================================================

def render_domain_summary_prompt(template: str, intention_md: str, context_json: Dict[str, Any], evidence_pack: str) -> str:
    prompt = template
    prompt = prompt.replace("{{INTENTION_MD}}", intention_md.strip())
    prompt = prompt.replace("{{CONTEXT_JSON}}", json.dumps(context_json, ensure_ascii=False, indent=2).strip())
    prompt = prompt.replace("{{EVIDENCE_PACK}}", evidence_pack.strip())
    return prompt


def render_first_pass_prompt(
    template_md: str,
    intention_md: str,
    context_json: Dict[str, Any],
    evidence_pack: str,
    domain_summary_md: str,
) -> str:
    prompt = template_md
    prompt = prompt.replace("{{INTENTION_MD}}", intention_md.strip())
    prompt = prompt.replace("{{CONTEXT_JSON}}", json.dumps(context_json, ensure_ascii=False, indent=2).strip())
    prompt = prompt.replace("{{EVIDENCE_PACK}}", evidence_pack.strip())

    prompt += "\n\n---\n\n# Domain Summary gerado\n\n"
    prompt += domain_summary_md.strip()

    prompt += "\n\n---\n\n# Regras mínimas de qualidade\n\n"
    prompt += "- não invente outro domínio\n"
    prompt += "- responda somente em JSON válido\n"
    prompt += "- cada campo deve ser markdown completo\n"
    prompt += "- mencione explicitamente Schola, ProdOps, turmas, matrícula, pagamento e Certificare quando relevantes\n"

    return prompt


def render_self_review_prompt(
    self_review_template: str,
    context_json: Dict[str, Any],
    domain_summary_md: str,
    rubric_md: str,
    first_draft_json: Dict[str, Any],
) -> str:
    prompt = self_review_template
    prompt = prompt.replace("{{CONTEXT_JSON}}", json.dumps(context_json, ensure_ascii=False, indent=2).strip())
    prompt = prompt.replace("{{DOMAIN_SUMMARY_MD}}", domain_summary_md.strip())
    prompt = prompt.replace("{{RUBRIC_MD}}", rubric_md.strip())
    prompt = prompt.replace("{{FIRST_DRAFT_JSON}}", json.dumps(first_draft_json, ensure_ascii=False, indent=2))
    return prompt


def render_domain_repair_prompt(
    repair_template: str,
    context_json: Dict[str, Any],
    rejected_output_json: Dict[str, Any],
    forbidden_terms_json: List[str],
) -> str:
    prompt = repair_template
    prompt = prompt.replace("{{CONTEXT_JSON}}", json.dumps(context_json, ensure_ascii=False, indent=2).strip())
    prompt = prompt.replace("{{REJECTED_OUTPUT_JSON}}", json.dumps(rejected_output_json, ensure_ascii=False, indent=2))
    prompt = prompt.replace("{{FORBIDDEN_TERMS_JSON}}", json.dumps(forbidden_terms_json, ensure_ascii=False))
    return prompt


# ============================================================
# Main
# ============================================================

def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--product", required=True)
    ap.add_argument("--root", required=True)
    ap.add_argument("--agent-root", default="/opt/agents")
    ap.add_argument("--force", action="store_true")
    args = ap.parse_args()

    product = args.product.strip()
    product_root = (Path(args.root) / product).resolve()
    agent_dir = (Path(args.agent_root) / "gertrudes").resolve()

    if not product_root.exists():
        raise SystemExit(f"Produto não encontrado: {product_root}")
    if not agent_dir.exists():
        raise SystemExit(f"Agent dir não encontrado: {agent_dir}")

    agent = load_agent_files(agent_dir)
    intention_md, context_json = load_product_inputs(product_root, agent.cfg)

    input_hash = compute_input_hash(intention_md, context_json, agent.cfg)
    state_file = product_root / "_state" / "gertrudes.json"

    if state_file.exists() and not args.force:
        try:
            st = read_json(state_file)
            if st.get("input_hash") == input_hash and st.get("status") == "ok":
                log(f"Skip: já executado com o mesmo input_hash para product={product}")
                return
        except Exception:
            pass

    ollama_url = os.environ.get("OLLAMA_BASE_URL", "http://host.docker.internal:11434")
    embed_model = agent.cfg.get("models", {}).get("embed_model", "nomic-embed-text")
    gen_model = agent.cfg.get("models", {}).get("generate_model", "llama3.1:8b")

    debug_dir = product_root / "_debug" / "gertrudes"
    debug_dir.mkdir(parents=True, exist_ok=True)

    # 1. RAG refinado
    hits, domain_evidence_pack, synthesis_evidence_pack = retrieve_evidence(
        product=product,
        intention_md=intention_md,
        context_json=context_json,
        cfg=agent.cfg,
        ollama_url=ollama_url,
        embed_model=embed_model,
    )
    write_text(debug_dir / "domain_evidence_pack.txt", domain_evidence_pack)
    write_text(debug_dir / "synthesis_evidence_pack.txt", synthesis_evidence_pack)
    log(f"Domain evidence chars={len(domain_evidence_pack)} | Synthesis evidence chars={len(synthesis_evidence_pack)} | hits={len(hits)}")

    # 2. Domain Summary
    domain_prompt = render_domain_summary_prompt(
        agent.domain_summary_prompt_md,
        intention_md,
        context_json,
        domain_evidence_pack,
    )
    write_text(debug_dir / "domain_prompt.txt", domain_prompt)

    domain_summary_md = ollama_generate(
        base_url=ollama_url,
        model=gen_model,
        system=agent.system_md,
        prompt=domain_prompt,
        timeout=int(os.environ.get("GEN_TIMEOUT_SEC", "1200")),
    )
    write_text(debug_dir / "domain_summary_raw.txt", domain_summary_md)

    # 3. First pass
    first_pass_prompt = render_first_pass_prompt(
        template_md=agent.template_md,
        intention_md=intention_md,
        context_json=context_json,
        evidence_pack=synthesis_evidence_pack,
        domain_summary_md=domain_summary_md,
    )
    write_text(debug_dir / "first_pass_prompt.txt", first_pass_prompt)

    raw_first = ollama_generate(
        base_url=ollama_url,
        model=gen_model,
        system=agent.system_md,
        prompt=first_pass_prompt,
        timeout=int(os.environ.get("GEN_TIMEOUT_SEC", "1200")),
    )
    write_text(debug_dir / "raw_llm_first_pass.txt", raw_first)

    first_draft = safe_json_from_llm(raw_first)
    write_json(debug_dir / "parsed_llm_first_pass.json", first_draft)

    expected_keys = {"requirements_md", "non_functional_md", "glossary_md", "assumptions_md", "handoff_md"}
    if "error" in first_draft:
        raise RuntimeError(f"LLM retornou erro explícito na primeira passada: {first_draft['error']}")
    if not any(k in first_draft for k in expected_keys):
        raise RuntimeError("LLM não retornou JSON nem bundle markdown reconhecível na primeira passada")

    # 4. Self review
    self_review_prompt = render_self_review_prompt(
        self_review_template=agent.self_review_prompt_md,
        context_json=context_json,
        domain_summary_md=domain_summary_md,
        rubric_md=agent.rubric_md,
        first_draft_json=first_draft,
    )
    write_text(debug_dir / "self_review_prompt.txt", self_review_prompt)

    raw_review = ollama_generate(
        base_url=ollama_url,
        model=gen_model,
        system=agent.system_md,
        prompt=self_review_prompt,
        timeout=int(os.environ.get("GEN_TIMEOUT_SEC", "1200")),
    )
    write_text(debug_dir / "raw_llm_self_review.txt", raw_review)

    reviewed = safe_json_from_llm(raw_review)
    write_json(debug_dir / "parsed_llm_self_review.json", reviewed)

    if "error" in reviewed:
        raise RuntimeError(f"LLM retornou erro explícito no self review: {reviewed['error']}")
    if not any(k in reviewed for k in expected_keys):
        raise RuntimeError("LLM não retornou JSON nem bundle markdown reconhecível no self review")

    # 5. Final docs
    requirements_md = normalize_llm_text(reviewed.get("requirements_md")).strip()
    non_functional_md = normalize_llm_text(reviewed.get("non_functional_md")).strip()
    glossary_md = normalize_llm_text(reviewed.get("glossary_md")).strip()
    assumptions_md = normalize_llm_text(reviewed.get("assumptions_md")).strip()
    handoff_md = normalize_llm_text(reviewed.get("handoff_md")).strip()
    review_notes_md = normalize_llm_text(reviewed.get("review_notes_md")).strip()

    # 6. Domain validation
    combined = "\n\n".join([
        domain_summary_md,
        requirements_md,
        non_functional_md,
        glossary_md,
        assumptions_md,
        handoff_md,
    ])

    ok_domain, validation = validate_domain_adherence(combined, agent.cfg)
    write_json(debug_dir / "validation.json", validation)

    if not ok_domain:
        forbidden_found = validation.get("forbidden_terms_found", [])
        if forbidden_found:
            repair_prompt = render_domain_repair_prompt(
                repair_template=agent.domain_repair_prompt_md,
                context_json=context_json,
                rejected_output_json={
                    "requirements_md": requirements_md,
                    "non_functional_md": non_functional_md,
                    "glossary_md": glossary_md,
                    "assumptions_md": assumptions_md,
                    "handoff_md": handoff_md,
                },
                forbidden_terms_json=forbidden_found,
            )
            write_text(debug_dir / "domain_repair_prompt.txt", repair_prompt)

            raw_repair = ollama_generate(
                base_url=ollama_url,
                model=gen_model,
                system=agent.system_md,
                prompt=repair_prompt,
                timeout=int(os.environ.get("GEN_TIMEOUT_SEC", "1200")),
            )
            write_text(debug_dir / "raw_llm_domain_repair.txt", raw_repair)

            repaired = safe_json_from_llm(raw_repair)
            write_json(debug_dir / "parsed_llm_domain_repair.json", repaired)

            if not any(k in repaired for k in expected_keys):
                raise RuntimeError("Domain repair não retornou JSON nem bundle markdown reconhecível")

            requirements_md = normalize_llm_text(repaired.get("requirements_md")).strip()
            non_functional_md = normalize_llm_text(repaired.get("non_functional_md")).strip()
            glossary_md = normalize_llm_text(repaired.get("glossary_md")).strip()
            assumptions_md = normalize_llm_text(repaired.get("assumptions_md")).strip()
            handoff_md = normalize_llm_text(repaired.get("handoff_md")).strip()

            combined = "\n\n".join([
                domain_summary_md,
                requirements_md,
                non_functional_md,
                glossary_md,
                assumptions_md,
                handoff_md,
            ])

            ok_domain, validation = validate_domain_adherence(combined, agent.cfg)
            write_json(debug_dir / "validation_after_repair.json", validation)

        if not ok_domain:
            raise RuntimeError(
                "Saída do LLM não aderente ao domínio do produto mesmo após repair. "
                f"Validação: {json.dumps(validation, ensure_ascii=False)}"
            )

    # 7. Contracts
    outputs = agent.cfg.get("outputs", {})
    out_dir = product_root / outputs.get("output_dir", "1-requirements")
    out_dir.mkdir(parents=True, exist_ok=True)

    final_docs = {
        outputs.get("domain_summary_md", "domain_summary.md"): domain_summary_md.strip(),
        outputs.get("requirements_md", "requirements.md"): requirements_md,
        outputs.get("non_functional_md", "non_functional.md"): non_functional_md,
        outputs.get("glossary_md", "glossary.md"): glossary_md,
        outputs.get("assumptions_md", "assumptions.md"): assumptions_md,
        outputs.get("handoff_md", "handoff_to_corrinha.md"): handoff_md,
    }

    ok_contracts, contract_errors = validate_output_contracts(final_docs, agent.output_contracts)
    write_json(debug_dir / "output_contract_validation.json", {"ok": ok_contracts, "errors": contract_errors})

    if not ok_contracts:
        contract_repair_prompt = render_contract_repair_prompt(
            repair_template=agent.contract_repair_prompt_md,
            context_json=context_json,
            domain_summary_md=domain_summary_md,
            current_output_json={
                "requirements_md": requirements_md,
                "non_functional_md": non_functional_md,
                "glossary_md": glossary_md,
                "assumptions_md": assumptions_md,
                "handoff_md": handoff_md,
            },
            contract_errors=contract_errors,
        )
        write_text(debug_dir / "contract_repair_prompt.txt", contract_repair_prompt)

        raw_contract_repair = ollama_generate(
            base_url=ollama_url,
            model=gen_model,
            system=agent.system_md,
            prompt=contract_repair_prompt,
            timeout=int(os.environ.get("GEN_TIMEOUT_SEC", "1200")),
        )
        write_text(debug_dir / "raw_llm_contract_repair.txt", raw_contract_repair)

        repaired_contract = safe_json_from_llm(raw_contract_repair)
        write_json(debug_dir / "parsed_llm_contract_repair.json", repaired_contract)

        if not any(k in repaired_contract for k in expected_keys):
            raise RuntimeError("Contract repair não retornou JSON nem bundle markdown reconhecível")

        requirements_md = normalize_llm_text(repaired_contract.get("requirements_md")).strip()
        non_functional_md = normalize_llm_text(repaired_contract.get("non_functional_md")).strip()
        glossary_md = normalize_llm_text(repaired_contract.get("glossary_md")).strip()
        assumptions_md = normalize_llm_text(repaired_contract.get("assumptions_md")).strip()
        handoff_md = normalize_llm_text(repaired_contract.get("handoff_md")).strip()

        final_docs = {
            outputs.get("domain_summary_md", "domain_summary.md"): domain_summary_md.strip(),
            outputs.get("requirements_md", "requirements.md"): requirements_md,
            outputs.get("non_functional_md", "non_functional.md"): non_functional_md,
            outputs.get("glossary_md", "glossary.md"): glossary_md,
            outputs.get("assumptions_md", "assumptions.md"): assumptions_md,
            outputs.get("handoff_md", "handoff_to_corrinha.md"): handoff_md,
        }

        ok_contracts, contract_errors = validate_output_contracts(final_docs, agent.output_contracts)
        write_json(debug_dir / "output_contract_validation_after_repair.json", {"ok": ok_contracts, "errors": contract_errors})

        if not ok_contracts:
            raise RuntimeError("Output contracts inválidos mesmo após contract repair: " + "; ".join(contract_errors))

    # 8. Persist
    for fname, content in final_docs.items():
        write_text(out_dir / fname, content.strip() + "\n")

    write_text(debug_dir / "review_notes.md", review_notes_md + "\n")

    # 9. State
    write_json(state_file, {
        "agent": "gertrudes",
        "version": agent.cfg.get("version"),
        "status": "ok",
        "product": product,
        "input_hash": input_hash,
        "generated_at": now_iso(),
        "ollama_url": ollama_url,
        "embed_model": embed_model,
        "generate_model": gen_model,
    })

    log(f"OK: arquivos gerados em {out_dir} (product={product})")


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        log(f"ERROR: {e}")
        raise