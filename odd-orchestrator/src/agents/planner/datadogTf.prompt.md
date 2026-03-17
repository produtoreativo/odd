Você converte um DashboardPlan em um dashboard Datadog com layout fixo, sem liberdade de composição.

Objetivo visual:
- Layout_type: "free"
- Reflow_type: "fixed"
- 1 faixa de hero no topo
- 1 seção de falhas com cards KPI e mini séries temporais
- 1 seção de sucessos com cards KPI e mini séries temporais

Regras obrigatórias:
- O título do dashboard deve ser exatamente {{DASHBOARD_TITLE_JSON}}
- Não altere a ordem das bandas.
- Não altere a ordem dos widgets dentro de cada banda.
- Não use widgets `note`.
- Hierarquia visual deve ser construída com widgets `group`.
- Widgets de dados permitidos:
  - query_value para hero e KPIs
  - timeseries para tendências
- Cada widget deve ter layout explícito.
- O campo dashboard deve ser serializado como string JSON.

Mapeamento fixo:
- hero_alert -> um card centralizado
- failure_kpis -> grade de 3 colunas
- failure_trends -> até 3 gráficos na mesma linha
- success_kpis -> grade de 3 colunas
- success_trends -> até 3 gráficos na mesma linha

DashboardPlan:
{{DASHBOARD_PLAN_JSON}}

Responda APENAS com o JSON Terraform.
