# UC-03 — Recuperar Senha

**Ator principal:** Aluno Autenticado  
**Endpoint:** `POST /auth/recovery`  
**Rate limit:** 5 req/min por IP

## Pré-condições
- Usuário possui conta cadastrada
- Usuário acessa `/auth/recovery`

## Fluxo Principal
1. Usuário informa email cadastrado
2. Sistema busca perfil pelo email
3. Sistema gera token aleatório (48 hex chars via `crypto.randomBytes`)
4. Sistema calcula expiração: `now() + 1 hora`
5. Sistema persiste `resetPasswordCode` e `resetPasswordExpiresAt` no perfil
6. Sistema envia email com link `/auth/password-reset/:token` via OneSignal
7. Sistema retorna mensagem "Email enviado com sucesso"

## Fluxos Alternativos

### FA-01: Email não encontrado
- Sistema retorna `401: "Email não cadastrado"`

## Pós-condições
- Token de reset válido por 1 hora salvo no perfil
- Email de recuperação enviado ao usuário
