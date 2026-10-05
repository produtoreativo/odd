Você está executando correção estrutural dos artefatos gerados.

A saída anterior violou contratos obrigatórios.

Sua tarefa é corrigir apenas a estrutura necessária.

IMPORTANTE:
- preserve o domínio do produto
- preserve o máximo possível do conteúdo existente
- responda SOMENTE em JSON válido
- não escreva texto fora do JSON

---

# Contexto

{{CONTEXT_JSON}}

---

# Artefatos atuais

{{CURRENT_OUTPUT_JSON}}

---

# Erros detectados

{{CONTRACT_ERRORS_JSON}}

---

# Regras obrigatórias

Preserve o conteúdo existente sempre que possível.

Corrija apenas o necessário.

Não invente novo domínio.

Mantenha aderência a:
- Schola
- ProdOps
- turmas
- matrícula
- pagamento
- Certificare

---

# Regras estruturais dos artefatos

## requirements_md

requirements_md deve começar exatamente com:

# Requisitos Funcionais

Depois disso devem existir no mínimo 10 requisitos funcionais.

Cada requisito deve começar na primeira coluna da linha com o identificador RF.

Formato obrigatório:

RF-001 Nome curto do requisito

### Objetivo
texto curto

### Descrição
texto curto

### Regras de negócio
texto curto

### Critérios de aceitação
texto curto

### Rastreabilidade
texto curto

Repita o padrão até RF-010.

Regras obrigatórias:

- a linha do requisito deve começar exatamente com RF-001, RF-002, etc
- NÃO use ## RF-001
- NÃO use listas numeradas
- NÃO use bullets antes de RF
- se existirem menos de 10 requisitos, gere os faltantes

---

## non_functional_md

Deve conter exatamente estas seções:

## Segurança
texto curto

## Performance
texto curto

## Confiabilidade
texto curto

## Observabilidade
texto curto

---

## glossary_md

glossary_md deve conter uma tabela markdown válida com pelo menos 5 termos.

Formato esperado:

| Termo | Definição | Exemplo |
|------|-----------|--------|
| ... | ... | ... |
| ... | ... | ... |
| ... | ... | ... |
| ... | ... | ... |
| ... | ... | ... |

---

## assumptions_md

assumptions_md deve conter pelo menos 3 suposições neste formato:

AS-001 texto curto
Justificativa: texto curto

AS-002 texto curto
Justificativa: texto curto

AS-003 texto curto
Justificativa: texto curto

---

## handoff_md

handoff_md deve conter exatamente estas seções:

## Entradas
texto curto

## Próximo passo
texto curto

## Pontos críticos
texto curto

---

# Regra crítica de saída

Responda SOMENTE em JSON válido.

Não escreva texto fora do JSON.

---

# Estrutura obrigatória da resposta

{
  "requirements_md": "markdown completo",
  "non_functional_md": "markdown completo",
  "glossary_md": "markdown completo",
  "assumptions_md": "markdown completo",
  "handoff_md": "markdown completo"
}
