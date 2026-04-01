# Event Storming Bedrock

Workflow em TypeScript com LangGraph para processar imagens de event storming usando Amazon Bedrock.

O fluxo executa:
1. observação multimodal da imagem;
2. extração de eventos e fluxos candidatos com enriquecimento de metadados de projeto;
3. normalização do contexto em formato de projeto;
4. geração da planilha final no modelo usado em `odd/odd-orchestrator/samples/event-storming-tuangou-project-format.xlsx`.

## Execução

```bash
npm install

npm run start -- \
  --input-image samples/ODD-Payments-EventStorming.png \
  --output-dir ./generated/payments \
  --env dev \
  --provider bedrock
```

Para retomar a partir do agente 2:

```bash
npm run start -- \
  --input-image samples/ODD-Payments-EventStorming.png \
  --output-dir ./generated/payments \
  --provider bedrock \
  --start-from extract \
  --image-observation ./generated/payments/01-image-observation.json
```

Para retomar a partir do agente 3:

```bash
npm run start -- \
  --input-image samples/ODD-Payments-EventStorming.png \
  --output-dir ./generated/payments \
  --provider bedrock \
  --start-from normalize \
  --candidate-context ./generated/payments/02-candidate-events.json
```

## Argumentos

- `--input-image`: caminho da imagem de event storming
- `--output-dir`: diretório de saída
- `--provider`: use `bedrock`
- `--env`: ambiente usado no `query_hint`; opcional, padrão `dev`
- `--start-from`: `observe`, `extract` ou `normalize`
- `--image-observation`: obrigatório com `--start-from extract`
- `--candidate-context`: obrigatório com `--start-from normalize`
- `--model`: fallback global para todos os agentes
- `--observe-model`: override do modelo do agente de observação
- `--extract-model`: override do modelo do agente de extração
- `--normalize-model`: override do modelo do agente de normalização
- `--max-attempts`: opcional, padrão `2`

## Ambiente

Defina ao menos:

```bash
AWS_REGION=us-east-1
BEDROCK_REQUEST_TIMEOUT_MS=3600000
EVENT_STORMING_DEFAULT_MODEL=amazon.nova-lite-v1:0
EVENT_STORMING_OBSERVE_MODEL=amazon.nova-pro-v1:0
EVENT_STORMING_EXTRACT_MODEL=amazon.nova-lite-v1:0
EVENT_STORMING_NORMALIZE_MODEL=amazon.nova-lite-v1:0
```

As credenciais AWS podem vir do ambiente padrão do SDK:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN` opcional

## Saídas

- `01-image-observation.json`
- `01-image-observation.attempt-<n>.raw.txt`
- `02-candidate-events.json`: eventos candidatos normalizados com `source_touch_point`, `stage`, `service` e `tags` aderentes ao contrato dos prompts
- `02-candidate-events.attempt-<n>.raw.txt`
- `03-standardized-context.json`: contexto reconhecido pronto para gerar a planilha final
- `03-standardized-context.attempt-<n>.raw.txt`
- `04-workbook.json`: payload da planilha no formato de projeto
- `recognized-event-storming.xlsx`: workbook final com as abas `project_input` e `conversion_notes`

## Formato Final

O XLSX final segue o modelo de projeto usado em `odd-orchestrator/samples/event-storming-tuangou-project-format.xlsx`.

A aba `project_input` contém:

- colunas base: `ordem`, `event_key`, `event_title`, `stage`, `actor`, `service`, `tags`, `dashboard_widget`, `query_hint`
- colunas adicionais de rastreabilidade: `source_row`, `source_touch_point`

A aba `conversion_notes` contém observações de conversão e suposições usadas durante a geração.

## Regras de Enriquecimento

Do agente 2 em diante, o pipeline tenta produzir saída compatível com o formato de projeto:

- `stage` no padrão slug `dominio_subdominio`
- `service` no padrão `dominio.subdominio`
- `tags` com `touch_point` e `business_domain`
- `source_touch_point` para preservar a origem do evento na imagem
- `event_key` normalizado para o padrão do projeto, com deduplicação automática quando necessário

## LangSmith

Se `LANGSMITH_API_KEY` estiver definido, o tracing continua habilitado normalmente.

## Anthropic Use Case

Se o Bedrock exigir o formulário de use case da Anthropic, use:

```bash
cd event-storming/bedrock
bash scripts/submit_anthropic_use_case.sh
```

Para consultar o status depois:

```bash
cd event-storming/bedrock
bash scripts/submit_anthropic_use_case.sh --check
```

O script carrega automaticamente as credenciais e a região a partir do `.env` do projeto.

Parâmetros suportados hoje:
- argumento `--check`: consulta o status enviado no Bedrock

Valores configuráveis por variáveis de ambiente no momento da chamada:
- `AWS_REGION`
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`
- `AWS_SESSION_TOKEN`
- `COMPANY_NAME`
- `COMPANY_WEBSITE`
- `INTENDED_USERS`
- `INDUSTRY_OPTION`
- `OTHER_INDUSTRY_OPTION`
- `USE_CASES`

Exemplo completo com overrides:

```bash
cd event-storming/bedrock

COMPANY_NAME="Produto Reativo" \
COMPANY_WEBSITE="https://produtoreativo.com.br" \
INTENDED_USERS="0" \
INDUSTRY_OPTION="Technology" \
USE_CASES="Event storming image understanding and structured JSON extraction for internal software architecture analysis and workflow automation." \
bash scripts/submit_anthropic_use_case.sh
```

Sem overrides, o script usa:
- credenciais e região do `.env`
- `COMPANY_NAME=ODD`
- `COMPANY_WEBSITE=https://odd.com.br`
- `INTENDED_USERS=0`
- `INDUSTRY_OPTION=Technology`
- `OTHER_INDUSTRY_OPTION=` vazio
- um texto padrão em `USE_CASES`
