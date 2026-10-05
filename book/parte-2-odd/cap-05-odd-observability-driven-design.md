# Capítulo 5 — ODD: Observability Driven Design

ODD, Observability Driven Design, é a abordagem que transforma uma intenção de produto em um domínio compreendido, observável e confiável antes que essa intenção se torne um compromisso de engenharia.

Essa definição contém uma fronteira importante. ODD não é uma nova versão de DDD. Não é um catálogo de ferramentas de observabilidade. Também não é uma técnica para criar dashboards ou uma metodologia de arquitetura.

## O que ODD não é

Antes de definir o que ODD faz, vale tornar explícito o que ele não faz — porque as confusões mais comuns tendem a surgir nessas fronteiras.

**ODD não é DDD.** DDD oferece fundamentos essenciais para compreender complexidade de domínio: linguagem ubíqua, Bounded Contexts, agregados, Domain Events. ODD utiliza esses fundamentos. A diferença está na pergunta que orienta o trabalho. DDD pergunta como modelar o domínio. ODD pergunta o que precisamos compreender sobre o domínio para saber o que deverá ser observado, operado e protegido antes do compromisso.

**ODD não é observabilidade de Runtime.** Ferramentas como Datadog, Dynatrace e Grafana são importantes para operar produtos em produção. ODD não substitui nem compete com essas ferramentas. A diferença está no momento. ODD atua antes da produção, na fase de descoberta e compreensão do domínio. O que ODD produz orienta como a observabilidade de Runtime será configurada — mas não é a configuração em si.

**ODD não é arquitetura.** O resultado de ODD não é um diagrama de microserviços, uma decisão de banco de dados ou um mapa de integrações. Esses elementos podem emergir como consequência do trabalho de ODD, mas não são seu objetivo direto.

## A pergunta que diferencia ODD

A pergunta que define ODD é:

> **O que precisamos compreender sobre o domínio para saber o que deverá ser observado, operado e protegido antes de assumir o compromisso de construir?**

Essa pergunta muda a finalidade da modelagem. O resultado esperado não é apenas um modelo conceitual. É a preparação de condições para decisão.

Quando ODD está sendo aplicado, jornada, Value Stream, Domain Events, entidades protagonistas, mutabilidade, Bounded Contexts, times, contratos e confiabilidade passam a formar uma sequência. Cada elemento descoberto avança a compreensão do domínio até o ponto em que a organização consegue dizer: compreendemos o suficiente para assumir um compromisso.

## A posição de ODD

No universo ProdOps, ODD ocupa uma posição precisa:

```
Intent → ODD → OBC → PRE → Delivery → Runtime → Outcome
```

ODD trabalha entre Intent e OBC. Durante esse intervalo, o domínio está sendo descoberto. Existem experimentos, hipóteses, conversas e revisões. A flexibilidade é desejável porque ainda estamos aprendendo.

OBC marca o ponto de passagem: o domínio está suficientemente compreendido para que a organização assuma um compromisso. A partir daí começa PRE, que prepara a execução do que foi comprometido.

Essa distinção protege ODD contra dois desvios opostos. O primeiro é transformá-lo em atividade de arquitetura — como se o resultado de ODD fosse um conjunto de decisões técnicas. O segundo é transformá-lo em atividade operacional — como se ODD fosse sobre monitorar o que já está em produção.

ODD está antes de ambos. Ele procura produzir entendimento suficiente para que arquitetura, entrega e operação sejam decisões informadas, não tentativas de compensar o que não foi compreendido.

## A estrutura conceitual de ODD

O ponto de partida é sempre o negócio. A partir daí, ODD percorre três etapas em direção à tecnologia, integrando tudo pela linguagem ubíqua do domínio.

![Estrutura conceitual de ODD: Começa com Negócio, três etapas, integra por Linguagem Ubíqua, mergulha na Tecnologia](../images/cap05-estrutura-conceitual.png)

*As três etapas estruturais do ODD: (1) estabelecer Domain Events a partir da visão de entidades protagonistas em uma Value Stream; (2) encontrar os Bounded Contexts para identificar os times e Domain Contracts; (3) identificar o modelo de persistência e mutação transacional das entidades. O ciclo integra por Linguagem Ubíqua e mergulha na Tecnologia apenas após o domínio estar suficientemente compreendido. Fonte: slide 19 da apresentação "ProdOps — Modelagem de Domínio com Confiabilidade, Parte 2".*

## Os quatro movimentos

ODD se organiza em quatro movimentos sequenciais.

O primeiro é **enxergar** — antes de modelar, é preciso compreender a trajetória do produto através de jornada, Value Stream, Service Blueprint e Product Deck.

O segundo é **tornar o domínio explícito** — descobrir os acontecimentos relevantes, identificar as entidades que os protagonizam, estabelecer fronteiras semânticas e responsabilidades.

O terceiro é **descobrir onde o risco realmente está** — compreender como as entidades mudam e qual é a consequência operacional de cada mudança.

O quarto é **transformar o domínio em Plano de Confiabilidade** — o resultado de ODD não é um diagrama. É um plano que a organização pode usar para decidir.

Os próximos capítulos percorrem cada um desses movimentos no detalhe, usando o caso Group Buying como fio narrativo.

---

*A contribuição de ODD não está em substituir práticas existentes, mas em mudar a pergunta que antecede o compromisso: antes de construir, o que precisamos compreender para saber onde a confiabilidade realmente está?*
