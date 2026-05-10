# ADR 0002 — FKs on `people` instead of a `relationships` join table

**Status:** Accepted
**Date:** 2026-05-10

## Context

A family tree is a graph: people are nodes, parent-of and married-to are edges. Two reasonable database shapes:

1. **FKs on `people`** — `father_id`, `mother_id`, `spouse_id` as nullable self-FKs.
2. **Join table** — `relationships(person_a, person_b, type)` with type values like `'parent_of'` and `'spouse_of'`.

The spec scopes v1 to "simple only" relationships: one spouse, one parent pair, no step / adoption / multiple marriages.

## Decision

**FKs on the `people` table.** Three nullable self-FKs: `father_id`, `mother_id`, `spouse_id`.

## Consequences

- **Every parent-child / spouse query is one row read or one indexed SELECT.** "Who are X's parents?" is `SELECT father_id, mother_id WHERE id = X`. "Who are X's children?" is `SELECT WHERE father_id = X OR mother_id = X`.
- **Schema is dramatically simpler** — three columns vs. an entire join table with its own RLS policies.
- **The cost is asymmetric writes** — to set "A and B are spouses," we have to update *both* rows. Wrapped in a Server Action transaction. See [`../architecture/data-model.md`](../architecture/data-model.md) → "Edge cases."
- **Migrating to a join table later is straightforward** — a one-time data migration that walks every row of `people` and produces the corresponding `relationships` rows. We pay this cost only if/when the scope grows.

## Alternatives considered

- **`relationships` join table** — necessary if we ever need multiple marriages, step / adoption typing, or richer relationship metadata. Out of scope for v1; revisit if/when the scope grows.
- **Bidirectional `parents: [id, id]` array on `people`** — Postgres supports it but loses FK referential integrity (no cascade enforcement). Worse than self-FKs.
