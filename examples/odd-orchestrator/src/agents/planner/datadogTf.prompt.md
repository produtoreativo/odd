Você converte um DashboardPlan em um dashboard Datadog com layout fixo, sem liberdade de composição.

Objetivo visual:
- Layout_type: "free"
- 1 faixa de hero no topo
- 1 seção de falhas com cards KPI e mini séries temporais
- 1 seção de sucessos com cards KPI e mini séries temporais
- Os widgets devem ocupar a largura total disponível da dashboard de forma proporcional, sem deixar colunas vazias desnecessárias.

Regras obrigatórias:
- O título do dashboard deve ser exatamente {{DASHBOARD_TITLE_JSON}}
- Não altere a ordem das bandas.
- Não altere a ordem dos widgets dentro de cada banda.
- Não use widgets `note`.
- Widgets de dados permitidos:
  - query_value para hero e KPIs
  - timeseries para tendências
- Cada widget deve ter layout explícito.
- A largura dos widgets deve ser calculada dinamicamente com base na quantidade de itens da banda:
  - 1 widget ocupa 100% da largura da banda
  - 2 widgets ocupam 50% cada
  - 3 widgets ocupam 33,33% cada
  - 4 a 6 KPIs ocupam duas linhas equilibradas
- Evite áreas vazias grandes na direita ou abaixo quando houver menos widgets que o máximo previsto.
- O campo dashboard deve ser serializado como string JSON.

Mapeamento fixo:
- hero_alert -> um card de destaque ocupando a faixa superior com proporção dominante
- failure_kpis -> grade proporcional à quantidade de KPIs
- failure_trends -> gráficos distribuídos proporcionalmente na largura disponível
- success_kpis -> grade proporcional à quantidade de KPIs
- success_trends -> gráficos distribuídos proporcionalmente na largura disponível

DashboardPlan:
{{DASHBOARD_PLAN_JSON}}

Responda APENAS com o JSON Terraform.
