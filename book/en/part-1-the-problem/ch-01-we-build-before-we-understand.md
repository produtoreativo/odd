# Chapter 1 — We Build Before We Understand

An organization rarely starts a product saying it wants to build a confusing system. It starts with a legitimate intent. There is a commercial opportunity, a customer need, an operational change, or a strategic decision. The problem arises when that intent flows directly into the backlog, and the backlog is treated as if it were understanding.

It is possible to have hundreds of cards and still not know how the product actually works. It is possible to have a sophisticated architecture and not know which events are critical to the journey. It is possible to have observability tools installed and still not know what should be observed.

This distance between intent and understanding is the central problem this book addresses.

## The Pressure That Shortens Understanding

The dynamic that leads organizations to build before they understand is not carelessness. It is pressure. Deadlines, competition, stakeholder expectations, and the visible cost of discovery time create a constant gravitational pull toward execution.

The reasoning is direct: the sooner we start building, the sooner we deliver value. The problem is that this reasoning hides a silent premise — that we know enough to build something that will, in fact, be valuable.

When the premise is true, the pressure toward execution makes sense. When it is false, the pressure produces rework, invisible dependencies, and products that are hard to operate.

The question is not speed. It is the quality of understanding that precedes speed.

## What Happens When the Backlog Replaces Understanding

There is a particularly costly form of confusion: well-documented confusion. Detailed cards, extensive acceptance criteria, precise estimates — all of this can coexist with insufficient understanding of the domain.

The consequence appears later. A service is built on an assumption that no one recorded as an assumption. A dependency grows without anyone mapping what happens when it fails. A flow that seemed simple reveals, in production, a sequence of states that no one discovered during development.

Domain discovery exists precisely to reduce this distance — not because discovery is more valuable than delivery, but because delivery built on insufficient understanding tends to cost more than the discovery that was avoided.

## Group Buying: When Intent Seems Simple

In the Group Buying case, the intent seems simple: allow people to participate in a group purchase to take advantage of progressive discounts based on volume. The description fits in a single sentence.

But the simplicity disappears when we ask what needs to happen for that promise to be true.

There is an offer that needs to be eligible. There is a group that needs to be created, announced, and indexed so others can find it. There are participants who join, carts that are created, invoices that are generated. There is a deadline. There is a minimum volume that, if not reached, changes the group's outcome. There is a sequence of states — created, active, indexed, joined, expired, closed — that needs to remain coherent across distinct domains.

The first mistake would be to start with services. The second would be to start with the database. The third would be to start with APIs. All of these starts share the fact that they are technical starts in the face of a domain problem that has not yet been understood.

## The Question That Guides This Book

ODD is born in this space. Not as a technique for writing better code, but as a way to transform intent into understanding sufficient enough for the organization to know what it is about to commit to.

The question that guides this book comes before the choice of any technology: before building the product, what do we need to understand to know what will need to be observed, operated, and protected?

This question changes the nature of discovery work. It does not exist to delay delivery. It exists so that delivery happens on sufficiently known ground.

---

*Understanding does not delay delivery. It reduces the amount of execution done over a reality that has not yet been understood.*
