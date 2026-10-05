# Chapter 18: Runtime Is the Proof

A domain can be well modeled. An OBC can be consistent. A Reliability Plan can be complete. Even so, none of this proves the product works.

The proof appears when software meets reality.

The reference material formulates this with provocative precision: if there is no software in production, there is no value for the customer. This sentence does not diminish the importance of discovery. It defines its purpose.

ODD does not exist to produce perfect diagrams. It exists to increase the quality of what will be put into production, and so that, when it gets there, we know what to observe.

## What Runtime Reveals

Runtime is where the decisions made during ODD, OBC, and PRE are confronted with real behavior.

Observability shows whether what was considered important during discovery continues to happen as expected. Operations reveals where the model encountered exceptions, behaviors that existed in the domain but were not captured during exploration. The customer shows whether the experience preserves the value that motivated the product.

These three confrontations are inevitable. The question is what the organization can do with them.

When the domain was understood, events were named, and observability was designed from the journey, the organization can recognize when reality diverges from what was expected. And it can act, with speed, with clear responsibility, and with enough context to understand what needs to be corrected.

When the domain was not understood, the organization reacts to symptoms. The incident has a root cause that is hard to trace. Alerting is imprecise. The correction is made under uncertainty, and can create new problems that will only appear in the next incident.

## The Cycle That Closes

Runtime closes the ProdOps cycle.

Intent produces a direction. ODD transforms direction into understanding. OBC transforms understanding into commitment. PRE prepares execution. Delivery puts the change in motion. Runtime shows what actually happened. Outcome returns the evidence to the business.

This cycle is not linear merely because there is a sequence. It is linear because each stage creates the conditions for the next one to work. Runtime without ODD is reaction without context. ODD without Runtime is modeling without proof.

## Group Buying: When the Model Meets the World

In Group Buying, the journey finally ceases to be a sequence of mapped events and becomes a real experience.

Orders are created. Groups change state. Automatic closure executes. Inventory is consumed. Payments happen. Products are delivered.

If observability was designed from the domain, if events were instrumented, if alerts reflect business conditions, if the Reliability Matrix transformed dependencies into KPIs, the organization can see the journey working, or not working, with the granularity necessary to act.

A group that expires with unreconciled orders is not just a bug. It is a violation of a behavior that should have been protected by a contract. Observability designed from the domain allows identifying this with precision, not as an infrastructure problem, but as a problem in the Group Buying journey.

## Why Observability Is in ODD's Name

The reason observability is in the name of this approach is not because the book is about dashboards. It is because what was understood during ODD needs to remain verifiable after the commitment becomes software.

When an entity was identified as a dynamic protagonist, with low tolerance for deviation, the behavior that determines this classification needs to be observable in production. When a contract between domains was established with a consistency guarantee, that guarantee needs to be measurable at Runtime.

ODD without observability at Runtime is a theory without a test. Runtime without ODD's understanding is reaction without context.

The proof Runtime offers, the only proof that truly matters, depends on the question of what to observe having been answered before.

---

*The product is not the diagram, the backlog, the OBC, or the architecture. The product is what happens when software meets the world.*

**Before building the product, discover what needs to be reliable. Then, put that reliability to the test in production.**
