# ADR 0003 — No real-time in v1

**Status:** Accepted
**Date:** 2026-05-10

## Context

Trees support multiple editors. Two options for keeping co-editors in sync:

1. **Real-time** — each client subscribes to changes on the tree's rows; updates propagate within ~100 ms.
2. **Last-write-wins + revalidate** — Server Action mutates a row; `revalidatePath` re-fetches; the other client sees the change on its next render (or page refresh).

## Decision

**No real-time in v1.** Use last-write-wins with `revalidatePath`.

## Consequences

- **Significantly simpler implementation** — no subscription management, no client-side merge / conflict logic, no broken-channel reconnection.
- **Edge case**: two editors editing the same person's row at the same time. Last write wins; the loser's edit is silently overwritten.
- **In practice this almost never matters** for a 1–3 concurrent-editor side project. Real conflict only happens if two people happen to be open on the same person row at the same second.
- **Revisit trigger**: if a real user reports a "we keep overwriting each other" complaint, add Supabase Realtime subscriptions on the `people` table for the active tree and reload data when a row changes. Estimate: ~2 days of work — well-isolated, won't reshape anything.

## Alternatives considered

- **Supabase Realtime subscriptions** — beautiful when wired correctly, but adds reconnection logic, optimistic-update merge handling, and a debug surface for "why is the tree updating in a loop?" issues. Not worth it before a user reports the problem.
- **Polling** — `setInterval` re-fetches every 30 s. Cheaper than real-time, more wasteful than revalidate-on-mutation. Worse than both.
