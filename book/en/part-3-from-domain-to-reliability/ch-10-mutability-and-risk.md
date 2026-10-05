# Chapter 10: Mutability Is Risk

If an entity changes, we need to understand how it changes. If it changes frequently, the need for observation increases. If it changes in a context of low tolerance for deviation, the need for consistency increases as well.

Mutation frequency and error tolerance are the two dimensions that determine the risk of an entity in a journey. The question is not whether the entity is important, but how it behaves when it undergoes change and what happens when that change fails.

The reference material organizes entities into four categories. Each category carries direct consequences about where to concentrate observability, which persistence strategy makes sense, and how to structure alerts. Group Buying serves as the continuous case to make each category concrete.

## Volatile Entities: the Cart

Volatile entities present very high mutability. They change with every user interaction, often within a single session, without each change needing to be permanent.

The shopping cart is the canonical example. Items are added, removed, quantities altered, groups associated, and sessions expired, all of this without the buyer having finalized anything. The cart reflects the intention of the moment, not a consolidated decision.

In Group Buying, the Cart carries an additional layer of complexity: it needs to reflect not only what the buyer wants to purchase, but also which group they are associated with, whether they are creating a new group or joining an existing one. Two distinct paths of the journey arrive at the same component with different contexts.

![Cart as volatile entity in Group Buying, with two domain event flows reaching the Shop Cart: group_buying.shopcart.buybox.added with {group:created} and {group:adhesion}](../../images/cap10-entidades-volateis.png)

*The diagram highlights the Cart (in dark red) as the central volatile entity in Group Buying. Two flows reach the Shop Cart: creating a new group and a buyer joining an already active group. Both trigger the same domain event, `group_buying.shopcart.buybox.added`, with distinct metadata: `{group:created}` and `{group:adhesion}`. The Cart is resolved by the Webshop API, which integrates the Search, ShopCart, and Group modules, and persists via Magento and MySQL. The risk here is behavioral: if the cart does not correctly reflect the group context, the buyer may complete the journey associated with the wrong group or with no association at all. Source: slide from the presentation "ProdOps — Domain Modeling with Reliability, Part 2".*

The risk associated with the Cart lies in experience and conversion. A failure in a volatile entity tends to appear immediately to the user: the item disappears, the group does not show up, the session expires without saving state. The impact is direct on the journey completion rate.

Appropriate observability for volatile entities follows the session: tracing per session, action logs with short TTL, volume and failure rate metrics per step, alerts about abandonment patterns at specific points in the journey.

## Dynamic Entities: the Buying Group

Dynamic entities present high mutability with low tolerance for deviation. They change with operational frequency, not at every click, but at every relevant transaction, and each change needs to be consistent.

The central difference from volatile entities is tolerance. A cart with incorrect state can be corrected by the buyer during the session. A buying group with incorrect state compromises real orders, real buyers, and real money.

The Buying Group in the Group Buying context is the dynamic protagonist par excellence. It traverses a lifecycle, created, indexed, with buyers joining, reaching minimum volume, being automatically closed, and each state transition needs to be atomic and traceable. A group that is simultaneously active and closed is not an acceptable intermediate state. It is an inconsistency with consequences.

![Buying Group as dynamic entity: Grupo highlighted in the value stream, with domain events group_buying.available_group.status.view {group:created} and {group:adhesion} flowing to the Webshop API](../../images/cap10-entidades-dinamicas.png)

*The diagram highlights the Grupo (in orange/yellow) as a dynamic entity in the Group Buying value stream. The upper portion shows the five journey moments: Produto Elegível, Grupo de Compra Criado, Grupo de Compra Indexado, Produto Encontrado com Grupo de Compra, Grupo de Compra Aderido. The domain events `group_buying.available_group.status.view {group:created}` and `{group:adhesion}` flow from two distinct contexts to the Webshop API, which integrates Search, ShopCart, and Group, and persists in the Data Store. Grupo appears as the thickest bar in the entity layer, indicating its protagonist role across all journey stages. Source: slide from the presentation "ProdOps — Domain Modeling with Reliability, Part 2".*

The risk in dynamic entities lies in state consistency. The typical alert is not "application slow", it is "active buying group with unreconciled orders for more than two minutes." This can only be detected if the domain was understood well enough to know that this state is possible and that it is unacceptable.

Appropriate observability for dynamic entities requires greater rigor: structured logs with event, version, and entity identifiers, alerts for invalid or stagnant states, distributed tracing across services participating in each transition, and consistency deviation metrics with an explicit SLO.

## Semi-static Entities: the Offer

Semi-static entities change with lower frequency. They do not change per transaction, but per administrative operation, publication, or business cycle. But when they change, the change needs to propagate correctly across all channels that consume them.

The Offer in Group Buying occupies this position. The attributes of an offer, price, group discount, participation conditions, minimum quantity, do not change with each purchase. But when they change, the indexed representation needs to reflect this. A buyer who finds a group with outdated conditions may have their expectation frustrated when trying to complete the purchase.

There is a specific scenario the material revisits carefully: what differentiates an offer in the showcase when no group has been created for it versus when an active group already exists? The search component needs to respond to this distinction, and the Offer, being semi-static, is the entity that anchors this difference in the index.

![Offer as semi-static entity: Revisited Scenario showing how the offer behaves when no group has been created versus when an active group exists, with domain events group_buying.catalog.offer.view and group_buying.catalog.search.view](../../images/cap10-entidades-semiestaticas.png)

*The diagram highlights the Oferta (in orange/yellow) as a semi-static entity in the value stream. The "Cenário revisitado" section shows the central question: what differentiates when an offer in the Showcase is available with no group created versus when a group already exists? The domain events `group_buying.catalog.offer.view` and `group_buying.catalog.search.view` flow from Group Buying to the Webshop API, which queries the Search API, which in turn reads from Elasticsearch. The Offer does not change per transaction, but per publication. But the indexed representation needs to reflect the correct state of the associated group. Source: slide from the presentation "ProdOps — Domain Modeling with Reliability, Part 2".*

The risk in semi-static entities lies in synchronization and versioning. An offer change not correctly propagated across domains may not immediately interrupt a purchase, but it can produce incorrect displays, inconsistencies across channels, or frustrated expectations at the moment of payment.

Appropriate observability for semi-static entities shifts toward mutation logs with auditing, alerts for outdated data after expected time windows, and control of who changed what and when.

## Massively Immutable Entities: the Product and the Catalog

Massively immutable entities are created in volume and practically not modified after creation. Immutability here is not absolute, the product can have attributes updated, but the operational nature favors efficient reading, broad replication, and aggressive caching strategies.

The Product in Group Buying is the foundation of the entire journey. It appears in the first moment, eligibility, and remains as a reference across all subsequent stages: in the created group, in the indexed search, in discovery by the buyer, in adhesion, and in the final order. No transaction alters the Product. The Product frames the transactions.

![Complete Group Buying Value Stream showing Product, Offer, Customer, Cart, and Group as entities traversing the five journey moments, with distinction between Protagonist Service and Supporting Service](../../images/cap10-mutacao-value-stream.png)

*The diagram shows the complete Group Buying Value Stream with five overlapping phases: Produto Elegível, Grupo de Compra Criado, Grupo de Compra Indexado, Produto Encontrado com Grupo de Compra, Grupo de Compra Aderido. At the bottom, entities appear as horizontal bars — Produto, Oferta, Cliente, Cart, Grupo — with distinction between Serviço Protagonista (solid box) and Serviço Coadjuvante (dashed box). The Product traverses the entire journey as the most stable entity: it is referenced at every stage, but is not the agent of mutations. Source: slide from the presentation "ProdOps — Domain Modeling with Reliability, Part 2".*

The risk in massively immutable entities is different: volume, traceability, and read efficiency. A published offer is not altered, it is replaced by a new version. A catalog configuration is not edited in-place, a new version is generated. This enables strategies that would be unviable for volatile or dynamic entities: replication to multiple channels, aggressive read-model projections, long-TTL cache without risk of relevant inconsistency.

Appropriate observability for massively immutable entities concentrates on creation volume, version traceability, and projection coverage. What needs an alert is not frequent mutation, it is the absence of propagation when a new version is published.

## The Question That Guides the Classification

The classification should not become a mechanical taxonomy applied to entities out of context. It exists to guide questions.

**How much does this entity change?** At what frequency, per session, per transaction, per administrative operation, per publication?

**How much does the business tolerate it being wrong?** A cart with the wrong item is correctable during the session. An invoiced order with the wrong amount has financial consequences. A group closed with inconsistent data may mean lost orders that no one recovered.

**What happens when it is wrong?** The answer determines where rigor needs to be greater, in prevention, detection, correction, or all three.

The same entity can occupy different positions depending on the domain in which it operates. The Product in the catalog domain is semi-static. The Product at the moment of Group Buying eligibility functions as a massively immutable anchor. The classification is always relative to the behavior observed in the journey, not to the name of the entity.

## Mutation Frequency Imposes Different Rigor

The central principle of this chapter is operational: mutation frequency imposes rigor in observability.

Treating the cart with the same level of attention as the product catalog wastes attention where it matters less and fails to concentrate it where it matters more. Treating the buying group, with its transactional lifecycle and low tolerance for deviation, with the lightness appropriate for a product is to compromise the integrity of real orders.

ODD uses entity classification to calibrate the Reliability Plan. Where are the most volatile entities? Where are the entities the business least tolerates seeing as wrong? These are the places where domain discovery needs to go deepest and where instrumentation needs to be most rigorous.

---

*Reliability is not treating everything with the same rigor. It is applying rigor proportional to the behavior and risk of what drives the journey.*
