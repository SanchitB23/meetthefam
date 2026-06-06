# Spike: Full-tree export viability — design

> **Issue:** [#215](https://github.com/SanchitB23/meetthefam/issues/215) (sub-issue of epic [#60](https://github.com/SanchitB23/meetthefam/issues/60))
> **Milestone:** v1.2 — Export & archival
> **Type:** Spike (investigation + product call). **No production feature code ships from this branch.**
> **Date:** 2026-06-06

## 1. Background & reframe

Epic #60 wants tree export as PNG / PDF (photographer hand-off, archival prints). The earlier feasibility comment assumed family-chart renders a **windowed** view (depth-limited, centred on the focused person), and so split the work into **Option A** (capture current view) vs **Option B** (capture full tree).

Grounding the code disproved that assumption:

- `FamilyTree.tsx` configures `setAncestryDepth(20)` + `setProgenyDepth(20)` (`src/app/(app)/tree/[id]/_components/FamilyTree.tsx:196-197`) — effectively unlimited for a 50–200-person tree.
- `family-chart-data-show-all.ts` grafts a synthetic `__super_root__` parent onto every rootless patriarch so family-chart's single-root walk reaches **every** subtree.
- Result: **the entire tree is already rendered into one `svg.main_svg`.** `overflow: hidden` on the container div (`FamilyTree.tsx:475-485`) clips the *viewport*, not the SVG. Pan/zoom is a d3 `<g class="view">` transform over an already-complete DOM.

So "full-tree capture" is **not** a re-render problem — it is: read the full `svg.main_svg` bbox → reset the view transform → lift `overflow` → rasterise. The A-vs-B distinction nearly collapses. What remains genuinely unknown:

1. **Canvas ceiling** — does a ~200-person photo tree blow past the browser max-canvas dimension (~16384px) or memory limits, especially on mobile?
2. **`foreignObject` → canvas reliability** — person cards are HTML in `<foreignObject>` (`person-node-html.ts`). Native SVG serialisation drops foreignObject; client rasterisers (`html-to-image`) are historically flaky here cross-browser. A headless-Chrome (Playwright) screenshot is the most reliable fallback.
3. **Photo CORS taint** — avatar `<img>` tags carry no `crossOrigin` (`person-node-html.ts:138-152`); cross-origin Supabase URLs can taint the canvas.
4. **UX cost** — capture wall-time at scale.

## 2. Goal & deliverable

**Goal:** Decide whether **full-tree** export is viable for v1.2, settle whether #218/#219 should keep a "current-view vs full-tree" split at all, and price the client-vs-server escape hatch.

**Deliverables (all on `spike/215-full-tree-export-viability`):**

1. **Synthetic seed script** — committed, deterministic, idempotent. Creates **5 distinct trees**, one per size target.
2. **Capture probe harness** — a throwaway route exercising both capture paths. Committed but clearly marked disposable (removed before the epic's feature branches build the real thing).
3. **This decision doc**, updated with the results table + verdict.
4. **Decision-summary comment on #215** linking back here.

**Explicit non-goals:** no `ExportTreeButton`, no production export pipeline, no `crossOrigin` change to `person-node-html.ts` (that is #216), no `containerRef` refactor (that is #217). The probe may *locally* hack those in throwaway code to measure, but ships none of it.

## 3. The bar (tiered)

| Tier | Definition |
|---|---|
| **Floor — must pass** | Desktop Chrome + Safari + Firefox each cleanly export a **100-person** photo tree, both PNG and PDF, visually correct (all cards, fonts, photos present). |
| **Stretch — measure, don't gate** | Chart the capture curve across 100 → 150 → 200 to find the real ceiling per browser. |
| **Degrade rule** | Mobile, or trees above the measured ceiling → fall back to current-view capture, or show "open on desktop to export the full tree". |

100 is the practical floor for now; the 200 ceiling data makes the feature scalable without re-spiking.

## 4. Test fixtures — five distinct trees

A seed script (`scripts/seed-export-stress.ts`) creates five separate trees, each its own tree row + people set:

| Tree name | People |
|---|---|
| `Export Stress 25` | 25 |
| `Export Stress 50` | 50 |
| `Export Stress 100` | 100 |
| `Export Stress 150` | 150 |
| `Export Stress 200` | 200 |

Per tree:
- ~5 generations, branching shaped to hit the exact count.
- ~70% of people get a real photo uploaded to **local Supabase Storage**, so `photo_url`s are genuine cross-origin URLs (exercises the canvas-taint path realistically).
- Deterministic — re-seeding yields the same five trees (stable IDs / stable people), so runs are comparable and trees can be eyeballed individually.

Rationale for distinct trees (vs one growing tree): deterministic, isolated, visually inspectable, no mutation between runs. The probe selects a fixture by tree id.

## 5. The probe

A throwaway route (e.g. `/_spike/export-probe?tree=<id>`) renders the real `FamilyTree` component against a chosen seed tree and runs two capture paths on demand:

- **Path 1 — client `html-to-image`:** `toPng` on the full `svg.main_svg` bbox, with the view transform reset and `overflow` lifted. The realistic client-side path #60 committed to.
- **Path 2 — server / headless:** capture the same rendered tree via Playwright (headless Chrome) screenshot. The reliability fallback. Record infra implications (Vercel function bundle size, 300 s timeout headroom).

**Metrics captured per (size × browser × path):**

- pass / fail
- output canvas dimensions vs the ~16384 px ceiling
- output blob size (bytes)
- wall-time (seconds)
- visual defects: missing foreignObject cards, web-font fallback (Cormorant / Manrope), tainted or blank photos

**Browser matrix:**

- **Floor (gates the verdict):** desktop Chrome, Safari, Firefox.
- **Degrade-rule data (does not gate):** mobile Safari, Android Chrome.
- Driven via Playwright where possible; manual spot-check where not.

## 6. Decision framework

The verdict is computed by rule, not impression:

| Verdict | Trigger |
|---|---|
| **A-only** — ship client-side, drop the current-view/full-tree split | Client `html-to-image` clears the 100-floor on all three desktop browsers with correct visuals. Because the whole tree is already in the SVG, "current-view" and "full-tree" converge → #60 simplifies to one "Export tree" action. |
| **A-now / B-later** | Client clears the floor but breaks before 200 or on mobile → ship client full-tree now **with the degrade rule**; file a follow-up issue for the server path. |
| **A+B — server required** | Client fails the 100-floor, or has uncorrectable visual defects (missing cards / blank photos) on a target desktop browser → server Playwright path becomes required. Report its infra cost. |

**Product note (required output):** an explicit recommendation on whether #218 / #219 should keep "current-view vs full-tree" as separate modes or collapse to a single "Export tree" action, plus any rescoping the verdict forces on the epic (e.g. a new server-export issue under #60).

## 7. Impact on the epic

The verdict feeds directly back into #60's sub-issues:

- **#218 (PNG)** / **#219 (PDF)** — scope adjusts to single-mode vs dual-mode capture, and to client vs server pipeline.
- **#216 (crossOrigin/CORS)** — the probe confirms whether the `crossOrigin="anonymous"` change is sufficient for taint-free photo capture, or whether the CDN cache interaction bites.
- **#217 (containerRef refactor)** — the probe confirms the SVG-access shape the real export needs.
- Possible **new issue:** server-side export, if the verdict is A+B or A-now/B-later.

## 8. Definition of done

- [ ] Seed script committed; creates the five trees deterministically against local Supabase with photos.
- [ ] Probe harness committed (marked disposable); runs both capture paths and emits the metrics table.
- [ ] Metrics table filled across size × browser × path for at least the floor browsers.
- [ ] Verdict computed against §6 and written into this doc.
- [ ] Product note + epic-rescope recommendations written.
- [ ] Decision-summary comment posted on #215 linking here.
