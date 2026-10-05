# Capítulo 13 — A Matriz de Confiabilidade

Depois de descobrir jornada, protagonistas, fronteiras e contratos, ainda falta responder uma pergunta operacional: onde a confiabilidade pode ser perdida?

A Matriz de Confiabilidade organiza essa pergunta de forma visual e acionável.

No material de referência, ela cruza aplicações e suas dependências. Cada interseção — cada nó nessa matriz — funciona como um KPI de confiabilidade diretamente conectado à experiência do cliente. O objetivo é produzir pontos de observação que sejam mensuráveis, observáveis e acionáveis.

## Uma dependência não é apenas uma seta

Nos diagramas de arquitetura, dependências costumam aparecer como setas — linhas que conectam caixas, indicando que um sistema chama outro. Essa representação é útil para entender a estrutura, mas não é suficiente para entender o risco.

Uma dependência na Matriz de Confiabilidade não é apenas uma seta. Ela é uma condição que pode proteger ou ameaçar a jornada.

Quando o serviço de pagamento é uma dependência no caminho crítico de criação de pedido, cada interseção precisa responder a uma pergunta concreta: o que acontece com a jornada de compra em grupo se esse serviço estiver indisponível? A resposta é um KPI — ou um conjunto de KPIs — que precisa ser monitorado.

## O que entra na matriz

A matriz conecta as aplicações envolvidas na jornada com suas dependências diretas. Para cada interseção relevante, a instrumentação precisa cobrir aquilo que importa para a experiência — não apenas o que é tecnicamente fácil de medir.

Métricas como disponibilidade, taxa de erro e latência podem participar dessa matriz quando fizerem sentido para o ponto observado. SLOs podem ser usados para estabelecer condições explícitas de confiabilidade — quando a taxa de sucesso cai abaixo de um determinado nível, o Error Budget está sendo consumido e uma decisão precisa ser tomada.

O material de referência é preciso nesse ponto: a matriz se torna útil para negócio e produto quando cada nó tem significado operacional — não apenas técnico. Engenharia observa o comportamento técnico. Produto observa o impacto na experiência. Operação aciona o time correto para reduzir MTTR.

Isso cria uma linguagem comum. Todos os nós e arestas podem gerar incidentes — e cada incidente tem um responsável explícito, não apenas um sistema suspeito.

## Group Buying: o que a matriz revela

No Group Buying, a jornada atravessa múltiplos domínios. A Matriz de Confiabilidade torna visível o que cada dependência significa para a experiência.

Não basta saber que o serviço de pagamentos está disponível. Precisamos saber o que sua indisponibilidade significa para a jornada de compra em grupo e quem precisa agir. Não basta saber que o estoque responde. Precisamos saber se os estados relevantes — quantidade reservada, quantidade disponível, quantidade comprometida pelo grupo — permanecem reconciliados entre os domínios que os consultam.

A integração entre o domínio de grupo e o motor de busca é uma dependência com um contrato implícito — quando um grupo muda de estado, a indexação precisa refletir isso dentro de um tempo aceitável. A Matriz de Confiabilidade torna esse contrato explícito como um KPI: qual é a latência máxima tolerável entre um evento de mudança de grupo e a atualização do índice? Quando esse tempo é ultrapassado, quem precisa saber?

## Acionamento como consequência da matriz

Uma das utilidades mais práticas da Matriz de Confiabilidade é guiar o acionamento de times específicos durante um incidente.

O troubleshooting de um problema de integração não precisa reunir todos os times envolvidos no produto. Precisa reunir os times com capacidade de atuação naquela interseção específica — os responsáveis pelos Bounded Contexts que participam do nó problemático.

A matriz mapeia essas responsabilidades antes do incidente. Quando a falha acontece, o acionamento é orientado pelo conhecimento já documentado sobre quem controla cada dependência — não por uma investigação improvisada sob pressão.

---

*A Matriz de Confiabilidade transforma a arquitetura em uma superfície de decisão. Cada dependência passa a responder à pergunta: o que precisa permanecer confiável aqui para que a experiência continue funcionando?*
