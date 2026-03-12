# ODD DataDog Agents with XLSX support

Projeto mínimo em TypeScript com 2 agentes:

- `planner`: lê uma planilha de Event Storming em CSV ou XLSX, normaliza os eventos, usa opcionalmente o Ollama para melhorar títulos de grupos, e gera:
  - `generated/plan.json`
  - `generated/custom-events.json`
  - `terraform/generated/dashboard.auto.tf.json`
- `applier`: executa Terraform e ingere os eventos sintéticos no DataDog.

## Escopo intencionalmente simples

Esta versão foca somente em:

- `event_stream`
- `note`

Isso evita erro conceitual de prometer widgets numéricos sem pipeline de métricas customizadas.

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
| 1 | analyst_entry_approved | Analyst Entry Approved | triagem | analyst | risk-analysis | journey:inspection,domain:risk | event_stream | tags:(event_key:analyst_entry_approved service:risk-analysis) |
| 2 | inspection_requested | Inspection Requested | solicitacao | system | inspection-api | journey:inspection,domain:field | event_stream | tags:(event_key:inspection_requested service:inspection-api) |

## Instalação

```bash
npm install
```

## Executando o planner

CSV:

```bash
npm run planner -- \
  --input ./samples/event-storming.csv \
  --dashboard-title "ODD - Inspection Journey"
```

XLSX:

```bash
npm run planner -- \
  --input ./samples/event-storming.xlsx \
  --dashboard-title "ODD - Inspection Journey"
```

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
  --dry-run
```

Real:

```bash
DD_API_KEY=xxx \
DD_APP_KEY=yyy \
DD_SITE=datadoghq.com \
npm run applier -- \
  --terraform-dir ./terraform \
  --events-file ./generated/custom-events.json
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

## Estrutura

```txt
src/
  agents/
    planner/
    applier/
  shared/
samples/
terraform/generated/
generated/
```

## Observações de corretude

- O dashboard gerado usa `datadog_dashboard_json` em Terraform.
- Os eventos sintéticos são preparados para `POST /api/v1/events`.
- Não há lockfile no projeto, conforme pedido.
- O parser aceita tanto CSV quanto XLSX; no caso do XLSX, usa a primeira aba não vazia.
