# Capítulo 15: O OBC

OBC não é simplesmente documentação. Essa distinção é essencial e precisa ser preservada ao longo de todo o livro.

Um documento pode registrar o que alguém pensou sobre o domínio em um determinado momento. OBC precisa representar o domínio de maneira suficientemente compreendida para que a organização possa assumir um compromisso sobre ele.

A diferença está na função. Documentação descreve. OBC habilita decisão.

## O que OBC representa

OBC é o ponto de passagem entre descoberta e compromisso.

Durante ODD, o domínio está sendo compreendido. Experimentos são feitos, hipóteses são testadas, a jornada é mapeada, protagonistas são identificados, fronteiras são estabelecidas e um Plano de Confiabilidade é construído. Ao longo de todo esse processo, a representação do domínio pode mudar, porque a compreensão está evoluindo.

OBC marca o momento em que essa representação é suficientemente estável para ser usada como base de um compromisso. Não significa que o domínio está completamente compreendido, domínios complexos raramente são. Significa que o entendimento acumulado é suficiente para que a organização decida avançar com clareza sobre o que está assumindo.

A definição provisória é direta: OBC é a representação do domínio suficientemente compreendida para permitir que uma organização decida assumir um compromisso.

## A passagem que OBC representa

Sem OBC, a transição entre descoberta e entrega tende a acontecer de forma implícita, a organização simplesmente começa a construir em algum ponto, sem que exista um momento explícito de decisão sobre o que foi compreendido e o que ainda é incerto.

Essa transição implícita tem um custo. Incertezas que existiam durante a descoberta são importadas para a fase de execução, onde o custo de descobrir e corrigir é mais alto.

OBC torna a transição explícita. Ele representa uma pergunta que precisa ser respondida antes de assumir o compromisso: compreendemos o domínio suficientemente bem para saber o que estamos prestes a construir, quais riscos estamos assumindo e como a confiabilidade da jornada será garantida?

Se a resposta é sim, existe um OBC. Se a resposta é não, existe mais trabalho de ODD a fazer.

## Group Buying: o que OBC contém

No Group Buying, OBC não é uma descrição de telas ou uma lista de funcionalidades. É uma representação do que precisa acontecer para que a jornada de compra em grupo seja válida.

Ela inclui a jornada mapeada, do produto elegível ao produto recebido, com os eventos relevantes em cada etapa. Inclui as entidades protagonistas e suas categorias de mutabilidade, grupo e pedido como dinâmicos, carrinho como volátil. Inclui os Bounded Contexts identificados e os contratos que os conectam. Inclui as condições de confiabilidade que precisam ser preservadas, quais dependências estão no caminho crítico, quais garantias são necessárias em cada interseção.

Essa representação é o que permite que PRE comece, não sobre incerteza não explicitada, mas sobre um entendimento registrado e negociado.

## Intent, ODD e OBC

A sequência é:

**Intent** produz direção. A organização sabe o que quer construir, por que quer construir e qual valor espera entregar.

**ODD** produz entendimento. A organização compreende o domínio, seus riscos, suas dependências e suas condições de confiabilidade.

**OBC** torna esse entendimento utilizável para compromisso. A representação está suficientemente estável para que a decisão de avançar seja informada, não impulsionada.

---

*A pergunta não é se temos documentação suficiente. A pergunta é se compreendemos o domínio suficientemente bem para assumir a responsabilidade de construir.*
