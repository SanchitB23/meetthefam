# Show all people in the tree — design

> Spec for [#69](https://github.com/SanchitB23/meetthefam/issues/69). Milestone:
> **v1.1 — Post-launch polish**. Authored via `superpowers:brainstorming` on
> 2026-06-01. The original design (below) called for **option (d) — synthetic
> super-root grafted onto a hash-driven main_id**. During implementation that
> proved structurally insufficient (family-chart's walk doesn't traverse the
> super-root's other subtrees from a deep main_id). We pivoted mid-stream to
> **option (d') — pin main_id permanently to super-root and pan the camera on
> re-center**, then iterated through five further fixes as the layout
> pathologies of that approach surfaced. The §"Shipped design" below records
> what actually ships in the PR; the §"Original design" further down records
> the brainstorming session's design as historical context for the option-(e)
> follow-up.

## Shipped design (option d', after the iteration cycle)

**`main_id` is pinned permanently to `__super_root__`.** The progeny walk from
there reaches every real root → every subtree → every person on the canvas.
"Re-center here" no longer re-roots the layout; it pans the d3-zoom camera
via `f3.handlers.cardToMiddle` so the clicked card sits at the viewport
centre while every other person stays on canvas.

The show-all transform applies four passes on top of `transformToFamilyChartShape`:

1. **Floating co-parent synthesis** — for rootless people with no spouse but
   ≥ 1 child (Carlos Vargas in the local seed), synthesise a bidirectional
   spouse link to the in-tree other-parent of one of their kids, iff that
   other-parent isn't already married. In-memory only; never touches the DB.
2. **Couple-level child dedupe** — the base transform lists every child
   under BOTH parents. Walking from super-root, that emits duplicate progeny-
   tree branches and a card-explosion (`168 cards for 55 people` measured).
   Keep each two-parent child under exactly one parent — preferring the
   parent reachable from super-root (rules out the Carlos branch).
3. **True-root identification** — only people who are rootless AND have a
   rootless spouse (or no spouse at all) become super-root's children.
   Cross-level in-laws (rootless person married to a deeper-generation
   in-tree person, e.g. Nora ↔ Daniel) stay rootless in `rels.parents` and
   get rendered via their spouse's existing spouse link. Skipping this
   exclusion was the original layout-pathology cause.
4. **Primary-partner-only super-root linkage** — for each true-root couple,
   only the first-declared partner becomes a super-root child; the second
   partner is reached via the first's spouse-link only. Without this, every
   Gen-1 patriarch + matriarch rendered twice (once via super-root's progeny
   walk, once via the partner's spouse-link), adding 10 unnecessary
   duplicate cards.

**Click handler update**: family-chart's `setupTid`
(family-chart.js:897-913) marks EVERY occurrence of a duplicated id as
`duplicate > 0`, not just the second+. So for cross-subtree-married people
(Robert ↔ Susan, Catherine ↔ James, Andrew ↔ Beth, Helen ↔ Marcus), every
rendered card is dashed. The original 8b-3 design assumed a "canonical"
instance with the actions and "echo" duplicates without — under d' that
canonical doesn't exist, so we now render the 3-dot menu + add-relative "+"
button on duplicate cards too. The "tap card body → recenter on duplicate"
behaviour is dropped: card body tap opens the detail sheet (same as
non-duplicate cards); re-centering is done explicitly via the action menu.

### Result on the 55-person local seed

| Metric | Result |
|---|---|
| Unique people rendered | **55 / 55** ✅ |
| Total cards rendered | **63** (8 duplicates) |
| Duplicate sources | 4 cross-subtree marriages (Robert ↔ Susan, Catherine ↔ James, Andrew ↔ Beth, Helen ↔ Marcus) × 2 partners each |
| "Out of thin air" on re-center | **Eliminated** — camera pans, layout never re-roots |

The 8 remaining duplicates are the **hard structural floor of option d'**:
family-chart's `d3.hierarchy` walks each subtree independently, so a person
whose spouse is in a different super-root subtree is necessarily rendered
in both. Eliminating those last 8 requires option (e) — replace the layout
engine. Filed as a v1.2+ follow-up.

### Files actually changed (final state)

| File | Change |
|---|---|
| `src/app/(app)/tree/[id]/_lib/family-chart-data-show-all.ts` | New — the 4-pass show-all transform. |
| `src/app/(app)/tree/[id]/_lib/pan-camera-to.ts` | New — wraps `f3.handlers.cardToMiddle` with current-zoom preservation. |
| `src/app/(app)/tree/[id]/_lib/super-root-link-suppressor.ts` | New — MutationObserver-backed suppression of link paths touching super-root. |
| `src/app/(app)/tree/[id]/_lib/person-node-html.ts` | Render 3-dot + "+" buttons on duplicate cards too. |
| `src/app/(app)/tree/[id]/_components/FamilyTree.tsx` | Pin `main_id = SUPER_ROOT_ID`; `panCameraTo` for hash-driven focus; click-handler reorder (action-trigger before duplicate-tap, which is now dropped). Removed `fallbackMainIdRef`. |
| `src/app/globals.css` | Hide super-root foreignObject via `:has()`; scoped negative-margin to absorb the reserved card-row slot. |
| `supabase/seed.sql` | 13 → 55 people. |
| `supabase/seed-qa.sql` | 14 → 49 people. 8b-3 anchor (Catherine ↔ Andrew + Maya) preserved. |
| `src/__tests__/lib/family-chart-data-show-all.test.ts` | New — 12 Vitest cases covering the 4-pass transform branches. |
| `src/__tests__/lib/person-node-html.test.ts` | Inverted 2 cases — duplicate cards now INCLUDE the action buttons. |

### Known limitations (filed for option-(e) follow-up)

1. **8 cross-subtree-marriage duplicates** — structural; only option (e) (replace layout engine) eliminates them.
2. **Wide horizontal layout** — 5 Gen-1 subtrees laid side-by-side stretches the canvas horizontally. Zoom-to-fit works but the bounding box is wide; mobile users will need to pan more than they would in a single-trunk tree.
3. **Negative-margin CSS** — try-first hack to absorb the super-root's reserved card-row slot. If `chart.fit()` math drifts in QA, the rule can be deleted without functional impact.

---

## Original design (option d) — historical, kept for option-(e) follow-up context

The sections below describe the design as it was locked at brainstorm time.
They do **not** describe what ships. Read these for the option-(e) follow-up
to understand the assumptions that proved wrong.

## Goal

Eliminate the "people appearing out of thin air" UX. Today `family-chart`'s
single-root walk hides everyone not reachable from the current `main_id` via
parent ↔ child edges, so re-centering on a new person can make distant
relatives suddenly show up. After this work, every person in the tree is on
the canvas regardless of `main_id`; re-centering only shifts the camera /
layout, never the visible cast.

## Current behaviour (recap from #69)

- `f3.createChart(container, data)` lays out the canvas by walking two d3
  hierarchies rooted at `main_id` — ancestors via `rels.parents`, descendants
  via `rels.children` (see `node_modules/family-chart/dist/family-chart.js:604-634`).
- Anything not reachable from `main_id` through a parent-or-child chain is
  not in the tree.
- `setAncestryDepth(20) / setProgenyDepth(20)` are already set
  ([FamilyTree.tsx:164-165](../../../src/app/(app)/tree/[id]/_components/FamilyTree.tsx))
  — depth is not the limiter; the single-root walk is.
- "Re-center here" + the `#p=<id>` URL hash drive `main_id`, so each focus
  exposes a different subset of the family. Issue [#62](https://github.com/SanchitB23/meetthefam/issues/62)
  (closed, v1.0) makes that reversible via browser back, but does not change
  which people are visible.

## Decisions locked (from brainstorming)

| # | Decision | Choice | Rationale |
|---|---|---|---|
| D1 | Approach | **Option (d) — synthetic super-root** | Spike POC mechanism is sound: every person renders regardless of `main_id`. Lightest path (S, ~1 day). |
| D2 | "No hiding" vs "no layout jumps" for v1.1 | **Just stop hiding** | Option (e) (replace layout engine, fixed-position map) is L-sized; file as v1.2+ candidate if users still complain after (d) ships. |
| D3 | Blank row above Gen-1 | **Try CSS negative-margin first; fall back to accepting it** | Cheap to try; if it breaks `chart.fit()` / scroll-into-view math, accept the ~110px gap and file follow-up. |
| D4 | Connector-line flash during re-center | **Fix now via MutationObserver** | Same pattern as `non-spouse-parent-links.ts`; ~50 lines; within the S budget. |
| D5 | Seed expansion | **Grow both `seed.sql` + `seed-qa.sql` to ~60 people, same PR** | A 13-person tree is too small to stress option (d) realistically. ~60 people, 6–10 root groups, is mid-scale for our 50–200 cap. |
| D6 | Seed structure | **Extend existing Smith / Anderson** | Preserve all 13 existing UUIDs in `seed.sql` and all 14 in `seed-qa.sql` (incl. the Catherine ↔ Andrew marriage + Maya Anderson that drives the 8b-3 duplicate-card QA gate). Add more in-law families, more siblings, Gen-4 cousins, Gen-5. |

## Mechanism (option (d) refresher)

`transformToFamilyChartShape` already produces the library's `Datum[]` shape.
The show-all wrapper does two things on top:

1. Identify every person with `rels.parents.length === 0` (no parents in the
   tree — i.e. graph roots). If there are 0 or 1 roots, the wrapper is a
   no-op (the single-root walk already covers everyone).
2. Otherwise inject a synthetic `__super_root__` datum whose
   `rels.children` is the list of all root ids; every real root gets
   `__super_root__` as its sole parent.

Because family-chart's walk follows **all** children of every ancestor it
encounters, reaching `__super_root__` from any `main_id` exposes every other
root subtree as a sibling chain — making the full graph visible.

The super-root is invisible at the render layer:

- `setCardInnerHtmlCreator` returns a zero-size sentinel `<div data-person-id="__super_root__">`.
- CSS rule on `.f3 foreignObject:has([data-person-id="__super_root__"])` sets
  `visibility: hidden; pointer-events: none`.
- Ancestry links targeting `__super_root__` are zeroed (`d='M0,0'`) by a new
  `super-root-link-suppressor` keeping pace with d3's transition tween via
  a `MutationObserver` (parallels `non-spouse-parent-links.ts`).

## Architecture

### Files touched

| File | Change | Estimated lines |
|---|---|---|
| `src/app/(app)/tree/[id]/_lib/family-chart-data-show-all.ts` | Strip POC banner. Keep `SUPER_ROOT_ID` export. Keep `transformToFamilyChartShapeShowAll` as the production transform — name unchanged so it is obvious at the call-site that this is the wrapper. | Edit, ~30 lines net |
| `src/app/(app)/tree/[id]/_lib/family-chart-data.ts` | No change to `transformToFamilyChartShape` itself. It remains the inner transform called by the show-all wrapper. | — |
| `src/app/(app)/tree/[id]/_lib/super-root-link-suppressor.ts` | **New.** Mirrors `non-spouse-parent-links.ts` shape: exports `attachSuperRootLinkSuppressor(container) → { kick, dispose }`. `kick()` is called from `setAfterUpdate`. A `MutationObserver` on `g.links_view`'s `d=` attributes re-applies `M0,0` to any ancestry path whose target is `__super_root__`, surviving d3's 800ms transition tween. Re-entrancy guard same as the existing rewriter. | New, ~70 lines |
| `src/app/(app)/tree/[id]/_components/FamilyTree.tsx` | Remove the `NEXT_PUBLIC_SHOW_ALL_PEOPLE` flag + branching. Always import + call `transformToFamilyChartShapeShowAll`. Remove the inline `suppressSuperRootLinks` function and its conditional call. Wire `attachSuperRootLinkSuppressor` alongside the existing `attachNonSpouseParentLinkRewriter` — both `kick()`s fire in the existing `setAfterUpdate`. Add `dispose()` to the unmount cleanup. Keep the `SUPER_ROOT_ID` guard inside `setCardInnerHtmlCreator`. **Harden the `seedFocus` fallback (line 238)** to coerce to `people[0]?.id` — without this, the chart's `data[0]` default in the no-hash + no-`initialFocusId` case lands on the invisible `__super_root__` (see §"Initial `main_id` fallback hardening" below). | Edit, ~16 lines net (mostly removals + one fallback chain extension) |
| `src/app/globals.css` | Keep the `:has([data-person-id="__super_root__"])` rule from the POC. Add a scoped negative-margin attempt on `.f3 svg.main_svg` *only when a `__super_root__` foreignObject is present in the DOM*, using `:has()` again. Size the offset to one card-row height (110px) plus the layout's vertical gap (verify via DevTools). | Edit, ~12 lines net |
| `.env.local.example` | Remove the `NEXT_PUBLIC_SHOW_ALL_PEOPLE` block (flag retired). | -6 lines |
| `supabase/seed.sql` | Expand from 13 → ~60 people. Preserve all existing UUIDs + relationships. Add Gen-1 in-law couples, more Gen-2 siblings, Gen-4 cousins, Gen-5 great-great-grandchildren. Target 6–10 root groups for option-(d) stress. | Edit, ~600 lines added |
| `supabase/seed-qa.sql` | Same shape as the local-seed expansion, but in the QA-seed UUID namespace. **Must preserve** the Catherine ↔ Andrew marriage + Maya Anderson cross-lineage child (drives the 8b-3 duplicate-card QA gate). | Edit, ~600 lines added |
| `src/app/(app)/tree/[id]/_lib/__tests__/family-chart-data-show-all.test.ts` | **New.** Vitest unit specs: (a) 0 roots → no-op; (b) 1 root → no-op; (c) ≥2 roots → super-root injected with `rels.children = rootIds`, every root rewired. | New, ~80 lines |

### Module boundaries

- **`family-chart-data-show-all.ts`** — pure data transform. No DOM, no React.
  Takes `PersonRow[]`, returns `FamilyChartDatum[]`. Unit-testable.
- **`super-root-link-suppressor.ts`** — pure DOM side-effect, no React.
  Takes the chart container, returns `{ kick, dispose }`. Lifecycle is
  identical to `non-spouse-parent-links.ts`; one-line wiring at the call
  site.
- **`FamilyTree.tsx`** — orchestration only. No new logic; just removes the
  flag and wires the new suppressor alongside the existing rewriter.

### Why a separate suppressor file instead of folding into `non-spouse-parent-links.ts`?

They look similar but have different concerns:

- `non-spouse-parent-links.ts` reshapes ancestry links to honour the
  married-vs-co-parent semantic distinction. Pure visual semantics.
- `super-root-link-suppressor.ts` hides links to a layout-engineering
  artefact. Pure structural concealment.

Folding them would couple two unrelated reasons-to-change; keeping them
separate is the cheap choice. Same pattern, two files, ~70 lines each.

## Seed expansion details

### Local seed (`supabase/seed.sql`)

Goal: ~60 people, 6–10 root groups, 5 generations deep, mix of married and
co-parent (unmarried) Gen-2/3 pairs so the existing `non-spouse-parent-links`
behaviour stays exercised.

Approach — additive only:

1. Keep all 13 existing people, UUIDs, and `father_id` / `mother_id` /
   `spouse_id` values exactly as today (so any tests / screenshots / RLS
   fixtures keyed off these ids keep working).
2. Add ~3 more Gen-1 in-law couples (separate root groups): e.g. the
   *Hartford* (Penny's eventual in-laws), *Brennan*, *Okonkwo* families.
   Each becomes a new root.
3. Add 2–3 more Gen-2 siblings to George + Margaret, Henry + Eleanor: more
   children means more branching across Gen-3.
4. Add Gen-3 children of those new Gen-2 siblings: nephews / nieces of the
   existing Gen-3 people. Mix spouses in from the new in-law families.
5. Add Gen-4 cousins to existing Theo: ~8–10 great-grandchildren spread
   across Gen-3 couples.
6. Add a Gen-5 (~3–5 great-great-grandchildren) under the oldest Gen-4 if
   the years line up.

Target distribution: Gen-1 ≈ 8, Gen-2 ≈ 12, Gen-3 ≈ 20, Gen-4 ≈ 15, Gen-5 ≈ 5.

Tones: continue the existing palette mapping (`sage` / `terracotta` /
`charcoal` etc. per `tones.ts`). Locations and years stay plausibly grounded
in the Smith / Anderson backstory — Boston-area + 1930s–2020s arc.

Spouse FKs: same two-pass shape as today — insert all people, then a single
`UPDATE` block sets `spouse_id` on both sides of each marriage.

### QA seed (`supabase/seed-qa.sql`)

Same shape and headcount as the local seed but in the QA-namespace UUIDs
already used by that file. Two **non-negotiables**:

1. The Catherine Smith ↔ Andrew Anderson marriage must remain intact.
2. Maya Anderson (Gen 3, b. 1998, child of Catherine + Andrew) must remain
   in the tree as the cross-lineage trigger for the 8b-3 duplicate-card QA
   gate (her presence makes `family-chart` emit `d.duplicate > 0` when the
   tree is viewed centered on Daniel).

Adding ~46 new people around that anchor is fine; rearranging the anchor
itself is not. Spec calls this out so the implementer doesn't accidentally
break the gate.

## Initial `main_id` fallback hardening

Today's seed-focus computation in [`FamilyTree.tsx:238`](../../../src/app/(app)/tree/[id]/_components/FamilyTree.tsx):

```ts
const seedFocus = readHashFocus() ?? initialFocusId ?? null
if (seedFocus && peopleByIdRef.current.has(seedFocus)) {
  chart.updateMainId(seedFocus)
}
// otherwise: family-chart defaults to data[0] as main_id
```

On qa (no super-root) `data[0]` is the first real person returned by the
Supabase query — a sensible default. After option (d) we **prepend**
`__super_root__` at index 0 of the chart data (so it occupies the
"above-the-tree" layout slot the library assigns to `data[0]`). That
prepend turns `data[0]` into the invisible super-root.

If a tree is opened with no `#p=` hash AND no `initialFocusId` prop —
e.g. a fresh top-level tree URL after an authenticated sign-in — the
fallback path silently sets `main_id` to `'__super_root__'`. The graph
still renders correctly (the walk from super-root downward reaches every
real root), but `chart.getMainId()` is now an invisible-node id, which
breaks the "you are centered on …" mental model and any future code that
reads `main_id` to drive UI copy.

**Fix.** Extend the `seedFocus` fallback to coerce to `people[0]?.id`,
matching the `fallbackMainIdRef` logic already on line 253:

```ts
const seedFocus =
  readHashFocus() ?? initialFocusId ?? people[0]?.id ?? null
```

That keeps the existing semantics (no-hash → first real person) and
guarantees `main_id` is always a real person id from the moment the
chart paints. Edge case: a fully empty tree (`people.length === 0`) —
`people[0]?.id` is `undefined`, `seedFocus` falls back to `null`,
`updateMainId` is skipped. The library then has `data = []` (the
show-all wrapper returns `[]` for 0 roots — no super-root injected), so
`data[0]` is also `undefined`. No regression.

## Behaviour audit

| Surface | Before | After |
|---|---|---|
| Re-center on a person | Distant relatives disappear; only their ancestry/progeny chain shows | All ~60 people stay on canvas; only layout *position* shifts around the new `main_id` |
| URL hash `#p=<id>` | Drives `main_id` | Same — `main_id` now controls *centering*, not *visibility* |
| Page load, no hash, `initialFocusId` set | `initialFocusId` wins | Unchanged |
| Page load, no hash, no `initialFocusId` | Library defaults `main_id` to `data[0]` = `people[0]` (a real person) | **Hardened** — `seedFocus` fallback now coerces to `people[0]?.id` explicitly so we don't rely on the library-default behaviour landing on a real person. See §"Initial `main_id` fallback hardening". |
| Browser-back on re-center (post-#62) | Undoes the previous re-center | Unchanged |
| "Re-center here" action menu | Repositions tree around the clicked person | Same mechanic; semantic shift from "reveal" to "reposition" (label unchanged for v1.1) |
| Duplicate-card dashed marker (8b-3) | Marks shared ancestors visible via multiple chains | Still emitted by family-chart; still meaningful (more layout chains = more potential duplicates) |
| AddRelativeFab context-awareness | Reads `focusPerson` from `currentFocusId` | Unchanged — super-root can never be `currentFocusId` (it's not in `peopleById`) |
| Click on super-root card | n/a | Silently dropped by existing `peopleById.has(id)` guard; CSS `pointer-events: none` is belt-and-braces |
| Zoom-to-fit ("Tree overview" button) | Fits the focus-rooted subgraph | Fits the whole graph (super-root foreignObject is in the layout bounding box; negative-margin CSS handles the visual gap if D3 applies cleanly) |
| Non-spouse co-parent link geometry | Rewritten by `non-spouse-parent-links.ts` | Unchanged — the new suppressor runs alongside, observes only super-root-targeted links |
| Single-root tree (degenerate) | Single-root walk covers everyone | Wrapper detects `rootIds.length ≤ 1` and returns the base transform unchanged — zero behavioural diff |

## Testing strategy

### Unit (Vitest)

`family-chart-data-show-all.test.ts`:
- 0 roots (empty `PersonRow[]`) → returns `[]`.
- 1 root → returns base transform unchanged; no `__super_root__` datum.
- 2+ roots → returns base transform plus a leading `__super_root__` whose
  `rels.children` is exactly the root ids, in declaration order; every
  real root has `rels.parents === [SUPER_ROOT_ID]`.

No DOM tests for the suppressor: it's a thin wrapper around a
DOM-mutation pattern that is already battle-tested in
`non-spouse-parent-links.ts`. Manual smoke covers the integration.

### Manual

Run `pnpm exec supabase db reset` to load the expanded seed. On the
expanded ~60-person Smith / Anderson tree:

1. Visit `/tree/<smith-demo-id>` with each of the following as `main_id`
   via `#p=<id>`: Catherine, Nora, Andrew, George, Henry, plus one person
   from each new in-law family. Count visible cards each time — must be
   ~60 in every case.
2. During each re-center, watch the SVG: no `__super_root__` connector
   lines visible during the 800ms transition (this is the MutationObserver
   acid test).
3. Confirm the negative-margin CSS keeps the canvas visually anchored —
   no large blank row above Gen-1. If it visibly breaks `zoomToFit`,
   remove the negative-margin and document the blank-row follow-up issue.
4. Browser back/forward across 3–4 re-centers; verify the back-stack
   restores prior `main_id`s.
5. Read-only share link (token-bypass path): same coverage; suppressor +
   transform must work without an authed session.
6. Mobile gestures: pinch-zoom + pan still smooth on the expanded tree.

### Regression coverage

- **8b-3 duplicate-card gate** — on the QA seed, focus on Daniel and
  confirm Maya Anderson's card carries the dashed-duplicate treatment.
  This is the test that proves the seed-qa expansion didn't break the
  cross-lineage anchor.
- **`non-spouse-parent-links` rewriter** — on any unmarried co-parent pair
  in the expanded seed, the parent-bar should still render as two
  independent stepped verticals (not a horizontal bar).
- **No new Playwright** — existing tree-view smoke flows cover canvas
  rendering and will surface regressions naturally.

## Risks / open

1. **`foreignObject:has()` browser support** — Safari ≥ 15.4, Chrome ≥ 105.
   Aligned with our target matrix; pin the requirement in a comment near
   the CSS rule.
2. **Negative-margin CSS interacting with `chart.fit()`** — family-chart's
   fit-to-viewport math reads SVG bounding-box dimensions. If the margin
   throws off centering, fall back: accept the ~110px blank row and file
   a separate v1.2+ issue.
3. **Two MutationObservers on `links_view`** — both are idempotent and
   short-circuit on no-change writes; the existing rewriter at our scale
   (50–200 people) costs ~sub-millisecond per kick. Verify in the manual
   smoke that re-center doesn't stutter on the expanded ~60-person tree.
4. **Seed PR size** — adding ~1200 lines of SQL fixtures to one PR is
   noisy. Acceptable trade-off because the user picked "same PR" and
   re-running the spike against pre-expanded data is wasted effort.
5. **`f3.createChart` data-array ordering** — the POC prepends
   `__super_root__` at index 0 because family-chart treats `data[0]` as
   a default `main_id` when none is set. Our wiring always calls
   `updateMainId` explicitly before the first `updateTree({ initial })`,
   so this is belt-and-braces. Keep the prepend; document the reasoning.

## Out of scope

- Option (e) — replacing the layout engine to also freeze positions across
  re-centers. Filed as v1.2+ candidate.
- Renaming "Re-center here" to "Center here" (or similar semantic update).
  Cosmetic copy change; can ride a later polish PR if user feedback
  demands it.
- Mini-map / overview pane (mentioned in #69, deferred).
- Mobile gesture refinement (pinch, double-tap-to-zoom).
- Production-DB seed changes — local + QA only, same as the current
  convention documented in [`supabase/seed.sql`](../../../supabase/seed.sql)
  header (production starts empty).

## Implementation order

The bundle is one PR but the work breaks cleanly into ordered sub-tasks:

1. Expand `supabase/seed.sql` to ~60 people. `supabase db reset`. Sanity-check.
2. Expand `supabase/seed-qa.sql` to mirror. Manually verify Catherine ↔ Andrew + Maya intact.
3. Strip the POC banner from `family-chart-data-show-all.ts`; add Vitest unit specs.
4. Create `super-root-link-suppressor.ts`. Verify the file isolated against
   the existing `non-spouse-parent-links.ts` pattern.
5. Update `FamilyTree.tsx`: remove flag + inline `suppressSuperRootLinks`,
   wire the new suppressor, and **harden the `seedFocus` fallback** to
   coerce to `people[0]?.id` (see §"Initial `main_id` fallback hardening").
6. Remove the `NEXT_PUBLIC_SHOW_ALL_PEOPLE` block from `.env.local.example`.
7. CSS pass on `globals.css`: keep the visibility rule, add the
   `:has()`-scoped negative-margin attempt.
8. Local manual smoke (per "Manual" above).
9. PR; QA-seed apply against `ljjvwtpifmoshfknlbaj` via the documented
   `supabase db query --linked` flow; QA smoke; merge.

## Links

- Issue [#69](https://github.com/SanchitB23/meetthefam/issues/69) — spike + POC
- POC branch [`claude/issue-69-20260526-0835`](https://github.com/SanchitB23/meetthefam/tree/claude/issue-69-20260526-0835)
- Issue [#62](https://github.com/SanchitB23/meetthefam/issues/62) — re-center undo (closed v1.0, orthogonal)
- [`docs/architecture/data-model.md`](../../architecture/data-model.md) — `father_id` / `mother_id` / `spouse_id` shape
- [`supabase/seed.sql`](../../../supabase/seed.sql) header — seed data is
  local + QA only (production starts empty)
- `non-spouse-parent-links.ts` — template for the MutationObserver pattern
