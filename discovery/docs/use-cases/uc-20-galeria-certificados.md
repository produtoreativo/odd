# UC-20 — Visualizar Galeria de Certificados Públicos

**Ator principal:** Visitante Anônimo  
**Endpoint:** `GET /credentials/public?page=1&limit=20`

## Fluxo Principal
1. Visitante acessa `/certified`
2. Sistema chama `GET /credentials/public` com paginação (`page`, `limit=20`)
3. Backend usa `findAndCount` com `isPublic=true`, ordenado por `issueYear DESC, issueMonth DESC, id DESC`
4. Frontend exibe grid paginado: badge (160×160), nome do badge, código, avatar, nome do profissional, data e ícone LinkedIn
5. Visitante navega entre páginas (scroll para topo automático)
6. Visitante clica em uma credencial → `/public/credentials/:certId`

## Paginação
- 20 itens por página
- Componente `Pagination` MUI com botões de primeira/última página
- Total de certificados exibido acima da lista
