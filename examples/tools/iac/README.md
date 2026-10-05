

## Como subir

```sh

# cria a estrutura sugerida em tools/runner
mkdir -p tools/runner/airflow/{dags,plugins,logs}
mkdir -p tools/runner/library/{raw,processed,packs,cache}
mkdir -p tools/runner/scripts/{qdrant}

docker compose up -d

# puxar o modelo de embedding
docker exec -it $(docker ps --filter name=ollama --format "{{.ID}}") ollama pull nomic-embed-text

# testar se está funcionando
curl -s http://localhost:11434/api/tags | head

# docker-compose up -d 

docker-compose down
docker-network prune -f
docker-compose up -d

# pra atualizar o airflow
docker-compose down --remove-orphans
docker-compose up -d
# Se precisar restartar somente o airflow
docker-compose restart airflow-worker airflow-scheduler airflow-webserver

# Verificar se tem erros nos DAGs
docker-compose exec airflow-scheduler bash -lc "airflow dags list-import-errors"

docker-compose exec airflow-scheduler getent hosts postgres || true
docker-compose exec airflow-scheduler bash -lc "python - <<'PY'
import os, psycopg2
dsn=os.environ['AIRFLOW__DATABASE__SQL_ALCHEMY_CONN'].replace('postgresql+psycopg2://','postgresql://')
conn=psycopg2.connect(dsn)
cur=conn.cursor(); cur.execute('select 1;'); print(cur.fetchone())
conn.close()
PY"
```

## Endpoints úteis

	•	Airflow UI: http://localhost:8080 (admin/admin)
	•	Ollama API: http://localhost:11434
	•	Qdrant: http://localhost:6333

## Como fica seu pipeline “bibliotecário”

	•	Você coloca livros/arquivos em ./data/library/raw
	•	Seu serviço/ETL (DAG do Airflow) lê /opt/library/raw
	•	Gera chunks em /opt/library/processed
	•	Indexa no Qdrant
	•	Gera knowledge packs em /opt/library/packs

Tudo fica local no docker (na pasta ./data/library do host).


Livro EPUB/PDF
    ↓
Chunk
    ↓
Ollama embeddings
    ↓
Qdrant (kb__requirements etc)
    ↓
Agente faz search top_k
    ↓
LLM gera output fundamentado

## Criar documentação 

```sh
docker compose exec toolbox bash -lc \
"python /work/scripts/agents/orchestrator.py /opt/products/new/schola"
```

### Rodar a Gertrudes manualmente

```sh
docker-compose exec airflow-scheduler bash -lc \
"python /opt/scripts/agents/gertrudes_run.py --product schola --root /opt/products"
```