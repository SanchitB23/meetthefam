# UX inspiration

Vendored design references that anchor the project's visual direction. Loaded by phase-specific UX work (especially Phase 8 — visual polish + landing).

## Bundles

### `kintree/` — Claude Design handoff prototype (canonical visual reference)

A 10-screen interactive prototype produced by [Claude Design](https://claude.ai/design) and shared as the project's design north star. The full bundle was downloaded in May 2026; **only the reusable subset is vendored here** — primitives, demo data, and design intent — not the screen-by-screen implementations.

| Vendored file | What it is | Why it's here |
|---|---|---|
| [`kintree/SOURCE-README.md`](kintree/SOURCE-README.md) | Original handoff README from Claude Design | Documents the bundle's intent and conventions |
| [`kintree/chats/chat1.md`](kintree/chats/chat1.md) | Design chat transcript | The "**aesthetic** + **type** + **layout**" decisions originate here. The italic flourish whitelist in [ADR 0008](../../adrs/0008-design-system.md) was distilled from this transcript. |
| [`kintree/project/Family Tree Prototype.html`](kintree/project/Family%20Tree%20Prototype.html) | Entry HTML — fonts + CSS variables | **Source of truth for the heirloom palette, font stack, and CSS-variable structure.** The `:root` block here is what `src/app/globals.css` mirrors (in OKLCH). |
| [`kintree/project/shared.jsx`](kintree/project/shared.jsx) | Inline-SVG `Icon` set + `Avatar`, `PersonNode`, `Pill`, `Button`, `Card`, `Branch` primitives | Reference shape for the components we'll build per phase. The 40+ inline SVG icons here are the source for the hand-rolled brand icons (`Branch`, `Leaf`, `Quote`, `Family`, `Sparkle`, `Heart`) we'll extract in Phase 8 — see ADR 0008 → "Hybrid icon set." |
| [`kintree/project/data.jsx`](kintree/project/data.jsx) | **Sanitized** Smith / Anderson family across 4 generations + memories + invites + `TONES` palette | Reference for the people-table data shape, the family-chart wire-format, and the 5 `TONES` values consumed by [`../avatars-and-tones.md`](../avatars-and-tones.md). **Personal names sanitized per ADR 0008.** |

### What's intentionally NOT vendored

| File from the original bundle | Why we skipped it |
|---|---|
| `screens-landing.jsx`, `screens-dashboard.jsx`, `screens-tree.jsx`, `screens-profile.jsx`, `screens-other.jsx`, `screens-mobile.jsx` | Heavy screen-by-screen implementations. Pattern is fully captured by the primitives in `shared.jsx` plus the prototype HTML's `:root` tokens. |
| `design-canvas.jsx` | The "all 10 screens side-by-side" canvas — only useful if rendering the prototype in a browser. |
| `tweaks-panel.jsx` | A dev-mode palette/font hot-swap UI. Explicitly **declined** in ADR 0008. |
| `app.jsx` | Orchestrator for the canvas; not a reusable pattern. |

> **Note**: because the screen `.jsx` files aren't vendored, [`Family Tree Prototype.html`](kintree/project/Family%20Tree%20Prototype.html) **will not render** in a browser as-is. That's intentional — this is a code reference, not a runnable mockup. To view the original prototype, re-fetch the source bundle at `https://api.anthropic.com/v1/design/h/hVKZ3pFfyYxtkMv_fFQoUA?open_file=Family+Tree+Prototype.html`.

### `knot/` — Claude Design handoff (second-pass refinement, candidate brand name)

A second design pass dropped on 2026-05-13, proposing **"Knot"** as the candidate brand/logo direction and refining the heirloom token system. Subset-vendored alongside Kintree — see [`knot/README.md`](knot/README.md) for the full file inventory + adoption-candidate stubs. **Nothing here is adopted yet** — Phase 8 picks the cherry-list at kick-off (per the same ADR 0008 discipline applied to Kintree).

Notable additions vs. the Kintree bundle:
- A documented `tokens.json` with OKLCH pinpoints + a WCAG contrast matrix.
- A `theme.css` with `.dark` warm-shifted dark-mode tokens (we currently use shadcn defaults).
- A `logo.svg` (96×96, ~400 B — three overlapping rings + a terracotta dot).
- Per-component `handoff.md` callouts (e.g. wrapping `PersonNode` inside the family-chart layout engine).

## Per-screen → phase mapping

Each Kintree screen maps to a phase where the equivalent meetthefam surface gets built. The prototype acts as the visual target; the implementation lives in `src/`.

| Kintree screen (in original bundle) | meetthefam phase | Implementation surface |
|---|---|---|
| Landing | Phase 8 | `src/app/page.tsx` (replace create-next-app boilerplate) |
| Onboarding | Phase 1 | Magic-link auth flow + post-signup redirect |
| Dashboard ("my trees") | Phase 2 | `src/app/dashboard/page.tsx` |
| **Tree** view | Phase 4 | `src/app/tree/[id]/page.tsx` + family-chart wrapper |
| Timeline view | **Declined** (ADR 0008) | — |
| List view | **Declined** (ADR 0008) | — |
| Profile drawer | Phase 3 | Bottom-sheet via shadcn `Sheet` |
| Add Relative | Phase 3 | Bottom-sheet form |
| Memory | **Declined for v1.0** (ADR 0008) | — |
| Invite | Phase 6 | Collaborator invite form + accept route |
| Privacy / share-link | Phase 7 | `src/app/share/[token]/route.ts` |
| Mobile variants | Phases 2–4 | Tailwind responsive variants on each above |
| Empty states | Phase 8 | Per-screen empty/loading/error states |

## When to consult this directory

- **Before any Phase 8 visual-polish work** — the prototype is the target. Don't invent a new aesthetic.
- **Before adding a `<Avatar>`, `<PersonNode>`, or any tree-card component** — match the prop shape and visual treatment from `shared.jsx`.
- **Before adding a brand icon** (branch, leaf, quote, family, sparkle, heart) — port the SVG path data from `shared.jsx` rather than searching lucide for an approximation.
- **When seeding demo data** in Phase 0 sub-task 4 — `data.jsx` is the canonical structure for the "Smith Family Demo" tree.

## Out of scope

- **Live browsable prototype** — see the note above. If we ever need a fully runnable in-repo mockup, we'd vendor the missing screen files at that point.
- **A Figma file** — we don't maintain one. The vendored code IS the design source of truth.
