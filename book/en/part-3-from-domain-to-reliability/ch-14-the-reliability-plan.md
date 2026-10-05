# Chapter 14 — The Reliability Plan

ODD does not end when the domain has been drawn. Knowledge needs to become a plan.

The Reliability Plan is the artifact that brings together what was discovered about journey, events, protagonists, boundaries, contracts, mutability, dependencies, and observability. Its purpose is to allow the organization to see the weaknesses and strengths of the flow before committing to building it.

## What the Plan Needs to Answer

A Reliability Plan is not static documentation. It is an actionable representation of the understanding accumulated during ODD.

It needs to answer where the entities that change with the highest frequency and lowest tolerance for deviation are. It needs to show which dependencies are in the critical path of the journey and what happens when each one fails. It needs to indicate which contracts protect the boundaries between contexts and what level of reliability each contract offers.

It also needs to answer who is responsible for each part of the system — not just which team does the deploy, but which team can act when something goes outside expectations.

This last question is central. Observability without an owner does not reduce MTTR. A dependency without an owner remains an invisible dependency — identifiable as a cause after the failure, but not manageable before it.

## The Chain the Plan Makes Visible

The reference material presents the Reliability Plan as the result of a chain of discoveries:

An event leads to an entity. The entity leads to a mutation. The mutation leads to a reliability condition. The condition leads to an observation. The observation leads to a responsibility.

When this chain is visible, it is possible to make decisions about where to instrument, what to alert, how to alert, and how to respond. When it is not visible, each incident begins with an investigation that needs to retroactively reconstruct what could have been mapped in advance.

## The ProdOps Engineer in the Plan

The material establishes the role of the ProdOps Engineer at this moment: refining the details, exposing the weaknesses and strengths of the flow, and establishing how reliability can be observed.

This is not a review activity at the end of development. It is an activity that happens during domain discovery — while it is still possible to alter the design, redistribute responsibilities, or make explicit dependencies that were implicit.

The entire team needs to follow the Service Blueprint mapping to extract the architecture necessary for each moment of action. The ProdOps Engineer is the one who ensures the conversation includes weaknesses, not just possibilities.

## Group Buying: The Plan in Action

In Group Buying, the Reliability Plan can reveal:

Which entities require greater rigor — buying group and order as dynamic, with low tolerance for deviation; cart as volatile, with high mutation frequency and direct impact on conversion.

Which contracts need to be protected — the integration between the group domain and the search engine, the integration between group and order at the time of automatic closure, the integration between payment and billing.

Which dependencies have direct impact on the journey — inventory, payment, and indexing are in the critical path; the commercial team needs to be alerted when a group closes with pending approval.

Which indicators need to accompany the journey — rate of groups reaching minimum volume, indexing latency after state change, rate of unreconciled orders in active groups.

## The Passage to OBC

The Reliability Plan is the bridge between understanding the domain and preparing a commitment.

When the plan exists, the organization has what it needs to answer the question that defines OBC: do we understand the domain well enough to assume the responsibility of building?

If the answer is yes, the plan becomes the foundation on which OBC will be built — the representation of the domain sufficiently understood so that the commitment can be assumed with clarity.

---

*The Reliability Plan is the bridge between understanding the domain and preparing a commitment. The next step is representing that understanding in a form clear enough for the organization to decide.*
