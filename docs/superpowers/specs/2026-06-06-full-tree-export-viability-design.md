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

- [x] Seed script committed; creates the five trees deterministically against local Supabase with photos.
- [x] Probe harness committed (marked disposable).
- [ ] ~~Metrics table filled across size × browser × path~~ — **deferred** (see §9; blocked then descoped by decision, the qualitative findings answered the product call).
- [x] Verdict computed and written into this doc (§10).
- [x] Product note + epic-rescope recommendations written (§10).
- [ ] Decision-summary comment posted on #215 linking here.

---

## 9. Results (investigation findings, 2026-06-07)

Run controlled, one browser at a time, against the local stack (Docker + Supabase) with a prod `next build` + `next start` (leaner than dev). The exact size × browser ceiling table was **not** completed — the investigation surfaced architecture facts that answered the product call before a ceiling number was needed, and the original large fixtures didn't render (see 9.4). What we proved:

### 9.1 The capture target in the plan was wrong
Person cards + photos are **HTML `div.card_cont` nodes that are siblings of `svg.main_svg`**, not `<foreignObject>` inside it. `svg.main_svg` contains **only the connector-line `<path>`s**. The probe (and the plan's technical sketch) captured `svg.main_svg` → it serialised the lines only, which is why captured dimensions were a constant 2512×1152 and PNG bytes *shrank* as the tree grew. **Any real export must capture the wrapper `div` that holds BOTH the SVG and the cards layer** (`svg.main_svg.parentElement`), not the SVG.

### 9.2 family-chart is NOT viewport-virtualized
When a tree renders correctly, **all reachable nodes mount into the DOM simultaneously** — the hand-authored 56-person "Smith Family Demo" renders 65 `card_cont` + 64 link paths at once. So a full-tree DOM capture *is* feasible in principle; the cards are all present, laid out via a single d3 `<g>` transform inside an `overflow:hidden` viewport. (An earlier hypothesis that cards were viewport-culled was disproved: zoom-out and "fit to screen" did not change the count.)

### 9.3 The capture pipeline mechanically works at small scale
`html-to-image` → blob → `jspdf` ran cleanly for the 25-person tree; PNG produced in ~30–65 ms. No CORS taint surfaced on the synthetic photos in chromium. (Cross-browser correctness — Safari/Firefox foreignObject-vs-HTML, web-font embedding — was not measured.)

### 9.4 The large synthetic fixtures didn't render — root cause found
Export Stress 50/100/200 rendered only **2 nodes** despite well-connected data (e.g. the 200-tree DB has 118 fathers, 162 spouses). Cause: the **#69 show-all transform** (`family-chart-data-show-all.ts`) only injects the synthetic `__super_root__` when there are **≥2 "primary root" couples**; with ≤1 it returns the data unchanged. The generator produced a **single founding couple → 1 primary root → no super-root**, while `FamilyTree` pins `main_id` to the (now non-existent) `__super_root__`, so family-chart's walk reaches almost nothing. Smith Demo renders because it has 6 root families → super-root injected. **This is a fixture artefact, not an app bug for multi-root trees.**

### 9.5 Flagged: possible real single-trunk render bug (independent of export)
Export Stress **25** (single founding couple, no super-root) renders fully, but Export Stress **50** (identical single-trunk structure) renders only 2. Same code path, different outcome by size/shape → the single-ancestral-couple fallback in the #69 path looks **non-deterministic at scale**. A real user building a one-couple-origin tree (very common) could hit a blank/2-node tree. **Recommend a separate investigation issue against #69** — this is a product-rendering risk, not an export concern.

## 10. Verdict

**A-now / B-later.**

- **A (current-view / small-tree export) — viable client-side now.** Cards all render; the `html-to-image` → `jspdf` pipeline works; the only required correction is capturing the **wrapper div** (SVG + cards), not `svg.main_svg`. Trees that fit the viewport (or a "fit to screen" then capture) export fine.
- **B (full-tree, archival-quality export) — needs a dedicated path, not live-chart scraping.** Capturing the live interactive chart is **fragile and tightly coupled** to (a) the d3 zoom/pan transform, (b) the `overflow:hidden` viewport clipping the full layout, and (c) the #69 `__super_root__` rendering. Producing a readable, complete 200-person artefact means either zoom-to-fit (cards become unreadably small at scale) or rendering at full layout size (re-introduces the canvas-dimension/memory ceiling we set out to measure). The robust answer is a **dedicated full-layout renderer** — compute the layout once and render all cards at full size to an offscreen surface, or generate server-side — rather than scraping the on-screen chart.

### Product note (rescope for the epic)
- The #60 "current-view vs full-tree" split is **real and should stay** — they are different efforts, not the same code. Do **not** collapse them.
- **#218 (PNG)** can ship the cheap win first: capture the wrapper div for the visible/fit view. Update its spec to capture `svg.main_svg.parentElement`, not the SVG, and to add a "Fit to screen" step before capture.
- **#219 (PDF)** layers on #218 unchanged in principle.
- **Full-tree archival export is a larger B item** — likely a new issue under #60 for a dedicated/headless full-layout renderer. This **revisits #60's "no server" assumption**: a readable 200-person export may justify a server-side render after all.
- **#216 (crossOrigin/CORS)** is still worth doing but lower urgency — no taint surfaced on synthetic photos in chromium; re-validate with real Supabase URLs cross-browser when #218 builds.
- **Exact memory/canvas ceiling deferred** — measure it inside the B full-layout-renderer spike, where the full tree actually renders at full size.

### Spike disposable-code note
The probe (`src/app/spike/**`), `playwright.config.ts`, `scripts/spike-215/capture-runner.spec.ts`, and the `next.config.ts` / `public-routes.ts` spike hacks are **throwaway** — remove before #218 builds the real feature (see the plan's cleanup contract). `scripts/spike-215/tree-shape.ts` + `synth-photo.ts` + `seed-export-stress.ts` may be reused for #218 testing (the single-trunk topology is fine on real browsers — see §11).

## 11. Correction (2026-06-07) — the "collapse" was a headless artifact

§9.4 / §9.5 reported that large single-trunk trees "render only 2 nodes." A **live QA check on real Chrome disproved this**: a seeded 60-person single-trunk tree on the QA `/share/<token>` route renders the **full tree — 60 cards + 59 links**, laid out across ~4600px × multiple generations. Same code (`de3cc24`, identical to qa).

So the collapse-to-2 reproduced **only under headless Chromium** (Playwright + the local prod build), not on real browsers. Likely the headless layout/measurement path (family-chart sizes cards off hidden "fake" cards via `getBoundingClientRect`, unreliable headless). It is **not a user-facing bug** (#224 re-scoped from "prod blocker" to "headless-only, affects automated export testing").

**Impact on the verdict (still A-now / B-later):**
- The capture-target finding (§9.1 — capture the wrapper div, not `svg.main_svg`) **stands**; it's DOM structure, independent of headless.
- On real browsers **all cards render into the DOM at once** (✓ confirmed at 60) — so full-tree DOM capture is *more* feasible than §9.4 implied; the tree is all there.
- BUT large trees auto-fit-zoom to a tiny scale, so a current-view capture is unreadable at 200, and a readable full capture needs full-layout-size rendering (canvas ceiling) — the **B-path rationale is unchanged**.
- **New constraint for #225:** measure the ceiling in a **headed/real browser**, not headless Playwright, or the measurement itself collapses.

## 12. Correction-of-the-correction (2026-06-07) — §11 was WRONG; the collapse is real on real browsers

§11 attributed the collapse to headless Chromium. That was disproved by loading the **exact local trees in real Chrome** (personal profile, via the extension, against the same local prod build of `de3cc24`):

| tree-shape(n) | real Chrome `.card_cont` | result |
|---|---|---|
| 25 | 25 | renders ✓ |
| 50 | 2 | **collapses** ✗ |
| 60 (the QA tree) | 60 | renders ✓ |
| 100 | 3 | **collapses** ✗ |
| 150 | 3 | **collapses** ✗ |
| 200 | 2 | **collapses** ✗ |

The earlier "QA renders fully" result was **survivorship bias**: the QA fixture happened to be `tree-shape(60)`, one of the topologies that renders. The transform is **identical for all counts** (no `__super_root__` injected, `data[0]` = founding patriarch) — so the difference is purely **family-chart's layout when `main_id` is pinned to a non-existent `__super_root__`** (FamilyTree.tsx:328) and the transform skipped the super-root (single primary root → `family-chart-data-show-all.ts:193`). The fallback walk is **fragile and topology-dependent** — it renders some single-trunk trees fully and collapses others to ~2.

**Net:** #224 is a **REAL, real-browser, user-facing bug** (this code shipped in v1.1 → it's on prod), structure-dependent, hitting many single-ancestral-couple trees — especially larger ones (50/100/150/200 all collapsed in my sample; only 25 and 60 rendered). It **does** affect export (a collapsed tree exports nothing useful), so #224 effectively gates full-value export for affected trees. §11's "headless-only / not a user bug" conclusion is retracted.
