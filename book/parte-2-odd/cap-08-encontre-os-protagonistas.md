# Capítulo 8 — Encontre os protagonistas

Nem todo dado possui o mesmo peso em uma jornada.

Existe uma distinção que o material de referência formula de maneira direta: entidades e dados protagonistas são os elementos centrais que movem a jornada de um processo. Eles mudam de estado ao longo do tempo, influenciam decisões, determinam regras e conduzem o fluxo. São esses dados que merecem atenção especial, porque sua mutação impacta o comportamento e o resultado do sistema como um todo.

Dados coadjuvantes existem e participam da jornada, mas geralmente afetam sem interromper. Quando um dado coadjuvante está incorreto, o efeito tende a ser visível na apresentação ou na informação exibida. Quando um dado protagonista está incorreto ou inconsistente, o efeito tende a ser sentido na jornada inteira.

## Por que a distinção importa

Tratar todos os dados com o mesmo nível de atenção é uma forma de não prestar atenção em nada em particular.

Uma tabela de produto e uma tabela de pedido não possuem o mesmo risco operacional em uma jornada de compra. Um objeto de configuração e um objeto de grupo de compra não possuem a mesma frequência de mudança nem a mesma consequência quando estão inconsistentes.

A distinção entre protagonistas e coadjuvantes permite abandonar a visão em que todas as tabelas, APIs e objetos recebem o mesmo tratamento arquitetural e o mesmo nível de rigor operacional. Quando sabemos quem conduz a jornada, sabemos onde concentrar a atenção.

Isso também muda a conversa sobre observabilidade. Não é possível observar tudo com o mesmo rigor sem que o sinal se perca no ruído. Protagonistas precisam de observabilidade proporcional ao seu papel.

## Group Buying: quem move a jornada

No caso Group Buying, os protagonistas se revelam quando olhamos para o que muda e o que essa mudança significa para o fluxo.

O **grupo de compra** é o protagonista central. Ele inicia como um estado inexistente, é criado, anunciado, indexado. Participantes entram, pedidos são associados, o prazo avança. Ao final, o grupo é encerrado — seja com sucesso, com pendência de aprovação comercial ou com um erro crítico na persistência. Cada transição de estado é relevante e pode ter consequências em outros domínios.

O **pedido** também é protagonista. Ele nasce associado a um grupo e um carrinho, passa pelo processo de faturamento e termina como pedido faturado — um objeto que representa um compromisso financeiro do negócio com o cliente.

O **carrinho** é protagonista de um ciclo mais curto e mais volátil. Ele existe enquanto o comprador está no processo de adesão e some — como objeto transacional ativo — quando o pedido é confirmado.

Por contraste, o **produto** é principalmente coadjuvante nessa jornada. Ele é referenciado, consultado e exibido, mas raramente muda como resultado de uma compra em grupo específica. O **catálogo** e a **oferta** também são coadjuvantes — importantes para que a jornada comece, mas não alterados pelo processo em si.

## O protagonismo depende do ponto de observação

Uma nuance importante: o protagonismo não é uma propriedade absoluta de uma entidade. É relativa ao Value Stream sendo observado.

Em uma jornada de compra em grupo, o produto é coadjuvante. Em uma jornada de cadastro de catálogo ou de atualização de preço, o produto é protagonista. A mesma entidade pode mudar de papel dependendo do fluxo que está sendo analisado.

Isso é relevante para ODD porque significa que a descoberta de protagonistas precisa acontecer em relação a uma jornada específica, não em abstrato. Quando a jornada não está clara, a identificação de protagonistas tende a ser feita por intuição ou por importância percebida — o que geralmente beneficia os dados mais familiares, não os mais críticos.

## Da descoberta à responsabilidade

Identificar um protagonista levanta imediatamente uma série de perguntas que precisam de resposta: onde essa entidade é controlada? Quem responde pelas mudanças que ela sofre? Quais contratos existem ao redor dela que garantem que outros sistemas podem depender do seu estado?

Essas perguntas conectam protagonistas a Bounded Contexts — o tema do próximo capítulo.

---

*O domínio começa a ficar inteligível quando deixamos de tratar todos os dados como equivalentes e passamos a enxergar aqueles que realmente conduzem a jornada.*
