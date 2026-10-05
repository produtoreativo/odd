# Capítulo 7 — Eventos contam a história

Uma jornada pode ser desenhada como uma sequência de atividades. O domínio, no entanto, se torna mais claro quando conseguimos identificar acontecimentos relevantes.

Existe uma diferença importante entre atividade e evento. Uma atividade descreve o que alguém faz — o usuário clica, o sistema processa, o time aprova. Um evento descreve o que já aconteceu — um grupo foi criado, um pedido foi recebido, uma cobrança foi faturada, um produto foi entregue.

Eventos contam a história porque registram mudanças que já se tornaram verdadeiras. Eles são o vocabulário do domínio em movimento.

## Por que eventos revelam mais que atividades

Uma tela mostra uma representação do estado atual. Um evento mostra a mudança que tornou esse estado possível.

Essa diferença muda o que conseguimos perguntar. A partir de uma tela, podemos perguntar como ela está organizada ou o que ela exibe. A partir de um evento, podemos perguntar o que aconteceu para que ele existisse, quais entidades foram afetadas, quais outros eventos podem se seguir a ele e o que falha quando ele não ocorre no momento certo.

A mudança de linguagem é decisiva. Quando uma equipe consegue descrever o domínio como uma sequência de acontecimentos — e não apenas como um conjunto de telas, campos e botões — a conversa entre negócio e tecnologia passa a ter outro nível de precisão.

## Event Storming como instrumento de descoberta

Event Storming é uma forma estruturada de descobrir eventos a partir do comportamento do negócio. Seu valor não está nos post its, na sala ou na ferramenta. Está na conversa que torna explícita a sequência de acontecimentos e as condições que os tornam possíveis.

Uma sessão de Event Storming começa com os eventos — o que aconteceu — e trabalha retroativamente para descobrir o que os causou. Comandos, atores, sistemas externos, políticas e restrições aparecem como consequências dessa investigação.

O resultado é uma narrativa do domínio que qualquer pessoa envolvida no produto consegue ler e questionar — incluindo pessoas que não escrevem código.

Event Storming, portanto, não encerra a modelagem. Ele abre caminho para perguntas posteriores sobre protagonistas, fronteiras e confiabilidade. Um erro seria terminar o trabalho quando o mapeamento está pronto. Os eventos interessam porque nos ajudam a descobrir domínio, responsabilidade e o que precisa ser observado.

## Group Buying: eventos que constroem a jornada

No Group Buying, a pergunta não é apenas quais telas existem. Perguntamos o que aconteceu para que o estado atual pudesse existir.

Grupo criado. Grupo anunciado. Grupo indexado para buscas. Usuário aderiu ao grupo. Carrinho criado. Invoice gerada. Pedido criado. Prazo expirado com quantidade insuficiente. Grupo encerrado com pendência de aprovação. Produto recebido.

![Fluxo de Domain Events do Group Buying: PIM → Catálogo → Oferta → Ordem de Compra → Pedido → Pedido Faturado, com subluxo de criação e indexação do Grupo de Compra](../images/cap07-domain-events.png)

*O diagrama mostra os Domain Events do Group Buying como uma sequência de acontecimentos: a jornada principal vai de PIM ao Pedido Produto Faturado, enquanto o subluxo de Group Buying revela os eventos de Produto Elegível, Grupo de Compra Criado, Grupo de Compra Indexado e Produto Encontrado com Grupo de Compra. Cada caixa laranja é um evento, não uma atividade. Fonte: slide 71 da apresentação "ProdOps — Modelagem de Domínio com Confiabilidade, Parte 1".*

Cada um desses eventos representa uma mudança que importa para o negócio. Cada um pode ter consequências diretas em outros domínios: o evento de indexação precisa se propagar para o motor de busca, o evento de encerramento precisa notificar o time comercial, o evento de recebimento pode precisar atualizar métricas de entrega.

Os domain events também têm nomes precisos. No caso Group Buying, eventos como `group_buying.shopcart.buybox.added` com metadados `{group:created}` ou `{group:adhesion}` revelam não apenas o que aconteceu, mas em que contexto aconteceu. Essa precisão semântica é o que permite que sistemas distintos se coordenem sem acoplamento excessivo.

## O que eventos revelam sobre protagonistas

A partir dos eventos, começamos a perceber quais elementos realmente movem a jornada.

Alguns dados mudam constantemente e conduzem o fluxo. Um grupo de compra muda de estado várias vezes durante seu ciclo de vida. Um pedido muda conforme avança pelo processo de faturamento. Um carrinho muda sempre que o comprador interage com ele.

Outros dados participam da jornada como informação de suporte. Um produto existe e é referenciado, mas raramente muda durante uma compra específica. Uma oferta é consultada, mas não é alterada pelo ato da compra.

Essa distinção — entre o que muda e o que apenas existe — prepara a descoberta dos protagonistas. E é sobre os protagonistas que o próximo capítulo trata.

---

*Eventos não são o produto final da descoberta. São a narrativa que permite enxergar o que muda e, a partir disso, descobrir onde a confiabilidade precisa existir.*
