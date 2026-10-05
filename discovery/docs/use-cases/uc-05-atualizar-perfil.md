# UC-05 — Atualizar Perfil

**Ator principal:** Aluno Autenticado  
**Endpoint:** `PATCH /profiles/:id`

## Pré-condições
- Usuário autenticado acessa `/profile`
- JWT válido no header `Authorization`

## Fluxo Principal
1. Sistema carrega perfil via `GET /auth/profile`
2. Sistema carrega endereço via `GET /profiles/address`
3. Usuário edita campos: nome, telefone, LinkedIn, email Google
4. Usuário submete o formulário
5. Frontend envia apenas campos do DTO (sem `id`, `avatarUrl`, `isAdmin`)
6. Sistema verifica que `req.user.id === id` do parâmetro (anti-IDOR)
7. Sistema persiste alterações via `updateSettings`
8. Sistema dispara `LOAD_PROFILE` para recarregar estado

## Fluxos Alternativos

### FA-01: IDOR tentado
- Usuário tenta editar `id` de outro usuário
- `403 Forbidden`

## Pós-condições
- Perfil atualizado no banco de dados
- `googleEmail` disponível para compartilhamento do Google Drive
- Observabilidade registra `profile.settings.updated`

## DTO aceito (campos validados)
```typescript
{ name?, phone?, linkedin?, googleEmail? }
```
