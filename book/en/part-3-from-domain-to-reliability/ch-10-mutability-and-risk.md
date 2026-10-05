# Chapter 10 — Mutability Is Risk

If an entity changes, we need to understand how it changes. If it changes frequently, the need for observation increases. If it changes in a context of low tolerance for deviation, the need for consistency increases as well.

Mutation frequency and error tolerance are the two dimensions that determine an entity's risk in a journey. The question is not whether the entity is important — it is how it behaves when it undergoes change and what happens when that change fails.

## The Four Categories

The reference material organizes entities into four groups that serve as orientation for risk analysis.

**Volatile Entities** exhibit very high mutability. The shopping cart is the canonical example. It changes with every buyer interaction — items are added, removed, quantities are altered, the session can expire. The associated risk lies in behavior, experience, and conversion. A failure in a volatile entity tends to appear immediately to the user and directly impact the journey completion rate.

**Dynamic Entities** exhibit high mutability with low tolerance for deviation. Inventory is the material's example. In Group Buying, the buying group and the order also fit here. They change with operational frequency and each change needs to be consistent — an invalid intermediate state can compromise the integrity of the entire journey. The risk lies in state consistency.

**Semi-static Entities** change less frequently. A product may occupy this position. A product's attributes change — name, price, description, categories — but they do not change with every transaction. The risk lies in synchronization, versioning, and consistency. An outdated product change may not interrupt a purchase, but can produce incorrect displays or inconsistencies between channels.

**Massively Immutable Entities** are created in volume and practically never modified after creation. Depending on the case, offer, promotion, or versioned catalog can exhibit this characteristic. A published offer is not altered — it is replaced by a new version. The risk is different: volume, traceability, and the operational strategy favors efficient reading, caching, and projections.

## The Question That Guides Classification

Classification should not become a mechanical taxonomy applied to entities out of context. It exists to guide questions.

**How much does this entity change?** At what frequency — per session, per transaction, per administrative operation, per publication?

**How much does the business tolerate it being wrong?** A cart with an incorrect item is correctable during the session. An invoiced order with an incorrect value has financial consequences. A group closed with inconsistent data can mean loss of orders that no one recovered.

**What happens when it is wrong?** The answer determines where rigor needs to be greater — in prevention, in detection, in correction, or in all three.

## Observability Proportional to Behavior

The direct consequence of classification is that observability cannot be uniform.

For volatile entities, the material associates attention to usability and trends — session-level tracing, action logs with short TTL, volume and failure rate metrics, alerts about abandonment patterns.

For dynamic entities, rigor increases — structured logs with event, version, and entity identifiers, alerts for invalid or stagnant states, distributed tracing across services, consistency deviation metrics. The typical alert is not "application slow." It is "active buying group with unreconciled orders for more than two minutes."

For semi-static entities, attention shifts to synchronization and versioning — mutation logs with audit trails, outdated data alerts, control of who changed what and when.

## Mutation Frequency Demands Different Rigor

The central principle of this chapter is operational: mutation frequency demands rigor in observability.

Treating the cart with the same level of attention as the product catalog is wasting attention where it matters less and failing to concentrate it where it matters more.

ODD uses entity classification to calibrate the Reliability Plan. Where are the most volatile entities? Where are the entities the business least tolerates seeing wrong? Those are the places where domain discovery needs to be deepest and where instrumentation needs to be most rigorous.

---

*Reliability is not treating everything with the same rigor. It is applying rigor proportional to the behavior and risk of what drives the journey.*
