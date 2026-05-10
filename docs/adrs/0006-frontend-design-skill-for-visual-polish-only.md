# ADR 0006 — `frontend-design` skill is for visual polish only

**Status:** Accepted
**Date:** 2026-05-10

## Context

The Claude Code `frontend-design` skill is tuned to generate distinctive, production-grade React + Tailwind UI — explicitly avoiding generic AI aesthetics like "rounded card on a gradient." It's a strong tool, but it isn't free: each invocation costs more tokens and time than a normal Claude Code edit. Where do we use it, and where don't we?

## Decision

Use the `frontend-design` skill **only at the visual polish stage** — Phase 8 in the spec. Use it for:

- Tree-view canvas styling and person cards
- Bottom-sheet design and animations
- Landing page hero
- Empty / loading / error states
- Pre-launch polish on the dashboard

Do **not** use it for:

- Schema, migrations, RLS — pure SQL
- Auth flows — utility code, not visual design
- Server Actions, business logic — not visual at all
- Initial component scaffolding — Claude Code handles it; design-fidelity matters at polish, not on a placeholder.

## Consequences

- **Build function first, polish at the end.** Phases 0–7 produce a functional app with default-styled components. Phase 8 is where design judgement gets applied to specific surfaces.
- **No mid-build aesthetic re-treads.** We don't redesign the dashboard three times during the build — once is enough.
- **Token cost stays predictable.** The expensive sessions cluster in Phase 8.

## Alternatives considered

- **Use `frontend-design` from day 1, designing each component as we build it.** Higher quality at every step, but slows everything and risks throwing away polish when the underlying flow changes. Net negative for this scope.
- **Don't use `frontend-design` at all — let Claude Code handle visuals as part of normal edits.** Cheaper, but produces forgettable UI. The "meet-the-family" use case lives or dies on polish; this is exactly where it's worth spending.
