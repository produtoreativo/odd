# Chapter 2: The Domain Exists Before the Software

Before a Group Buying application exists, someone already needs to know what it means to buy as a group. There are rules, events, participants, states, and consequences. Software does not create this reality. It represents, automates, and makes it executable.

This distinction matters because the order in which things are discovered tends to determine what remains invisible.

When software is the starting point, architecture captures what was decided, endpoints, tables, objects, data flows. But it does not always reveal what has not yet been understood: which event makes an order valid, which context is responsible for the truth of a product, which part of the journey is affected when a dependency fails.

## The Product as a Living System

A useful way to see the product is through four complementary dimensions.

**Flow** deals with journeys and movement, how the customer traverses the product, where value is delivered, where it is lost. **Team** deals with responsibility and capacity, who can act, who answers for each part. **Data** deals with behavior and impact, what changes, when it changes, what that change means. **Parts** deal with the applications, services, and integrations that sustain the trajectory.

These four dimensions do not describe the software. They describe the product as a living system. The difference is subtle but consequential: software can be working while the product is failing.

This happens when observability is focused only on the parts and not on the flow. An application can respond 200 while a business rule has stopped being satisfied. A service can be available while the journey that should traverse it found an alternative path the business did not authorize.

## Trajectory Before Implementation

The change ODD proposes is in the order of the conversation. Instead of asking which application should be built, we ask which trajectory needs to be understood.

In Group Buying, that sequence traverses PIM, catalog, offer, purchase order, order, billing, and receipt. The value is not in possessing all those parts in isolation, it is in being able to explain how they participate in a single journey and what needs to remain true for the journey to work.

When the question starts with the trajectory, applications appear as consequences of the domain. The catalog exists because there is a product that needs to be found. The offer exists because there is an eligibility condition that needs to be evaluated. The group exists because there is a volume and deadline dynamic that determines whether the group purchase is possible.

Each part answers to a behavior. The behavior answers to the journey. The journey answers to the domain.

## DDD as Foundation, Not Destination

DDD offers important tools for this investigation. Ubiquitous language, Bounded Contexts, and Domain Events are ways to make the domain explicit and align the conversation between business experts and technology people.

ODD does not replace these foundations. It adds a question that DDD does not directly answer: what do we need to understand about the domain to know what needs to be observed and protected before committing to build?

This question orients ODD toward a specific moment, before commitment, and toward a specific concern, journey reliability. DDD helps discover the domain. ODD uses that discovery to prepare the conditions for decision.

The confusion between the two approaches is understandable and will be addressed more carefully in the chapter that formally defines ODD. What matters here is the sequence: domain first, implementation as consequence.

## What Architecture Tends to Hide

An architecture can be well designed and still hide important realities.

There can be an order creation endpoint without anyone having clarity on which business event makes that order valid. There can be an inventory integration without it being explicit what happens when inventory is not updated at the moment the group closes. There can be a notification service without anyone having mapped which business events actually need to generate a notification.

These gaps do not appear in the architecture diagram. They appear in production, in the form of unexpected behaviors, incidents with hard-to-trace root causes, and support decisions that no one can make with confidence.

Domain discovery before commitment serves precisely so that these gaps appear at the moment when it is still possible to act on them.

---

*When software is treated as the starting point, architecture tends to hide the reality it should represent. When the journey comes first, the parts begin to appear as consequences of the domain.*
