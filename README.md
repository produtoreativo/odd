# odd

Repositório com dois projetos ativos:

- `event-storming`: transforma imagens de event storming em contexto estruturado
- `odd-orchestration-v2`: transforma o contexto estruturado em plano de observabilidade, Terraform e aplicação nos providers

Hoje, o fluxo recomendado do repositório é:

1. processar a imagem no `event-storming/bedrock`
2. usar o `03-standardized-context.json` como entrada do `odd-orchestration-v2`

## Estrutura

```txt
event-storming/
  bedrock/   # workflow multimodal com Amazon Bedrock
  foss/      # variante local/alternativa
odd-orchestration-v2/
  src/
  generated/
  terraform/
  terraform-dynatrace/
  terraform-grafana/
```

## Pré-requisitos

- Node.js 20+
- npm 10+
- Terraform 1.5+
- credenciais AWS com acesso ao Bedrock, se for usar `event-storming/bedrock`
- credenciais do provider de observabilidade que você quer aplicar no `odd-orchestration-v2`

## Instalação

### event-storming/bedrock

```bash
cd event-storming/bedrock
npm install
npm run check
```

### odd-orchestration-v2

```bash
cd odd-orchestration-v2
npm install
npm run check
```

## Ambiente

### event-storming/bedrock

Arquivo: `event-storming/bedrock/.env`

Variáveis mínimas:

```dotenv
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_SESSION_TOKEN=... # opcional
AWS_REGION=us-east-1

BEDROCK_REQUEST_TIMEOUT_MS=3600000

EVENT_STORMING_DEFAULT_MODEL=amazon.nova-lite-v1:0
EVENT_STORMING_OBSERVE_MODEL=amazon.nova-pro-v1:0
EVENT_STORMING_EXTRACT_MODEL=amazon.nova-lite-v1:0
EVENT_STORMING_NORMALIZE_MODEL=amazon.nova-lite-v1:0
```

### odd-orchestration-v2

Arquivo: `odd-orchestration-v2/.env`

Variáveis mínimas para geração com Bedrock:

```dotenv
AWS_ACCESS_KEY_ID=...
AWS_SECRET_ACCESS_KEY=...
AWS_SESSION_TOKEN=... # opcional
AWS_REGION=us-east-1

BEDROCK_REQUEST_TIMEOUT_MS=3600000

ODD_ORCHESTRATION_MODEL=amazon.nova-lite-v1:0
ODD_ORCHESTRATION_CATEGORIZE_MODEL=amazon.nova-lite-v1:0
ODD_ORCHESTRATION_SLO_MODEL=amazon.nova-lite-v1:0
ODD_ORCHESTRATION_PLAN_MODEL=amazon.nova-lite-v1:0
```

Variáveis por provider:

Datadog:

```dotenv
DD_API_KEY=...
DD_APP_KEY=...
DD_SITE=datadoghq.com
DD_API_BASE_URL=https://api.datadoghq.com
DD_EVENT_BATCH_SIZE=10
```

Dynatrace:

```dotenv
DYNATRACE_ENV_URL=https://SEU-AMBIENTE.live.dynatrace.com
DYNATRACE_API_TOKEN=...
DYNATRACE_PLATFORM_TOKEN=...
DYNATRACE_ENTITY_SELECTOR=...     # opcional
DYNATRACE_MANAGEMENT_ZONE=...     # opcional
DYNATRACE_EVENT_TIMEOUT_MINUTES=15
```

Grafana:

```dotenv
GRAFANA_URL=...
GRAFANA_AUTH=...
GRAFANA_METRICS_URL=...
GRAFANA_METRICS_USER=...
GRAFANA_METRICS_TOKEN=...
```

## Como executar

### 1. Gerar contexto estruturado a partir da imagem

No `event-storming/bedrock`:

```bash
cd event-storming/bedrock

npm run start -- \
  --input-image samples/ODD-Payments-EventStorming.png \
  --output-dir ./generated/payments \
  --env dev \
  --provider bedrock
```

Saídas principais:

- `01-image-observation.json`
- `02-candidate-events.json`
- `03-standardized-context.json`
- `04-workbook.json`
- `recognized-event-storming.xlsx`

Retomadas suportadas:

Do `extract`:

```bash
npm run start -- \
  --input-image samples/ODD-Payments-EventStorming.png \
  --output-dir ./generated/payments \
  --provider bedrock \
  --start-from extract \
  --image-observation ./generated/payments/01-image-observation.json
```

Do `normalize`:

```bash
npm run start -- \
  --input-image samples/ODD-Payments-EventStorming.png \
  --output-dir ./generated/payments \
  --provider bedrock \
  --start-from normalize \
  --candidate-context ./generated/payments/02-candidate-events.json
```

### 2. Gerar e aplicar observabilidade

No `odd-orchestration-v2`:

Exemplo completo com o contexto gerado pelo `event-storming/bedrock`:

```bash
cd odd-orchestration-v2

npm run workflow -- \
  --input ../event-storming/bedrock/generated/payments/03-standardized-context.json \
  --dashboard-title "ODD - Payments - v4" \
  --dashboard-key "payments-acompanhamento-v4" \
  --env dev \
  --provider datadog
```

Providers suportados:

- `datadog`
- `dynatrace`
- `grafana`

Exemplo completo para Dynatrace:

```bash
cd odd-orchestration-v2

npm run workflow -- \
  --input ../event-storming/bedrock/generated/payments/03-standardized-context.json \
  --dashboard-title "ODD - Payments - Dynatrace" \
  --dashboard-key "payments-acompanhamento-dynatrace" \
  --env dev \
  --provider dynatrace \
  --end-at apply
```

Exemplo completo para Datadog com rajadas:

```bash
cd odd-orchestration-v2

npm run workflow -- \
  --input ../event-storming/bedrock/generated/payments/03-standardized-context.json \
  --dashboard-title "ODD - Payments - v4" \
  --dashboard-key "payments-acompanhamento-v4" \
  --env dev \
  --provider datadog \
  --burst-count 6 \
  --burst-interval-ms 10000 \
  --copies-per-event 4 \
  --randomize-event-counts
```

## odd-orchestration-v2 em detalhes

### Scripts

```bash
npm run workflow
npm run applier
npm run check
```

### Etapas do workflow

1. `input`
2. `categorize`
3. `slos`
4. `plan`
5. `terraform`
6. `slo_terraform`
7. `apply`

### Execução parcial

Parar no `plan`:

```bash
npm run workflow -- \
  --input ../event-storming/bedrock/generated/payments/03-standardized-context.json \
  --dashboard-title "ODD - Payments - v4" \
  --dashboard-key "payments-acompanhamento-v4" \
  --provider datadog \
  --end-at plan
```

Executar só `terraform` a partir de um `plan.json`:

```bash
npm run workflow -- \
  --plan-file ./generated/<dashboard-key>/<run-id>/plan.json \
  --dashboard-key "<dashboard-key>" \
  --provider datadog \
  --start-from terraform \
  --end-at terraform
```

Executar só `apply` a partir de um `plan.json`:

```bash
npm run workflow -- \
  --plan-file ./generated/<dashboard-key>/<run-id>/plan.json \
  --dashboard-key "<dashboard-key>" \
  --provider dynatrace \
  --start-from apply \
  --end-at apply
```

### Saídas do odd-orchestration-v2

Por execução:

- `generated/<dashboard-key>/<run-id>/`

Arquivos principais:

- `rows.json`
- `categorized-events.json`
- `slo-suggestions.json`
- `plan.json`
- `custom-events.json`
- `<provider>-dashboard.auto.tf.json`
- `<provider>-slos.auto.tf.json` quando houver
- `<provider>-bundle.auto.tf.json`
- `dashboard-metadata.json`
- `apply-report.json` quando `apply` for executado

Workspace Terraform isolado:

- `generated/terraform-workspaces/<provider>/<dashboard-key>/`

## Fluxo recomendado

```bash
cd event-storming/bedrock
npm install
npm run start -- \
  --input-image samples/ODD-Payments-EventStorming.png \
  --output-dir ./generated/payments \
  --env dev \
  --provider bedrock

cd ../../odd-orchestration-v2
npm install
npm run workflow -- \
  --input ../event-storming/bedrock/generated/payments/03-standardized-context.json \
  --dashboard-title "ODD - Payments - v4" \
  --dashboard-key "payments-acompanhamento-v4" \
  --env dev \
  --provider datadog
```

## Observações

- O `event-storming/foss` existe no repositório, mas o caminho principal hoje continua sendo `event-storming/bedrock`.
- O `odd-orchestration-v2` é o orchestrator ativo do repo.
- O `odd-orchestrator` legado não é mais o ponto de entrada recomendado deste README.
