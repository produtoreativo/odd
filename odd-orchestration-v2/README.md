# ODD Orchestration V2

Orchestrator de observabilidade baseado em LangGraph e Bedrock.

O comando principal do projeto é o workflow completo de observabilidade. Ele recebe:

- uma planilha `.xlsx`, `.xls` ou `.csv`
- ou um JSON estruturado vindo do projeto de `event-storming`

E pode executar:

- o fluxo completo
- ou uma execução parcial por etapa

Além do `dashboardTitle`, o workflow agora trabalha com um `dashboardKey`, que representa a identidade estável do dashboard de acompanhamento.

- `dashboardTitle`: nome visual exibido no provider
- `dashboardKey`: identificador técnico usado para isolar artefatos, workspace Terraform e state

Se você não informar `--dashboard-key`, o projeto gera um valor determinístico a partir do provider, do título e da origem da entrada. Quando quiser controlar a identidade de forma estável, informe explicitamente `--dashboard-key`.

Regra prática:

- mude só o `dashboardTitle` quando quiser renomear visualmente o mesmo dashboard
- mude o `dashboardKey` quando quiser outro dashboard, outro workspace Terraform e outro state

## Scripts

- `npm run workflow`
- `npm run applier`
- `npm run check`

## Etapas do Workflow

O workflow possui estas etapas:

1. `input`: leitura e normalização da entrada
2. `categorize`: separação dos eventos em `problems` e `normal`
3. `slos`: sugestão de 3 a 5 SLOs (LLM)
4. `openslo`: composição determinística do bundle OpenSLO v1 — encadeia 7 sub-nodes, um por entidade:
   1. `compose_openslo_datasources` — `DataSource` por provider
   2. `compose_openslo_service` — `Service` único do dashboard
   3. `compose_openslo_slis` — `SLI` por sugestão
   4. `compose_openslo_slos` — `SLO` referenciando o SLI via `indicatorRef`
   5. `compose_openslo_alert_conditions` — `AlertCondition` por SLO em duas janelas (1h/6h burn-rate)
   6. `compose_openslo_alert_notification_targets` — `AlertNotificationTarget` (email + slack default)
   7. `compose_openslo_alert_policies` — `AlertPolicy` ligando conditions a targets
5. `plan`: geração do `plan.json`
6. `terraform`: compilação do Terraform do dashboard
7. `slo_terraform`: compilação do Terraform dos SLOs (deriva do bundle OpenSLO)
8. `apply`: `terraform init` e `terraform apply` para todos os providers; no Datadog também executa envio dos eventos em batch e das métricas sintéticas dos SLOs

Para parar a execução após a composição OpenSLO sem gerar o `plan.json`, use `--end-at openslo`.

Na CLI, `--end-at terraform` continua representando o fechamento do bundle Terraform completo. Internamente o workflow passa por dashboard Terraform e SLO Terraform antes de encerrar ou aplicar.

Na etapa `apply`, a ingestão de eventos também pode simular volume recorrente com rajadas periódicas.

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
  --dashboard-key "tuangou-acompanhamento" \
  --env dev \
  --provider datadog
```

Exemplo com JSON estruturado do event-storming:

```bash
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

Providers suportados no workflow:

- `datadog`
- `dynatrace`
- `grafana`

## Execução Completa

Sem `--end-at`, o comando executa tudo para qualquer provider suportado:

- `input`
- `categorize`
- `slos`
- `plan`
- `terraform`
- `slo_terraform`
- `apply` para qualquer provider suportado

Exemplo:

```bash
npm run workflow -- \
  --input ./samples/event-storming-tuangou-project-format.xlsx \
  --dashboard-title "ODD - Tuangou" \
  --dashboard-key "tuangou-acompanhamento" \
  --provider datadog \
  --burst-count 6 \
  --burst-interval-ms 10000 \
  --copies-per-event 4 \
  --randomize-event-counts
```

## Execução Parcial

Você pode controlar a execução com:

- `--start-from <input|categorize|slos|plan|terraform|apply>`
- `--end-at <input|categorize|slos|plan|terraform|apply>`
- `--env <dev|...>`: ambiente usado nos `queryHint`; opcional, padrão `dev`

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
  --rows-file ./generated/<dashboard-key>/<run-id>/rows.json \
  --dashboard-title "ODD - Tuangou" \
  --dashboard-key "tuangou-acompanhamento" \
  --provider datadog \
  --start-from categorize \
  --end-at categorize
```

Executar somente `slos` a partir de `categorized-events.json`:

```bash
npm run workflow -- \
  --categorized-file ./generated/<dashboard-key>/<run-id>/categorized-events.json \
  --dashboard-title "ODD - Tuangou" \
  --dashboard-key "tuangou-acompanhamento" \
  --provider datadog \
  --start-from slos \
  --end-at slos
```


Executar `plan` e `terraform` a partir dos artefatos intermediários:

```bash
npm run workflow -- \
  --categorized-file ./generated/<dashboard-key>/<run-id>/categorized-events.json \
  --slo-file ./generated/<dashboard-key>/<run-id>/slo-suggestions.json \
  --dashboard-title "ODD - Tuangou" \
  --dashboard-key "tuangou-acompanhamento" \
  --provider datadog \
  --start-from plan
```

Executar somente `terraform` a partir de um `plan.json`:

```bash
npm run workflow -- \
  --plan-file ./generated/<dashboard-key>/<run-id>/plan.json \
  --dashboard-key "tuangou-acompanhamento" \
  --provider datadog \
  --start-from terraform \
  --end-at terraform
```

Executar somente `apply` a partir de um `plan.json`:

```bash
npm run workflow -- \
  --plan-file ./generated/<dashboard-key>/<run-id>/plan.json \
  --dashboard-key "tuangou-acompanhamento" \
  --provider datadog \
  --start-from apply \
  --end-at apply \
  --burst-count 12 \
  --burst-interval-ms 5000 \
  --copies-per-event 3 \
  --randomize-event-counts
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
- `cloud-events.json` — eventos canônicos no padrão CloudEvents 1.0
- `openslo.json` e `openslo.yaml` — bundle completo OpenSLO v1 (atalho equivalente a `openslo/bundle.{json,yaml}`)
- `openslo/` — uma pasta com um arquivo por entidade OpenSLO v1, em JSON e YAML:
  - `datasources.{json,yaml}` — `DataSource` por provider
  - `service.{json,yaml}` — `Service`
  - `slis.{json,yaml}` — `SLI`
  - `slos.{json,yaml}` — `SLO` (com `indicatorRef`)
  - `alert-conditions.{json,yaml}` — `AlertCondition` multi-window burn rate
  - `alert-notification-targets.{json,yaml}` — `AlertNotificationTarget`
  - `alert-policies.{json,yaml}` — `AlertPolicy`
  - `bundle.{json,yaml}` — todos os documentos concatenados
- `datadog-events.json` — tradução dos CloudEvents para o formato do endpoint `/api/v1/events` do Datadog
- `dynatrace-bizevents.json` — tradução dos CloudEvents para o batch CloudEvents do `api/v2/bizevents/ingest` do Dynatrace
- `custom-events.json` — alias do `datadog-events.json` mantido por compatibilidade
- `<provider>-dashboard.auto.tf.json`
- `<provider>-slos.auto.tf.json` quando houver suporte de provider
- `<provider>-bundle.auto.tf.json`
- `dashboard-metadata.json`
- `apply-report.json` quando a etapa `apply` for executada

### Formatos canônicos e tradução por provider

- **Eventos**: `cloud-events.json` é a fonte de verdade no padrão CloudEvents 1.0.
  - Dynatrace aceita CloudEvents nativamente em `application/cloudevents-batch+json`; o `dynatrace-bizevents.json` adiciona apenas as extensões `odd.*` em `data` (campos achatados a partir das tags) exigidas pelo schema de BizEvents.
  - Datadog não aceita CloudEvents no endpoint de eventos; o `datadog-events.json` é a tradução proprietária com `title`/`text`/`tags`/`alert_type` necessária para `/api/v1/events`.
- **SLOs**: `openslo.json` e `openslo.yaml` são a fonte de verdade no padrão OpenSLO v1 (`Service` + `SLO` ratio/threshold).
  - Datadog não aceita OpenSLO; o `<provider>-slos.auto.tf.json` traduz para `datadog_service_level_objective` (`type = "metric"`).
  - Dynatrace também não aceita OpenSLO; quando o provider é `dynatrace`, o `<provider>-slos.auto.tf.json` traduz para `dynatrace_slo` com `metric_expression` baseado em `builtin:bizevents.count`/`builtin:bizevents.duration` filtrado por `odd.dashboard_key`/`odd.env`/`odd.slo_id`.

Quando houver `apply`, o relatório inclui:

- configuração de rajadas usada no envio
- total de eventos agendados
- resultado por evento, rajada e cópia
- resultado do envio das métricas sintéticas dos SLOs

Isolamento por dashboard:

- artefatos de execução: `generated/<dashboard-key>/<run-id>/`
- workspace Terraform isolado: `generated/terraform-workspaces/<provider>/<dashboard-key>/`

Nesse workspace ficam o `state`, os arquivos `.tf` base e o dashboard compilado daquele dashboard específico.
O bundle Terraform final inclui o dashboard e, quando suportado, os recursos de SLO.
No Datadog, os SLOs são gerados como `metric SLOs`, não por `monitor_ids`.

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

O `applier` suporta:

- `datadog`: terraform + ingestão de eventos + métricas sintéticas
- `dynatrace`: terraform
- `grafana`: terraform

Ele executa:

- `terraform init`
- `terraform apply`
- ingestão dos `custom-events`
- geração de `apply-report.json`

Dry run:

```bash
npm run applier -- \
  --events-file ./generated/<dashboard-key>/<run-id>/custom-events.json \
  --dashboard-key "payments-acompanhamento" \
  --dry-run \
  --burst-count 6 \
  --burst-interval-ms 10000 \
  --copies-per-event 4 \
  --randomize-event-counts
```

Execução real:

```bash
npm run applier -- \
  --events-file ./generated/<dashboard-key>/<run-id>/custom-events.json \
  --dashboard-key "payments-acompanhamento" \
  --burst-count 6 \
  --burst-interval-ms 10000 \
  --copies-per-event 4 \
  --randomize-event-counts
```

Se quiser sobrescrever o workspace resolvido automaticamente, ainda pode usar `--terraform-dir`.

Parâmetros opcionais da simulação de rajadas:

- `--burst-count`: quantas rajadas enviar
- `--burst-interval-ms`: tempo de espera entre uma rajada e a próxima
- `--copies-per-event`: quantas cópias de cada evento enviar dentro de cada rajada
- `--randomize-event-counts`: quando presente, a quantidade enviada por evento em cada rajada passa a ser randômica; o teto usado é `--copies-per-event` e, se ele não for informado, o padrão passa a ser `5`

Esses parâmetros são úteis para simular padrões mais próximos dos SLOs do fluxo, por exemplo volume recorrente, janelas de pico e repetição de eventos de sucesso ou falha ao longo do tempo.

Variáveis necessárias para apply real no Datadog:

- `DD_API_KEY`
- `DD_APP_KEY`
- `DD_SITE` opcional
- `DD_API_BASE_URL` opcional
- `DD_EVENT_BATCH_SIZE` opcional
- `DD_EVENT_BURST_COUNT` opcional
- `DD_EVENT_BURST_INTERVAL_MS` opcional
- `DD_EVENT_BURST_REPEAT_PER_EVENT` opcional

## Recomendação de Identidade

Se `dashboardTitle` não for suficiente, use um `dashboardKey` funcional e estável, por exemplo:

- `payments-acompanhamento`
- `payments-checkout-acompanhamento`
- `billing-cobranca-operacao`
- `tuangou-formacao-de-grupos`

Para um dashboard de acompanhamento, prefira um identificador ligado ao fluxo monitorado, não à versão do nome visual.

## Observação

Se o Bedrock falhar, a rede estiver indisponível, ou a resposta sair do contrato esperado, o workflow aplica fallback heurístico para continuar a execução.
