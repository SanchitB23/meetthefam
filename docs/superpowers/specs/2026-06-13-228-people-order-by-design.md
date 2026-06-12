# #228 — deterministic people ordering (id tiebreak) — design

**Date:** 2026-06-13
**Issue:** #228 (v1.2 — Export & archival)
**Status:** Approved

## Corrected diagnosis

Issue #228 claims the people fetches have **no `ORDER BY`**. That was stale
when filed: both fetches have carried
`.order('created_at', { ascending: true })` since 2026-05-15 (`92bf861`,
phase 7). The real remaining gap is narrower:

`created_at` defaults to `now()`, which Postgres fixes **per transaction**.
Any batch insert — a future import feature, a multi-row seed, several inserts
in one transaction — produces people with *identical* `created_at`, and row
order among ties is still arbitrary. App-UI inserts (one person per request)
essentially never tie, so today this is latent, not live.

## Why order matters visually

The tree's *hierarchy* is order-independent (derived from
`father_id`/`mother_id`/`spouse_id`). But
`transformToFamilyChartShape` builds each person's `rels.children` by
filtering the fetched rows **in array order**
(`src/app/(app)/tree/[id]/_lib/family-chart-data.ts`), and family-chart lays
siblings out left-to-right in that order. Non-deterministic fetch order ⇒
siblings can visually shuffle between loads — noticeable now that exports
(#60) produce archival PNGs/PDFs.

## Decision

Add `.order('id', { ascending: true })` as a tiebreak after the existing
`created_at` order in both fetches:

- `src/app/(app)/tree/[id]/_components/TreeContent.tsx` (tree page)
- `src/app/share/[token]/page.tsx` (share page)

`id` is a UUID — meaningless as an ordering but **stable**, which is all a
tiebreak needs. Result: a total order; sibling layout is fully deterministic
and insertion-ordered (product choice: insertion order, NOT eldest-first —
confirmed 2026-06-12).

## Alternatives considered

- **Close #228 as already-done, no code.** Defensible (the live fetches are
  ordered), but the tie gap is real and the fix is two lines.
- **Fuller package**: extract the duplicated people select-string into a
  shared helper + DB-integration test asserting stable order across
  batch-inserted ties. ~60 lines for a 2-line problem; the test mostly
  exercises Postgres. Rejected per YAGNI; the helper dedupe can be its own
  issue if the column list ever drifts.
- **`birth_year` sibling sort (eldest-first).** Rejected — user chose
  insertion order; also changes existing visual layouts.

## Testing / verification

No new tests (issue marks them optional; an ORDER-BY-tiebreak integration
test verifies Postgres, not us). Verification:

- `pnpm test`, `pnpm typecheck`, `pnpm lint` green (modulo documented
  pre-existing local failures; CI is the arbiter).
- Visual check on local dev: tree + share pages render identically.

## Delivery

Branch `fix/228-people-order-by` off `qa` (worktree `../mtf-wt-228`), one
commit, draft PR with `Closes #228` + *v1.2 — Export & archival* milestone.
Add a correcting comment on #228 documenting that `ORDER BY created_at` has
existed since `92bf861` and only the `id` tiebreak was missing.
