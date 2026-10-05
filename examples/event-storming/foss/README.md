# Event Storming FOSS

Workflow em TypeScript com LangGraph + LangChain para:

1. observar uma imagem de event storming;
2. extrair eventos e fluxos candidatos;
3. normalizar para o contrato final;
4. gerar a planilha final no mesmo formato usado pelo `storm-image` do `odd-orchestrator`.

## Execução

Instale as dependências do pacote e rode:

```bash
npm install

npm run start -- \
  --input-image samples/ODD-Payments-EventStorming.png \
  --output-dir ./generated/payments \
  --provider ollama
```

Para executar somente o agente 1:

```bash
npm run start -- \
  --input-image samples/ODD-Payments-EventStorming.png \
  --output-dir ./generated/payments \
  --provider ollama \
  --end-at observe
```

Para retomar a partir do agente 2:

```bash
npm run start -- \
  --input-image samples/ODD-Payments-EventStorming.png \
  --output-dir ./generated/payments \
  --provider ollama \
  --start-from extract \
  --image-observation ./generated/payments/01-image-observation.json
```

Para retomar a partir do agente 3:

```bash
npm run start -- \
  --input-image samples/ODD-Payments-EventStorming.png \
  --output-dir ./generated/payments \
  --provider ollama \
  --start-from normalize \
  --candidate-context ./generated/payments/02-candidate-events.json
```

## Argumentos

- `--input-image`: caminho da imagem de event storming
- `--output-dir`: diretório de saída
- `--provider`: `ollama` ou `openai`
- `--start-from`: `observe`, `extract` ou `normalize`. Padrão: `observe`
- `--end-at`: `observe`. Encerra o workflow após a observação válida
- `--image-observation`: obrigatório com `--start-from extract`
- `--candidate-context`: obrigatório com `--start-from normalize`
- `--model`: fallback global para todos os agentes
- `--observe-model`: override do modelo do agente de observação
- `--extract-model`: override do modelo do agente de extração
- `--normalize-model`: override do modelo do agente de normalização
- `--max-attempts`: opcional, padrão `2`

## Saídas

- `01a-visual-observation.json`: inventário visual bruto do board
- `01b-interpreted-observation.json`: interpretação estrutural derivada do inventário visual
- `01-image-observation.json`: observação final consolidada do agente `observe`
- `02-candidate-events.json`: eventos e fluxos candidatos
- `03-standardized-context.json`: contexto final padronizado
- `04-workbook.json`: payload determinístico da planilha
- `image-observation.json`: alias da observação visual
- `candidate-events.json`: alias dos eventos candidatos
- `recognized-context.json`: alias do contexto final reconhecido
- `standardized-context.json`: alias do contexto final padronizado
- `workbook.json`: alias do payload da planilha
- `recognized-event-storming.xlsx`: planilha final

## Ambiente

Para `ollama`, use `OLLAMA_BASE_URL` se necessário.

Para `openai`, defina `OPENAI_API_KEY` e opcionalmente `OPENAI_BASE_URL`.

### Modelos por agente

O pacote resolve os modelos com a seguinte prioridade:

1. `--observe-model`, `--extract-model`, `--normalize-model`
2. `EVENT_STORMING_OBSERVE_MODEL`, `EVENT_STORMING_EXTRACT_MODEL`, `EVENT_STORMING_NORMALIZE_MODEL`
3. `--model`
4. `EVENT_STORMING_DEFAULT_MODEL`

Exemplo de `.env`:

```bash
OLLAMA_BASE_URL=http://127.0.0.1:11434
EVENT_STORMING_DEFAULT_MODEL=qwen2.5vl:7b
EVENT_STORMING_OBSERVE_MODEL=qwen2.5vl:7b
EVENT_STORMING_EXTRACT_MODEL=qwen2.5vl:7b
EVENT_STORMING_NORMALIZE_MODEL=qwen2.5:14b
```

## LangSmith

Se `LANGSMITH_API_KEY` estiver definido no `.env`, o projeto habilita tracing automaticamente.

Defaults aplicados no bootstrap:

- `LANGSMITH_TRACING=true`
- `LANGSMITH_PROJECT=event-storming-foss`
- `LANGSMITH_ENDPOINT=https://api.smith.langchain.com`

Os traces incluem:

- execução raiz do workflow
- execução do grafo LangGraph
- cada nó principal de extração, normalização, geração de workbook e validação
