# UC-02 — Fazer Login

**Ator principal:** Aluno Autenticado  
**Endpoint:** `POST /auth/login`  
**Rate limit:** 10 req/min por IP

## Pré-condições
- Usuário possui conta ativa na plataforma

## Fluxo Principal
1. Usuário informa email e senha no formulário
2. Sistema valida campos no frontend
3. Sistema chama `POST /auth/login`
4. Sistema busca perfil pelo email
5. Sistema compara senha com hash bcrypt
6. Sistema gera JWT com payload `{ name, email, id }` e expiração de 24h
7. Sistema retorna `{ access_token }`
8. Frontend armazena token no Redux/localStorage (senha NÃO é persistida)
9. Usuário acessa área autenticada

## Fluxos Alternativos

### FA-01: Credenciais inválidas
- Sistema retorna `401 Unauthorized`
- Frontend exibe mensagem de erro

### FA-02: Rate limit excedido
- Sistema retorna `429 Too Many Requests`

## Pós-condições
- JWT válido armazenado no cliente (expira em 24h)
- Usuário autenticado pode acessar rotas protegidas pelo `AuthGuard`

## Regras de negócio
- JWT secret lido de `process.env.JWT_SECRET`
- `errors` do formulário de autenticação são removidos da serialização do localStorage (segurança)
