from __future__ import annotations

import os
from pathlib import Path
from airflow import DAG
from airflow.decorators import task
from airflow.utils.dates import days_ago

PRODUCTS_ROOT = Path(os.environ.get("PRODUCTS_ROOT", "/opt/products"))

with DAG(
    dag_id="product_pipeline_gertrudes",
    start_date=days_ago(1),
    schedule_interval=None,
    catchup=False,
    max_active_runs=1,
    tags=["odd", "products", "agents"],
) as dag:

    @task
    def list_products():
        products = []
        if PRODUCTS_ROOT.exists():
            for p in PRODUCTS_ROOT.iterdir():
                if p.is_dir() and (p / "0-intent" / "intention.md").exists():
                    products.append(p.name)
        return products

    @task
    def run_gertrudes(product: str):
        cmd = f"python /opt/airflow/dags/../../scripts/agents/gertrudes_run.py --product {product} --root /opt/products"
        rc = os.system(cmd)
        if rc != 0:
            raise RuntimeError(f"gertrudes failed for {product}")

    products = list_products()
    run_gertrudes.expand(product=products)