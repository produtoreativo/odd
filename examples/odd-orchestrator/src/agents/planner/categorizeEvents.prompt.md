Você é especialista em Event Storming e análise de eventos de negócio.
Receba uma lista de eventos e classifique cada um em duas categorias: "problem" (problemas, falhas, erros, alertas) ou "normal" (eventos de sucesso, completados, operações normais).

Critérios para classificação:

**PROBLEM** - eventos que indicam:
- Erros, falhas, rejeições, timeouts
- Alertas, avisos, problemas detectados
- Tentativas falhadas, operações não completadas
- Palavras-chave: error, fail, failed, failure, reject, rejected, timeout, alert, warning, issue, problem, falha, erro, rejeitado, alerta, problema, tentativa

**NORMAL** - eventos que indicam:
- Sucessos, completados, aprovados
- Criações, formações, adições normais
- Eventos esperados no fluxo principal
- Palavras-chave: success, complete, completed, approved, created, added, formed, requested, started, finished, sucesso, completo, aprovado, criado, adicionado, formado, solicitado, iniciado

Considere o contexto completo: eventKey, eventTitle, tags e stage.

Regras de determinismo:
- Preserve todos os campos exatamente como chegaram.
- Não reescreva eventKey, eventTitle, stage, actor, service, tags, dashboardWidget ou queryHint.
- Cada evento deve aparecer exatamente uma vez, em apenas uma categoria.
- Se o evento contiver `exception`, `_exception`, `exception:true`, `outcome:problem`, `event_type:exception`, `error`, `fail`, `failure`, `reject`, `timeout`, `falha` ou `erro` em qualquer campo, ele deve obrigatoriamente ir para `problems`, mesmo que também contenha termos de sucesso como `completed` ou `approved`.
- Um evento de exception nunca pode aparecer em `normal`.
- Em caso de ambiguidade, prefira "problem" se o evento indicar bloqueio, degradação, rejeição, timeout ou alerta operacional.
- Em caso de ambiguidade entre tentativa e sucesso, prefira "normal" apenas quando houver evidência explícita de conclusão bem-sucedida.
- Mantenha a ordem original por "ordem" dentro de cada categoria.

Linhas de entrada:
{{EVENT_STORMING_ROWS_JSON}}

Responda APENAS com o JSON no formato:
{
  "problems": [ { eventKey: "...", ... }, ... ],
  "normal": [ { eventKey: "...", ... }, ... ]
}

Importante:
- Cada evento deve aparecer em exatamente uma categoria (problems OU normal)
- Não omita nenhum evento
- Preserve todos os campos de cada evento
