# Chapter 16 — When to Experiment and When to Commit

Not every change should receive the same rigor. And not every moment in a product's lifecycle demands the same organizational posture.

Before commitment, the organization needs to learn. After commitment, it needs to preserve a promise.

This difference is at the heart of the separation between Upstream and Downstream — and it is one of the most important distinctions ODD needs to make explicit.

## Upstream: The Space of Learning

In the Upstream, intent passes through ODD, through experimentation, and through the evolution of domain understanding that will eventually consolidate into OBC.

In this space, flexibility is desirable. There can be Event Storming, prototypes, vibecoding, hypotheses about domain behavior, revisions of the Reliability Plan. The domain representation can change because we are still learning about it.

What defines the Upstream is not a tool or a technique. It is the absence of a formal commitment. The organization is investing in understanding before investing in committed execution.

This posture has a cost — the time and capacity dedicated to discovery. But it reduces a larger cost: the cost of executing on an insufficiently understood reality.

## Downstream: The Space of Commitment

In the Downstream, there is a committed OBC. From there, BDD, Reliability Gates, and Delivery come in. Change is now evaluated not just by what can be built, but by the commitment that needs to be preserved.

When a feature is committed, a change that affects its behavior or its reliability is not just a technical decision. It is a decision about the commitment assumed. It needs to be treated as such — with visibility, traceability, and explicit impact for the parties that depend on that commitment.

This does not mean the Downstream is too rigid to evolve. It means evolution happens on known ground, with clarity about what is being changed and who needs to know.

## The Error That Appears on Both Sides

The most common error on the Upstream side is applying Downstream rigor too early — treating discovery as execution, over-documenting what has not yet been understood, freezing decisions that need to be explored.

The most common error on the Downstream side is carrying Upstream freedom into after the commitment — changing behaviors without visibility, making decisions that affect contracts without communicating, treating the commitment as a past formality and not as a present responsibility.

In the first case, the organization turns discovery into bureaucracy. In the second, it turns commitment into improvisation.

Both have operational consequences. The first produces slowness and rigidity where flexibility would be beneficial. The second produces instability and low confidence where predictability would be necessary.

## Group Buying: Where the Boundary Is

In Group Buying, while the journey is being discovered — how joining works, which states the group needs to traverse, how automatic closure should behave — the organization is in the Upstream. Representations can change. Hypotheses can be tested. Contracts between domains are still being negotiated.

When the organization decides to commit — when OBC exists and the decision to move forward has been made — changes that affect the group's behavior, the state sequence, or the journey's reliability take on a different weight.

ODD does not determine when the boundary should be crossed. It helps make visible what is still unknown and what has already been understood — so that the decision to commit is made consciously, not by inertia or pressure.

---

*The boundary between Upstream and Downstream is not a tool boundary. It is a commitment boundary.*
