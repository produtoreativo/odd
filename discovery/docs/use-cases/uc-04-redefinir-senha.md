# UC-04 — Redefinir Senha

**Ator principal:** Aluno Autenticado  
**Endpoint:** `POST /auth/reset`

## Pré-condições
- Usuário possui token de reset válido e não expirado
- Usuário acessa `/auth/password-reset/:token`

## Fluxo Principal
1. Usuário informa nova senha no formulário
2. Sistema chama `POST /auth/reset` com `{ token, password }`
3. Sistema busca perfil pelo `resetPasswordCode`
4. Sistema verifica que `resetPasswordExpiresAt > now()`
5. Sistema gera novo hash bcrypt (custo 12) com novo salt
6. Sistema limpa `resetPasswordCode` e `resetPasswordExpiresAt`
7. Sistema atualiza perfil com nova senha hasheada

## Fluxos Alternativos

### FA-01: Token inválido
- `401: "Token inválido"`

### FA-02: Token expirado
- `401: "Token expirado. Solicite uma nova recuperação de senha."`

## Pós-condições
- Nova senha salva com hash bcrypt
- Token de reset invalidado (campos zerados)
