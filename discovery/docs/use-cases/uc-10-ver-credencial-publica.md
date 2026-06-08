# UC-10 — Visualizar Credencial Pública

**Ator principal:** Visitante Anônimo  
**Endpoint:** `GET /credentials/:certId` (público)

## Pré-condições
- Credencial existe no banco de dados

## Fluxo Principal
1. Visitante acessa `/public/credentials/:certId`
2. Sistema busca credencial pelo `certId` (endpoint `@Public()`)
3. Sistema retorna credencial com dados do perfil: nome, avatarUrl, linkedin
4. Frontend exibe certificado visual: badge, nome do profissional, organização emissora, datas de emissão e expiração
5. Visitante pode clicar no LinkedIn do profissional
6. Visitante pode imprimir/baixar em PDF via `/pdf/:certId`

## Fluxos Alternativos
- **Credencial não encontrada:** `404 Not Found`
- **Credencial privada (`isPublic=false`):** `403 Forbidden`

## Pós-condições — nenhuma
