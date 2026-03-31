#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(cd "${SCRIPT_DIR}/.." && pwd)"
ENV_FILE="${PROJECT_DIR}/.env"

if ! command -v aws >/dev/null 2>&1; then
  echo "aws CLI não encontrado. Instale e configure o AWS CLI antes de continuar." >&2
  exit 1
fi

if [[ ! -f "${ENV_FILE}" ]]; then
  echo "Arquivo .env não encontrado em ${ENV_FILE}" >&2
  exit 1
fi

set -a
source "${ENV_FILE}"
set +a

: "${AWS_REGION:=us-east-1}"
: "${AWS_ACCESS_KEY_ID:?AWS_ACCESS_KEY_ID ausente no .env}"
: "${AWS_SECRET_ACCESS_KEY:?AWS_SECRET_ACCESS_KEY ausente no .env}"

COMPANY_NAME="${COMPANY_NAME:-ODD}"
COMPANY_WEBSITE="${COMPANY_WEBSITE:-https://odd.com.br}"
INTENDED_USERS="${INTENDED_USERS:-0}"
INDUSTRY_OPTION="${INDUSTRY_OPTION:-Technology}"
OTHER_INDUSTRY_OPTION="${OTHER_INDUSTRY_OPTION:-}"
USE_CASES="${USE_CASES:-Event storming image understanding and structured JSON extraction for internal software architecture analysis and workflow automation.}"

if [[ "${1:-}" == "--check" ]]; then
  aws bedrock get-use-case-for-model-access \
    --region "${AWS_REGION}"
  exit 0
fi

FORM_JSON="$(cat <<JSON
{"companyName":"${COMPANY_NAME}","companyWebsite":"${COMPANY_WEBSITE}","intendedUsers":"${INTENDED_USERS}","industryOption":"${INDUSTRY_OPTION}","otherIndustryOption":"${OTHER_INDUSTRY_OPTION}","useCases":"${USE_CASES}"}
JSON
)"

FORM_B64="$(printf '%s' "${FORM_JSON}" | base64 | tr -d '\n')"

echo "Enviando use case details para Anthropic via Bedrock..."
echo "Região: ${AWS_REGION}"
echo "Empresa: ${COMPANY_NAME}"
echo "Website: ${COMPANY_WEBSITE}"
echo "IntendedUsers: ${INTENDED_USERS}"
echo "IndustryOption: ${INDUSTRY_OPTION}"

aws bedrock put-use-case-for-model-access \
  --region "${AWS_REGION}" \
  --form-data "${FORM_B64}"

echo
echo "Recomendado: aguarde alguns minutos e depois verifique com:"
echo "  bash scripts/submit_anthropic_use_case.sh --check"
