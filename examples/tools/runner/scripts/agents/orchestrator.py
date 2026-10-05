import time
import json
from pathlib import Path
from typing import Optional

from agents import Gertrudes, Corrinha, Creuza


def read_text(path: Path) -> str:
    return path.read_text(encoding="utf-8", errors="ignore").strip()


def read_json(path: Path):
    return json.loads(path.read_text(encoding="utf-8"))


def wait_for(path: Path, timeout_sec: int = 3600) -> None:
    t0 = time.time()
    while True:
        if path.exists():
            return
        if time.time() - t0 > timeout_sec:
            raise RuntimeError(f"Timeout esperando {path}")
        time.sleep(2)


def ensure_product_structure(product_root: Path) -> None:
    (product_root / "artifacts" / "99_trace").mkdir(parents=True, exist_ok=True)
    (product_root / "docs").mkdir(parents=True, exist_ok=True)
    ctx = product_root / "context.yaml"
    if not ctx.exists():
        ctx.write_text("product: unknown\n", encoding="utf-8")


def run_product(product_root: Path) -> None:
    ensure_product_structure(product_root)

    product = product_root.name
    intention_path = product_root / "intention.md"
    if not intention_path.exists():
        raise RuntimeError("Crie intention.md na pasta do produto")

    intent_text = read_text(intention_path)

    # 1) Gertrudes inicia
    g = Gertrudes(product_root)
    g_out = g.run(intent_text=intent_text, product=product)

    # 2) Corrinha reage quando requirements.json existir
    req_path = product_root / "artifacts" / "01_requirements" / "requirements.json"
    wait_for(req_path)
    req_json = read_json(req_path)

    c = Corrinha(product_root)
    c.run(req_json)

    # 3) Creuza reage quando specs existirem (ou só requirements, você escolhe)
    # Aqui usamos requirements para manter simples e determinístico
    cr = Creuza(product_root)
    cr.run(req_json)

    # docs
    overview = product_root / "docs" / "overview.md"
    if not overview.exists():
        overview.write_text(
            f"# {product}\n\nIntenção\n\n{intent_text}\n",
            encoding="utf-8",
        )

    print("Pipeline concluído")


if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        raise SystemExit("Uso: python orchestrator.py /opt/products/new/meu_produto")
    run_product(Path(sys.argv[1]))