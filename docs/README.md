# meetthefam — docs

This directory is the project's knowledge base. Each doc is small and focused so a Claude Code session can load only what it needs.

## Quick map

```
docs/
├── specs/            Canonical product + technical spec
├── architecture/     System shape, data model, auth/RLS, photo upload, share links
├── ux/               Page-by-page UX, gestures, family-chart integration
├── adrs/             Architecture Decision Records (why each non-obvious call was made)
├── dev/              Operational guides: git workflow, release recipe (the how)
├── setup/            Environment setup notes (MCP servers, Dependabot config)
├── qa/               QA smoke-flow catalog
└── tasks/            Living task tracker for the current phase
```

## When to read what

| If you're working on… | Read first |
|---|---|
| Anything | [`tasks/current-phase.md`](tasks/current-phase.md) — know what phase we're in. Cross-check [`tasks/phase-backlog.md`](tasks/phase-backlog.md) for phase-specific TODOs (Next.js 16 idioms, View Transitions, Devtools MCP). |
| Cutting a feature branch / opening a PR | [`dev/git-workflow.md`](dev/git-workflow.md) (recipe) + [`adrs/0010-feature-branch-workflow.md`](adrs/0010-feature-branch-workflow.md) (rationale). |
| Cutting a release | [`dev/releases.md`](dev/releases.md) (recipe) + [`adrs/0009-versioning-and-releases.md`](adrs/0009-versioning-and-releases.md) (rationale). |
| Next.js 16 conventions (async params, `proxy.ts`, `updateTag()`, `refresh()`) | [`adrs/0007-nextjs-16-and-async-idioms.md`](adrs/0007-nextjs-16-and-async-idioms.md) |
| The DB schema, migrations, RLS | [`architecture/data-model.md`](architecture/data-model.md) + [`architecture/auth-and-rls.md`](architecture/auth-and-rls.md) |
| Auth flows | [`architecture/auth-and-rls.md`](architecture/auth-and-rls.md) |
| Photo upload | [`architecture/photo-upload.md`](architecture/photo-upload.md) |
| Share link / `/share/[token]` | [`architecture/share-link.md`](architecture/share-link.md) |
| Pages / routing | [`ux/pages-and-routes.md`](ux/pages-and-routes.md) |
| Tree view canvas, family-chart wiring | [`ux/tree-view.md`](ux/tree-view.md) |
| Add / edit / link person flow | [`ux/add-edit-person.md`](ux/add-edit-person.md) |
| Mobile gestures (tap, long-press, pan, zoom) | [`ux/mobile-gestures.md`](ux/mobile-gestures.md) |
| "Why was this decision made?" | [`adrs/`](adrs/) |
| Full context | [`specs/2026-05-10-family-tree-design.md`](specs/2026-05-10-family-tree-design.md) |

## Updating docs

- Architecture / UX docs are lossy summaries of the spec. If they drift from the spec, the **spec is the source of truth** until both are reconciled.
- New decisions worth recording → write a new ADR (`adrs/NNNN-<slug>.md`, increment NNNN).
- Phase changes → update `tasks/current-phase.md` only; don't archive prior phases here (git history is enough).
