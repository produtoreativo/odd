# ODD — Observability Driven Design

> **Antes de construir o produto, descubra o que precisa ser confiável.**

---

## O problema

Organizações frequentemente começam a construir antes de compreender o sistema que estão tentando modificar.

Isso gera ambiguidade, decisões escondidas, dependências não compreendidas, WIP desnecessário, baixa confiança nas decisões, retrabalho, baixa capacidade de antecipar riscos e produtos difíceis de observar e operar.

O resultado é previsível: times que entregam, mas não sabem o que estão entregando. Sistemas que funcionam, mas que ninguém consegue operar com segurança. Incidentes que revelam, tarde demais, dependências que ninguém havia mapeado.

---

## A tese

> **ODD é uma abordagem para transformar uma intenção de produto em um domínio compreendido, observável e confiável antes que ela se torne um compromisso de engenharia.**

ODD não é um substituto de DDD. DDD fornece fundamentos importantes — linguagem ubíqua, Bounded Contexts, modelagem estratégica. ODD reorganiza a preocupação em torno daquilo que precisa ser compreendido, observado, operado e protegido antes de assumir o compromisso de construir.

A pergunta central de ODD é:

> **O que precisamos compreender sobre o domínio para saber o que deverá ser observado, operado e protegido antes de assumir o compromisso de construir?**

---

## A posição de ODD

ODD não é o processo inteiro de produto. Sua posição é:

```
Business Intent
      ↓
     ODD        ← domínio compreendido, observável e confiável
      ↓
     OBC        ← compromisso assumido
      ↓
     PRE        ← entrega preparada
      ↓
   Delivery     ← compromisso executado
      ↓
   Runtime      ← realidade confrontada
      ↓
   Outcome
```

ODD prepara o domínio. OBC representa o domínio suficientemente compreendido para permitir compromisso. PRE prepara a entrega. Runtime confronta o produto com a realidade.

ODD não entrega código. ODD entrega **condições para decidir**.

---

## Os quatro movimentos de ODD

### Movimento 1 — Enxergar

Antes de modelar, enxergar.

Qual trajetória do produto precisa ser compreendida? Quais são os touch points, os fluxos, as dimensões Cliente, Empresa, Time e Tecnologia? Onde está o Value Stream?

Não se começa desenhando arquitetura.

### Movimento 2 — Tornar o domínio explícito

```
Value Stream → Domain Events → Entidades protagonistas → Bounded Contexts → Times → Domain Contracts
```

O foco não é uma ferramenta. O foco é descobrir o que acontece, o que muda, quem protagoniza a mudança, onde existe fronteira semântica, onde existe responsabilidade e quais contratos precisam existir.

### Movimento 3 — Descobrir onde o risco realmente está

Não basta descobrir entidades. É preciso descobrir como elas mudam e qual é a consequência operacional dessa mudança.

Quanto essa entidade muda, quanto o negócio tolera que ela esteja errada e o que acontece quando ela está errada?

As categorias fundamentais são:

- **Entidades voláteis** — mutabilidade altíssima; risco associado a comportamento, experiência e conversão
- **Entidades dinâmicas** — mutabilidade alta com baixa tolerância ao desvio; risco associado à consistência do estado
- **Entidades semiestáticas** — mudanças menos frequentes; risco associado a sincronização, versão e consistência
- **Entidades massivamente imutáveis** — criadas em volume e praticamente não modificadas; estratégia operacional favorece leitura, cache e projeções

### Movimento 4 — Transformar o domínio em Plano de Confiabilidade

O resultado de ODD não é simplesmente um diagrama. É um Plano de Confiabilidade.

```
ODD
 │
 ├── Product Deck
 ├── Value Stream
 ├── Domain Events
 ├── Protagonistas
 ├── Bounded Contexts
 ├── Contratos
 ├── Mutabilidade
 ├── Dependências
 └── Matriz de Confiabilidade
              ↓
       Plano de Confiabilidade
              ↓
             OBC
```

---

## Estrutura do livro

### Parte I — O Problema

| Capítulo | Argumento |
|----------|-----------|
| 1 | Construímos antes de compreender |
| 2 | O domínio existe antes do software |
| 3 | A entropia do produto |
| 4 | Observabilidade começa antes da produção |

### Parte II — ODD

| Capítulo | Argumento |
|----------|-----------|
| 5 | ODD: Observability Driven Design |
| 6 | Comece pela jornada |
| 7 | Eventos contam a história |
| 8 | Encontre os protagonistas |
| 9 | Onde termina um domínio? |

### Parte III — Do Domínio à Confiabilidade

| Capítulo | Argumento |
|----------|-----------|
| 10 | Mutabilidade é risco |
| 11 | O contrato do domínio |
| 12 | Persistência acompanha o comportamento |
| 13 | A Matriz de Confiabilidade |
| 14 | O Plano de Confiabilidade |

### Parte IV — Do Conhecimento ao Compromisso

| Capítulo | Argumento |
|----------|-----------|
| 15 | O OBC |
| 16 | Quando experimentar e quando comprometer |
| 17 | ODD, PRE e Delivery |
| 18 | Runtime é a prova |

---

## O caso do livro

O fio narrativo do livro é o **Group Buying / Tuangou**.

A jornada percorrida:

```
PIM → Catálogo → Oferta → Ordem de Compra → Pedido → Pedido faturado → Produto recebido
```

Esse caso demonstra Event Storming, Value Stream, entidades protagonistas, mutabilidade, Bounded Contexts, contratos, persistência, observabilidade, Matriz de Confiabilidade, Plano de Confiabilidade, OBC e PRE — de ponta a ponta, sem exemplos artificiais.

---

## O código como exemplo

O código neste repositório exemplifica os conceitos do livro em dois momentos do fluxo ODD:

**`event-storming/`** — transforma uma imagem de Event Storming em contexto estruturado de domínio, extraindo eventos, touch points, serviços e fluxos detectados na sessão.

**`obc-o11y/`** — recebe o contexto estruturado e o transforma em plano de observabilidade, gerando configurações Terraform para os providers Datadog, Dynatrace e Grafana.

O fluxo que esses dois módulos percorrem é o mesmo fluxo que o livro descreve:

```
imagem do Event Storming
         ↓
 contexto de domínio estruturado   (event-storming)
         ↓
 plano de observabilidade          (obc-o11y)
         ↓
 dashboards e SLOs aplicados
```

Para instruções de instalação e execução dos exemplos de código, consulte:

- [`event-storming/bedrock/README.md`](event-storming/bedrock/README.md)
- [`obc-o11y/README.md`](obc-o11y/README.md)

---

## ODD no ProdOps

ODD é parte de um conjunto editorial:

**From Intent to Outcome** — explica o Operating Model completo: `Intent → Upstream → Commitment → Downstream → Outcome`

**ODD** — explica como compreender o domínio antes do compromisso: `Intent → Journey → Domain → Reliability → OBC`

**From Commitment to Outcome** — explica como executar depois do compromisso: `OBC → PRE → Delivery → Runtime → Outcome`

Os livros não competem. Formam uma sequência.

---

## O diferencial intelectual

| Abordagem | Pergunta central |
|-----------|-----------------|
| DDD | Como modelar o domínio? |
| Observabilidade tradicional | O que está acontecendo no sistema? |
| DevOps | Como entregar e operar continuamente? |
| ProdOps | Como manter o produto operável durante sua evolução? |
| **ODD** | **O que precisamos compreender sobre o domínio para saber o que deverá ser observado, operado e protegido antes de assumir o compromisso de construir?** |

---

> **Code in production is the only code that matters.**
>
> ODD existe para que, quando o código chegar à produção, o time já saiba o que observar, por que observar e o que fazer quando algo sair do esperado.
