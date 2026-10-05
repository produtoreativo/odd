# Capítulo 10 — Mutabilidade é risco

Se uma entidade muda, precisamos compreender como ela muda. Se ela muda frequentemente, a necessidade de observação aumenta. Se ela muda em um contexto de baixa tolerância ao desvio, a necessidade de consistência aumenta também.

Frequência de mutação e tolerância ao erro são as duas dimensões que determinam o risco de uma entidade em uma jornada. A pergunta não é se a entidade é importante — é como ela se comporta quando sofre mudança e o que acontece quando essa mudança falha.

## As quatro categorias

O material de referência organiza entidades em quatro grupos que servem como orientação para a análise de risco.

**Entidades Voláteis** apresentam mutabilidade muito alta. O carrinho de compras é o exemplo canônico. Ele muda a cada interação do comprador — itens são adicionados, removidos, quantidades são alteradas, o sessão pode expirar. O risco associado está no comportamento, na experiência e na conversão. Uma falha em entidade volátil tende a aparecer imediatamente para o usuário e impactar diretamente a taxa de conclusão da jornada.

![Entidade Volátil no Group Buying: o Cart como entidade central, com os eventos group_buying.shopcart.buybox.added {group:created} e {group:adhesion} fluindo para o Webshop API](../images/cap10-entidades-volateis.png)

*O diagrama mostra o Cart como entidade volátil no contexto do Group Buying. Dois fluxos chegam ao Shop Cart — a criação de grupo e a adesão de novo comprador — e ambos disparam o mesmo domain event (`group_buying.shopcart.buybox.added`) com metadados distintos (`{group:created}` e `{group:adhesion}`). O Cart é resolvido pelo Webshop API (que integra Search, ShopCart e Group) e persiste via Magento/MySQL. Fonte: slide 9 da apresentação "ProdOps — Modelagem de Domínio com Confiabilidade, Parte 2".*

**Entidades Dinâmicas** apresentam mutabilidade alta com baixa tolerância ao desvio. Estoque é o exemplo do material. No Group Buying, o grupo de compra e o pedido também se encaixam aqui. Elas mudam com frequência operacional e cada mudança precisa ser consistente — um estado intermediário inválido pode comprometer a integridade de toda a jornada. O risco está na consistência de estado.

**Entidades Semiestáticas** mudam com menor frequência. Produto pode ocupar essa posição. Os atributos de um produto mudam — nome, preço, descrição, categorias — mas não mudam a cada transação. O risco está em sincronização, versão e consistência. Uma mudança desatualizada de produto pode não interromper uma compra, mas pode produzir exibições incorretas ou inconsistências entre canais.

**Entidades Massivamente Imutáveis** são criadas em volume e praticamente não modificadas após a criação. Dependendo do caso, oferta, promoção ou catálogo versionado podem apresentar essa característica. Uma oferta publicada não é alterada — ela é substituída por uma nova versão. O risco é diferente: volume, rastreabilidade, e a estratégia operacional favorece leitura eficiente, cache e projeções.

## A pergunta que orienta a classificação

A classificação não deve virar uma taxonomia mecânica aplicada a entidades fora de contexto. Ela existe para orientar perguntas.

**Quanto essa entidade muda?** Em que frequência — por sessão, por transação, por operação administrativa, por publicação?

**Quanto o negócio tolera que ela esteja errada?** Um carrinho com item errado é corrigível durante a sessão. Um pedido faturado com valor errado tem consequências financeiras. Um grupo encerrado com dados inconsistentes pode significar perda de pedidos que ninguém recuperou.

**O que acontece quando ela está errada?** A resposta determina onde o rigor precisa ser maior — na prevenção, na detecção, na correção ou nos três.

## Observabilidade proporcional ao comportamento

A consequência direta da classificação é que a observabilidade não pode ser uniforme.

Para entidades voláteis, o material associa a atenção à usabilidade e às tendências — tracing por sessão, log de ações com TTL curto, métricas de volume e taxa de falha, alertas sobre padrões de abandono.

Para entidades dinâmicas, o rigor aumenta — logs estruturados com identificadores de evento, versão e entidade, alertas por estado inválido ou estagnado, tracing distribuído entre serviços, métricas de desvio de consistência. O alerta típico não é "aplicação lenta". É "grupo de compra ativo com pedidos não reconciliados há mais de dois minutos".

Para entidades semiestáticas, a atenção se desloca para sincronização e versionamento — logs de mutação com auditoria, alertas de dados desatualizados, controle de quem alterou o quê e quando.

## Frequência de mutação impõe rigor diferente

O princípio central deste capítulo é operacional: frequência de mutação impõe o rigor na observabilidade.

Tratar o carrinho com o mesmo nível de atenção que o catálogo de produtos é desperdiçar atenção onde ela importa menos e deixar de concentrá-la onde ela importa mais.

ODD usa a classificação de entidades para calibrar o Plano de Confiabilidade. Onde estão as entidades mais voláteis? Onde estão as entidades que o negócio menos tolera ver erradas? Esses são os lugares onde a descoberta do domínio precisa ser mais profunda e onde a instrumentação precisa ser mais rigorosa.

---

*Confiabilidade não é tratar tudo com o mesmo rigor. É aplicar rigor proporcional ao comportamento e ao risco daquilo que conduz a jornada.*
