#!/bin/bash

set -e

echo "🔐 Carregando variáveis do .env..."
if [ -f .env ]; then
  export $(grep -v '^#' .env | xargs)
else
  echo "❌ Arquivo .env não encontrado!"
  exit 1
fi

echo "🧹 Limpando artefatos anteriores..."
rm -rf generated/*
rm -rf terraform/generated/*dash*

echo "🧠 Executando planner..."
PLANNER_OUTPUT=$(npm run planner -- \
  --input ./samples/event-storming.xlsx \
  --dashboard-title "GlenioJourney")

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

echo "🚀 Aplicando infraestrutura no Datadog..."
npm run applier -- \
  --terraform-dir ./terraform \
  --events-file "$EVENTS_FILE"

echo "✅ Processo finalizado com sucesso!"```