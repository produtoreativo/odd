# Chapter 15 — The OBC

OBC is not simply documentation. This distinction is essential and needs to be preserved throughout the entire book.

A document can record what someone thought about the domain at a given moment. OBC needs to represent the domain in a way sufficiently understood for the organization to make a commitment about it.

The difference lies in function. Documentation describes. OBC enables decision.

## What OBC Represents

OBC is the passage point between discovery and commitment.

During ODD, the domain is being understood. Experiments are made, hypotheses are tested, the journey is mapped, protagonists are identified, boundaries are established, and a Reliability Plan is built. Throughout this entire process, the representation of the domain can change — because understanding is evolving.

OBC marks the moment when this representation is stable enough to be used as the basis for a commitment. It does not mean the domain is completely understood — complex domains rarely are. It means the accumulated understanding is sufficient for the organization to decide to move forward with clarity about what it is committing to.

The provisional definition is direct: OBC is the representation of the domain sufficiently understood to allow an organization to decide to make a commitment.

## The Passage OBC Represents

Without OBC, the transition between discovery and delivery tends to happen implicitly — the organization simply starts building at some point, without there being an explicit moment of decision about what was understood and what is still uncertain.

This implicit transition has a cost. Uncertainties that existed during discovery are imported into the execution phase, where the cost of discovering and correcting is higher.

OBC makes the transition explicit. It represents a question that needs to be answered before making the commitment: do we understand the domain well enough to know what we are about to build, which risks we are assuming, and how the journey's reliability will be guaranteed?

If the answer is yes, there is an OBC. If the answer is no, there is more ODD work to do.

## Group Buying: What OBC Contains

In Group Buying, OBC is not a description of screens or a list of features. It is a representation of what needs to happen for the group purchase journey to be valid.

It includes the mapped journey — from eligible product to received product — with the relevant events at each stage. It includes protagonist entities and their mutability categories — group and order as dynamic, cart as volatile. It includes the identified Bounded Contexts and the contracts that connect them. It includes the reliability conditions that need to be preserved — which dependencies are in the critical path, which guarantees are necessary at each intersection.

This representation is what allows PRE to begin — not on unexplained uncertainty, but on understanding that has been recorded and negotiated.

## Intent, ODD, and OBC

The sequence is:

**Intent** produces direction. The organization knows what it wants to build, why it wants to build it, and what value it expects to deliver.

**ODD** produces understanding. The organization comprehends the domain, its risks, its dependencies, and its reliability conditions.

**OBC** makes that understanding usable for commitment. The representation is stable enough for the decision to move forward to be informed, not impulsive.

---

*The question is not whether we have enough documentation. The question is whether we understand the domain well enough to assume the responsibility of building.*
