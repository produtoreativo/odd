# odd — Observability Driven Design

> Transformando intenções de produto em requisitos estruturados e dashboards operacionais através de agentes de IA.

## Status do projeto

O ecossistema **odd** ainda está em construção.

- **odd-orchestrator** — **Release Candidate (RC)**. É o componente mais maduro hoje e já cobre o fluxo de Event Storming para plano de dashboard, geração de Terraform e aplicação no Datadog.
  Hoje também já possui suporte funcional para Dynatrace e Grafana Cloud, embora o caminho Datadog ainda seja o mais maduro.
- **Demais agentes e pipeline multi-agente** — **em construção**. As peças fora do orchestrator ainda estão evoluindo em arquitetura, contratos e integração end-to-end.

Se você quer avaliar o projeto agora, o ponto de entrada recomendado é o diretório `odd-orchestrator/`.

## O que é o odd?

O **odd** é um sistema de engenharia de requisitos e observabilidade orientado por IA, construído sobre o conceito de **Observability Driven Design (ODD)** — a ideia de que a observabilidade não é algo que se adiciona depois, mas sim parte fundamental do design desde o primeiro momento.

Na prática, isso significa que quando você descreve a intenção de um produto, o odd não gera apenas requisitos e user stories — ele também produz os eventos de domínio e os dashboards que vão permitir observar o sistema em produção. O resultado é uma ponte direta entre o que o produto **faz** e o que a operação **enxerga**.

## O problema

No ciclo tradicional de desenvolvimento, existe um gap enorme entre o que o time de produto imagina e o que a engenharia entrega em termos de observabilidade:

1. **Requisitos são escritos manualmente** — propensos a inconsistências, lacunas e ambiguidades
2. **Event Storming vive em post-its** — se perde depois do workshop
3. **Dashboards são criados ad-hoc** — desconectados dos eventos de domínio
4. **Observabilidade é um afterthought** — adicionada quando já está em produção e algo quebrou

O odd resolve isso com um pipeline automatizado que conecta essas etapas usando orquestração multi-agente com LLMs.

## Visão geral

```
                          O PIPELINE ODD
                          ═════════════

  ┌─────────────────┐
  │  Intenção do     │  intention.md + context.json
  │  Produto         │  (o que o produto deve fazer)
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  🤖 Gertrudes    │  Agente de requisitos (RAG + LLM)
  │                  │  Gera: requisitos, glossário,
  │                  │  premissas, requisitos não-funcionais
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  🤖 Corrinha     │  Agente de user stories [PLANEJADO]
  │                  │  Converte requisitos em histórias
  │                  │  de usuário e contratos de API
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  🤖 Creuza       │  Agente de Event Storming [PLANEJADO]
  │                  │  Gera planilha de Event Storming
  │                  │  a partir dos requisitos
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  📋 Planner      │  Lê Event Storming (XLSX/CSV)
  │                  │  Categoriza eventos (sucesso/falha)
  │                  │  Gera plano do dashboard + Terraform
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  🚀 Applier      │  Executa terraform apply
  │                  │  Ingere eventos sintéticos
  │                  │  no Datadog, Dynatrace ou Grafana
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  📊 Dashboard    │  Dashboard operacional em
  │  Datadog/DT/GF   │  Datadog, Dynatrace ou Grafana
  │                  │  com eventos e KPIs por fluxo
  └─────────────────┘
```

## Componentes

### odd-orchestrator (TypeScript/Node.js) — Release Candidate

Responsável por transformar planilhas de Event Storming em dashboards via Terraform para Datadog, Dynatrace e Grafana Cloud.

- **Planner** — Lê arquivos XLSX/CSV de Event Storming, categoriza eventos em "problemas" (erros, falhas, rejeições) e "normais" (sucessos, aprovações), e gera o plano do dashboard junto com o código Terraform
- **Applier** — Executa `terraform plan/apply` para criar o dashboard no provider selecionado e ingere eventos customizados sintéticos para popular os painéis

Cada prompt do Planner pode usar um modelo de LLM diferente (Ollama local, OpenAI ou Anthropic Claude).

### tools (Python/Docker) — Em construção

Pipeline multi-agente para geração de requisitos usando RAG (Retrieval-Augmented Generation).

- **Gertrudes** — O primeiro agente do pipeline. Recebe a intenção do produto, consulta uma base de conhecimento vetorial (Qdrant) em duas etapas (coarse → fine), e gera requisitos estruturados com validação de domínio e contratos de qualidade. Inclui ciclos de auto-revisão e reparo
- **Airflow DAGs** — Orquestram a execução do pipeline, descobrindo produtos automaticamente e disparando os agentes
- **Infraestrutura** — Stack Docker Compose com Airflow, PostgreSQL, Redis, Qdrant e Ollama

#### O processo da Gertrudes em detalhe

1. Recebe `intention.md` (descrição do produto) e `context.json` (metadados)
2. Busca evidências relevantes na base de conhecimento via RAG de duas etapas
3. Gera um resumo de domínio
4. Produz requisitos em primeira passada
5. Faz auto-revisão contra uma rubrica de qualidade
6. Repara aderência ao domínio (termos obrigatórios, termos proibidos)
7. Valida contratos de saída (estrutura dos arquivos, seções obrigatórias)
8. Escreve os artefatos finais + logs de debug

## Stack tecnológico

| Camada | Tecnologias |
|--------|-------------|
| Modelos LLM | Ollama (local), Anthropic Claude, OpenAI GPT-4 |
| Embeddings | nomic-embed-text via Ollama |
| Banco vetorial | Qdrant |
| Orquestração | Apache Airflow + Celery |
| Dashboards | Datadog, Dynatrace, Grafana Cloud + Terraform (IaC) |
| Linguagens | TypeScript (orchestrator), Python (agentes) |
| Infraestrutura | Docker Compose, PostgreSQL, Redis |

## Estado atual e roadmap

### Maturidade atual

- **Release Candidate**
  - `odd-orchestrator`
- **Em construção**
  - `tools/`
  - Gertrudes como produto operacional dentro do pipeline maior
  - Corrinha
  - Creuza
  - Integração completa entre todos os agentes

### Pronto

- **Gertrudes** — Geração completa de requisitos com RAG, múltiplas passadas, validação de domínio e contratos de qualidade
- **Planner** — Leitura de Event Storming, categorização de eventos por sucesso/falha, geração de planos e Terraform
- **Applier** — Execução de Terraform e ingestão de eventos no Datadog, Dynatrace e Grafana Cloud
- **Abstração de LLM** — Suporte a Ollama, OpenAI e Anthropic com seleção por prompt
- **Infraestrutura** — Stack completa com Airflow, Qdrant e Ollama via Docker Compose

### Planejado

- **Corrinha** — Agente que converte requisitos em user stories, casos de uso e contratos de API
- **Creuza** — Agente que gera Event Storming automaticamente a partir dos requisitos
- **Pipeline end-to-end** — Integração completa desde a intenção do produto até o dashboard no Datadog/Dynatrace/Grafana, sem intervenção manual
- **Base de conhecimento expandida** — Indexação de livros clássicos de engenharia de requisitos e software (Mastering the Requirements Process, Software Requirements, SWEBOK)

### A visão completa

Quando todos os agentes estiverem conectados, o fluxo será:

> Você descreve o que o produto deve fazer → o odd gera os requisitos, as user stories, os eventos de domínio, o dashboard de observabilidade e o código Terraform — tudo validado, estruturado e pronto para deploy.

O objetivo é que a distância entre a intenção e a observabilidade seja zero.

## Como executar

### odd-orchestrator

O `odd-orchestrator` é hoje o ponto de entrada recomendado do repositório. Ele já suporta:

- geração de dashboard para `datadog`
- geração de dashboard para `dynatrace`
- geração de dashboard para `grafana` (Grafana Cloud)
- ingestão de eventos sintéticos nos três providers
- execução ponta a ponta via `pipeline.sh`

#### Instalação

```bash
cd odd-orchestrator
npm install
npm run build
```

#### Configuração de ambiente

Crie `.env` a partir de `.env.example`.

Exemplo mínimo:

```dotenv
DD_API_KEY=XXXXXX
DD_APP_KEY=XXXXXX
DD_SITE=datadoghq.com
DD_API_BASE_URL=https://api.datadoghq.com
DD_EVENT_BATCH_SIZE=10

OLLAMA_ENABLED=true
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=qwen2.5-coder:14b

DYNATRACE_ENV_URL=https://SEU-AMBIENTE.live.dynatrace.com
DYNATRACE_API_TOKEN=xxxxxx
DYNATRACE_PLATFORM_TOKEN=xxxxxx
DYNATRACE_EVENT_TIMEOUT_MINUTES=15

GRAFANA_URL=https://your-stack.grafana.net
GRAFANA_AUTH=glsa_xxxxxxxxxxxxxxxxxxxx
GRAFANA_METRICS_URL=https://prometheus-prod-XX-prod-REGION-0.grafana.net
GRAFANA_METRICS_USER=000000
GRAFANA_METRICS_TOKEN=glc_xxxxxxxxxxxxxxxxxxxx
```

Observações:

- `DYNATRACE_API_TOKEN` é usado para ingestão em `/api/v2/events/ingest`
- `DYNATRACE_PLATFORM_TOKEN` é usado pelo provider Terraform ao criar dashboards novos via `dynatrace_document`
- `GRAFANA_AUTH` (service account token `glsa_...`) é usado pelo provider Terraform para criação de dashboards
- `GRAFANA_METRICS_TOKEN` (Cloud Access Policy token `glc_...`) é usado para push de métricas Prometheus via InfluxDB line protocol
- `OLLAMA_BASE_URL` deve preferencialmente usar `127.0.0.1`, não `localhost`

#### Pipeline ponta a ponta

Uso:

```bash
./pipeline.sh [datadog|dynatrace|grafana] [planilha.xlsx|planilha.csv] [dashboard-title]
```

Exemplos:

```bash
./pipeline.sh
./pipeline.sh datadog
./pipeline.sh datadog ./samples/event-storming.xlsx "Meu Dashboard"
./pipeline.sh dynatrace ./samples/value_stream_confirmacao_pagamento_completa.xlsx "PagamentoCompleto"
./pipeline.sh grafana ./samples/event-storming.xlsx "Meu Dashboard Grafana"
```

Comportamento atual do script:

- carrega o `.env`
- valida a saúde do Ollama
- executa o `planner`
- descobre o diretório de saída em `generated/...`
- executa o `applier` com o provider selecionado

#### Execução manual

Planner Datadog:

```bash
npm run planner -- \
  --input ./samples/event-storming.xlsx \
  --dashboard-title "Meu Dashboard" \
  --provider datadog
```

Planner Dynatrace:

```bash
npm run planner -- \
  --input ./samples/event-storming.xlsx \
  --dashboard-title "Meu Dashboard" \
  --provider dynatrace
```

Applier Datadog:

```bash
npm run applier -- \
  --terraform-dir ./terraform \
  --events-file ./generated/<run>/custom-events.json \
  --provider datadog
```

Applier Dynatrace:

```bash
npm run applier -- \
  --terraform-dir ./terraform-dynatrace \
  --events-file ./generated/<run>/custom-events.json \
  --provider dynatrace
```

Planner Grafana:

```bash
npm run planner -- \
  --input ./samples/event-storming.xlsx \
  --dashboard-title "Meu Dashboard" \
  --provider grafana
```

Applier Grafana:

```bash
npm run applier -- \
  --terraform-dir ./terraform-grafana \
  --events-file ./generated/<run>/custom-events.json \
  --provider grafana
```

Dry run:

```bash
npm run applier -- \
  --terraform-dir ./terraform \
  --events-file ./generated/<run>/custom-events.json \
  --provider datadog \
  --dry-run
```

#### Providers e maturidade

- `datadog`: caminho mais maduro hoje
- `dynatrace`: já cria dashboard nova, aplica Terraform e ingere eventos, mas ainda está evoluindo na paridade visual com o Datadog
- `grafana`: cria dashboard no Grafana Cloud via Terraform e ingere métricas via Prometheus (InfluxDB line protocol). Compatível com o free tier do Grafana Cloud

### Stack Docker (Gertrudes + infra)

```bash
cd tools/iac
docker-compose up -d

# Executar Gertrudes manualmente
docker-compose exec airflow-scheduler python /opt/scripts/agents/gertrudes_run.py \
  --product schola --root /opt/products --force
```

## Formato de entrada — Event Storming

O Planner espera planilhas XLSX ou CSV com as seguintes colunas:

| Coluna | Descrição |
|--------|-----------|
| `ordem` | Número de sequência do evento |
| `event_key` | Identificador único (ex: `analyst_entry_approved`) |
| `event_title` | Título legível do evento |
| `stage` | Etapa do processo (ex: `triagem`, `solicitacao`, `execucao`) |
| `actor` | Quem dispara ou trata o evento |
| `service` | Serviço responsável |
| `tags` | Metadados separados por vírgula (ex: `journey:inspection,domain:risk`) |
| `dashboard_widget` | Tipo de widget de origem: `event_stream`, `note`, `query_value` ou `timeseries` |
| `query_hint` | Template de query para o Datadog |

Veja exemplos em `odd-orchestrator/samples/`.

## Artefatos gerados

### Pelo Planner
- `generated/<inputName>_<timestamp>/plan.json` — Estrutura do dashboard em bandas visuais fixas (hero, KPIs e tendências)
- `generated/<inputName>_<timestamp>/custom-events.json` — Eventos sintéticos para Datadog ou Dynatrace
- `terraform/generated/<inputName>-dashboard.auto.tf.json` — Código Terraform para Datadog
- `terraform-dynatrace/generated/<inputName>-dashboard.auto.tf.json` — Código Terraform para Dynatrace
- `terraform-grafana/generated/<inputName>-dashboard.auto.tf.json` — Código Terraform para Grafana Cloud

### Pelo Applier
- `generated/apply-report.json` — Relatório de sucesso/falha da aplicação

### Pela Gertrudes
- `products/{produto}/1-requirements/requirements.md` — Requisitos funcionais (RF-001, RF-002, ...)
- `products/{produto}/1-requirements/non_functional.md` — Requisitos não-funcionais
- `products/{produto}/1-requirements/glossary.md` — Glossário do domínio
- `products/{produto}/1-requirements/assumptions.md` — Premissas (AS-001, AS-002, ...)
- `products/{produto}/1-requirements/domain_summary.md` — Resumo do domínio
- `products/{produto}/1-requirements/handoff_to_corrinha.md` — Instruções para o próximo agente

## Variáveis de ambiente

| Variável | Componente | Uso |
|----------|------------|-----|
| `DD_API_KEY`, `DD_APP_KEY`, `DD_SITE` | Applier | Autenticação no Datadog |
| `DYNATRACE_ENV_URL`, `DYNATRACE_API_TOKEN` | Applier | Ingestão de eventos no Dynatrace |
| `DYNATRACE_PLATFORM_TOKEN` | Terraform Dynatrace | Criação de dashboards novas via `dynatrace_document` |
| `GRAFANA_URL`, `GRAFANA_AUTH` | Terraform Grafana | URL do stack e service account token (`glsa_...`) para criação de dashboards |
| `GRAFANA_METRICS_URL`, `GRAFANA_METRICS_USER` | Applier | Endpoint e usuário para push de métricas Prometheus |
| `GRAFANA_METRICS_TOKEN` | Applier | Cloud Access Policy token (`glc_...`) para push de métricas |
| `OLLAMA_ENABLED`, `OLLAMA_BASE_URL`, `OLLAMA_MODEL` | Planner | LLM local para categorização e suporte ao planner |
| `CHUNK_SIZE`, `CHUNK_OVERLAP` | Airflow | Configuração de chunking para indexação RAG |
