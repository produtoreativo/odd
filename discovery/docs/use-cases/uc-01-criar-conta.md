# UC-01 — Criar Conta

**Ator principal:** Visitante Anônimo  
**Endpoint:** `POST /auth/signup`  
**Rate limit:** 5 req/min por IP

## Pré-condições
- Visitante acessa `/auth/signup`
- Email não está previamente cadastrado na plataforma

## Fluxo Principal
1. Visitante preenche nome e email no formulário
2. Sistema valida campos (nome e email obrigatórios, formato email)
3. Sistema verifica que o email não existe (`POST /auth/signup`)
4. Sistema cria perfil com senha aleatória temporária
5. Sistema gera token de definição de senha (48 hex chars, expira em 1h)
6. Sistema envia email com link `/auth/password-reset/:token` via OneSignal
7. Sistema registra assinatura de email no OneSignal
8. Sistema retorna `201 Created` com perfil criado

## Fluxos Alternativos

### FA-01: Email já cadastrado
- No passo 3, sistema detecta email existente
- Sistema retorna `409 Conflict: "Email já cadastrado"`
- Frontend exibe mensagem de erro no formulário

### FA-02: Rate limit excedido
- Sistema retorna `429 Too Many Requests`

## Pós-condições
- Perfil criado no banco de dados com `isAdmin=false`
- Email de boas-vindas enviado via OneSignal
- Usuário assinado no OneSignal

## Regras de negócio
- Senha gerada aleatoriamente (`@Testes55` para perfis via integração é um bug conhecido)
- `bcrypt` com custo 12 para hash de senhas
