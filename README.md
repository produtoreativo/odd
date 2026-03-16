# odd — Observability Driven Design

> Transformando intenções de produto em requisitos estruturados e dashboards operacionais através de agentes de IA.

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
  │                  │  no Datadog
  └────────┬────────┘
           │
           ▼
  ┌─────────────────┐
  │  📊 Dashboard    │  Dashboard no Datadog com
  │     Datadog      │  event streams organizados
  │                  │  por domínio e categorias
  └─────────────────┘
```

## Componentes

### odd-orchestrator (TypeScript/Node.js)

Responsável por transformar planilhas de Event Storming em dashboards do Datadog via Terraform.

- **Planner** — Lê arquivos XLSX/CSV de Event Storming, categoriza eventos em "problemas" (erros, falhas, rejeições) e "normais" (sucessos, aprovações), e gera o plano do dashboard junto com o código Terraform
- **Applier** — Executa `terraform plan/apply` para criar o dashboard no Datadog e ingere eventos customizados sintéticos para popular os event streams

Cada prompt do Planner pode usar um modelo de LLM diferente (Ollama local, OpenAI ou Anthropic Claude).

### tools (Python/Docker)

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
| Dashboards | Datadog + Terraform (IaC) |
| Linguagens | TypeScript (orchestrator), Python (agentes) |
| Infraestrutura | Docker Compose, PostgreSQL, Redis |

## Estado atual e roadmap

### Pronto

- **Gertrudes** — Geração completa de requisitos com RAG, múltiplas passadas, validação de domínio e contratos de qualidade
- **Planner** — Leitura de Event Storming, categorização de eventos por sucesso/falha, geração de planos e Terraform
- **Applier** — Execução de Terraform e ingestão de eventos no Datadog
- **Abstração de LLM** — Suporte a Ollama, OpenAI e Anthropic com seleção por prompt
- **Infraestrutura** — Stack completa com Airflow, Qdrant e Ollama via Docker Compose

### Planejado

- **Corrinha** — Agente que converte requisitos em user stories, casos de uso e contratos de API
- **Creuza** — Agente que gera Event Storming automaticamente a partir dos requisitos
- **Pipeline end-to-end** — Integração completa desde a intenção do produto até o dashboard no Datadog, sem intervenção manual
- **Base de conhecimento expandida** — Indexação de livros clássicos de engenharia de requisitos e software (Mastering the Requirements Process, Software Requirements, SWEBOK)

### A visão completa

Quando todos os agentes estiverem conectados, o fluxo será:

> Você descreve o que o produto deve fazer → o odd gera os requisitos, as user stories, os eventos de domínio, o dashboard de observabilidade e o código Terraform — tudo validado, estruturado e pronto para deploy.

O objetivo é que a distância entre a intenção e a observabilidade seja zero.

## Como executar

### odd-orchestrator

```bash
cd odd-orchestrator
npm install
npm run build

# Gerar plano de dashboard a partir de Event Storming
npm run planner -- --input ./samples/event-storming.xlsx --dashboard-title "Meu Dashboard"

# Aplicar no Datadog (requer DD_API_KEY, DD_APP_KEY, DD_SITE)
npm run applier -- --terraform-dir ./terraform --events-file ./generated/custom-events.json

# Apenas verificar o plano sem aplicar
npm run applier -- --terraform-dir ./terraform --events-file ./generated/custom-events.json --dry-run
```

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
| `dashboard_widget` | Tipo de widget: `event_stream` ou `note` |
| `query_hint` | Template de query para o Datadog |

Veja exemplos em `odd-orchestrator/samples/`.

## Artefatos gerados

### Pelo Planner
- `generated/plan.json` — Estrutura do dashboard (seções, grupos, widgets)
- `generated/custom-events.json` — Eventos sintéticos para o Datadog
- `terraform/generated/{runId}-dashboard.auto.tf.json` — Código Terraform

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
| `OLLAMA_ENABLED`, `OLLAMA_MODEL` | Planner | LLM local para enhancement de títulos |
| `CHUNK_SIZE`, `CHUNK_OVERLAP` | Airflow | Configuração de chunking para indexação RAG |
