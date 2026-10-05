# Pipeline de Agentes --- Execução e Operação

Este documento descreve como instalar, executar e depurar a pipeline de
agentes de engenharia de requisitos utilizada no projeto.

A pipeline transforma **intenção de produto → requisitos estruturados →
artefatos de engenharia** utilizando agentes LLM, recuperação semântica
e orquestração.

------------------------------------------------------------------------

# Visão Geral da Pipeline

Fluxo principal:

Product Intent → Knowledge Retrieval → Gertrudes → Corrinha → Event
Storming → ODD

Descrição das etapas:

1.  **Product Intent**
    -   Documento inicial descrevendo o produto.
    -   Normalmente localizado em `products/<produto>/intention.md`.
2.  **Knowledge Retrieval**
    -   Consulta à base vetorial de conhecimento.
    -   Trechos relevantes de livros e documentos são recuperados.
3.  **Gertrudes**
    -   Agente responsável por gerar requisitos estruturados.
4.  **Corrinha**
    -   Converte requisitos em histórias e casos de uso.
5.  **Event Storming**
    -   Identifica eventos de domínio e fluxos.
6.  **Observability Driven Design**
    -   Eventos alimentam instrumentação e observabilidade.

------------------------------------------------------------------------

# Requisitos

Ferramentas necessárias:

-   Docker
-   Docker Compose
-   Python 3.10+
-   Git
-   Ollama

Opcional:
-   GPU local para embeddings

------------------------------------------------------------------------

# Subindo o Ambiente

Na raiz do projeto:

``` bash
cd tools/iac
docker-compose up -d
```

Serviços iniciados:

-   airflow-webserver
-   airflow-scheduler
-   postgres
-   qdrant
-   redis

Verifique containers:

``` bash
docker ps
```

------------------------------------------------------------------------

# Acessando o Airflow

Interface web:

http://localhost:8080

Credenciais padrão:

    user: airflow
    password: airflow

No Airflow você pode:

-   ativar DAGs
-   executar pipelines
-   visualizar logs

------------------------------------------------------------------------

# Execução Manual da Pipeline

Para executar apenas o agente **Gertrudes**:

``` bash
docker-compose exec airflow-scheduler bash -lc "python /opt/scripts/agents/gertrudes_run.py --product schola --root /opt/products --force"
```

Parâmetros:

  Parâmetro     Descrição
  ------------- ------------------------------
  `--product`   nome do diretório do produto
  `--root`      diretório raiz de produtos
  `--force`     ignora cache

------------------------------------------------------------------------

# Estrutura de Diretórios

    products/
       schola/
          intention.md
          context.json

    tools/
       runner/
          agents/
             gertrudes/
             corrinha/

    knowledge/
       requirements/
       architecture/
       product/

------------------------------------------------------------------------

# Saídas Geradas

Após execução do Gertrudes:

    products/<produto>/

Arquivos gerados:

    requirements.md
    non_functional.md
    glossary.md
    assumptions.md
    handoff_to_corrinha.md

Esses artefatos são utilizados pelos próximos agentes.

------------------------------------------------------------------------

# Diretório de Debug

Logs detalhados são salvos em:

    products/<produto>/_debug/gertrudes/

Arquivos importantes:

    first_pass_prompt.txt
    raw_llm_first_pass.txt
    parsed_llm_first_pass.json

    self_review_prompt.txt
    raw_llm_self_review.txt
    parsed_llm_self_review.json

Eles permitem analisar:

-   prompt enviado ao modelo
-   resposta bruta
-   parsing aplicado

------------------------------------------------------------------------

# Executando Sem Docker

Modo desenvolvimento local:

``` bash
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Execute o agente:

``` bash
python tools/runner/agents/gertrudes_run.py   --product schola   --root products   --force
```

------------------------------------------------------------------------

# Atualizando a Base de Conhecimento

Se novos documentos forem adicionados:

    knowledge/

Execute o indexador:

``` bash
python tools/indexer/index_documents.py
```

Esse processo:

1.  divide documentos em chunks
2.  gera embeddings
3.  armazena vetores no Qdrant

------------------------------------------------------------------------

# Verificando o Banco Vetorial

Interface Qdrant:

http://localhost:6333/dashboard

Você pode visualizar:

-   coleções
-   vetores
-   payloads

------------------------------------------------------------------------

# Troubleshooting

## LLM não retornou JSON

Verifique:

    _debug/gertrudes/raw_llm_first_pass.txt

Possíveis causas:

-   prompt mal formatado
-   saída excedendo token limit
-   modelo retornando markdown

------------------------------------------------------------------------

## Output contracts inválidos

Significa que algum artefato violou o contrato esperado.

Exemplo:

-   requisitos insuficientes
-   prefixos incorretos
-   seções ausentes

Abra:

    _debug/gertrudes/parsed_llm_contract_repair.json

------------------------------------------------------------------------

# Stack Recomendada

    LLM → Llama 3
    Embeddings → BGE-M3
    Vector DB → Qdrant
    Reranker → BGE-reranker
    Orquestração → Airflow

------------------------------------------------------------------------

# Objetivo da Pipeline

Demonstrar como IA pode apoiar engenharia de software automatizando:

-   elicitação de requisitos
-   análise de domínio
-   modelagem de eventos
-   geração de artefatos técnicos
