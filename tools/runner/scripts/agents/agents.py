import json
import hashlib
from pathlib import Path
from typing import Dict, Any, List

from .rag_two_stage import two_stage_search


def sha256(s: str) -> str:
    return hashlib.sha256(s.encode("utf-8")).hexdigest()


def write_json(path: Path, obj: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(obj, ensure_ascii=False, indent=2), encoding="utf-8")


def write_text(path: Path, txt: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(txt, encoding="utf-8")


class BaseAgent:
    name = "base"

    def __init__(self, product_root: Path):
        self.product_root = product_root
        self.artifacts = product_root / "artifacts"
        self.trace = self.artifacts / "99_trace"

    def log_evidence(self, filename: str, obj: Any) -> None:
        write_json(self.trace / filename, obj)


class Gertrudes(BaseAgent):
    name = "Gertrudes"

    def run(self, intent_text: str, product: str) -> Dict[str, Any]:
        # RAG focado em requirements, product, architecture, testing
        evidence = []
        for specialty in ["product", "requirements", "architecture", "testing"]:
            evidence.append(two_stage_search(specialty, intent_text))

        self.log_evidence("rag_evidence_gertrudes.json", evidence)

        # Saída inicial estruturada, simples e rastreável
        intent_hash = sha256(intent_text)
        reqs = []
        for i in range(1, 9):
            reqs.append(
                {
                    "id": f"REQ_{i:03d}",
                    "title": f"Requisito {i}",
                    "type": "functional" if i <= 6 else "non_functional",
                    "description": f"Derivado da intenção: {intent_text[:200]}",
                    "priority": "must" if i <= 4 else "should",
                    "acceptance_criteria": [
                        "Critério observável e verificável",
                    ],
                    "constraints": [],
                    "assumptions": [],
                    "risks": [],
                    "trace": {
                        "sources": [
                            {
                                "specialty": "requirements",
                                "collection_stage": "fine",
                                "doc_id": (evidence[1]["fine"][0]["payload"].get("doc_id") if evidence[1]["fine"] else ""),
                                "section": (evidence[1]["fine"][0]["payload"].get("section") if evidence[1]["fine"] else ""),
                                "chunk_id": (evidence[1]["fine"][0]["payload"].get("chunk_id") if evidence[1]["fine"] else ""),
                            }
                        ]
                    },
                }
            )

        out = {
            "schema_version": 1,
            "product": product,
            "intent_hash": intent_hash,
            "requirements": reqs,
        }

        req_dir = self.artifacts / "01_requirements"
        write_json(req_dir / "requirements.json", out)
        write_text(req_dir / "requirements.md", "\n".join([f"- {r['id']}: {r['title']}" for r in reqs]))
        return out


class Corrinha(BaseAgent):
    name = "Corrinha"

    def run(self, requirements_json: Dict[str, Any]) -> Dict[str, Any]:
        product = requirements_json["product"]
        reqs = requirements_json["requirements"]

        evidence = two_stage_search("product", f"User stories e use cases para {product}")
        self.log_evidence("rag_evidence_corrinha.json", evidence)

        stories = []
        use_cases = []
        for r in reqs[:6]:
            stories.append(f"Como usuario eu quero {r['title'].lower()} para atingir o objetivo do produto")
            use_cases.append(f"Use case: {r['title']} \nFluxo principal: ... \nExceções: ...")

        spec_dir = self.artifacts / "02_specs"
        contracts_dir = spec_dir / "contracts"
        contracts_dir.mkdir(parents=True, exist_ok=True)

        write_text(spec_dir / "user_stories.md", "\n".join([f"- {s}" for s in stories]))
        write_text(spec_dir / "use_cases.md", "\n\n".join(use_cases))

        # Contratos placeholders que você vai evoluir com seu estilo
        openapi = f"""openapi: 3.0.3
info:
  title: {product} API
  version: 0.1.0
paths: {{}}
"""
        asyncapi = f"""asyncapi: 2.6.0
info:
  title: {product} Async API
  version: 0.1.0
channels: {{}}
"""
        events_contracts = """schema_version: 1
events: []
"""

        write_text(contracts_dir / "openapi.yaml", openapi)
        write_text(contracts_dir / "asyncapi.yaml", asyncapi)
        write_text(contracts_dir / "events_contracts.yaml", events_contracts)

        return {"product": product, "stories": stories}


class Creuza(BaseAgent):
    name = "Creuza"

    def run(self, requirements_json: Dict[str, Any]) -> Dict[str, Any]:
        product = requirements_json["product"]

        evidence = two_stage_search("eventing", f"Event storming e eventos de dominio para {product}")
        self.log_evidence("rag_evidence_creuza.json", evidence)

        odd_dir = self.artifacts / "03_odd"
        odd_dir.mkdir(parents=True, exist_ok=True)

        event_storming_md = f"""# Event Storming {product}

## Eventos sugeridos
- Evento 1
- Evento 2

## Notas
Derivado dos requisitos e evidências de eventing.
"""
        write_text(odd_dir / "event_storming.md", event_storming_md)

        # CSV mínimo, você pode depois gerar xlsx via python
        csv = "event_name,bounded_context,command,aggregate,actor,system,source,notes\n"
        csv += "EventoCriado,Core,ComandoCriar,AggregatePrincipal,Usuario,API,EventStorming,Inicial\n"
        write_text(odd_dir / "odd_events.csv", csv)

        return {"product": product, "events_csv": str(odd_dir / "odd_events.csv")}