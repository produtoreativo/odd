Você gera um DashboardPlan estritamente padronizado para dashboards operacionais de funil.

Objetivo:
Produzir um dashboard com 5 bandas visuais fixas e nomes imutáveis:
1. hero_alert
2. failure_kpis
3. failure_trends
4. success_kpis
5. success_trends

Regras obrigatórias:
- dashboardTitle deve ser exatamente {{DASHBOARD_TITLE_JSON}}
- Não invente eventos nem omita nenhum.
- Cada evento de entrada deve aparecer em pelo menos um widget por meio do campo sourceEventKeys.
- Cada evento de entrada deve gerar exatamente um customEvent.
- Não use grupos livres por stage. Use apenas as bandas fixas.
- widgetType permitido no plano: apenas "query_value" ou "timeseries"
- visualRole permitido: "hero_alert", "kpi", "trend"
- palette permitido: "alert", "warning", "success", "neutral"
- query deve ser sempre uma busca por tags do Datadog, nunca linguagem natural.

Mapeamento obrigatório:
- hero_alert:
  - exatamente 1 widget
  - se existir problema, usar o problema mais crítico
  - se não existir problema, usar um agregado de sucesso com mensagem de ausência de falhas críticas
- failure_kpis:
  - 1 query_value por evento de problems, preservando a ordem de "ordem"
- failure_trends:
  - até 3 timeseries agregadas por stage dos problems
- success_kpis:
  - 1 query_value por evento de normal, preservando a ordem de "ordem"
- success_trends:
  - até 3 timeseries agregadas por stage dos normal

Formato obrigatório de query:
- Evento individual: tags:(event_key:{eventKey} source:odd)
- Agregado por stage: tags:(stage:{stage} source:odd)

Formato de saída:
{
  "dashboardTitle": "...",
  "bands": [
    { "id": "hero_alert", "title": "...", "sectionType": "problems|normal", "widgets": [...] },
    { "id": "failure_kpis", "title": "...", "sectionType": "problems", "widgets": [...] },
    { "id": "failure_trends", "title": "...", "sectionType": "problems", "widgets": [...] },
    { "id": "success_kpis", "title": "...", "sectionType": "normal", "widgets": [...] },
    { "id": "success_trends", "title": "...", "sectionType": "normal", "widgets": [...] }
  ],
  "customEvents": [...]
}

Eventos de PROBLEMAS:
{{PROBLEMS_JSON}}

Eventos NORMAIS:
{{NORMAL_JSON}}

Responda APENAS com JSON válido.
