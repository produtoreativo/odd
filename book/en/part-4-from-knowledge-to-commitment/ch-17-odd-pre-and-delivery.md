# Chapter 17 — ODD, PRE, and Delivery

ODD does not deliver software. It delivers conditions to decide.

This sentence defines the boundary with PRE — and it is one of the most important boundaries to preserve throughout this book.

## The Sequence and What Each Stage Does

The sequence is:

```
Intent → ODD → OBC → PRE → Delivery → Runtime → Outcome
```

**ODD** works to understand the domain. Journey, events, protagonists, boundaries, contracts, mutability, dependencies, Reliability Plan.

**OBC** consolidates that understanding into a representation that enables commitment. It is not documentation — it is the passage point between discovery and execution.

**PRE** begins when there is commitment and needs to prepare its execution. Reliability Gates, BDD with observability extensions, instrumentation, alert configuration, Runbooks.

**Delivery** executes the commitment — the code enters production.

**Runtime** confronts the product with reality.

Each stage has a distinct function. Confusing the functions means losing the reason for each one to exist.

## What PRE Is Not

PRE is not ODD continued. When PRE begins, the domain has already been sufficiently understood and the commitment has already been assumed. PRE is no longer discovering — it is preparing.

This has practical implications. During PRE, reliability scenarios are written with precision about already agreed-upon behaviors. The BDD extended with `Emit / Observe / Expect / Alert` reflects domain events that were discovered during ODD, not hypotheses about what the domain might be.

![Enriched BDD table for Group Buying: columns Touch Point, Domain Event, Bounded Context, Domain, Subdomain, Metric Label, Metric Type, and Tags](../../images/cap17-bdd-enriquecido.png)

*The enriched BDD connects each touchpoint to its Domain Event, Bounded Context, domain and subdomain, and then to a metric with a semantic label in the format `context.domain.sub.event`. In the example, "Grupo de Compra com falha de Status" generates the metric `group_buying.available_group.status.failure` of type `count`, with tags for each possible group state (created, adhesion, expired, pending\_approval, cancelled, completed). This is observability derived from the domain, not from a tool. Source: slide 77 of the presentation "ProdOps — Domain Modeling with Reliability, Part 1".*

If PRE is discovering fundamental domain behaviors, something in the previous process was not completed. The Reliability Plan was incomplete. The OBC did not sufficiently represent the domain. The commitment was assumed on unexplained uncertainty.

## The Causality That Needs to Be Preserved

The causality between stages is what guarantees that each one works well.

If the domain was not understood, PRE receives a fragile input. Reliability scenarios will be written on assumptions, not on discovered behaviors. Alerts will be configured on metrics that may not reflect what matters for the journey.

If OBC does not sufficiently represent the domain, the commitment is assumed on unexplained uncertainty. What was delivered as "understood" still contained ambiguities that someone will need to resolve — probably under pressure, in production.

Preserving causality means each stage delivers what the next one needs. ODD delivers understanding. OBC delivers enablement for commitment. PRE delivers preparation for execution. Delivery delivers the software. Runtime delivers evidence.

## Group Buying: The Boundary in Practice

In Group Buying, PRE can only prepare execution safely after the organization understands:

Which journeys need to work — the group creation journey, the joining journey, the automatic closure journey, the delivery journey.

Which entities are protagonists and what their critical states are — the group with its lifecycle states, the order with its financial integrity, the cart with its volatility.

Which contracts exist and what they protect — the integration with the search engine, the automatic closure process, the notification to the commercial team.

Which reliability conditions are relevant — SLOs about group formation, alerts about unreconciled orders, traceability of automatic closure.

Without this understanding, PRE is working in the dark.

## What This Book Does Not Cover

Delivery and Runtime belong to the book *From Commitment to Outcome*. What this chapter needs to preserve is the boundary — not anticipate what comes after it.

ODD prepares knowledge. OBC prepares the decision. PRE prepares execution. The execution itself — how to deliver with quality, how to operate in production, how to evolve a committed product — is another book, with another responsibility.

---

*ODD prepares knowledge. OBC prepares the decision. PRE prepares execution. Confusing these functions means losing the very reason for each one to exist.*
