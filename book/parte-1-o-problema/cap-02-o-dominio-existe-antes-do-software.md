# Capítulo 2 — O domínio existe antes do software

Antes de existir uma aplicação de Group Buying, alguém já precisa saber o que significa comprar em grupo. Existem regras, acontecimentos, participantes, estados e consequências. O software não cria essa realidade. Ele a representa, automatiza e torna executável.

Essa distinção importa porque a ordem em que as coisas são descobertas tende a determinar o que permanece invisível.

Quando o software é o ponto de partida, a arquitetura captura aquilo que foi decidido — endpoints, tabelas, objetos, fluxos de dados. Mas nem sempre revela aquilo que ainda não foi compreendido: qual acontecimento torna um pedido válido, qual contexto é responsável pela verdade de um produto, qual parte da jornada é afetada quando uma dependência falha.

## O produto como sistema vivo

Uma forma útil de enxergar o produto é através de quatro dimensões complementares.

**Fluxo** trata das jornadas e do movimento — como o cliente percorre o produto, onde o valor é entregue, onde ele é perdido. **Time** trata de responsabilidade e capacidade — quem pode agir, quem responde por cada parte. **Dados** tratam de comportamento e impacto — o que muda, quando muda, o que essa mudança significa. **Peças** tratam das aplicações, serviços e integrações que sustentam a trajetória.

Essas quatro dimensões não descrevem o software. Descrevem o produto como sistema vivo. A diferença é sutil mas consequente: um software pode estar funcionando enquanto o produto está falhando.

Isso acontece quando a observabilidade está voltada apenas para as peças e não para o fluxo. Uma aplicação pode responder 200 enquanto uma regra de negócio deixou de ser satisfeita. Um serviço pode estar disponível enquanto a jornada que deveria atravessá-lo encontrou um caminho alternativo que o negócio não autorizou.

## Trajetória antes de implementação

A mudança que ODD propõe é na ordem da conversa. Em vez de perguntar qual aplicação deve ser construída, perguntamos qual trajetória precisa ser compreendida.

No Group Buying, essa sequência atravessa PIM, catálogo, oferta, ordem de compra, pedido, faturamento e recebimento. O valor não está em possuir todas essas peças isoladamente — está em conseguir explicar como elas participam de uma mesma jornada e o que precisa permanecer verdadeiro para que a jornada funcione.

Quando a pergunta começa pela trajetória, as aplicações aparecem como consequências do domínio. O catálogo existe porque existe um produto que precisa ser encontrado. A oferta existe porque existe uma condição de elegibilidade que precisa ser avaliada. O grupo existe porque existe uma dinâmica de volume e prazo que determina se a compra em grupo é possível.

Cada peça responde a um comportamento. O comportamento responde à jornada. A jornada responde ao domínio.

## DDD como fundamento, não como destino

DDD oferece ferramentas importantes para essa investigação. Linguagem ubíqua, Bounded Contexts e Domain Events são formas de tornar o domínio explícito e de alinhar a conversa entre especialistas de negócio e pessoas de tecnologia.

ODD não substitui esses fundamentos. Ele acrescenta uma pergunta que DDD não responde diretamente: o que precisamos compreender sobre o domínio para saber o que deverá ser observado e protegido antes de assumir o compromisso de construir?

Essa pergunta orienta ODD para um momento específico — antes do compromisso — e para uma preocupação específica — a confiabilidade da jornada. DDD ajuda a descobrir o domínio. ODD usa essa descoberta para preparar as condições de decisão.

A confusão entre as duas abordagens é compreensível e será tratada com mais cuidado no capítulo que define formalmente ODD. O que importa aqui é a sequência: domínio primeiro, implementação como consequência.

## O que a arquitetura tende a esconder

Uma arquitetura pode estar bem desenhada e ainda esconder realidades importantes.

Pode existir um endpoint de criação de pedido sem que ninguém tenha clareza sobre qual acontecimento de negócio torna esse pedido válido. Pode existir uma integração de estoque sem que esteja explícito o que acontece quando o estoque não está atualizado no momento em que o grupo é encerrado. Pode existir um serviço de notificação sem que alguém tenha mapeado quais eventos de negócio precisam, de fato, gerar uma notificação.

Essas lacunas não aparecem no diagrama de arquitetura. Aparecem em produção, na forma de comportamentos inesperados, incidentes com causa raiz difícil de rastrear e decisões de suporte que ninguém consegue tomar com confiança.

A descoberta do domínio antes do compromisso serve exatamente para que essas lacunas apareçam no momento em que ainda é possível agir sobre elas.

---

*Quando o software é tratado como ponto de partida, a arquitetura tende a esconder a realidade que deveria representar. Quando a jornada vem primeiro, as peças começam a aparecer como consequências do domínio.*
