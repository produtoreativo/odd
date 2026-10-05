# Chapter 9 — Where Does a Domain End?

Discovering protagonists is not enough. We need to discover where each meaning remains valid.

An entity can have different meanings in distinct parts of the organization. The concept of "product" for the catalog team is not the same as for the orders team. The catalog's "product" is a set of attributes, categories, and editorial content. An order's "product" is an item with a price, quantity, and delivery condition. Both share an identifier, but they have distinct behaviors, rules, and owners.

When this difference is not made explicit, systems begin to share assumptions that were never agreed upon. The consequences appear in the form of bugs that are hard to locate, design decisions that violate another team's rules without anyone noticing, and changes that produce unexpected side effects in contexts no one had mapped.

## Bounded Context as a Responsibility Boundary

Bounded Context, a central concept in Domain-Driven Design, offers a way to establish semantic boundaries. Within a Bounded Context, a domain model has its own meaning, rules, and consistency. Outside it, the same term can mean something else.

ODD uses this foundation because reliability also depends on knowing who owns a truth and where it can be changed.

The boundary should not be chosen merely because an application seems large or because a service seems convenient. It should emerge from understanding the domain, the responsibility, and the contracts necessary for the journey to keep working.

Without associated responsibility, a Bounded Context is just a box in a diagram.

## How Contexts Relate

When there are multiple Bounded Contexts, their relationships need to be made explicit. DDD describes relationship patterns that help understand how contexts cooperate, compete, or isolate themselves.

A **Customer/Supplier** relationship exists when one context depends on the other with well-defined contracts — the consumer adapts its model to what the supplier exposes. An **Anti-Corruption Layer** exists when a context needs to isolate its model from the influence of another external context — it translates without being contaminated. **Separate Ways** means the contexts operate completely independently.

Each pattern has implications for design, for teams, and for reliability. A direct dependency between contexts without an explicit contract is an invisible dependency — exactly the kind of dependency ODD seeks to make visible.

## Group Buying: Boundaries That Emerge from the Journey

In Group Buying, different parts of the journey have clearly distinct responsibilities.

The **catalog** domain answers for the product's existence and attributes. The **offer** domain answers for eligibility and the conditions of the group purchase. The **group** domain answers for the group's lifecycle — its creation, joins, expiration, and closure. The **order** domain answers for the financial transaction. The **search** domain answers for indexing and discovery.

Each of these domains has its own language, its own rules, and its own protagonists. When a change in the group needs to propagate to the search engine — so the indexed group reflects the current state — there is a dependency between domains that needs to be managed as a contract, not as an improvised implementation.

## Domain Experts as Guardians of Meaning

The discovery of Bounded Contexts depends on people who deeply know each part of the business — domain experts, or Subject Matter Experts.

They are the ones who know where a word changes meaning. They are the ones who notice when a business rule is being violated by a technical decision that seemed neutral. They are the ones who can say, with authority, what can change within a context without affecting the others.

ODD does not work without this dialogue. The discovery of semantic boundaries is, fundamentally, a conversation between those who understand the business and those who will build the system.

## From Boundary to Contract

When a domain boundary is established, the next question is natural: how do the contexts communicate? What can one context expect from the other? Under what conditions is that expectation valid?

These are the questions about domain contracts — the topic of Chapter 11. Before getting there, we need to understand what differentiates entities in terms of risk, because it is the nature of change that determines what the contract needs to protect.

---

*Bounded Contexts are not the endpoint of modeling. They are a consequence of the attempt to make responsibility, language, and reliability sufficiently explicit.*
