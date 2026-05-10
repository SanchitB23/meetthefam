# ADR 0008 — Design system: heirloom journal aesthetic, anchored on the Kintree prototype

**Status:** Accepted
**Date:** 2026-05-11

## Context

Phase 0 sub-task 2 (shadcn/ui init) shipped with a custom heirloom-journal palette and Cormorant Garamond + Manrope fonts (commit `0dd1ae6`). Locking design tokens at init time — rather than starting on a neutral default and retrofitting later — is the only way to keep every component added in Phases 1–7 on-brand by default.

To anchor that direction, the user shared a Claude Design handoff bundle ("Kintree" — `Family Tree Prototype.html` + shared primitives, ~10 screens) at [`docs/ux/inspiration/kintree/`](../ux/inspiration/kintree/). The prototype contains a fully-considered visual language for a family-tree product: palette, typography, component vocabulary (PersonNode, Avatar, Pill, Card, Branch SVG), an icon set, and demo data.

The chat brief that produced Kintree is **not** an exact match for meetthefam's product brief. Adopting it wholesale would inflate scope and bleed Phase 8 visual polish into Phase 0. We need a structured cherry-pick.

## Decision

Adopt Kintree as the **canonical visual reference** (vendored, sanitized — see "Privacy" below). Cherry-pick five elements; explicitly decline four. Each adopted element lands in its natural phase, not Phase 0.

### Adopted

| Element | What | Phase |
|---|---|---|
| **Heirloom palette + fonts** | Cream + paper page bg, forest-green primary, terracotta accent, warm charcoal text; Cormorant + Manrope | Phase 0 — committed `0dd1ae6`; refined to two-tone (`--paper`) + 5 TONES vars in Phase 0 close-out |
| **5-tone Avatar system** | `sage / rose / indigo / amber / green` tinted circles with serif initials, used as photo-fallback. `tone` column on `people`; default auto-assigned via `hash(name) % 5` | Tokens: Phase 0; column: Phase 0 sub-task 4; `<Avatar>` component: Phase 3 |
| **PersonNode card pattern** | Round tinted avatar + serif name + uppercase role + dates + floating terracotta "+" hover affordance | Phase 4 (tree visualization) **with explicit go/no-go gate**: spike family-chart's custom-node API at start of Phase 4. If its layout fights fixed-size custom HTML, fall back to family-chart's default node with our color tokens applied. |
| **Decorative motifs** | Branch SVG section dividers, leaf / quote / sparkle icons, italic Cormorant flourishes (per whitelist below) | Phase 8 (visual polish + landing) |
| **Mobile patterns** | Bottom sheets via shadcn `Sheet` for modal forms, FAB for primary action on tree screen, stacked-card grid on dashboard at mobile breakpoint. **Defer the bespoke bottom-tab-bar decision to Phase 2** — try top-nav-only first, only build the tab bar if mobile feels cramped | Phases 2 / 3 / 4 (per-screen) |
| **Hybrid icon set** | Lucide for functional icons (Mail, LogOut, Trash, Settings, Search…); hand-rolled brand icons in `src/components/icons/` for branch / leaf / quote / family / sparkle / heart, extracted from prototype `shared.jsx` | Brand icons: Phase 8; functional: per-phase |

### Italic whitelist

Italic Cormorant is reserved **only** for these uses:

- Landing-page hero kicker line + section taglines
- Empty-state hero copy ("Your tree starts here.")
- Pull-quotes / memorial dedications on the share-link footer
- Person nicknames inside bios ("*affectionately, Anjali Bua*")

Italic is **off-limits** everywhere else: form labels, buttons, navigation, person names, dates, body copy. Headings use upright Cormorant; body uses Manrope. Reason: italic Cormorant elevates surgically-used moments; used as default it tips the app from "heirloom journal" into "wedding invitation."

### Declined

| Element | Reason |
|---|---|
| **Memory cards** as a first-class feature (`screens-other.jsx`) | Out of v1.0 spec scope. The product is "names + photos + bios + relationships" — memories add a second content type with its own CRUD, RLS, storage path. Reconsider for v2.0. |
| **Timeline + List views** alongside the tree | Out of v1.0 spec. The tree IS the visualization. Adding two more requires UX, state, and routing for value unproven against our user persona. Reconsider post-launch. |
| **Dev-mode tweaks panel** for palette / font hot-swap | Useful in a prototype where exploring palettes IS the goal; we've committed to a palette. Maintaining a dev-only toggle UI is overhead with no ongoing value. |
| **Replacing lucide entirely** with hand-rolled icons | Lucide gives ~1500 icons at zero maintenance cost. Hand-rolling all of them is a maintenance burden. Hybrid (above) keeps the brand-specific six, defaults to lucide for the rest. |

### Seed data (Phase 0 sub-task 4)

Two seeded trees in local dev / QA:

1. **"Smith Family Demo"** — generic 4-generation tree (~12 people), shipped in `supabase/seed.sql`. Editable like any other tree; no UI "demo" distinction (option α). Useful for visual verification, onboarding screenshots, visual regression tests.
2. **Maintainer's personal tree** — for the maintainer's personal-MVP use of v0.1. Seeded **only locally** via gitignored `supabase/seed.local.sql`. Never committed.

**Production seed: neither.** New users start from zero. (A "Try the demo" landing affordance may be reconsidered at v1.0 ship; not now.)

### Privacy: prototype data sanitization

Kintree's `data.jsx` contains the maintainer's actual extended family (real names, multi-generational). When vendored at `docs/ux/inspiration/kintree/`, names are **sanitized to the Smith family**. The data shape (4 generations, partner / children / parents arrays, `tone` field, role labels) is preserved — only personal names change. This keeps the prototype useful as a structural reference without leaking personal data into a potentially-public repo.

## Consequences

- **No token drift across phases.** Every component lands on-brand by default; no "rip and re-skin in Phase 8" pass.
- **Checked-in north star.** Future Claude sessions can grep the vendored prototype for component patterns and demo-data shapes — better than a Figma URL.
- **Phase boundaries respected.** Visual polish stays in Phase 8. Adopting Kintree adds work to *its natural phase*, never to Phase 0.
- **Explicit declined-list prevents re-litigation.** Future sessions seeing the rich prototype don't propose adopting memory cards or timeline views by default.
- **Small plumbing cost**: `tone` column adds a default-assignment trigger or server-action helper to people CRUD.
- **PersonNode locked behind a Phase 4 spike.** Cannot pre-commit to the custom-node design without verifying family-chart's API supports it.
- **~25 KB repo inflation** from vendoring the prototype's relevant files. Acceptable.

## Alternatives considered

- **Adopt Kintree wholesale (all 10 screens).** Massive scope expansion, blurs phase boundaries, builds visual polish before the data layer exists. Rejected.
- **Drop Kintree entirely; design fresh in Phase 8 via the `frontend-design` skill.** Loses the design tokens and component vocabulary that make every Phase 1–7 component on-brand by default. Sets us up for the "rip and re-skin" pass we want to avoid. Rejected.
- **Vendor only a markdown extract of design tokens + component descriptions, not the source files.** Smaller, but loses the ability to grep / copy specific patterns (icons, TONES values, PersonNode prop shape). Rejected — 25 KB is cheap.
- **Keep Bhatnagar family demo data as-is in vendored prototype (not sanitize).** Personal information in a potentially-public repo. Rejected.

## References

- Kintree prototype (vendored, sanitized): [`docs/ux/inspiration/kintree/`](../ux/inspiration/kintree/)
- Inspiration README + per-screen → phase mapping: [`docs/ux/inspiration/README.md`](../ux/inspiration/README.md)
- Avatar tone spec: [`docs/ux/avatars-and-tones.md`](../ux/avatars-and-tones.md)
- Heirloom palette commit: `0dd1ae6` — *feat: shadcn/ui init with heirloom journal theme*
- ADR 0006 — `frontend-design` is for visual polish only: [`./0006-frontend-design-skill-for-visual-polish-only.md`](./0006-frontend-design-skill-for-visual-polish-only.md)
