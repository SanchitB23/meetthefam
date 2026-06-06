# Spike #214 — layout-engine findings: dagre vs d3-dag

> Findings doc for [#214](https://github.com/SanchitB23/meetthefam/issues/214).
> Decision gate for [#200](https://github.com/SanchitB23/meetthefam/issues/200) (impl, backlog).
> Authored 2026-06-06. Artifacts in `scripts/spike-214/out/`.
> Design/approach doc: `docs/superpowers/specs/2026-06-06-issue-214-layout-engine-spike-design.md`

---

## 1. Verdict

**Conditional go on dagre (`@dagrejs/dagre@3.0.0`) as the layout engine for #200, with a hard human gate on the compactness question.**

The union-node encoding works cleanly: both engines render all 55 people exactly once with zero duplicates. That is the clear win — it eliminates the structural floor of option d' (8 duplicate cards from cross-subtree marriages) in a principled way.

However, the compactness gate is ambiguous:

- dagre produces a **4984 × 966 px** bounding box (aspect 5.16) — slightly wider and shallower than option d'.
- d3-dag produces a **3964 × 1130 px** bounding box (aspect 3.51) — ~20% narrower but ~17% taller. Marginally better overall, but still a wide horizontal strip, not a compact "portrait" layout.
- Neither engine delivers dramatically more compact output than option d''s 5-subtree-wide strip.

**dagre passes gate #1 (maintenance health) decisively.** d3-dag passes it too but with more caveats (much lower download volume; API is more volatile across versions).

**Gate #2 (compactness) is ambiguous** — neither engine is dramatically better than d'. The question for the human gate: is eliminating 8 duplicate cards worth an L-effort rebuild even if the layout shape stays roughly as wide? If yes, dagre is the right pick. If layout compactness is the primary motivation (and not duplicate removal), neither engine solves the problem without additional layout-tuning work.

If the answer is "go": **use dagre 3.0.0**, not d3-dag. Reasoning: 44× more weekly downloads, stable classic API, bundled types, 95× faster layout (18ms vs 1701ms), and the API is already familiar from the POC harness. d3-dag's `decrossOpt()` is exponential — it would need a swap to `decrossTwoLayer()` at 200-person trees, adding maintenance burden.

---

## 2. Metrics table

| Engine | Version | People rendered | Duplicates | All once? | Width (px) | Height (px) | Aspect | Layout time |
|---|---|---|---|---|---|---|---|---|
| **option d' baseline** | family-chart 0.9.0 | 55 / 55 | **8** | no | ~wide strip | — | ~5× wide | ~18ms |
| `@dagrejs/dagre` | 3.0.0 | 55 / 55 | **0** | yes | 4984 | 966 | 5.16 | **18ms** |
| `d3-dag` | 1.2.1 | 55 / 55 | **0** | yes | 3964 | 1130 | 3.51 | 1701ms |

Notes:
- Option d' width is qualitative (five Gen-1 subtrees side by side); exact pixel count was not instrumented.
- Both new engines used the union-node encoding (55 person nodes + 18 union nodes, 72 edges, acyclic DAG).
- d3-dag layout time of 1701ms is dominated by `decrossOpt()` (exponential crossing minimization). At 200 people this would become prohibitive; `decrossTwoLayer()` would be required in production.

---

## 3. Engine health matrix

| | `@dagrejs/dagre` | `d3-dag` |
|---|---|---|
| **npm latest** | 3.0.0 | 1.2.1 |
| **npm last publish** | 2026-03-22 | 2026-04-14 |
| **GitHub last push** | 2026-03-22 | 2026-04-14 |
| **Latest GitHub release** | v2.0.0 (2025-11-23) — v3.0.0 is a tag-only publish, no formal GitHub release | v1.2.1 (2026-04-14) |
| **npm weekly downloads** | **2,698,238** | 61,281 |
| **GitHub stars** | 5,663 | 1,510 |
| **Open issues** | 174 | 3 |
| **Archived?** | No | No |
| **License** | MIT | MIT |
| **TS types** | Bundled — `dist/types/index.d.ts` (via `package.json#types`) | Bundled — `dist/*.d.ts` |
| **Maintenance verdict** | **Healthy / high-confidence.** Actively developed (three major versions since 2025-11), 2.7M weekly downloads, 174 open issues reflects wide usage not neglect. v3.0.0 published March 2026 is the current stable. | **Healthy / lower-confidence.** Smaller but active: 3.0.0 maintainer-run, 3 open issues (low noise), April 2026 patch. Low downloads (61K/wk) mean fewer eyes, potentially slower ecosystem fixes. |
| **Gate #1** | PASS | PASS (conditional — track if API volatility continues) |

Additional notes:

- **dagre v3.0.0 vs v2.0.0 GitHub release gap:** `v3.0.0` is present as a git tag but the GitHub Releases page only lists `v2.0.0` as the latest formal release (2025-11-23). The v3.0.0 npm publish (2026-03-22) followed three incremental pre-release versions (2.0.1, 2.0.3, 2.0.4). The npm `latest` dist-tag correctly points to 3.0.0. This is a minor packaging hygiene issue, not a maintenance red flag — the commit history is active and the npm publish is the authoritative distribution channel.
- **d3-dag API stability:** The library went through a significant API churn between 0.x and 1.x (complete redesign). The 1.2.x series appears stable. The `graphConnect()` + `sugiyama()` pipeline used in the POC is the current documented API.

---

## 4. What the POC proved

1. **Union-node encoding eliminates duplicates in both engines.** Each spouse pair becomes a synthetic union node; both spouses have outgoing edges to the union node; the union node has outgoing edges to children. A person who is both a child (in one family) and a spouse (in another) is a single DAG node with both in-edges and out-edges. The acyclic constraint holds on the full 55-person seed — no cycle violations detected.

2. **The acyclic DAG holds on the real seed.** The union-node transform produces a graph with 55 person nodes + 18 union nodes + 72 edges. Both engines accepted it without errors.

3. **55 / 55 people rendered exactly once in both engines.** The 8 cross-subtree-marriage duplicates from option d' (Robert↔Susan, Catherine↔James, Andrew↔Beth, Helen↔Marcus) all resolve to single nodes under union-node encoding.

4. **d3-dag is ~20% narrower but ~17% taller than dagre, and 95× slower.** At 55 people the 1.7s d3-dag layout time is academic for interactive use. At 200 people, `decrossOpt()`'s exponential complexity would make this blocking — a production build would require `decrossTwoLayer()` instead, which trades crossing-minimization quality for speed.

5. **Neither layout is dramatically more compact than option d'.** Both produce wide horizontal strips (aspect ratios 3.5–5.2). The compactness improvement is marginal, not transformational. If a vertically-oriented or "portrait" layout is a product goal, neither engine achieves it with default settings — that would require layout-tuning work (custom node sizes, gap parameters, or a different layout algorithm like Coffman-Graham).

---

## 5. Strategy sketch for the #200 rebuild (IF go)

This section assumes the human gate votes "go". These are framing notes for the #200 implementation plan, not implementation here.

**Data layer (union-node encoding — the easy part):**
The POC harness proves the encoding works. The #200 implementation would need a production `transformToUnionNodeDAG(PersonRow[]) → { nodes, edges }` function — a clean split from the existing `transformToFamilyChartShape`. No DB schema changes required.

**What the rebuild must own (the hard parts):**

| Concern | Current owner | #200 must provide |
|---|---|---|
| **Link drawing** | `family-chart` (~2300 lines) — draws marriage bars, parent→child stepped paths, spouse connectors | Custom SVG/canvas renderer. At minimum: horizontal marriage bars between spouse pairs, vertical step-paths from union node down to children, horizontal connectors from union node to each spouse. |
| **d3-zoom pan / zoom** | `family-chart` owns the `d3.zoom` instance, re-center logic (`f3.handlers.cardToMiddle`), zoom-to-fit (`chart.fit()`), and the `#p=<id>` hash-driven focus. All of #187's "Zoom to fit" + "Re-center here" + "duplicate jump" flows depend on this. | Must implement `panCameraTo(id)`, `zoomToFit()`, and focus-by-id — either porting family-chart's d3-zoom wiring or rebuilding it. |
| **Transition + entry-animation lifecycle** | `family-chart`'s `setTransitionTime`, `setAfterUpdate`, `setBeforeUpdate` hooks. #187 shipped entry animations keyed to these. | Must implement transition lifecycle (or accept static/no-animation render). |
| **React component integration** | `FamilyTree.tsx` wraps `family-chart` via imperative API (`f3.createChart`, `updateData`, `updateMainId`). | New imperative or declarative wrapper. The card-body HTML (`person-node-html.ts`) can likely be reused — it's pure DOM templating. |

**Card-body reuse:** The existing `person-node-html.ts` (photo + name + bio + 3-dot action menu) is pure DOM templating and not tightly coupled to family-chart's layout math. It should survive the engine swap with minimal changes.

---

## 6. Effort re-estimate for #200

Original estimate: **L = 3–5 days**.

The POC confirms: the layout engine selection is a 1–2 hour decision, not a sprint. The bulk of #200 is rebuilding the three concerns above (link drawing, zoom/pan, transition lifecycle).

Revised estimate: **L = 4–7 days**, broken down roughly:

| Sub-task | Effort |
|---|---|
| Union-node data transform (prod-quality) | 0.5 day |
| dagre integration + positioned node/union-node coordinate extraction | 0.5 day |
| Link renderer (marriage bars + step paths + spouse connectors) | 1.5–2 days |
| d3-zoom re-implementation (pan, re-center, zoom-to-fit, `#p=` hash) | 1–1.5 days |
| Transition lifecycle (entry animations, `setAfterUpdate` equivalents) | 0.5–1 day |
| React wrapper + FamilyTree.tsx wiring | 0.5 day |
| Tests + QA smoke | 0.5–1 day |

The original L estimate was directionally correct but the lower bound (3 days) assumed the link-drawing and zoom work were lighter than they are. 4–7 days is a more honest range; the high end triggers if the transition lifecycle is rebuilt to match #187's quality bar rather than dropped.

---

## 7. Open question for the human gate

**Core question:** The union-node encoding demonstrably eliminates the 8 duplicate cards. Is that worth a 4–7 day L-rebuild when:

- The resulting layout shape (wide horizontal strip, aspect ~3.5–5.2) is not meaningfully more compact than option d'.
- Option d' ships 55 / 55 unique people; the 8 duplicates are navigable via the ↑ badge jump (already shipped in #69).
- The rebuild replaces family-chart's battle-tested link-drawing and zoom stack with custom code that must be re-verified.

**Secondary question (if "go"):** The wide-layout problem is independent of duplicate removal. If the layout is still wide after the rebuild, the user experience on mobile is roughly equivalent. Is that acceptable, or should layout compactness be a co-requirement of #200 (raising effort further)?

**Possible outcomes:**

| Gate vote | Implication |
|---|---|
| **Go, as-is** | Proceed with dagre rebuild. Accept wide layout; file layout-tuning as a follow-up. |
| **Go, but solve compactness too** | Requires layout-tuning work (gap/nodeSize tuning, sub-tree collapsing, or Coffman-Graham). Add ~1–2 days. |
| **No-go for now** | Keep option d'. The 8 duplicates are the hard structural floor; the ↑ badge navigation mitigates UX friction. Revisit at v1.2 if users report confusion. |
| **Conditional** | Spike a "portrait-mode" layout config before committing to the rebuild. Half-day investment to answer the compactness question more concretely. |

---

## 8. Reproduction

```sh
# In the spike worktree:
cd /path/to/.claude/worktrees/spike-214-layout-engine
nvm use            # Node 24 (per .nvmrc)
pnpm exec tsx scripts/spike-214/run.ts
```

Artifacts written to `scripts/spike-214/out/`:
- `metrics.json` — per-engine numbers (the source of truth for §2 above)
- `dagre.svg` — static SVG of the dagre layout
- `d3dag.svg` — static SVG of the d3-dag layout

The harness parses `supabase/seed.sql` directly — no running Supabase stack required.
