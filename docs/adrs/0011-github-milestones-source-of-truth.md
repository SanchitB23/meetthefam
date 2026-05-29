# ADR 0011 — GitHub milestones + issues as the planning source of truth

**Status:** Accepted
**Date:** 2026-05-29

## Context

Through Phases 0–9 the project carried **two parallel planning models**:

1. **In-repo task docs** — `docs/tasks/current-phase.md` (~106 KB) and `docs/tasks/phase-backlog.md` (~65 KB): a fine-grained **Phase 0→12 + Wave A–F** model, hand-maintained, version-anchored, ticked per sub-task. Kept in sync by the `task-doc-keeper` agent and the `task-doc-tick-detector.sh` PreToolUse hook (per the standing memory `feedback_update_tasks_before_commit.md`).
2. **GitHub milestones** — a coarse **version-line** model: `v0.4 — Phase 8 polish`, `v1.0 — Launch`, `v1.1 — Post-launch polish`, `v1.2 — Export & archival`.

The two drifted. At the point this ADR was written: the `v0.4 — Phase 8 polish` milestone was still **open** with 0 open issues (v0.4.0 had shipped 2026-05-18); **no `v0.5` milestone existed** despite v0.5.0 shipping 2026-05-29; **five open issues** (#86, #85, #74, #119, #120) had **no milestone**; and a "2026-05-22 restructure" had shifted every phase number by 1, leaving "phase numbers past 9 shifted by 1" caveats scattered through the docs.

The root cause is maintaining a **parallel artifact**: every sub-task required ticking the doc *and* updating issues/milestones, and when the two fell out of step neither was trustworthy. The phase docs and the GitHub state were two sources of truth competing to describe the same reality.

## Decision

**GitHub milestones + issues are the single planning source of truth.** The in-repo phase docs are retired.

### One milestone per cycle

Each working cycle (what a "phase" used to be) is **one GitHub milestone**, version-named (`v1.0 — Launch`, `v1.1 — Post-launch polish`, …).

- **The current cycle is the nearest open milestone** — the lowest open version number. Its open issues are the live work list. Future cycles (`v1.1`, `v1.2`, …) may also be open at the same time, acting as forward backlog buckets; one becomes "current" only once every earlier milestone has closed.
- **Ship gate = the milestone closes when it has zero open issues.** The milestone *description* carries the human-readable gate summary; the *issue set* carries the actual checklist. Epics (e.g. the verification matrix #86) hold internal checklists.
- Issues are the unit of work. Each gets a milestone + labels.

### Issue-anchored branches

Branches are `<type>/<issue#>-slug` (e.g. `feat/56-legal-pages`): one branch → one GitHub issue → one PR carrying `Closes #N` + the issue's milestone. This replaces the phase-anchored `feat/phase-N/sub-task-M-*` naming. See [ADR 0010](0010-feature-branch-workflow.md) (2026-05-29 amendment). Forward-promotion (`→ qa → release/vX.Y.Z → main → production`) is unchanged.

### What was retired

- The phase docs (`current-phase.md`, `phase-backlog.md`, `phase-8-resume-prompt.md`) were moved to [`docs/archive/`](../archive/) with a frozen-header banner. They are kept for historical rationale, not maintained.
- The still-live **Standing rules** from `phase-backlog.md` (the `await cookies()` / `await headers()` discipline; the "no prod changes pre-v1.0" rule) were lifted into [CLAUDE.md](../../CLAUDE.md) → "Code" conventions before archiving.
- The `task-doc-keeper` agent and `task-doc-tick-detector.sh` hook (plus its `.claude/settings.json` wiring) were deleted — with no doc to tick, they had no purpose.
- The sync discipline is now purely PR-side: `Closes #N` (per `feedback_link_closing_issues_in_pr.md`) + a milestone on the PR/issue.

## Consequences

- **No more doc-vs-GitHub drift.** There is one place to look, and it is the place where the work actually happens (issues, milestones, PRs).
- **"What are we working on?" is one click away** — the nearest open milestone. A fresh Claude session is pointed there by CLAUDE.md instead of at a 106 KB doc.
- **The single-file phase narrative is lost.** The dense per-phase rationale paragraphs no longer have a living home; this is mitigated by the archive (history preserved) and by writing decision rationale into milestone descriptions, issue threads, and ADRs.
- **Already-shipped cycles are not backfilled** as milestones (v0.1/v0.2/v0.3/v0.5 have no open work). The version ledger starts effectively from the current open cycle forward; pre-v1.0 history lives in the archive.
- **Branch names now reference issues, not phases**, making the issue → branch → PR → milestone chain self-evident.

## Alternatives considered

- **Coarse version-line milestones** (keep the prior shape: milestones = release lines that may span several cycles). Fewer milestones, but loses the tight "current cycle" focus the phase doc provided — "what's next" becomes a label-sorted scan of a large issue set. Rejected.
- **Milestones + a GitHub Projects board** (Todo / Doing / Done columns as the live work view). Most GitHub-native, but adds a Projects board to maintain on top of milestones + issues — another surface to keep in sync, which is the exact failure mode this ADR exists to kill. Rejected.
- **Status quo: keep both models.** The drift documented in Context is the verdict. Rejected.

## References

- [ADR 0010 — Feature-branch workflow](0010-feature-branch-workflow.md) — issue-anchored branch naming (2026-05-29 amendment).
- [ADR 0009 — Versioning and releases](0009-versioning-and-releases.md) — the SemVer scheme milestones are named after.
- [Design spec — GitHub milestones workflow](../superpowers/specs/2026-05-29-github-milestones-workflow-design.md) — the brainstorm that locked these decisions.
- [Implementation plan](../superpowers/plans/2026-05-29-github-milestones-workflow.md) — the migration steps.
- [`docs/archive/`](../archive/) — the frozen phase docs this ADR supersedes.
- [GitHub milestones](https://github.com/SanchitB23/meetthefam/milestones) — the live source of truth.
