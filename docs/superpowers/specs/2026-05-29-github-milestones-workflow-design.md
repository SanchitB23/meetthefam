# Design: GitHub milestones + issues as the single planning source of truth

> **Status**: Approved 2026-05-29. Supersedes the in-repo "Phase N + Wave A–F" planning model.
> **Spec type**: Process / workflow redesign (no product or schema change).
> **Author**: brainstorming session 2026-05-29.

## Problem

The project has carried **two parallel planning models** that drifted apart:

1. **In-repo task docs** — `docs/tasks/current-phase.md` (~106 KB) and
   `docs/tasks/phase-backlog.md` (~65 KB): a fine-grained **Phase 0→12 + Wave A–F**
   model, hand-maintained, version-anchored, ticked per sub-task.
2. **GitHub milestones** — a coarse **version-line** model: `v0.4 — Phase 8 polish`,
   `v1.0 — Launch`, `v1.1 — Post-launch polish`, `v1.2 — Export & archival`.

Symptoms of the drift at the time of writing:

- `v0.4 — Phase 8 polish` milestone still **open** with 0 open issues, despite v0.4.0
  having shipped 2026-05-18.
- **No `v0.5` milestone** exists even though v0.5.0 shipped 2026-05-29.
- Five open issues (#86, #85, #74, #119, #120) have **no milestone** assigned.
- A "2026-05-22 restructure" shifted every phase number by 1, requiring scattered
  "phase numbers past 9 shifted by 1" caveats throughout the docs.

The root cause is maintaining a **parallel artifact** (the phase docs) alongside the
GitHub state. Every sub-task required ticking the doc *and* updating issues/milestones;
when the two fell out of step, neither was trustworthy.

## Goal

Move **fully** to the GitHub-native model: **milestones + issues are the single source
of truth** for what we're working on and what gates a release. Retire the phase docs and
the automation built to keep them in sync.

## Decisions

### D1 — Milestone model: one milestone per cycle

Each working cycle (what a "phase" used to be) is **one GitHub milestone**, named by the
version it ships: `v1.0 — Launch`, `v1.1 — Post-launch polish`, `v1.2 — Export & archival`.

- **The current cycle is the nearest open milestone — the lowest open version number.**
  "What am I working on?" → open issues in that milestone. Future cycles (`v1.1`, `v1.2`, …)
  may also be open at the same time, acting as forward backlog buckets; they become "current"
  only once every earlier milestone has closed.
- **Ship gate = milestone closes when it has zero open issues.** The milestone description
  carries the human-readable gate summary; the issue set carries the actual checklist.
- Issues are the unit of work. Each issue gets a milestone + labels. Epics (e.g. the
  verification matrix #86) hold internal checklists.
- The "Phase N + Wave A–F" model is retired. Its history is preserved in the archived
  docs (see D3), not maintained going forward.

### D2 — Milestone reconciliation (concrete GitHub cleanup)

| Action | Target | Reason |
|---|---|---|
| **Close** | `v0.4 — Phase 8 polish` (#1) | v0.4.0 shipped 2026-05-18; 0 open issues |
| **Keep + rewrite description** | `v1.0 — Launch` (#2) | This is the current open cycle. Description encodes the ship gate: SMTP (#25), legal pages (#56), magic-link template (#61), verification matrix (#86), `typecheck/lint/test` clean, release cut |
| **Triage orphan issues** | see table below | Five open issues have no milestone |

Orphan-issue triage (proposed; confirm during execution):

| Issue | Milestone | Rationale |
|---|---|---|
| #86 verification matrix (epic) | **v1.0** | Pre-launch gate |
| #85 CI `pnpm test` workflow | **v1.1** | Infra hardening, not launch-blocking |
| #74 `<ViewTransition>` (blocked on React stable channel) | **v1.1** | Post-launch enhancement |
| #119 tree settings unified sheet | **v1.1** | Post-launch polish (matches milestone description) |
| #120 tree-nav animation spike | **v1.1** | Post-launch enhancement |

**No backfill** of already-shipped cycles (v0.1 / v0.2 / v0.3 / v0.5): no open work, and
the history lives in the archived doc. *(Optional, deferred unless requested: create +
immediately close empty milestones for a complete version ledger.)*

### D3 — Retire the docs; lift the live rules first

- Create `docs/archive/`.
- Move `current-phase.md`, `phase-backlog.md`, and `phase-8-resume-prompt.md` there, each
  with a one-line header marking it **frozen / historical — superseded by GitHub
  milestones (this spec)**.
- **Before archiving**, lift the still-live **Standing rules** out of `phase-backlog.md`
  into durable homes so they survive:
  - **`await cookies()` / `await headers()` discipline** → CLAUDE.md "Code" conventions
    (already cites ADR 0007).
  - **"No prod DB / Vercel-config changes pre-v1.0"** → CLAUDE.md, rephrased
    milestone-relative ("until the `v1.0 — Launch` milestone closes"), pointing at
    `docs/dev/prod-readiness.md` and memory `feedback_no_prod_changes_pre_v1.md`.

### D4 — Retire the sync machinery

- Delete the **`task-doc-keeper`** agent (`.claude/agents/task-doc-keeper.md`).
- Delete the **`task-doc-tick-detector.sh`** hook and its `.claude/settings.json` wiring.
- Leave `db-commit-detector.sh` / `supabase-validator` untouched — confirmed no task-doc
  coupling.

### D5 — Branch + PR conventions (issue-anchored)

- New branch convention: **`feat/<issue#>-slug`** (e.g. `feat/56-legal-pages`).
  Type prefix mirrors the Conventional Commit type (`feat/`, `fix/`, `chore/`, `docs/`,
  `refactor/`, `test/`, `style/`).
- **One branch → one issue → one PR**, with `Closes #N` + milestone set on the PR/issue.
- The promotion chain is unchanged:
  `feat/* → qa → release/vX.Y.Z → main → production`. `release/vX.Y.Z` remains the only
  branch into `main`.
- Sync discipline is now purely PR-side: `Closes #N` (per existing
  `feedback_link_closing_issues_in_pr.md`) + milestone assignment. No in-repo doc tick.

### D6 — Doc / README / CLAUDE.md rewrites

- **CLAUDE.md**:
  - "Where to look first" → the open GitHub milestone (= current cycle) replaces
    `docs/tasks/current-phase.md`.
  - "Project subagents" → drop `task-doc-keeper`.
  - "Phasing at a glance" → "Milestones at a glance", pointing at GitHub milestones.
  - "Git workflow" → issue-anchored branch naming.
  - "Code" conventions → absorb the two lifted standing rules (D3).
- **README.md** (line 12) → repoint "Current phase tasks" from `current-phase.md` to the
  GitHub milestones page.
- **Historical superpowers plans/specs** (phase-named, e.g.
  `2026-05-20-phase-9-pre-prod.md`) stay as-is — frozen execution artifacts. New plans/specs
  anchor to milestones/issues.

### D7 — ADRs

- **New ADR 0011 — "GitHub milestones + issues as planning source of truth"**: records the
  *why* (kill the parallel-artifact drift), the one-milestone-per-cycle model, doc
  archival, and machinery retirement. Supersedes the planning portions of the phase model.
- **Amend ADR 0010** (feature-branch workflow) for issue-anchored branch naming, noting the
  inversion of the earlier "phase-branch as default" stance.

### D8 — Memory updates

- Rewrite `feedback_update_tasks_before_commit.md` → an **issue-reference rule** (reference
  the issue in the closing commit; `Closes #N` on the PR), or fold it into
  `feedback_link_closing_issues_in_pr.md` and delete the former.
- Update `feedback_feature_branch_workflow.md` → issue-anchored branches; drop
  "phase-branch as default."

## Out of scope

- Product, schema, or RLS changes — none.
- Backfilling closed/empty milestones for shipped cycles (optional, deferred).
- Rewriting historical superpowers plans/specs or ADRs other than 0010/0011.
- GitHub Projects board (considered and rejected in favor of milestone-as-cycle simplicity).

## Success criteria

1. The **nearest open milestone** (lowest open version) represents the current cycle; its
   open-issue set is the live work list and its closure is the ship gate. Future-version
   milestones may also be open as forward backlog buckets.
2. **No open issue is orphaned** from a milestone.
3. `docs/tasks/` no longer contains a maintained planning doc — its content is archived,
   and the live standing rules survive in CLAUDE.md.
4. `task-doc-keeper` agent and `task-doc-tick-detector.sh` hook no longer exist; no dangling
   references to them in CLAUDE.md, README, or `.claude/settings.json`.
5. Branch naming, ADR 0010/0011, and the two memories all describe the issue-anchored,
   milestone-driven model consistently — no contradictions with the retired phase model.
6. A fresh Claude session, reading CLAUDE.md, is pointed at GitHub milestones (not the phase
   docs) for "what are we working on."

## Migration sequencing note

The doc-and-memory edits (D3, D6, D7, D8) and the machinery deletion (D4) are repo changes
that ride a normal `docs/`-type branch into `qa`. The GitHub milestone reconciliation (D2)
is a GitHub-state change with no repo diff — it can run independently, but should land in the
same effort so the repo and GitHub agree at the end. The implementation plan orders these.
