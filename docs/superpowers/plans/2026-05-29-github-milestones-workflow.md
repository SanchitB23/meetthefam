# GitHub Milestones Workflow Adoption — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Note on style:** This is a docs + tooling migration, not a code feature. There are no unit tests. "Verification" steps use `grep`/`gh` confirmations instead of test runs. Keep commits small and frequent as usual.

**Goal:** Retire the in-repo `Phase N + Wave A–F` planning docs and make GitHub milestones + issues the single planning source of truth.

**Architecture:** One milestone per cycle (nearest open milestone = current cycle). Issue-anchored branches (`feat/<issue#>-slug`). The phase docs are archived (not deleted) for historical rationale; their still-live standing rules move into CLAUDE.md first. The agent + hook that kept the phase doc ticked are deleted.

**Tech Stack:** GitHub (milestones, issues, labels via `gh`), Markdown docs, Claude Code agent/hook config (`.claude/`), file-based memory (`~/.claude/projects/.../memory/`).

**Spec:** [`docs/superpowers/specs/2026-05-29-github-milestones-workflow-design.md`](../specs/2026-05-29-github-milestones-workflow-design.md)

**Tracking issue:** [#126](https://github.com/SanchitB23/meetthefam/issues/126)

**Branch:** `chore/126-adopt-github-milestones` (already cut from `qa`; spec already committed there as `c54a6e0`).

---

## File map

| Path | Action | Responsibility |
|---|---|---|
| *(GitHub state — no file)* | reconcile | Milestone descriptions, orphan-issue assignment, close `v0.4` |
| `CLAUDE.md` | modify | Absorb 2 standing rules; repoint "Where to look first"; drop `task-doc-keeper`; rewrite "Phasing at a glance"; issue-anchored branch naming |
| `README.md` | modify | Line 12 pointer → milestones |
| `docs/README.md`, `.claude/agents/e2e-smoke-tester.md`, `.claude/agents/supabase-validator.md`, `docs/qa/smoke-flows.md` | modify (if live pointer) | Repoint any live "current work" reference; leave historical mentions |
| `docs/archive/` | create | New home for frozen phase docs |
| `docs/tasks/current-phase.md`, `docs/tasks/phase-backlog.md`, `docs/tasks/phase-8-resume-prompt.md` | move → `docs/archive/` | Frozen historical record |
| `.claude/agents/task-doc-keeper.md` | delete | Retired agent |
| `.claude/hooks/task-doc-tick-detector.sh` | delete | Retired hook |
| `.claude/settings.json` | modify | Remove the hook wiring |
| `docs/adrs/0011-github-milestones-source-of-truth.md` | create | Record the decision |
| `docs/adrs/0010-feature-branch-workflow.md` | modify | Amend for issue-anchored branches |
| `~/.claude/projects/-Users-.../memory/feedback_update_tasks_before_commit.md` | rewrite | Issue-reference rule (outside repo — no commit) |
| `~/.claude/projects/-Users-.../memory/feedback_feature_branch_workflow.md` | rewrite | Issue-anchored branches (outside repo — no commit) |
| `~/.claude/projects/-Users-.../memory/MEMORY.md` | modify | Update the two index lines (outside repo — no commit) |

---

## Task 1: Reconcile GitHub milestones (D2)

Pure GitHub-state change — **no repo commit**. Do this first so the model is real before the docs describe it.

**Files:** none (GitHub API via `gh`).

- [ ] **Step 1: Rewrite the `v1.0 — Launch` milestone description to encode the ship gate**

Milestone `v1.0 — Launch` is number `2`. Run:

```bash
gh api --method PATCH repos/SanchitB23/meetthefam/milestones/2 \
  -f description="Multi-tenant launch cycle (current open cycle). Ships v1.0.0. Ship gate — this milestone closes when all its issues close: custom SMTP (#25), legal pages catalog (#56), magic-link email template (#61), verification matrix epic (#86), and a clean \`pnpm typecheck && pnpm lint && pnpm test\` on qa, followed by the release cut. Launch-gate checklist: docs/dev/prod-readiness.md."
```

- [ ] **Step 2: Assign the 5 orphan issues to milestones**

```bash
gh issue edit 86 --milestone "v1.0 — Launch"
gh issue edit 85 --milestone "v1.1 — Post-launch polish"
gh issue edit 74 --milestone "v1.1 — Post-launch polish"
gh issue edit 119 --milestone "v1.1 — Post-launch polish"
gh issue edit 120 --milestone "v1.1 — Post-launch polish"
```

(If during execution any call should differ from this triage, adjust — these were the spec's proposed assignments.)

- [ ] **Step 3: Verify no open issue is orphaned**

Run:

```bash
gh issue list --state open --limit 100 --json number,milestone --jq '[.[] | select(.milestone == null)] | length'
```

Expected: `0` (excluding the tracking issue #126, which already has a milestone).

- [ ] **Step 4: Close the stale `v0.4 — Phase 8 polish` milestone**

Milestone `v0.4 — Phase 8 polish` is number `1`. Confirm 0 open issues, then close:

```bash
gh api repos/SanchitB23/meetthefam/milestones/1 --jq '.open_issues'   # expect 0
gh api --method PATCH repos/SanchitB23/meetthefam/milestones/1 -f state=closed
```

- [ ] **Step 5: Verify final milestone state**

```bash
gh api repos/SanchitB23/meetthefam/milestones --jq '.[] | "\(.title)\topen=\(.open_issues)\tclosed=\(.closed_issues)"'
gh api 'repos/SanchitB23/meetthefam/milestones?state=closed' --jq '.[].title'
```

Expected: `v0.4` appears under closed; `v1.0/v1.1/v1.2` open with their issues attached.

---

## Task 2: Lift the live standing rules into CLAUDE.md (D3 prep)

Move the two still-live Standing rules out of `phase-backlog.md` **before** archiving it, so they survive in a maintained location.

**Files:**
- Modify: `CLAUDE.md` (the "### Code" subsection under "## Conventions")

- [ ] **Step 1: Add the two standing rules to the "Code" conventions**

In `CLAUDE.md`, find the "### Code" bullet list (it ends with the "Components: prefer Server Components…" bullet). Append these two bullets after it:

```markdown
- **`await cookies()` / `await headers()`** in every server-side `@supabase/ssr` client. In Next.js 16 these are async — every new Supabase server client must `await` them when wiring the cookie adapter. Pull the current snippet via Context7 (`/supabase/supabase`) before writing one from memory. See [ADR 0007](docs/adrs/0007-nextjs-16-and-async-idioms.md).
- **No production DB or production-Vercel-config changes until the `v1.0 — Launch` milestone closes.** Per-cycle migrations apply to **local + QA only**; the `mcp__supabase__apply_migration` step against `family-tree-prod` is skipped pre-v1.0. All accumulated migrations batch-apply at the v1.0 launch cut-over. Launch-gate checklist: [`docs/dev/prod-readiness.md`](docs/dev/prod-readiness.md).
```

- [ ] **Step 2: Verify the rules landed**

```bash
grep -n "await cookies()" CLAUDE.md
grep -n "until the .v1.0 — Launch. milestone closes" CLAUDE.md
```

Expected: both match.

- [ ] **Step 3: Commit**

```bash
git add CLAUDE.md
git commit -m "docs(#126): lift live standing rules into CLAUDE.md before archiving phase docs

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Archive the phase docs (D3)

**Files:**
- Create: `docs/archive/` (directory)
- Move: `docs/tasks/current-phase.md`, `docs/tasks/phase-backlog.md`, `docs/tasks/phase-8-resume-prompt.md` → `docs/archive/`

- [ ] **Step 1: Move the three docs with `git mv` (preserves history)**

```bash
mkdir -p docs/archive
git mv docs/tasks/current-phase.md docs/archive/current-phase.md
git mv docs/tasks/phase-backlog.md docs/archive/phase-backlog.md
git mv docs/tasks/phase-8-resume-prompt.md docs/archive/phase-8-resume-prompt.md
```

- [ ] **Step 2: Prepend a frozen-header to each archived file**

Add this banner as the first lines of each of the three moved files (above their existing first line):

```markdown
> **⚠️ FROZEN / HISTORICAL.** This document is no longer maintained. Planning moved to GitHub milestones + issues on 2026-05-29 — see [ADR 0011](../adrs/0011-github-milestones-source-of-truth.md) and the design spec at [`../superpowers/specs/2026-05-29-github-milestones-workflow-design.md`](../superpowers/specs/2026-05-29-github-milestones-workflow-design.md). The current cycle is the nearest open [GitHub milestone](https://github.com/SanchitB23/meetthefam/milestones). Kept for historical rationale only.

---
```

- [ ] **Step 3: Add a short `docs/archive/README.md` explaining the directory**

Create `docs/archive/README.md`:

```markdown
# Archive

Frozen, no-longer-maintained docs kept for historical rationale. As of 2026-05-29, planning moved from the in-repo "Phase N + Wave A–F" model to GitHub milestones + issues (see [ADR 0011](../adrs/0011-github-milestones-source-of-truth.md)). The phase docs here record the *why* behind decisions made under the old model; they are not a source of truth for current work.

For "what are we working on now," see the nearest open [GitHub milestone](https://github.com/SanchitB23/meetthefam/milestones).
```

- [ ] **Step 4: Verify `docs/tasks/` is empty and archive is populated**

```bash
ls -A docs/tasks/ 2>/dev/null || echo "docs/tasks gone"
ls docs/archive/
```

Expected: `docs/tasks/` empty (or removed); `docs/archive/` has the 4 files.

- [ ] **Step 5: Commit**

```bash
git add docs/archive/ docs/tasks/
git commit -m "docs(#126): archive phase-tracking docs to docs/archive/ (frozen)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Retire the sync machinery (D4)

**Files:**
- Delete: `.claude/agents/task-doc-keeper.md`
- Delete: `.claude/hooks/task-doc-tick-detector.sh`
- Modify: `.claude/settings.json` (remove the hook wiring)

- [ ] **Step 1: Inspect the hook wiring in settings.json before editing**

```bash
grep -n "task-doc-tick-detector" .claude/settings.json
```

Note the exact PreToolUse entry that invokes the hook (matcher + command).

- [ ] **Step 2: Remove the `task-doc-tick-detector` PreToolUse entry**

Edit `.claude/settings.json` and delete the hook object that references `task-doc-tick-detector.sh`. Preserve all other hooks (e.g. `db-commit-detector`). If removing it leaves an empty `PreToolUse` array, keep the array as `[]` (don't break JSON shape unless other keys depend on it).

- [ ] **Step 3: Validate settings.json is still valid JSON**

```bash
jq empty .claude/settings.json && echo "valid JSON"
```

Expected: `valid JSON`.

- [ ] **Step 4: Delete the agent + hook files**

```bash
git rm .claude/agents/task-doc-keeper.md .claude/hooks/task-doc-tick-detector.sh
```

- [ ] **Step 5: Verify no dangling references to the retired machinery**

```bash
grep -rn "task-doc-tick-detector" .claude/ ; echo "exit: $?"
grep -rn "task-doc-keeper" .claude/settings.json ; echo "exit: $?"
```

Expected: no matches (grep exit `1`). Note: `CLAUDE.md` still references `task-doc-keeper` at this point — that's fixed in Task 5.

- [ ] **Step 6: Commit**

```bash
git add .claude/settings.json .claude/agents/task-doc-keeper.md .claude/hooks/task-doc-tick-detector.sh
git commit -m "chore(#126): retire task-doc-keeper agent + task-doc-tick-detector hook

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: Rewrite the live pointers in CLAUDE.md + README + agent/index docs (D6)

**Files:**
- Modify: `CLAUDE.md` ("Where to look first", "Project subagents", "Conventions › Git workflow", "Phasing at a glance")
- Modify: `README.md` (line 12)
- Modify (if live pointer): `docs/README.md`, `.claude/agents/e2e-smoke-tester.md`, `.claude/agents/supabase-validator.md`, `docs/qa/smoke-flows.md`

- [ ] **Step 1: CLAUDE.md — repoint "Where to look first"**

Replace the bullet:

```markdown
- [`docs/tasks/current-phase.md`](docs/tasks/current-phase.md) — what we're working on right now
```

with:

```markdown
- **[GitHub milestones](https://github.com/SanchitB23/meetthefam/milestones)** — the single source of truth for current work. The **nearest open milestone is the current cycle**; its open issues are the live work list, and it closes when they're all done. See [ADR 0011](docs/adrs/0011-github-milestones-source-of-truth.md).
```

Then replace the closing paragraph of that section:

```markdown
When unsure, read `docs/tasks/current-phase.md` first to know what phase we're in, then check `docs/superpowers/plans/` for the canonical plan + execution overlay matching that phase. Load only the architecture / UX docs relevant to the current phase.
```

with:

```markdown
When unsure, open the [GitHub milestones](https://github.com/SanchitB23/meetthefam/milestones) first — the nearest open milestone is the current cycle and its issues are the work. Then check `docs/superpowers/plans/` for any matching plan. Load only the architecture / UX docs relevant to the issue you're working. Historical "Phase N" plans/specs predate the milestone model (planning moved to GitHub on 2026-05-29, ADR 0011) — they're frozen rationale, not current-work pointers.
```

- [ ] **Step 2: CLAUDE.md — drop `task-doc-keeper` from "Project subagents"**

Remove the `task-doc-keeper` bullet entirely (the bullet beginning `- **`task-doc-keeper`** — keeps `docs/tasks/current-phase.md`…`). Then delete the paragraph describing its auto-nudge hook (the sentence block mentioning `task-doc-tick-detector` / `.claude/hooks/task-doc-tick-detector.sh`).

- [ ] **Step 3: CLAUDE.md — issue-anchored branch naming in "Git workflow"**

Replace this passage in the "### Git workflow" subsection:

```markdown
Feature-branch forward-promotion: `local → feat/* (or fix/, chore/, docs/, refactor/, test/, style/) → qa → release/vX.Y.Z → main → production`. Never commit directly to `main`; per-sub-task branches are mandatory and direct `qa` commits are emergency-only. Branch prefix mirrors the Conventional Commit type used in the commit message.
```

with:

```markdown
Feature-branch forward-promotion: `local → <type>/<issue#>-slug → qa → release/vX.Y.Z → main → production`. Branches are **issue-anchored**: one branch → one GitHub issue → one PR carrying `Closes #N` + the issue's milestone (e.g. `feat/56-legal-pages`). Branch prefix mirrors the Conventional Commit type (`feat/`, `fix/`, `chore/`, `docs/`, `refactor/`, `test/`, `style/`). Never commit directly to `main`; direct `qa` commits are emergency-only.
```

- [ ] **Step 4: CLAUDE.md — replace "Phasing at a glance" with "Milestones at a glance"**

Replace the entire "## Phasing at a glance" section (the `Phase −1 … Phases 6–9` list and its closing line) with:

```markdown
## Milestones at a glance

Work is organized as **GitHub milestones**, one per release cycle. The nearest open milestone is the current cycle.

- Shipped: **v0.1 → v0.5** (personal MVP through pre-launch hardening — history in [`docs/archive/`](docs/archive/)).
- **v1.0 — Launch** — multi-tenant launch cycle (current). Ships v1.0.0.
- **v1.1 — Post-launch polish** — post-launch UX + quality-of-life.
- **v1.2 — Export & archival** — tree export (PDF / image), archival prints.

Live list (always authoritative): [github.com/SanchitB23/meetthefam/milestones](https://github.com/SanchitB23/meetthefam/milestones).
```

- [ ] **Step 5: README.md — repoint line 12**

Replace:

```markdown
- **Current phase tasks**: [`docs/tasks/current-phase.md`](docs/tasks/current-phase.md)
```

with:

```markdown
- **Current work**: the nearest open [GitHub milestone](https://github.com/SanchitB23/meetthefam/milestones) (planning source of truth — see [ADR 0011](docs/adrs/0011-github-milestones-source-of-truth.md))
```

- [ ] **Step 6: Sweep the remaining reference files; repoint live pointers only**

For each file below, read the matching line and decide: is it a **live "go here for current work" pointer** (repoint to milestones) or a **historical mention** (leave it)?

```bash
grep -n "current-phase\|phase-backlog\|task-doc-keeper" docs/README.md .claude/agents/e2e-smoke-tester.md .claude/agents/supabase-validator.md docs/qa/smoke-flows.md
```

- `docs/README.md` — if it lists `docs/tasks/current-phase.md` in a docs index, repoint to the milestones URL (and/or `docs/archive/`).
- `.claude/agents/e2e-smoke-tester.md`, `.claude/agents/supabase-validator.md` — if they tell the agent to read `current-phase.md` for context, change to "the nearest open GitHub milestone." If they only mention `task-doc-keeper` as a sibling, drop that mention.
- `docs/qa/smoke-flows.md` — likely a historical phase reference; leave unless it's a live pointer.

Make the minimal repoint edits. Do **not** rewrite historical "Phase N" prose in `docs/superpowers/plans/`, `docs/specs/`, `docs/adrs/` (other than 0010/0011 in Task 6) or `docs/dev/` — those are frozen rationale.

- [ ] **Step 7: Verify no live pointer still aims at the retired docs/agent**

```bash
grep -rn "docs/tasks/current-phase\|docs/tasks/phase-backlog" CLAUDE.md README.md docs/README.md .claude/ ; echo "exit: $?"
grep -rn "task-doc-keeper" CLAUDE.md .claude/ ; echo "exit: $?"
```

Expected: no matches (exit `1`) — every live pointer now aims at milestones or `docs/archive/`.

- [ ] **Step 8: Commit**

```bash
git add CLAUDE.md README.md docs/README.md .claude/agents/e2e-smoke-tester.md .claude/agents/supabase-validator.md docs/qa/smoke-flows.md
git commit -m "docs(#126): repoint live work pointers from phase docs to GitHub milestones

Co-Authored-By: Claude <noreply@anthropic.com>"
```

(Only stage the files you actually edited in Step 6.)

---

## Task 6: ADRs (D7)

**Files:**
- Create: `docs/adrs/0011-github-milestones-source-of-truth.md`
- Modify: `docs/adrs/0010-feature-branch-workflow.md` (add an Amendment)

- [ ] **Step 1: Write ADR 0011**

Create `docs/adrs/0011-github-milestones-source-of-truth.md`, matching the format of the existing ADRs (read `docs/adrs/0010-feature-branch-workflow.md` for the exact section shape — Status / Context / Decision / Consequences / Alternatives). Content to capture:

- **Status:** Accepted, 2026-05-29.
- **Context:** Two parallel planning models (in-repo phase docs vs. GitHub milestones) drifted — stale `v0.4` milestone, missing `v0.5`, orphan issues, "phase numbers shifted by 1" caveats. Maintaining a parallel artifact was the root cause.
- **Decision:** GitHub milestones + issues are the single planning source of truth. One milestone per cycle, version-named; the nearest open milestone is the current cycle; ship gate = milestone closes when its issues close. Issue-anchored branches (`<type>/<issue#>-slug`). Phase docs archived to `docs/archive/`; the `task-doc-keeper` agent + `task-doc-tick-detector` hook retired; standing rules lifted into CLAUDE.md.
- **Consequences:** No more doc-vs-GitHub drift; "current work" is one click away; loses the single-file phase narrative (mitigated by archive + milestone descriptions). Sync discipline is now PR-side (`Closes #N` + milestone).
- **Alternatives considered:** coarse version-line milestones (loses cycle focus); milestones + a Projects board (extra surface to maintain). Both rejected during the 2026-05-29 brainstorm.

- [ ] **Step 2: Amend ADR 0010 for issue-anchored branches**

In `docs/adrs/0010-feature-branch-workflow.md`, add an Amendment entry (follow any existing "Amendment" pattern in that file, or add an "## Amendments" section if none exists):

```markdown
## Amendment (2026-05-29) — issue-anchored branches

Superseding the earlier "phase-branch as default" stance: branches are now **issue-anchored**, `<type>/<issue#>-slug` (one branch → one GitHub issue → one PR with `Closes #N` + milestone). The phase-tracking model that motivated `feat/phase-N/sub-task-M-*` branch names was retired in favor of GitHub milestones — see [ADR 0011](0011-github-milestones-source-of-truth.md). Forward-promotion (`→ qa → release/vX.Y.Z → main`) is unchanged.
```

- [ ] **Step 3: Verify ADR cross-links resolve**

```bash
grep -n "0011-github-milestones" docs/adrs/0010-feature-branch-workflow.md CLAUDE.md README.md
ls docs/adrs/0011-github-milestones-source-of-truth.md
```

Expected: ADR 0011 file exists; 0010 + CLAUDE.md + README link to it.

- [ ] **Step 4: Commit**

```bash
git add docs/adrs/0011-github-milestones-source-of-truth.md docs/adrs/0010-feature-branch-workflow.md
git commit -m "docs(#126): ADR 0011 (milestones as source of truth) + amend ADR 0010 for issue-anchored branches

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: Update file-based memory (D8)

**Files (outside the repo — NO git commit):** `~/.claude/projects/-Users-sqb6461-Workspace-SelfProjects-meetthefam/memory/`

- [ ] **Step 1: Rewrite `feedback_update_tasks_before_commit.md` → issue-reference rule**

Replace its body so it no longer references ticking `current-phase.md`. New content: the sync discipline is PR-side — every feature branch maps to a GitHub issue; the closing PR carries `Closes #N` (bare syntax) + the issue's milestone; reference the issue in the commit that closes it. Cross-link `[[feedback_link_closing_issues_in_pr.md]]` and `[[feedback_feature_branch_workflow.md]]`. Update its `description:` frontmatter accordingly. (Alternatively, if it now fully duplicates `feedback_link_closing_issues_in_pr.md`, delete it and update the index instead.)

- [ ] **Step 2: Rewrite `feedback_feature_branch_workflow.md` → issue-anchored branches**

Replace the "phase-branch as default" content with: branches are issue-anchored `<type>/<issue#>-slug`, one issue per branch/PR. `release/vX.Y.Z` is still the only branch into `main`. Note that phases were retired in favor of GitHub milestones (ADR 0011) on 2026-05-29.

- [ ] **Step 3: Update the `MEMORY.md` index lines**

Edit the two pointer lines in `MEMORY.md` to match the rewritten hooks (or remove the `feedback_update_tasks_before_commit` line if that file was deleted in Step 1).

- [ ] **Step 4: Verify**

```bash
grep -rn "issue-anchored\|Closes #N" ~/.claude/projects/-Users-sqb6461-Workspace-SelfProjects-meetthefam/memory/feedback_feature_branch_workflow.md ~/.claude/projects/-Users-sqb6461-Workspace-SelfProjects-meetthefam/memory/feedback_update_tasks_before_commit.md 2>/dev/null
grep -n "current-phase" ~/.claude/projects/-Users-sqb6461-Workspace-SelfProjects-meetthefam/memory/*.md ; echo "exit: $?"
```

Expected: the new phrasing present; no surviving `current-phase` tick references in memory.

---

## Task 8: Final verification + open the PR

**Files:** none (verification + PR).

- [ ] **Step 1: Full dangling-reference sweep (live files only)**

```bash
# Live pointers must NOT reference the retired docs/agent:
grep -rn "docs/tasks/current-phase\|docs/tasks/phase-backlog\|task-doc-keeper\|task-doc-tick-detector" \
  CLAUDE.md README.md .claude/ docs/README.md ; echo "exit: $?"
```

Expected: exit `1` (no matches). Historical mentions remaining under `docs/superpowers/`, `docs/specs/`, `docs/dev/`, `docs/adrs/` (≤0010) and `docs/archive/` are expected and fine.

- [ ] **Step 2: Confirm `docs/tasks/` no longer holds a maintained doc**

```bash
ls -A docs/tasks/ 2>/dev/null && echo "WARNING: still populated" || echo "docs/tasks empty/gone — OK"
```

- [ ] **Step 3: Sanity gates (no code changed, but CLAUDE.md asks for these before a PR)**

```bash
pnpm typecheck && pnpm lint
```

Expected: clean (this change touches no `src/`). If `version.ts` shows as modified in the working tree, leave it unstaged — it's an unrelated pre-existing change.

- [ ] **Step 4: Push the branch**

```bash
git push -u origin chore/126-adopt-github-milestones
```

- [ ] **Step 5: Open a DRAFT PR following the repo template, closing #126**

Create the PR with `gh pr create --draft --base qa`, body following `.github/pull_request_template.md` end-to-end, pre-ticking local gates and leaving manual-checklist boxes for the human reviewer. Include near the top:

```markdown
## Closes
Closes #126
```

Summarize: milestone reconciliation (v0.4 closed, orphans triaged, v1.0 gate described), phase docs archived, machinery retired, CLAUDE.md/README/ADRs/memories repointed to the milestone model. Note this is docs/chore-only → rides the next release per the no-release-for-docs-only rule. Do **not** mark it ready — the user does that.

---

## Self-review notes (filled by plan author)

- **Spec coverage:** D1 (model) → encoded in Task 5 Step 4 + ADR 0011 (Task 6). D2 → Task 1. D3 → Tasks 2–3. D4 → Task 4. D5 → Task 5 Step 3 + ADR 0010 amendment (Task 6). D6 → Task 5. D7 → Task 6. D8 → Task 7. Success criteria → Task 8 sweep. All spec sections covered.
- **Memory tasks are outside the repo** and intentionally have no commit — flagged in Task 7.
- **The `version.ts` working-tree change** is pre-existing/unrelated — flagged to leave unstaged in Tasks 1-context and Task 8.
- **Historical "phase" mentions are intentionally preserved** — the sweeps in Tasks 5/8 are scoped to live-pointer files only.
