# Capítulo 11 — O contrato do domínio

Um contrato técnico isolado pode dizer como chamar um serviço — o endpoint, o método HTTP, o schema do payload, os códigos de resposta esperados. Um contrato de domínio precisa dizer, ainda que indiretamente, o que aquela interação significa para o produto.

Essa distinção não é semântica. Ela determina o que é testável, o que é monitorável e o que é negociável quando a jornada falha.

ODD chega aos contratos depois de jornada, eventos, protagonistas e fronteiras. Essa ordem importa. O contrato não é o começo da descoberta — é uma consequência dela.

## O que um contrato de domínio precisa expressar

Um contrato de domínio precisa ir além da assinatura técnica.

Ele precisa expressar quais condições de negócio são preservadas pela interação. Quando um pedido é criado, quais invariantes precisam ser verdadeiros? O grupo precisa estar ativo. O comprador precisa ter um carrinho válido. A invoice precisa ser gerada. Se qualquer uma dessas condições não for satisfeita, o contrato foi violado — independentemente de o endpoint ter respondido 200.

Ele precisa expressar quais garantias de disponibilidade e consistência são oferecidas. Uma dependência que oferece consistência eventual não pode ser tratada como se oferecesse consistência imediata. Um serviço que pode estar indisponível por períodos curtos não pode ocupar um caminho crítico sem um mecanismo de fallback.

Ele precisa expressar o que acontece quando a interação falha. Falha silenciosa, falha com retentativa automática, falha com notificação imediata — cada escolha tem consequências operacionais que precisam ser explicitadas antes de se tornarem surpresas em produção.

## SLA, SLO, SLI e Error Budget como contratos internos

O material de referência trata SLA, SLO, SLI e Error Budget como contratos evolutivos — não apenas como compromissos externos com clientes, mas como acordos internos entre equipes.

O SLO define o objetivo de confiabilidade de um serviço dentro de um período. O SLI mede o que está sendo observado para verificar se o SLO está sendo cumprido. O Error Budget é o espaço de falha tolerado antes que o SLO seja violado. E o SLA é o comprometimento formal, frequentemente derivado do SLO, com partes externas.

Essa estrutura aproxima confiabilidade da experiência. Uma equipe não deveria medir apenas o que sua aplicação consegue medir internamente. Ela deveria medir aquilo que permite compreender se sua responsabilidade está preservando a jornada.

No Group Buying, isso significa que o SLO de um serviço de grupo de compra não deveria ser apenas "99% das requisições respondem em menos de 200ms". Deveria incluir algo como "zero falhas críticas no processo de encerramento automático de grupos" — uma condição que só faz sentido se a jornada foi compreendida.

## Group Buying: contratos que protegem a jornada

No Group Buying, um contrato de criação de pedido não é apenas um POST que responde 201. É uma promessa sobre o que significa receber um pedido e quais condições precisam ser preservadas — grupo ativo, carrinho válido, estoque disponível, invoice gerada.

Uma integração com o motor de busca não é apenas uma chamada de indexação. É um contrato que diz: quando um grupo muda de estado, a representação indexada precisa ser atualizada dentro de um tempo aceitável. Se o contrato é quebrado, compradores podem encontrar grupos expirados nas buscas.

Uma integração com o time comercial não é apenas uma notificação. É um contrato que diz: quando um grupo é encerrado com pendência de aprovação, uma pessoa precisa ser informada em tempo de tomar uma decisão útil.

![Alerta de contrato em produção: mensagem no Discord notificando que o número de grupos criados nos últimos 5 minutos caiu abaixo de 10](../images/cap11-contratos-negocio.png)

*O alerta mostra um contrato de domínio em ação: "Nos últimos 5 minutos, o número de grupos criados caiu abaixo de 10. Verifique o funcionamento da jornada de compra coletiva." Isso não é um alerta técnico de infraestrutura — é um alerta de comportamento de negócio. Ele só pode existir se a jornada foi compreendida e o contrato foi explicitado: quantos grupos deveriam ser criados em cinco minutos é uma condição de domínio, não uma métrica de servidor. Fonte: slide 22 da apresentação "ProdOps — Modelagem de Domínio com Confiabilidade, Parte 2".*

## O que este capítulo não é

Este capítulo não é um catálogo de padrões de integração. ODD não prescreve uma tecnologia para todos os contratos.

Alguns contratos serão expressos como APIs síncronas. Outros como eventos assíncronos. Outros como estados compartilhados com garantias de consistência. A escolha depende do comportamento descoberto, da frequência de mudança da entidade envolvida e do nível de tolerância ao desvio que o negócio aceita.

O que importa é tornar explícita a relação entre comportamento de domínio e condição de confiabilidade — antes que essa relação seja descoberta em produção, da pior forma possível.

---

*Contrato técnico sem contexto de negócio é apenas especificação. O contrato ganha força quando conseguimos explicar qual parte da jornada ele protege.*
