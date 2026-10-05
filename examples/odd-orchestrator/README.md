# ODD DataDog Agents with XLSX support

Projeto mínimo em TypeScript com 2 agentes:

- `planner`: lê uma planilha de Event Storming em CSV ou XLSX, normaliza os eventos, usa opcionalmente o Ollama para melhorar títulos de grupos, e gera:
  - `generated/plan.json`
  - `generated/custom-events.json`
  - `terraform/generated/dashboard.auto.tf.json`
- `applier`: executa Terraform e ingere os eventos sintéticos no DataDog.

## Escopo visual atual

Esta versão gera dashboards no padrão visual de funil operacional, com bandas fixas:

- `hero_alert`
- `failure_kpis`
- `failure_trends`
- `success_kpis`
- `success_trends`

Os widgets de dados produzidos pelo planner são:

- `query_value`
- `timeseries`

O parser da planilha também aceita `event_stream` e `note` por compatibilidade, mas o plano final é normalizado para cards numéricos e séries temporais.

## Formato mínimo da planilha

A primeira aba do XLSX ou o CSV devem ter estas colunas:

- `ordem`
- `event_key`
- `event_title`
- `stage`
- `actor`
- `service`
- `tags`
- `dashboard_widget`
- `query_hint`

### Exemplo

| ordem | event_key | event_title | stage | actor | service | tags | dashboard_widget | query_hint |
|---|---|---|---|---|---|---|---|---|
| 1 | analyst_entry_approved | Analyst Entry Approved | triagem | analyst | risk-analysis | journey:inspection,domain:risk | query_value | tags:(event_key:analyst_entry_approved service:risk-analysis) |
| 2 | inspection_requested | Inspection Requested | solicitacao | system | inspection-api | journey:inspection,domain:field | timeseries | tags:(event_key:inspection_requested service:inspection-api) |

## Instalação

```bash
npm install
```

## Executando o planner

CSV:

```bash
npm run planner -- \
  --input ./samples/event-storming.csv \
  --dashboard-title "ODD - Inspection Journey" \
  --provider datadog
```

XLSX:

```bash
npm run planner -- \
  --input ./samples/event-storming.xlsx \
  --dashboard-title "ODD - Inspection Journey" \
  --provider datadog
```

Dynatrace:

```bash
npm run planner -- \
  --input ./samples/event-storming.xlsx \
  --dashboard-title "ODD - Inspection Journey" \
  --provider dynatrace
```

Observação:

- O compilador Dynatrace gera uma dashboard no formato novo via `dynatrace_document`, mantendo a distribuição proporcional do `DashboardPlan` com tiles `MARKDOWN`.
- O fluxo Datadog continua sendo o caminho mais completo para widgets analíticos (`query_value` e `timeseries`) porque o input atual ainda não carrega um modelo de métrica/query nativo do Dynatrace.

Com Ollama opcional:

```bash
OLLAMA_ENABLED=true \
OLLAMA_MODEL=qwen2.5-coder \
npm run planner -- --input ./samples/event-storming.xlsx --dashboard-title "ODD - Inspection Journey"
```

## Executando o applier

Dry run:

```bash
npm run applier -- \
  --terraform-dir ./terraform \
  --events-file ./generated/custom-events.json \
  --provider datadog \
  --dry-run
```

Real:

```bash
DD_API_KEY=xxx \
DD_APP_KEY=yyy \
DD_SITE=datadoghq.com \
npm run applier -- \
  --terraform-dir ./terraform \
  --events-file ./generated/custom-events.json \
  --provider datadog
```

Dynatrace:

```bash
npm run applier -- \
  --terraform-dir ./terraform-dynatrace \
  --events-file ./generated/custom-events.json \
  --provider dynatrace \
  --dry-run
```

## Variáveis de ambiente

### Planner

- `OLLAMA_ENABLED=true|false`
- `OLLAMA_BASE_URL=http://localhost:11434`
- `OLLAMA_MODEL=qwen2.5-coder`

### Applier

- `DD_API_KEY`
- `DD_APP_KEY`
- `DD_SITE=datadoghq.com`
- `DD_API_BASE_URL=https://api.datadoghq.com`
- `DD_EVENT_BATCH_SIZE=10`
- `DYNATRACE_ENV_URL`
- `DYNATRACE_API_TOKEN`
- `DYNATRACE_ENTITY_SELECTOR`
- `DYNATRACE_MANAGEMENT_ZONE`
- `DYNATRACE_EVENT_TIMEOUT_MINUTES`

Convenções opcionais de tags para Dynatrace:

- `dynatrace.entity_selector:<selector>` — sobrescreve o `entitySelector` do evento
- `dynatrace.management_zone:<mz>` — adiciona contexto de management zone e, se houver `entitySelector`, injeta `mzName("<mz>")`
- `dt.entity.<type>:<id>` — copia propriedades `dt.entity.*` para o payload do evento

## Estrutura

```txt
src/
  agents/
    planner/
    applier/
  shared/
samples/
terraform/generated/
terraform-dynatrace/generated/
generated/
```

## Observações de corretude

- O dashboard gerado usa `datadog_dashboard_json` em Terraform.
- O layout do dashboard é `free` com posições fixas calculadas pelo compilador.
- Os eventos sintéticos são preparados para `POST /api/v1/events`.
- O parser aceita tanto CSV quanto XLSX; no caso do XLSX, usa a primeira aba não vazia.
