# UC-21 — Consultar Documentação do Framework ProdOps

**Ator principal:** Visitante Anônimo  
**Dados:** Estáticos com suporte a i18n (pt/en)

## Fluxo Principal
1. Visitante acessa `/docs`
2. Frontend exibe diagrama `ProdOpsDiagram` e grid de jornadas disponíveis
3. Visitante clica em uma jornada → `/docs/:journeyId`
4. Frontend exibe conteúdo detalhado da jornada: inputs, outputs, detalhes e jornadas relacionadas
