# Capítulo 18 — Runtime é a prova

Um domínio pode estar bem modelado. Um OBC pode estar consistente. Um Plano de Confiabilidade pode estar completo. Ainda assim, nada disso prova que o produto funciona.

A prova aparece quando o software encontra a realidade.

O material de referência formula isso com precisão provocativa: se não existe software em produção, não existe valor para o cliente. A frase não diminui a importância da descoberta. Ela define sua finalidade.

ODD não existe para produzir diagramas perfeitos. Existe para aumentar a qualidade daquilo que será colocado em produção — e para que, quando chegar lá, saibamos o que observar.

## O que Runtime revela

Runtime é onde as decisões tomadas durante ODD, OBC e PRE são confrontadas com comportamento real.

A observabilidade mostra se aquilo que foi considerado importante durante a descoberta continua acontecendo como esperado. A operação revela onde o modelo encontrou exceções — comportamentos que existiam no domínio mas não foram capturados durante a exploração. O cliente mostra se a experiência preserva o valor que motivou o produto.

Esses três confrontos são inevitáveis. A questão é o que a organização consegue fazer com eles.

Quando o domínio foi compreendido, os eventos foram nomeados e a observabilidade foi desenhada a partir da jornada, a organização consegue reconhecer quando a realidade diverge do que esperava. E consegue agir — com velocidade, com responsabilidade clara e com contexto suficiente para entender o que precisa ser corrigido.

Quando o domínio não foi compreendido, a organização reage a sintomas. O incidente tem causa raiz difícil de rastrear. O acionamento é impreciso. A correção é feita sobre incerteza — e pode criar novos problemas que só aparecerão no próximo incidente.

## O ciclo que se fecha

Runtime fecha o ciclo do ProdOps.

Intent produz uma direção. ODD transforma direção em entendimento. OBC transforma entendimento em compromisso. PRE prepara a execução. Delivery coloca a mudança no caminho. Runtime mostra o que realmente aconteceu. Outcome devolve a evidência ao negócio.

Esse ciclo não é linear apenas porque existe uma sequência. É linear porque cada etapa cria as condições para que a próxima funcione. Runtime sem ODD é reação sem contexto. ODD sem Runtime é modelagem sem prova.

## Group Buying: quando o modelo encontra o mundo

No Group Buying, a jornada finalmente deixa de ser uma sequência de acontecimentos mapeados e se torna uma experiência real.

Pedidos são criados. Grupos mudam de estado. O encerramento automático executa. O estoque é consumido. Pagamentos acontecem. Produtos são entregues.

Se a observabilidade foi desenhada a partir do domínio — se os eventos foram instrumentados, se os alertas refletem condições de negócio, se a Matriz de Confiabilidade transformou dependências em KPIs — a organização consegue ver a jornada funcionando, ou não funcionando, com a granularidade necessária para agir.

Um grupo que expira com pedidos não reconciliados não é apenas um bug. É uma violação de um comportamento que deveria ter sido protegido por um contrato. A observabilidade desenhada a partir do domínio permite identificar isso com precisão — não como um problema de infra, mas como um problema na jornada de Group Buying.

## Por que observabilidade está no nome de ODD

A razão pela qual observabilidade está no nome desta abordagem não é porque o livro seja sobre dashboards. É porque aquilo que foi compreendido durante ODD precisa continuar verificável depois que o compromisso vira software.

Quando uma entidade foi identificada como protagonista dinâmica, com baixa tolerância ao desvio, o comportamento que determina essa classificação precisa ser observável em produção. Quando um contrato entre domínios foi estabelecido com uma garantia de consistência, essa garantia precisa ser mensurável em Runtime.

ODD sem observabilidade em Runtime é uma teoria sem teste. Runtime sem o entendimento de ODD é reação sem contexto.

A prova que Runtime oferece — a única prova que realmente importa — depende de que a pergunta sobre o que observar tenha sido respondida antes.

---

*O produto não é o diagrama, o backlog, o OBC ou a arquitetura. O produto é aquilo que acontece quando o software encontra o mundo.*

**Antes de construir o produto, descubra o que precisa ser confiável. Depois, coloque essa confiança à prova em produção.**
