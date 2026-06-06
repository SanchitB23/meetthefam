# Spike #214 — dagre vs d3-dag layout-engine evaluation — design

> Investigation design for [#214](https://github.com/SanchitB23/meetthefam/issues/214).
> Decision gate for [#200](https://github.com/SanchitB23/meetthefam/issues/200) (impl, backlog).
> This is a **spike**: it produces evidence + a recommendation, not production code.

## Goal

Decide whether replacing family-chart's strict-tree layout walk (`calculateTree`,
`node_modules/family-chart/dist/family-chart.js:604`) with a layered-DAG engine
(**dagre** or **d3-dag**) can eliminate the 8 cross-subtree-marriage duplicate
cards documented in #200 — and is worth the L-sized rebuild.

The spike investigates and recommends. The **go/no-go is a human decision gate**;
the spike does not unilaterally commit the team to #200.

## Background

#69 shipped option (d') — pin `main_id` to a synthetic `__super_root__` and pan
the camera on re-center. Result on the 55-person local seed: all 55 render, but
**8 duplicate cards** remain from cross-subtree marriages (Robert↔Susan,
Catherine↔James, Andrew↔Beth, Helen↔Marcus). The duplicates are structural —
family-chart uses `d3.hierarchy`, which lays a married person out once per
ancestry subtree. Removing them requires replacing the position-calculation
engine. Full story: `docs/superpowers/specs/2026-06-01-issue-69-show-all-people-design.md`
(§"Known limitations").

family-chart is `0.9.0`, ISC. The render path (~2300 lines) owns link drawing,
transition lifecycle, d3-zoom pan, and card placement through family-chart — see
#200 for the coupling inventory.

## Decisions locked (from brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| POC fidelity | **Headless / standalone** | Fast research gate; no app wiring. Answers dupe-elimination + compactness + engine health without creeping into the #200 rebuild. |
| Engines POC'd | **Both** dagre + d3-dag (parallel) | Compactness is empirical + engine-specific; the shared harness makes the second engine near-free. |
| Findings deliverable | **#200 comment + in-repo findings doc** | GitHub comments aren't version-controlled; the rebuild will want the artifacts. |
| Hard no-go gates | **(1) stale/unmaintained engine, (2) layout not more compact than d'** | User-selected dealbreakers. Card-body reuse and license are *not* gates (both candidates are MIT). |

## Approach

**A — Parallel both-engine headless harness.** One harness extracts the 55-seed
graph, runs it through dagre AND d3-dag, emits coords + static SVG + metrics,
then a maintenance/license matrix. Chosen over sequential (B) and research-led
single-engine (C) because the compactness gate is empirical and the extractor is
shared, so doing both costs little extra and removes "did we pick wrong?" doubt.

## Architecture

Throwaway harness under `scripts/spike-214/` (spike branch only). Three units,
one job each, communicating through a normalized graph JSON:

### Module boundaries

1. **Graph extractor** — reads the 55-person local seed and emits normalized
   `{ nodes[], parentEdges[], spouseEdges[] }` JSON.
   - Primary source: query the local Supabase Postgres (`:54322`) for the seed's
     `people` + `relationships` rows.
   - Fallback: parse `supabase/seed.sql` directly (no running stack required).
   - Decouples the engine POC from the DB; engines never touch Supabase.

2. **Engine adapters** (`dagre-adapter`, `d3dag-adapter`) — each consumes the
   normalized graph → produces positioned nodes + routed edges. Both try the
   **union-node encoding**: insert a virtual marriage node between each spouse
   pair; children link to the union node, not to either parent directly. This is
   the standard genealogy-DAG trick and the **core hypothesis** the spike tests —
   it is what should let a cross-subtree-married person resolve to a single node.

3. **Renderer / metrics** — emits one standalone `.svg` per engine + a
   `metrics.json`.

### What it measures

| Metric | Target / purpose |
|---|---|
| Unique people rendered | 55, each exactly once |
| Duplicate cards | **0** (the #200 goal) |
| Bounding box W×H + aspect ratio | **compare vs option d''s 5-wide strip** — compactness gate |
| Layout time | report (expected trivial at 55 nodes) |
| Mobile aspect | report W:H for pan/zoom feel |

The option-d' baseline (63 cards, ~5 Gen-1 subtrees side-by-side) comes from the
#69 spec and, if useful, a current-app canvas bounding-box capture.

### Engine health research (second gate)

For **dagre** (`@dagrejs/dagre`) and **d3-dag** (`erikbrinkman/d3-dag`): last
release date, commit cadence, open-issue health, npm weekly downloads, TS-types
quality, breaking-change history, license (confirm both MIT). → verdict matrix.

## Deliverables

- **#200 comment** — verdict, recommended engine + version, SVG snapshots,
  metrics table, health matrix, effort re-estimate, and a *strategy sketch* for
  the rebuild (union-node encoding; how links / zoom / transition lifecycle get
  owned once family-chart no longer drives them). Sketch only — not built here.
- **In-repo findings doc** — `docs/superpowers/specs/2026-06-06-issue-214-layout-engine-spike-findings.md`
  — the matrix, metrics, harness-reproduction pointer, recommended encoding.
- **Harness + POC devDeps** (`dagre`, `d3-dag`) — stay **on the spike branch** as
  reproducibility reference; excluded from the `qa` PR unless go/no-go = go.

## Merge plan

- Both docs commit to `spike/214-layout-engine` (worktree
  `.claude/worktrees/spike-214-layout-engine`).
- At branch-finish: **draft PR** `spike/214-layout-engine → qa`, `Closes #214` +
  v1.2 milestone; user marks ready, then merge.
- Docs/spike-only → **rides the next feature release, no dedicated tag**.
- The `qa`-merged diff is **docs only**: the throwaway harness + `dagre` / `d3-dag`
  devDeps stay branch-local and are re-added properly during the #200 rebuild iff
  the decision is "go".

## Exit criteria

- [ ] Both engines POC'd headless; `metrics.json` + SVG snapshots captured
- [ ] Maintenance / license matrix complete
- [ ] Recommendation framed against the two hard gates (engine health, compactness vs d')
- [ ] #200 comment posted
- [ ] Findings doc committed
- [ ] Human go/no-go gate explicitly flagged (spike presents, does not decide)

## Out of scope (YAGNI)

- App wiring of any engine into `FamilyTree.tsx`.
- Implementing link drawing, zoom/pan, or transition lifecycle — all #200.
- Any DB or production change.
- Adding a layout-engine dependency to `qa`'s `package.json` during the spike.

## Links

- Spike issue: [#214](https://github.com/SanchitB23/meetthefam/issues/214)
- Impl (backlog): [#200](https://github.com/SanchitB23/meetthefam/issues/200)
- Prior art: `docs/superpowers/specs/2026-06-01-issue-69-show-all-people-design.md`
