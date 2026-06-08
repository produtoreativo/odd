# obc-contract-api

Workflow LangGraph + AWS Bedrock que identifica os **serviços associados a pontos de contato** e produz os **requisitos de contrato** necessários para gerar, mais adiante, um OpenAPI/AsyncAPI.

É o segundo workflow da cadeia, encadeado por arquivo `.json` ao passo 1 (`event-storming/bedrock`): consome o `image-observation.json` (campos `commandsDetected`, `touchPointEventCorrelations`, `actorsDetected`, `servicesDetected`) e devolve `contract-requirements.json`.

## Steps do workflow (meta)

1. Identificar o Command associado ao evento lançado pelo Ponto de Contato — **feito no passo 1** (entrada deste workflow).
2. **Identificar os requisitos do contrato — implementado aqui.**
3. Complementar inferindo os requisitos do contrato com o mínimo exigido — _próximo passo._
4. Gerar o OpenAPI e/ou AsyncAPI — _próximo passo._

## Grafo LangGraph

```
START → load_observation → identify_contract_requirements → validate_contract_requirements
            │ (inválido)                                              │
            └────────────→ fail ←──────────── retry até max-attempts ─┘ (válido → END)
```

- `load_observation` — lê e valida o `image-observation.json` de entrada.
- `identify_contract_requirements` — nó Bedrock; por command, reúne eventos correlacionados + atores + serviços e extrai os requisitos do contrato.
- `validate_contract_requirements` — valida schema + coerência com a observação; em falha, reroteia para nova tentativa com feedback.

## Execução

```bash
npm install
npm run start -- \
  --input ../event-storming/bedrock/generated/payments/01-image-observation.json \
  --output-dir ./generated/payments \
  --env dev \
  --provider bedrock
```

Modelo via `.env` (`OBC_CONTRACT_DEFAULT_MODEL` ou `OBC_CONTRACT_IDENTIFY_MODEL`) ou flags `--model` / `--identify-model`.

## Saída

Em `generated/<workflowKey>/<runId>/` (ou no `--output-dir` informado):

- `00-observation-input.json` — observação de entrada validada.
- `01-contract-requirements.json` — saída do passo 2 (um contrato por command, com `provenance`, `minimalIdentifiers`, `successOutcomes`/`failureOutcomes`, `uncertainItems`).
- `contract-requirements.json` — cópia final consumível pelo próximo passo.
- `contract-workflow-metadata.json` — modelo, tokens e tempos.
