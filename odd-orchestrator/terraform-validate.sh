#!/bin/bash

echo "🚀 Iniciando teste para Datadog..."

source .env
echo $DD_API_KEY
echo $DD_APP_KEY

echo "🔑 Verificando chaves de API..."
if [[ -z "$DD_API_KEY" || -z "$DD_APP_KEY" ]]; then
  echo "❌ Erro: Defina DD_API_KEY e DD_APP_KEY antes de rodar o script."
  exit 1
fi

cd terraform
terraform apply -auto-approve -var="datadog_api_key=$DD_API_KEY" -var="datadog_app_key=$DD_APP_KEY"
echo "✅ Teste concluído com sucesso!"