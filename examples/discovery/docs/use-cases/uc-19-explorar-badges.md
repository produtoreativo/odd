# UC-19 — Explorar Badges de Certificação

**Ator principal:** Visitante Anônimo  
**Endpoint:** `GET /badges` (público)

## Badges disponíveis
| Código | Nome | Nível |
|---|---|---|
| PDPT01 | ProdOps Foundation | Foundation (ProdOps 1) |
| PDAS01 | ProdOps Associate | Associate (ProdOps 2 — AI-Driven) |
| PDPD01 | ProdOps Product Delivery Practitioner | Delivery |
| PDRE02 | ProdOps Reliability Engineer | PRE |

## Fluxo Principal
1. Visitante acessa `/badges`
2. Sistema chama `GET /badges` → retorna badges do banco
3. Visitante clica em um badge → `/badges/:code`
4. Frontend exibe (dados de badges.data.ts): tagline, competências, público-alvo por papel profissional, conteúdo programático, formato e agenda, preço, PIX, instrutor
