# ODD Orchestration V2

Orchestrator de observabilidade baseado em LangGraph e Bedrock.

O comando principal do projeto é o workflow completo de observabilidade. Ele recebe:

- uma planilha `.xlsx`, `.xls` ou `.csv`
- ou um JSON estruturado vindo do projeto de `event-storming`

E pode executar:

- o fluxo completo
- ou uma execução parcial por etapa

## Scripts

- `npm run workflow`
- `npm run applier`
- `npm run check`

## Etapas do Workflow

O workflow possui estas etapas:

1. `input`: leitura e normalização da entrada
2. `categorize`: separação dos eventos em `problems` e `normal`
3. `slos`: sugestão de 3 a 5 SLOs
4. `plan`: geração do `plan.json`
5. `terraform`: compilação do dashboard Terraform
6. `apply`: `terraform init`, `terraform apply` e envio dos eventos para o Datadog em batch

## Entrada

Entradas aceitas:

- planilha com colunas de event storming
- JSON com `rows`
- JSON com `candidateEvents`

Exemplo com planilha:

```bash
npm install

npm run workflow -- \
  --input ./samples/event-storming-tuangou-project-format.xlsx \
  --dashboard-title "ODD - Tuangou" \
  --provider datadog
```

Exemplo com JSON estruturado do event-storming:

```bash
npm run workflow -- \
  --input ../event-storming/bedrock/generated/payments/03-standardized-context.json \
  --dashboard-title "ODD - Payments" \
  --provider datadog
```

Providers suportados no workflow:

- `datadog`
- `dynatrace`
- `grafana`

## Execução Completa

Sem parâmetros extras de etapa, o comando executa tudo:

- `input`
- `categorize`
- `slos`
- `plan`
- `terraform`
- `apply` para `datadog`

Exemplo:

```bash
npm run workflow -- \
  --input ./samples/event-storming-tuangou-project-format.xlsx \
  --dashboard-title "ODD - Tuangou" \
  --provider datadog
```

## Execução Parcial

Você pode controlar a execução com:

- `--start-from <input|categorize|slos|plan|terraform|apply>`
- `--end-at <input|categorize|slos|plan|terraform|apply>`

### Parar após uma etapa

Parar depois do `input`:

```bash
npm run workflow -- \
  --input ./samples/event-storming-tuangou-project-format.xlsx \
  --dashboard-title "ODD - Tuangou" \
  --provider datadog \
  --end-at input
```

Parar depois do `categorize`:

```bash
npm run workflow -- \
  --input ./samples/event-storming-tuangou-project-format.xlsx \
  --dashboard-title "ODD - Tuangou" \
  --provider datadog \
  --end-at categorize
```

### Retomar de uma etapa intermediária

Executar somente `categorize` a partir de `rows.json`:

```bash
npm run workflow -- \
  --rows-file ./generated/<run-id>/rows.json \
  --dashboard-title "ODD - Tuangou" \
  --provider datadog \
  --start-from categorize \
  --end-at categorize
```

Executar somente `slos` a partir de `categorized-events.json`:

```bash
npm run workflow -- \
  --categorized-file ./generated/<run-id>/categorized-events.json \
  --dashboard-title "ODD - Tuangou" \
  --provider datadog \
  --start-from slos \
  --end-at slos
```

Executar `plan` e `terraform` a partir dos artefatos intermediários:

```bash
npm run workflow -- \
  --categorized-file ./generated/<run-id>/categorized-events.json \
  --slo-file ./generated/<run-id>/slo-suggestions.json \
  --dashboard-title "ODD - Tuangou" \
  --provider datadog \
  --start-from plan
```

Executar somente `terraform` a partir de um `plan.json`:

```bash
npm run workflow -- \
  --plan-file ./generated/<run-id>/plan.json \
  --provider datadog \
  --start-from terraform \
  --end-at terraform
```

Executar somente `apply` a partir de um `plan.json`:

```bash
npm run workflow -- \
  --plan-file ./generated/<run-id>/plan.json \
  --provider datadog \
  --start-from apply \
  --end-at apply
```

Arquivos auxiliares suportados na retomada:

- `--rows-file`
- `--categorized-file`
- `--slo-file`
- `--plan-file`

## Saídas

Cada execução grava um diretório em `generated/` com os artefatos produzidos na etapa executada:

- `rows.json`
- `categorized-events.json`
- `slo-suggestions.json`
- `plan.json`
- `custom-events.json`
- `<provider>-dashboard.auto.tf.json`
- `apply-report.json` quando a etapa `apply` for executada

O Terraform compilado também é gravado em:

- `terraform/generated/`
- `terraform-dynatrace/generated/`
- `terraform-grafana/generated/`

## Ambiente

O projeto carrega variáveis nesta ordem:

1. `.env` do `odd-orchestration-v2`
2. fallback em `../event-storming/bedrock/.env`

Variáveis principais:

- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN` opcional
- `AWS_REGION`
- `BEDROCK_REQUEST_TIMEOUT_MS`
- `ODD_ORCHESTRATION_MODEL`
- `ODD_ORCHESTRATION_CATEGORIZE_MODEL`
- `ODD_ORCHESTRATION_SLO_MODEL`
- `ODD_ORCHESTRATION_PLAN_MODEL`

Default final de modelo:

- `amazon.nova-lite-v1:0`

## Applier Datadog

O `applier` atual está implementado para Datadog.

Ele executa:

- `terraform init`
- `terraform apply`
- ingestão dos `custom-events`
- geração de `apply-report.json`

Dry run:

```bash
npm run applier -- \
  --terraform-dir ./terraform \
  --events-file ./generated/<run-id>/custom-events.json \
  --dry-run
```

Execução real:

```bash
npm run applier -- \
  --terraform-dir ./terraform \
  --events-file ./generated/<run-id>/custom-events.json
```

Variáveis necessárias para apply real no Datadog:

- `DD_API_KEY`
- `DD_APP_KEY`
- `DD_SITE` opcional
- `DD_API_BASE_URL` opcional
- `DD_EVENT_BATCH_SIZE` opcional

## Observação

Se o Bedrock falhar, a rede estiver indisponível, ou a resposta sair do contrato esperado, o workflow aplica fallback heurístico para continuar a execução.
