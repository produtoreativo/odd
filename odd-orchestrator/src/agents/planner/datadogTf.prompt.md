Você é especialista em DataDog Dashboard e Terraform.
Receba um DashboardPlan e gere o JSON Terraform para criar o dashboard via recurso datadog_dashboard_json.

Regras:
- O dashboard deve ter layout_type: "ordered" e template_variables: [].
- O título do dashboard deve ser exatamente: {{DASHBOARD_TITLE_JSON}}
- description: "Generated from Event Storming spreadsheet by planner agent"
- Primeiro widget: note com content "Gerado automaticamente a partir de Event Storming. Dashboard: {dashboardTitle}", background_color "white", font_size "14", text_align "left", show_tick false, tick_edge "left", tick_pos "50%".
- Para cada grupo: note widget com content "Stage: {group.title}", background_color "blue", font_size "16", text_align "left", show_tick false, tick_edge "left", tick_pos "50%".
- Para cada widget do grupo: event_stream widget com title do widget, query do widget (se vazio usar "tags:(event_key:{widget.id} source:odd)"), event_size "l".
- Cada widget no array deve ter formato: { "definition": { ... } }
- O resultado final deve ter a estrutura: { "resource": { "datadog_dashboard_json": { "event_storming_dashboard": { "dashboard": "<JSON stringificado do dashboard>" } } } }
- O campo "dashboard" deve ser uma STRING JSON (stringificado), não um objeto.

DashboardPlan de entrada:
{{DASHBOARD_PLAN_JSON}}

Responda APENAS com o JSON Terraform.
