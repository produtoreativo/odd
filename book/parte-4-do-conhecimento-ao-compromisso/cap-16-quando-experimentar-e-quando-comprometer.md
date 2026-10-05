# Capítulo 16 — Quando experimentar e quando comprometer

Nem toda mudança deve receber o mesmo rigor. E nem todo momento no ciclo de vida de um produto exige a mesma postura organizacional.

Antes do compromisso, a organização precisa aprender. Depois do compromisso, precisa preservar uma promessa.

Essa diferença está no coração da separação entre Upstream e Downstream — e é uma das distinções mais importantes que ODD precisa tornar explícita.

## Upstream: o espaço do aprendizado

No Upstream, a intenção passa por ODD, por experimentação e pela evolução do entendimento do domínio que eventualmente se consolidará em OBC.

Nesse espaço, a flexibilidade é desejável. Podem existir Event Storming, protótipos, vibecoding, hipóteses sobre o comportamento do domínio, revisões do Plano de Confiabilidade. A representação do domínio pode mudar porque ainda estamos aprendendo sobre ele.

O que define o Upstream não é uma ferramenta ou uma técnica. É a ausência de compromisso formal. A organização está investindo em entendimento antes de investir em execução comprometida.

Essa postura tem um custo — o tempo e a capacidade dedicados à descoberta. Mas ela reduz um custo maior: o custo de executar sobre uma realidade insuficientemente compreendida.

## Downstream: o espaço do compromisso

No Downstream, existe OBC comprometido. A partir daí entram BDD, Reliability Gates e Delivery. A mudança passa a ser avaliada não apenas pelo que pode ser construído, mas pelo compromisso que precisa ser preservado.

Quando uma funcionalidade está comprometida, uma mudança que afeta seu comportamento ou sua confiabilidade não é apenas uma decisão técnica. É uma decisão sobre o compromisso assumido. Ela precisa ser tratada como tal — com visibilidade, rastreabilidade e impacto explícito para as partes que dependem desse compromisso.

Isso não significa que o Downstream é rígido demais para evoluir. Significa que a evolução acontece sobre um terreno conhecido, com clareza sobre o que está sendo alterado e quem precisa saber.

## O erro que aparece nos dois lados

O erro mais comum no lado Upstream é aplicar o rigor do Downstream cedo demais — tratar descoberta como execução, documentar em excesso o que ainda não foi compreendido, congelar decisões que precisam ser exploradas.

O erro mais comum no lado Downstream é carregar a liberdade do Upstream para depois do compromisso — alterar comportamentos sem visibilidade, tomar decisões que afetam contratos sem comunicar, tratar o compromisso como uma formalidade passada e não como uma responsabilidade presente.

No primeiro caso, a organização transforma descoberta em burocracia. No segundo, transforma compromisso em improvisação.

Ambos têm consequências operacionais. O primeiro produz lentidão e rigidez onde flexibilidade seria benéfica. O segundo produz instabilidade e baixa confiança onde previsibilidade seria necessária.

## Group Buying: onde está a fronteira

No Group Buying, enquanto a jornada está sendo descoberta — como funciona a adesão, quais estados o grupo precisa atravessar, como o encerramento automático deve se comportar — a organização está no Upstream. As representações podem mudar. As hipóteses podem ser testadas. Os contratos entre domínios ainda estão sendo negociados.

Quando a organização decide comprometer — quando OBC existe e a decisão de avançar foi tomada — as mudanças que afetam o comportamento do grupo, a sequência de estados ou a confiabilidade da jornada passam a ter um peso diferente.

ODD não determina quando a fronteira deve ser cruzada. Ele ajuda a tornar visível o que ainda é desconhecido e o que já foi compreendido — para que a decisão de comprometer seja tomada conscientemente, não por inércia ou pressão.

---

*A fronteira entre Upstream e Downstream não é uma fronteira de ferramenta. É uma fronteira de compromisso.*
