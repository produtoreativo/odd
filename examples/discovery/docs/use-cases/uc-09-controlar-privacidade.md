# UC-09 — Controlar Privacidade da Credencial

**Ator principal:** Aluno Autenticado  
**Endpoint:** `PATCH /credentials/:certId/privacy`

## Pré-condições
- Usuário possui pelo menos uma credencial

## Fluxo Principal
1. Usuário clica no chip "Privado" ou "Público" na credencial
2. Frontend chama `PATCH /credentials/:certId/privacy` com `{ isPublic: boolean }`
3. Sistema verifica que a credencial pertence ao `profileId` do JWT
4. Sistema atualiza campo `isPublic`
5. Frontend atualiza estado local otimisticamente

## Fluxos Alternativos
- **Credencial de outro usuário:** `403 Forbidden`

## Pós-condições
- `isPublic=true`: credencial aparece na galeria `/certified`
- `isPublic=false`: credencial removida da galeria pública
