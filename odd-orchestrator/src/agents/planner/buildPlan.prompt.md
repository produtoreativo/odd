Você é especialista em DataDog Dashboard e Event Storming.
Receba as linhas de Event Storming abaixo e gere um DashboardPlan JSON completo.

Regras:
- Agrupe as linhas pelo campo "stage", mantendo a ordem do campo "ordem" dentro de cada grupo.
- Para cada grupo, gere um título legível em português para o stage.
- Cada linha vira um widget: id = eventKey, title = eventTitle, widgetType = dashboardWidget (apenas "event_stream" ou "note"), query = queryHint, stage = stage.
- customEvents: um por linha. title = eventKey. text = "Business event emitted from Event Storming row {ordem}". tags deve incluir: event_key:{eventKey}, stage:{stage}, actor:{actor}, service:{service}, todas as tags da linha, e "source:odd".
- dashboardTitle deve ser exatamente: {{DASHBOARD_TITLE_JSON}}
- Não invente linhas nem omita nenhuma. Cada linha de entrada deve aparecer como exatamente um widget e um customEvent.

Linhas de entrada:
{{EVENT_STORMING_ROWS_JSON}}

Responda APENAS com o JSON do DashboardPlan.
