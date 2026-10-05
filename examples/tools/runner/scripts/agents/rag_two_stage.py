import os
from typing import List, Dict, Any, Optional

import requests
from qdrant_client import QdrantClient
from qdrant_client.http import models as qmodels


OLLAMA_BASE_URL = os.getenv("OLLAMA_BASE_URL", "http://ollama:11434")
OLLAMA_EMBED_MODEL = os.getenv("OLLAMA_EMBED_MODEL", "nomic-embed-text")
QDRANT_HOST = os.getenv("QDRANT_HOST", "qdrant")
QDRANT_PORT = int(os.getenv("QDRANT_PORT", "6333"))


def ollama_embed(text: str) -> List[float]:
    r = requests.post(
        f"{OLLAMA_BASE_URL}/api/embeddings",
        json={"model": OLLAMA_EMBED_MODEL, "prompt": text},
        timeout=600,
    )
    r.raise_for_status()
    data = r.json()
    return data["embedding"]


def two_stage_search(
    specialty: str,
    query: str,
    coarse_limit: int = 8,
    fine_limit: int = 12,
) -> Dict[str, Any]:
    client = QdrantClient(host=QDRANT_HOST, port=QDRANT_PORT)
    qv = ollama_embed(query)

    coarse_collection = f"kb__{specialty}__coarse"
    fine_collection = f"kb__{specialty}__fine"

    coarse = client.search(
        collection_name=coarse_collection,
        query_vector=qv,
        limit=coarse_limit,
        with_payload=True,
    )

    doc_ids = list({p.payload.get("doc_id") for p in coarse if p.payload})
    sections = list({p.payload.get("section") for p in coarse if p.payload})

    fine_filter = None
    must = []
    if doc_ids:
        must.append(qmodels.FieldCondition(key="doc_id", match=qmodels.MatchAny(any=doc_ids)))
    if sections:
        must.append(qmodels.FieldCondition(key="section", match=qmodels.MatchAny(any=sections)))
    if must:
        fine_filter = qmodels.Filter(must=must)

    fine = client.search(
        collection_name=fine_collection,
        query_vector=qv,
        limit=fine_limit,
        with_payload=True,
        query_filter=fine_filter,
    )

    def pack(points):
        out = []
        for p in points:
            out.append(
                {
                    "score": p.score,
                    "payload": dict(p.payload or {}),
                }
            )
        return out

    return {
        "query": query,
        "specialty": specialty,
        "collections": {"coarse": coarse_collection, "fine": fine_collection},
        "coarse": pack(coarse),
        "fine": pack(fine),
    }