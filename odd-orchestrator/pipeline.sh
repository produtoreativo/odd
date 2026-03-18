#!/bin/bash

set -Eeuo pipefail

PROVIDER="${1:-datadog}"
INPUT_FILE="${2:-./samples/value_stream_confirmacao_pagamento_completa.xlsx}"
DASHBOARD_TITLE="${3:-TuangouODDJourney}"
PIPELINE_STEP="startup"
PLANNER_LOG_FILE=""

log() {
  printf '[pipeline][%s] %s\n' "$PIPELINE_STEP" "$1"
}

normalize_ollama_url() {
  echo "${1//:\/\/localhost:/:\/\/127.0.0.1:}"
}

fail() {
  local exit_code=$?
  printf '[pipeline][error] step=%s exit_code=%s line=%s command=%s\n' \
    "$PIPELINE_STEP" "$exit_code" "${BASH_LINENO[0]:-unknown}" "${BASH_COMMAND:-unknown}" >&2
  exit "$exit_code"
}

trap fail ERR

cleanup_tmp() {
  if [ -n "$PLANNER_LOG_FILE" ] && [ -f "$PLANNER_LOG_FILE" ]; then
    rm -f "$PLANNER_LOG_FILE"
  fi
}

trap cleanup_tmp EXIT

if [ "$PROVIDER" != "datadog" ] && [ "$PROVIDER" != "dynatrace" ]; then
  echo "❌ Provider inválido: $PROVIDER"
  echo "Uso: ./pipeline.sh [datadog|dynatrace] [planilha.xlsx|planilha.csv] [dashboard-title]"
  exit 1
fi

if [ ! -f "$INPUT_FILE" ]; then
  echo "❌ Planilha não encontrada: $INPUT_FILE"
  echo "Uso: ./pipeline.sh [datadog|dynatrace] [planilha.xlsx|planilha.csv] [dashboard-title]"
  exit 1
fi

if [ "$PROVIDER" = "datadog" ]; then
  TERRAFORM_DIR="./terraform"
else
  TERRAFORM_DIR="./terraform-dynatrace"
fi

PIPELINE_STEP="env"
log "Carregando variáveis do .env..."
if [ -f .env ]; then
  set -a
  source .env
  set +a
  if [ -n "${OLLAMA_BASE_URL:-}" ]; then
    OLLAMA_BASE_URL="$(normalize_ollama_url "$OLLAMA_BASE_URL")"
    export OLLAMA_BASE_URL
  fi
  log "Variáveis carregadas. OLLAMA_BASE_URL=${OLLAMA_BASE_URL:-unset} OLLAMA_MODEL=${OLLAMA_MODEL:-unset}"
else
  echo "❌ Arquivo .env não encontrado!"
  exit 1
fi

PIPELINE_STEP="cleanup"
log "Limpando artefatos anteriores..."
rm -rf generated/*
rm -rf "$TERRAFORM_DIR"/generated/*dash*

PIPELINE_STEP="ollama-health"
if [ -n "${OLLAMA_BASE_URL:-}" ]; then
  log "Validando saúde do Ollama em ${OLLAMA_BASE_URL}"
  if curl -fsS "${OLLAMA_BASE_URL%/}/api/tags" >/tmp/odd-ollama-health.json 2>/dev/null; then
    if grep -q "\"${OLLAMA_MODEL}\"" /tmp/odd-ollama-health.json; then
      log "Ollama respondeu e o modelo ${OLLAMA_MODEL} está disponível"
    else
      log "Ollama respondeu, mas o modelo ${OLLAMA_MODEL} não apareceu em /api/tags"
    fi
  else
    log "Ollama não respondeu em ${OLLAMA_BASE_URL}. O planner pode travar em categorize-events"
  fi
  rm -f /tmp/odd-ollama-health.json
fi

PIPELINE_STEP="planner"
log "Executando planner para provider=${PROVIDER} terraform_dir=${TERRAFORM_DIR} input=${INPUT_FILE} dashboard_title=${DASHBOARD_TITLE}"
PLANNER_LOG_FILE="$(mktemp)"
npm run planner -- \
  --input "$INPUT_FILE" \
  --dashboard-title "$DASHBOARD_TITLE" \
  --provider "$PROVIDER" 2>&1 | tee "$PLANNER_LOG_FILE"

# Extrai o caminho do output gerado pelo planner
OUTPUT_DIR=$(grep "Output:" "$PLANNER_LOG_FILE" | tail -n 1 | awk '{print $2}')

if [ -z "$OUTPUT_DIR" ]; then
  echo "❌ Não foi possível identificar o diretório de saída do planner"
  exit 1
fi

PIPELINE_STEP="planner-output"
log "Output identificado: $OUTPUT_DIR"

EVENTS_FILE="$OUTPUT_DIR/custom-events.json"

if [ ! -f "$EVENTS_FILE" ]; then
  echo "❌ Arquivo de eventos não encontrado em $EVENTS_FILE"
  exit 1
fi

PIPELINE_STEP="applier"
log "Aplicando infraestrutura para provider=${PROVIDER} events_file=${EVENTS_FILE}"
npm run applier -- \
  --terraform-dir "$TERRAFORM_DIR" \
  --events-file "$EVENTS_FILE" \
  --provider "$PROVIDER"

PIPELINE_STEP="done"
log "Processo finalizado com sucesso"
