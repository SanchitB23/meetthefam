# Knot brand guide — Claude Design handoff (vendored 2026-05-13)

Second-pass design reference for `meetthefam`, sourced from a [Claude Design](https://claude.ai/design) handoff bundle on **2026-05-13**. The bundle proposes **"Knot"** as the candidate brand name + logo for the project (vs. the existing internal name "meetthefam"). It also re-issues the heirloom-journal token system that ADR 0008 already adopted from the original Kintree prototype — same five-tone palette, same Cormorant + Manrope pairing — but with sharper colour pinpoints (OKLCH definitions in [`project/tokens.json`](project/tokens.json)) and a documented dark-mode set.

This bundle is a **reference for Phase 8 visual polish + landing work**. Nothing here is adopted yet — see the Phase 8 backlog entries in [`../../tasks/phase-backlog.md`](../../tasks/phase-backlog.md) for the cherry-pick / brainstorm queue.

## Re-fetch URL

If you need to pull a fresh copy of this bundle (newer iteration, missing file, etc.):

```
https://api.anthropic.com/v1/design/h/EVFvUDndyAPQpKrIfo3lyw?open_file=Knot+-+Brand+Guide.html
```

The endpoint serves a downloadable `MeetMyFamily-handoff.tar.gz` archive. Use a browser (or Playwright) — the API doesn't respond to plain `curl` GETs.

## What is vendored

| Vendored file | What it is | Why it's here |
|---|---|---|
| [`SOURCE-README.md`](SOURCE-README.md) | Original handoff README from Claude Design | Documents the bundle's intent and the "read transcripts first" convention |
| [`chats/chat1.md`](chats/chat1.md) + [`chats/chat2.md`](chats/chat2.md) | Design chat transcripts (~10 KB total) | **Source of intent** — palette decisions, the "knot" naming exploration, the italic legibility floor, the dark-mode warm-shift policy all trace back here |
| [`project/Knot - Brand Guide.html`](project/Knot%20-%20Brand%20Guide.html) | Primary brand-guide HTML (36 KB) | Palette swatches, type specimens, logo dos/don'ts, voice notes — the canonical visual contract |
| [`project/Logo Explorations.html`](project/Logo%20Explorations.html) + [`v2.html`](project/Logo%20Explorations%20v2.html) | Iteration boards of logo candidates | Reference for which logo direction the design landed on; shape vocabulary (knot / overlapping rings / branch motifs) |
| [`project/logo.svg`](project/logo.svg) | Final logomark (96×96 SVG, 403 B) | The actual asset to wire into `src/components/icons/Logo.tsx` when Phase 8 adopts it. Three overlapping rings + a single terracotta dot — read the SVG directly to inspect. |
| [`project/tokens.json`](project/tokens.json) | Machine-readable design tokens (3 KB) | OKLCH colour pinpoints, tone palette, radii, shadows, spacing, type sizes, **a11y contrast table**. The contrast table is load-bearing — it's how we'll verify the heirloom palette still passes WCAG when Phase 8 lands. |
| [`project/theme.css`](project/theme.css) | Tailwind v4 `@theme` block ready to drop in | Compare against `src/app/globals.css` — token names + values are close but **not identical**; adopt selectively. |
| [`project/fonts.md`](project/fonts.md) | Font loading recipe + weight matrix | Documents the **16 px italic legibility floor** (informs the ADR 0008 italic whitelist), the "no Manrope italic" rule, and the `next/font` config we already follow. |
| [`project/handoff.md`](project/handoff.md) | Per-component integration notes | **Critical**: explicit warnings about wrapping `PersonNode` inside the family-chart layout engine, "mobile screens are concept art not breakpoint variants", and "tweaks panel is not for production." |
| [`project/shared.jsx`](project/shared.jsx) | React-ish primitive components (Avatar, PersonNode, Button, Pill, Card, Icon set) | Component-shape reference for Phase 8 polish. The PersonNode here is a Knot-specific evolution of the Kintree one. |
| [`project/data.jsx`](project/data.jsx) | Demo family data (pre-sanitized placeholder names) | Reference for the people data-shape. **Already sanitized in the source bundle** — Robert Smith / Katherine Smith / Victor Doe / Mary Doe, no real names. |

## What is intentionally NOT vendored

Mirrors the ADR 0008 cherry-pick discipline established for the Kintree bundle:

| File from the original bundle | Why skipped |
|---|---|
| `Family Tree Prototype.html` | 2.5 KB stub; just an import shell — content lives in the screen `.jsx` files we're also skipping. |
| `screens-landing.jsx`, `screens-dashboard.jsx`, `screens-tree.jsx`, `screens-profile.jsx`, `screens-other.jsx`, `screens-mobile.jsx` | 11–16 KB each, ~85 KB total. Heavy screen-level compositions. Pattern is fully captured by the primitives in [`shared.jsx`](project/shared.jsx) plus the Brand Guide HTML. |
| `design-canvas.jsx` (48 KB) | All-screens-side-by-side canvas; only useful when running the prototype in a browser. |
| `tweaks-panel.jsx` (26 KB) | Dev-mode palette/font hot-swap UI. **Explicitly declined** in [ADR 0008](../../adrs/0008-design-system.md) for the same reason as the Kintree version. |
| `app.jsx` (18 KB) | Canvas orchestrator; not a reusable pattern. |
| `.design-canvas.state.json` | Build artefact. |

> Because the screen `.jsx` files aren't vendored, [`Knot - Brand Guide.html`](project/Knot%20-%20Brand%20Guide.html) and the logo exploration HTMLs **will not render** in a browser as-is. That's intentional — this is a code/asset reference, not a runnable mockup. Open the HTML source directly to read it, or re-fetch the source bundle via the URL above and run it locally.

## Adoption candidates (to brainstorm at Phase 8 kick-off)

Stubs — fill at Phase 8 brainstorm. Mirror the ADR 0008 "Adopted / Declined" tables for consistency.

### Adopted

- *(TBD)*

### Declined

- *(TBD)*

### Open questions

- Does the **"Knot" name** become the public-facing brand, or stay an internal mood-name like "Kintree" did? If yes, every `meetthefam` user-facing string needs an audit.
- The bundle's `--color-mid` (mid-grey body secondary) doesn't have a current counterpart in our globals — our `--muted-foreground` is close but not the same OKLCH. Worth a side-by-side.
- The bundle ships a **warm-shifted dark-mode palette** (`.dark` block in `theme.css`); we currently use shadcn defaults for dark mode (placeholder). Phase 8 is the natural time to adopt the warm-shifted set.

## Privacy / sanitization note

The source bundle's `data.jsx` ships with placeholder names already (per its file-header comment: "PRIVACY: never commit real names into a public bundle"). No further sanitization performed during vendoring. If a future re-fetch returns a bundle with real names, sanitize before merging — see [ADR 0008 → "Privacy: prototype data sanitization"](../../adrs/0008-design-system.md).

## See also

- [ADR 0008 — Design system](../../adrs/0008-design-system.md) — the canonical cherry-pick policy this bundle should be evaluated against.
- [`../kintree/README.md`](../kintree/README.md) — the original (first-pass) inspiration bundle. Knot is the second-pass refinement.
- [`../avatars-and-tones.md`](../avatars-and-tones.md) — the existing tone system Knot proposes minor refinements to.
