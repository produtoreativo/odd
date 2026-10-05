# Capítulo 14 — O Plano de Confiabilidade

ODD não termina quando o domínio foi desenhado. O conhecimento precisa se transformar em plano.

O Plano de Confiabilidade é o artefato que reúne o que foi descoberto sobre jornada, eventos, protagonistas, fronteiras, contratos, mutabilidade, dependências e observabilidade. Seu propósito é permitir que a organização enxergue as fraquezas e fortalezas do fluxo antes de assumir o compromisso de construí-lo.

## O que o plano precisa responder

Um Plano de Confiabilidade não é documentação estática. É uma representação acionável do entendimento acumulado durante ODD.

Ele precisa responder onde estão as entidades que mudam com mais frequência e menos tolerância ao desvio. Precisa mostrar quais dependências estão no caminho crítico da jornada e o que acontece quando cada uma falha. Precisa indicar quais contratos protegem as fronteiras entre contextos e qual é o nível de confiabilidade que cada contrato oferece.

Precisa também responder quem é responsável por cada parte do sistema — não apenas qual time faz o deploy, mas qual time pode agir quando algo sai do esperado.

Essa última pergunta é central. Observabilidade sem responsável não reduz MTTR. Uma dependência sem dono permanece uma dependência invisível — identificável como causa depois da falha, mas não gerenciável antes dela.

## A cadeia que o plano torna visível

O material de referência apresenta o Plano de Confiabilidade como resultado de uma cadeia de descobertas:

Um evento leva a uma entidade. A entidade leva a uma mutação. A mutação leva a uma condição de confiabilidade. A condição leva a uma observação. A observação leva a uma responsabilidade.

Quando essa cadeia é visível, é possível tomar decisões sobre onde instrumentar, o que alertar, como acionar e como responder. Quando ela não é visível, cada incidente começa com uma investigação que precisa reconstruir retroativamente o que poderia ter sido mapeado com antecedência.

## O Engenheiro ProdOps no plano

O material estabelece o papel do Engenheiro ProdOps nesse momento: refinar os detalhes, expor as fraquezas e fortalezas do fluxo e estabelecer como a confiabilidade poderá ser observada.

Isso não é uma atividade de revisão ao final do desenvolvimento. É uma atividade que acontece durante a descoberta do domínio — enquanto ainda é possível alterar o design, redistribuir responsabilidades ou explicitar dependências que estavam implícitas.

O time inteiro precisa seguir o mapeamento da Service Blueprint para extrair a arquitetura necessária para cada momento de atuação. O Engenheiro ProdOps é quem garante que a conversa inclui fraquezas, não apenas possibilidades.

## Group Buying: o plano em ação

No Group Buying, o Plano de Confiabilidade pode revelar:

Quais entidades exigem maior rigor — grupo de compra e pedido como dinâmicas, com baixa tolerância ao desvio; carrinho como volátil, com alta frequência de mutação e impacto direto na conversão.

Quais contratos precisam ser protegidos — a integração entre o domínio de grupo e o motor de busca, a integração entre grupo e pedido no momento do encerramento automático, a integração entre pagamento e faturamento.

Quais dependências possuem impacto direto na jornada — estoque, pagamento e indexação estão no caminho crítico; o time comercial precisa ser acionado quando um grupo é encerrado com pendência de aprovação.

Quais indicadores precisam acompanhar a jornada — taxa de grupos que atingem volume mínimo, latência de indexação após mudança de estado, taxa de pedidos não reconciliados em grupos ativos.

## A passagem para OBC

O Plano de Confiabilidade é a ponte entre compreender o domínio e preparar um compromisso.

Quando o plano existe, a organização tem o que precisa para responder a pergunta que define OBC: compreendemos o domínio suficientemente bem para assumir a responsabilidade de construir?

Se a resposta é sim, o plano se torna a base sobre a qual OBC será construído — a representação do domínio suficientemente compreendida para que o compromisso seja assumido com clareza.

---

*O Plano de Confiabilidade é a ponte entre compreender o domínio e preparar um compromisso. O próximo passo é representar esse entendimento de uma forma suficientemente clara para que a organização possa decidir.*
