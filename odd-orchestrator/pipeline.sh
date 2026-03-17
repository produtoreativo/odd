#!/bin/bash

set -e

PROVIDER="${1:-datadog}"

if [ "$PROVIDER" != "datadog" ] && [ "$PROVIDER" != "dynatrace" ]; then
  echo "❌ Provider inválido: $PROVIDER"
  echo "Uso: ./pipeline.sh [datadog|dynatrace]"
  exit 1
fi

if [ "$PROVIDER" = "datadog" ]; then
  TERRAFORM_DIR="./terraform"
else
  TERRAFORM_DIR="./terraform-dynatrace"
fi

echo "🔐 Carregando variáveis do .env..."
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
else
  echo "❌ Arquivo .env não encontrado!"
  exit 1
fi

echo "🧹 Limpando artefatos anteriores..."
rm -rf generated/*
rm -rf "$TERRAFORM_DIR"/generated/*dash*

echo "🧠 Executando planner para provider: $PROVIDER..."
PLANNER_OUTPUT=$(npm run planner -- \
  --input ./samples/event-storming-tuangou-project-format.xlsx \
  --dashboard-title "TuangouODDJourney" \
  --provider "$PROVIDER")

echo "$PLANNER_OUTPUT"

# Extrai o caminho do output gerado pelo planner
OUTPUT_DIR=$(echo "$PLANNER_OUTPUT" | grep "Output:" | awk '{print $2}')

if [ -z "$OUTPUT_DIR" ]; then
  echo "❌ Não foi possível identificar o diretório de saída do planner"
  exit 1
fi

echo "📂 Output identificado: $OUTPUT_DIR"

EVENTS_FILE="$OUTPUT_DIR/custom-events.json"

if [ ! -f "$EVENTS_FILE" ]; then
  echo "❌ Arquivo de eventos não encontrado em $EVENTS_FILE"
  exit 1
fi

echo "🚀 Aplicando infraestrutura para provider: $PROVIDER..."
npm run applier -- \
  --terraform-dir "$TERRAFORM_DIR" \
  --events-file "$EVENTS_FILE" \
  --provider "$PROVIDER"

echo "✅ Processo finalizado com sucesso!"
