# Brand decisions — Knot pull-review (2026-05-16)

> Cherry-pick discipline from [ADR 0008](../adrs/0008-design-system.md). Each row records ADOPT / DECLINE / DEFER + rationale.
>
> Source bundle: [`docs/ux/inspiration/knot/project/`](../ux/inspiration/knot/project/) — `theme.css`, `tokens.json`, `logo.svg`, `handoff.md`, `fonts.md` (HTML mockups skipped). Current state of truth: [`src/app/globals.css`](../../src/app/globals.css).

## Identity

| Element | Decision | Rationale |
|---|---|---|
| Brand name | **Keep "meetthefam"** | No public marketing exists yet that ties the brand to Knot. The Knot bundle's `handoff.md` / `fonts.md` headers also call out the prototype as "meetTheFam" — Knot is the bundle's working title, not a competing brand. No ADR 0011 needed. |
| Logomark | **ADOPT — wired in 8a-3** | The three-overlapping-circles mark in [`logo.svg`](../ux/inspiration/knot/project/logo.svg) reads as a family knot (parent / child / partner) without leaning on tree iconography that competes with the canvas. Forest-green strokes + terracotta center dot already match our palette. Wires into top-nav + favicon + metadata in 8a-3. |
| Wordmark | **Keep meetthefam wordmark** | Brand name stays "meetthefam"; Knot ships no wordmark either way. Wordmark treatment (Cormorant 500 small caps vs all-lowercase Manrope) is a Phase 8c (landing/nav) decision, not 8a. |

## Palette

> **Convention used below.** "Adopt — values" means we move our OKLCH numbers to Knot's exact values; we keep our existing token *names* (`--background`, `--card`, `--primary`, `--accent`, `--muted-foreground`) since they're the shadcn/Base-UI contract surface. Knot's `--cream` / `--paper` / `--ink` / `--mid` aliases stay as bundle vocabulary, not new tokens.

| Token | Knot value | meetthefam current | Decision | Rationale |
|---|---|---|---|---|
| `--background` / `--cream` | `oklch(95% 0.015 80)` (#F5EFE3) | `oklch(0.945 0.014 80)` | **ADOPT — values** | Knot is source-of-truth; ~0.5% L lift brightens the page a hair. Within visual-noise threshold but worth aligning on the canonical bundle so 8a-2 dark-mode pairs match the documented `#F5EFE3` hex. |
| `--card` / `--paper` | `oklch(98.7% 0.01 85)` (#FFFCF5) | `oklch(0.99 0.008 85)` | **ADOPT — values** | ~0.3% L drop. Marginal change but worth aligning so paper-on-cream contrast (Knot a11y note: 9.6:1 AAA) is exactly the documented value. |
| `--primary` / `--ink` | `oklch(33.5% 0.04 158)` (#2D4A3E) | `oklch(0.36 0.04 155)` | **ADOPT — values** | ~2.5% L drop deepens the forest green; hue shift 155→158 is imperceptible but matches the documented hex. Knot's contrast budget (ink_on_cream 8.9:1 AAA, paper_on_ink 9.6:1 AAA) is calibrated to these numbers. |
| `--accent` | `oklch(64% 0.10 39)` (#C77B5C) | `oklch(0.65 0.10 40)` | **ADOPT — values** | ~1% L drop, hue 40→39. Below visual-noise threshold; align to the canonical hex `#C77B5C`. |
| `--muted-foreground` / `--mid` | `oklch(46% 0.015 70)` (#6B6358) | `oklch(0.42 0.018 70)` | **ADOPT — values, with note** | **+4% L jump** — larger than the other rows. Knot's value still passes the documented 4.7:1 AA contrast on cream; our darker `0.42` does too. Adopting Knot's lighter `0.46` makes secondary text feel a touch less "shouty" against the warm charcoal `--foreground`. Re-verify contrast in 8a-2 alongside the dark-mode pairs. |
| Five tones (`sage/rose/indigo/amber/green`) | Canonical hex per [tokens.json](../ux/inspiration/knot/project/tokens.json) — `bg`, `ring`, `ink` triplet each | OKLCH approximations of the same hex, already named the same | **ADOPT — values** | Token *names* match; values are OKLCH approximations that drift from the canonical hex. Convert each `--tone-*-{bg,ring,ink}` to its `oklch(from #HEX)` equivalent (decided 2026-05-16 review — keeps OKLCH convention consistent and lets Tailwind v4 manipulate channels). Implementation lands when 8a-2 / 8b-1 next touches the tone tokens — not a separate sub-task. [`docs/ux/avatars-and-tones.md`](../ux/avatars-and-tones.md) already cites Kintree's `TONES` (same hex set as Knot) as canonical — this is a consistency fix, not a redesign. |
| Dark mode (warm-shifted) | `--cream: #1B1814`, `--paper: #241F18`, `--ink: #E8DFD0`, `--accent: #E09376`, `--mid: #9A9081` | shadcn defaults (cool neutral grays) | **ADOPT — 8a-2** | Spec ship gate; shadcn defaults are placeholder. Knot's warm-shift (paper + ink retain the warm cream/charcoal hue family rather than desaturating to gray) is exactly what the heirloom-journal aesthetic demands. |

## Typography

| Token | Knot value | meetthefam current | Decision | Rationale |
|---|---|---|---|---|
| Display | `"Cormorant Garamond", Georgia, serif` (Knot var: `--font-display`) | `--font-serif` (Cormorant Garamond via `next/font` in `src/app/layout.tsx`) | **ADOPT — already aligned** | Same family, same Georgia fallback. Knot's `--font-display` and our `--font-serif` are aliases for the same font; `globals.css` already maps `--font-heading: var(--font-serif)`. No rename — `--font-serif` reads cleaner in shadcn/Base-UI context and is the shadcn convention. |
| Body | `"Manrope", system-ui, sans-serif` (Knot var: `--font-body`) | `--font-sans` (Manrope via `next/font`) | **ADOPT — already aligned** | Same. |
| Weights (display) | 400 italic, 500/600 regular, 500 italic — see [`fonts.md`](../ux/inspiration/knot/project/fonts.md) | All weights loaded by default `next/font` | **ADOPT — load only the 4 weights Knot uses** | Aligns with `fonts.md` italicMin=16px floor + "Cormorant bold 700 too heavy" guidance. Trim payload in 8c (landing) when we audit font subsets. |
| Weights (body) | Manrope 400 / 500 / 600 only — 700 reserved, italic forbidden | All weights loaded by default | **ADOPT — load only 400/500/600** | Same payload-trim follow-up in 8c. Italic Manrope is explicitly off-list per `fonts.md`. |
| Italic whitelist | Pull-quotes, hero kicker, memory bodies — see [`fonts.md`](../ux/inspiration/knot/project/fonts.md) | Same whitelist already encoded in [ADR 0008 § Italic whitelist](../adrs/0008-design-system.md) | **ADOPT — already aligned** | No-op; the whitelist in ADR 0008 already enforces this. |

## Shapes + Shadows

| Token | Knot value | meetthefam current | Decision | Rationale |
|---|---|---|---|---|
| `--radius-xs` | `6px` | n/a | **ADOPT** | New scale step (pills, small chips). |
| `--radius-sm` | `10px` | `calc(var(--radius) * 0.6)` = `4.8px` | **ADOPT — replace** | Drift: our derived `sm` is smaller than Knot's. Knot's 10px reads softer on small surfaces (input borders, badge corners). |
| `--radius-md` | `14px` | `calc(var(--radius) * 0.8)` = `6.4px` | **ADOPT — replace** | Same drift; Knot's md is the card-corner default. |
| `--radius-lg` | `20px` | `var(--radius)` = `8px` | **ADOPT — replace** | Significant drift. Knot's lg is the PersonNode + dialog corner; 20px is the heirloom-journal "rounded card" feel. |
| `--radius-xl` | `24px` | `calc(var(--radius) * 1.4)` = `11.2px` | **ADOPT — replace** | Used by hero panels + bottom-sheet top corners. |
| `--radius-pill` | `999px` | n/a (`2xl/3xl/4xl` derived steps unused) | **ADOPT** | Named alias for pill-shaped buttons + tone chips; replaces the unused `2xl/3xl/4xl` derived steps. |
| Existing `--radius` single value | (Knot has no equivalent) | `0.5rem` (= `8px`) | **DECLINE — remove on 8a follow-up** | The derived `calc(var(--radius) * N)` scale (`sm/md/lg/xl/2xl/3xl/4xl`) in `@theme inline` is what shadcn 3.x ships by default. Replacing with the named 6-step Knot scale is cleaner and removes the multiplier indirection. Note: shadcn primitives that hard-code `rounded-md` / `rounded-lg` classes will pick up the new values automatically (Tailwind reads `--radius-md` / `--radius-lg`). |
| `--shadow-card` | `0 1px 2px rgba(60,40,20,.03), 0 8px 28px rgba(60,40,20,.05)` | no token | **ADOPT** | Card-elevation default. Warm-tinted RGB (`60,40,20`) — desaturated brown — matches the cream palette better than shadcn's default cool-black shadow. |
| `--shadow-node` | `0 1px 2px rgba(60,40,20,.04), 0 4px 12px rgba(60,40,20,.05)` | no token | **ADOPT** | **Bonus token found in [tokens.json](../ux/inspiration/knot/project/tokens.json) but not in the plan template.** PersonNode resting state; gentler than `--shadow-card` so the canvas doesn't fight the connectors. Belongs to 8b-2 (canvas polish). |
| `--shadow-node-hover` | `0 0 0 3px rgba(45,74,62,.12), 0 8px 24px rgba(60,40,20,.10)` | no token | **ADOPT — informs 8b-2 hover affordance** | Forest-green inner ring (3px) + warm shadow halo. The ring uses our primary RGB tinted at 12% — pairs cleanly with the rest of the palette. |
| `--shadow-panel` | `-12px 0 40px rgba(60,40,20,.08)` | no token | **ADOPT** | **Bonus token found in [tokens.json](../ux/inspiration/knot/project/tokens.json) but not in the plan template.** Side-panel / sheet edge shadow (left-of-element direction). Lands in 8b alongside the canvas-side detail panel. |
| `--shadow-fab` | `0 8px 22px rgba(199,123,92,.45)` | no token | **ADOPT — informs FAB** | Terracotta-tinted drop shadow (RGB 199/123/92 ≈ `#C77B5C` = `--accent`). The FAB shadow tints itself the color of the FAB rather than going neutral — small detail, big "designed" feel. Lands in 8b (canvas FAB) and 8c (landing CTA, optionally). |

## Iconography

| Decision | Rationale |
|---|---|
| Hybrid icon set (Lucide for utility + Kintree-extracted brand icons) per [ADR 0008](../adrs/0008-design-system.md) — **stays** | Already adopted; nothing in the Knot bundle argues against it. Knot's own icon set in [`shared.jsx`](../ux/inspiration/knot/project/shared.jsx) is essentially a hand-rolled subset of Lucide-style line icons — duplicative if we adopt both, so we keep Lucide as the utility default. |
| 8a-4 extracts `Branch`, `Leaf`, `Quote`, `Family`, `Sparkle`, `Heart` from **Kintree**, not Knot | Kintree's brand icons are decorative-line style at 1.5px stroke; Knot's icon paths in `shared.jsx` use 1.6px stroke and are functionally identical-looking. Kintree was the original brand-icon source ADR 0008 § Hybrid icon set anchors on — no reason to switch sources. The Knot definitions are a fallback if a specific Kintree icon turns out to be missing. |

## ADR impact

- **ADR 0008** → Light-touch amendment when 8a-1 lands: append a "Brand-decisions follow-up (Phase 8a)" note pointing to this file. Tokens we adopt here (radii, shadows, palette lightness alignment) are *refinements* of ADR 0008's decisions, not reversals — the heirloom-journal direction and hybrid-icon strategy are unchanged.
- **ADR 0011 (NEW)** → **Not needed.** Brand name stays "meetthefam"; Knot is a working title in the inspiration bundle, not a competing identity.

## Open questions to revisit at v0.5+

- **Spacing scale**. [tokens.json](../ux/inspiration/knot/project/tokens.json) ships an explicit 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 px scale. Tailwind v4 already gives us this implicitly. Worth a follow-up audit at v0.5+ to confirm we're not drifting (e.g. ad-hoc `gap-[18px]`).
- **Type scale**. [tokens.json](../ux/inspiration/knot/project/tokens.json) ships a named `xs/sm/base/lg/xl/2xl/3xl/4xl/5xl` size scale (11/12.5/14/16/20/28/34/44/64 px). We currently rely on Tailwind's defaults. Worth aligning post-launch if hero / display copy starts to feel inconsistent.
- **A11y contrast budget**. Knot's `tokens.json` documents target contrast ratios (ink_on_cream 8.9:1 AAA, accent_on_cream 3.4:1 AA-large-only, etc.). Capture these as automated lint targets — a Vitest a11y test that fails the build if a token edit drops a pair below its documented floor.
- **`base-nova` shadcn preset**. CLAUDE.md flags we're on `base-nova` (Base UI, not Radix). When we adopt the Knot radius scale, double-check that the preset's hard-coded component classes (`rounded-md`, `rounded-lg`) pick up the new values — they should via Tailwind utility resolution, but it's worth a smoke test in 8a-2 alongside the dark-mode work.
- **Tweaks panel** ([`handoff.md`](../ux/inspiration/knot/project/handoff.md) flags this as "not for production"). Already covered by ADR 0008 § Declined — no action needed; logged here for future-session searchability.
