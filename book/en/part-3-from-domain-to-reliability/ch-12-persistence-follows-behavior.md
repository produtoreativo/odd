# Chapter 12 — Persistence Follows Behavior

One of the most common decisions in architecture is choosing a persistence strategy before understanding the behavior of the data. ODD inverts this order.

The behavior of entities — mutation frequency, tolerance for deviation, nature of reads and writes, relationship between consistency and availability — is what determines which persistence strategy makes sense. Technology answers to behavior. Not the other way around.

## Transactional and Analytical Are Not the Same Thing

There is a confusion present in many organizations: treating transactional data and analytical data as if they were the same problem, for the same purpose, with the same tools.

The transactional plan is concentrated on the system's immediate operations. Its goal is to facilitate direct and fast response. When a transaction needs to happen — an order needs to be created, a group needs to be closed, a payment needs to be confirmed — the transactional system needs to guarantee consistency and completeness.

The analytical plan supports medium and long-term decisions. Conversion rates, behavioral patterns, product metrics — this information is valuable for business evolution, but has a different nature and purpose than transactions.

Mixing the two produces unnecessary complexity. Trying to use a single pipeline for everything, with the same guarantees and the same tool, results in systems that are hard to operate and hard to evolve.

## How Behavior Determines Strategy

For **volatile** entities, like the cart, the behavior requires fast writes and state that is recoverable during the session. In-memory storage with TTL, like Redis, is an appropriate response. Transactional persistence can be eventual — what matters is that session state is available while the buyer is active.

For **dynamic** entities, like the buying group or the order, the behavior requires transactional consistency guarantees. The state needs to be correct, and state transitions need to be atomic — a group cannot simultaneously be active and closed. Event Sourcing can be an appropriate response here, because it allows reconstructing the history of states and tracing the cause of any transition.

For **semi-static** entities, like the product, the behavior allows for optimized reading strategies. The product changes rarely, but is read with very high frequency. Distributed cache with long TTL, derived read models, and projections are appropriate responses. Eventual consistency between the write model and the read model is generally acceptable.

For **massively immutable** entities, like published offers or promotions, the behavior favors structures optimized for read volume — Elasticsearch, for example. Once created, these entities do not change. They are replaced by new versions. This allows aggressive caching strategies and replication to multiple channels without concern for write concurrency.

## Write Model and Read Model

The reference material presents the separation between write model and read model as a natural consequence of this analysis.

The **Write Model** is the transactional core — behavior-rich entities, with business rules, validations, and consistency guarantees (ACID). It is the guardian of the domain's truth.

The **Read Model** is the projection optimized for querying — denormalized structures, derived from the write model, eventually consistent. It exists to serve reads with the necessary performance, without compromising domain integrity.

This separation is not just a technical decision. It is a direct consequence of recognizing that writing and reading have different natures, different frequencies, and different requirements.

![Write Model example: JSON structure of an order with pedidoId, nomeCliente, total, status PAGO, and dataCriacao](../../images/cap12-write-read-model.png)

*The example shows an order Write Model: `pedidoId`, `nomeCliente`, `total`, `status: "PAGO"`, and `dataCriacao`. This is the transactional structure — rich in business semantics, with guaranteed consistency. The Read Model derived from this order would be a denormalized, eventually consistent projection, optimized for the query channel (dashboard, report, search). Source: slide 4 of the presentation "ProdOps — Domain Modeling with Reliability, Part 2".*

## Group Buying: Persistence as a Domain Decision

In Group Buying, if inventory cannot be treated as simple catalog information because it changes during the purchase process and that change needs to be immediately consistent, this determines how it should be persisted. It is not an abstract technical choice — it is a response to the discovered behavior.

If a read projection for displaying active groups in searches can tolerate a few seconds of delay, this determines that indexing can happen asynchronously. If the automatic closure of groups requires persistence to be atomic — all orders recorded or none — this determines that the process needs explicit transactional guarantees.

The question is not which database is best. It is which behavior needs to be preserved, and which persistence strategy answers to that behavior with the lowest operational risk.

---

*Persistence is a consequence of the domain. When behavior is known, architecture ceases to be an abstract choice and becomes a response to a concrete need.*
