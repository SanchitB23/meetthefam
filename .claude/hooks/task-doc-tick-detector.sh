#!/usr/bin/env bash
# PreToolUse hook: detect a `git commit` on a sub-task feature branch that
# doesn't include a `docs/tasks/current-phase.md` tick in its staged set,
# and nudge Claude to dispatch the `task-doc-keeper` agent before the
# commit lands.
#
# Wiring: .claude/settings.json → hooks.PreToolUse.[matcher: Bash].command
#
# Why this exists: the standing memory rule
#   `feedback_update_tasks_before_commit.md`
# says sub-task ticks must land in the SAME commit as the feature work. This
# hook is the automation around that — if it fires, Claude forgot.
#
# Input (via stdin, JSON from the harness):
#   {
#     "tool_name": "Bash",
#     "tool_input": { "command": "...", ... }
#   }
#   Note: PreToolUse has NO tool_response — the tool hasn't run yet.
#
# Output (stdout): a <system-reminder> when the trigger conditions match.
# Otherwise silent.
#
# Trigger conditions (all must hold):
#   1. The command is a plain `git commit` (NOT --amend; amend is a
#      different workflow we leave alone).
#   2. Current branch matches `feat/phase-N/sub-task-M-*` — only sub-task
#      feature branches are subject to the same-commit rule. Other
#      branches (chore/, fix/, docs/, refactor/, test/, style/, release/)
#      are out of scope.
#   3. The about-to-commit file set includes "real work" — anything under
#      `src/`, `supabase/migrations/`, `supabase/seed.sql`, or
#      `supabase/config.toml`.
#   4. `docs/tasks/current-phase.md` is NOT in the about-to-commit set.
#
# About-to-commit set = `git diff --cached --name-only` (always)
#   PLUS `git diff --name-only` IF the command includes `-a` / `--all`
#   (which auto-stages tracked modifications at commit time).
#
# Discipline:
#   - Never block (always exit 0). Advisory only — Claude can choose to
#     skip if it knows a previous commit on the branch already ticked.
#   - Silent on every Bash call that doesn't match all four conditions.

set -uo pipefail

payload=$(cat 2>/dev/null || echo '{}')
command=$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null || true)

if [[ -z "$command" ]]; then exit 0; fi

# Match `git commit`, `git -C path commit`, etc. Skip `git commit-tree`,
# `git log --commit`, etc. by requiring a word-boundary after `commit`.
if ! printf '%s' "$command" | grep -qE '(^|[^[:alnum:]])git( -[^ ]+ +[^ ]+)?( +commit)([^[:alnum:]-]|$)'; then
  exit 0
fi

# `--amend` is a different workflow (rewriting an existing commit). Skip.
if printf '%s' "$command" | grep -qE -- '--amend'; then
  exit 0
fi

repo_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Branch gate: only sub-task feat branches.
branch=$(git -C "$repo_dir" rev-parse --abbrev-ref HEAD 2>/dev/null || echo '')
if ! printf '%s' "$branch" | grep -qE '^feat/phase-[0-9]+/sub-task-'; then
  exit 0
fi

# Determine about-to-commit file set.
staged=$(git -C "$repo_dir" diff --cached --name-only 2>/dev/null || echo '')

# `-a` / `--all` auto-stages tracked modifications at commit time. Include
# the working-tree-vs-HEAD diff in those cases so we don't miss the work.
also_unstaged=''
if printf '%s' "$command" | grep -qE -- '(^|[[:space:]])(-a|--all)([[:space:]]|$)'; then
  also_unstaged=$(git -C "$repo_dir" diff --name-only 2>/dev/null || echo '')
fi

all_changes=$(printf '%s\n%s' "$staged" "$also_unstaged" | grep -v '^$' | sort -u)
if [[ -z "$all_changes" ]]; then exit 0; fi

# Does the set include "real work" (code or migration changes)?
has_work_count=$(printf '%s\n' "$all_changes" | grep -cE '^(src/|supabase/migrations/|supabase/seed\.sql|supabase/config\.toml)' || true)
if [[ "$has_work_count" -eq 0 ]]; then exit 0; fi

# Does the set include a tick on current-phase.md?
has_tick_count=$(printf '%s\n' "$all_changes" | grep -cE '^docs/tasks/current-phase\.md$' || true)
if [[ "$has_tick_count" -gt 0 ]]; then exit 0; fi

# All four conditions met — emit the reminder.
cat <<EOF
<system-reminder>
You're about to commit on \`${branch}\` — a Phase sub-task branch — but
\`docs/tasks/current-phase.md\` is NOT in the about-to-commit changes.

Per the standing memory rule \`feedback_update_tasks_before_commit.md\`,
sub-task ticks must land in the SAME commit as the feature work.

Before this commit:
  - dispatch \`task-doc-keeper\` to tick the sub-task \`[ ]\` → \`[x]\` and
    replace its forward-summary with the dense rationale paragraph
  - stage \`docs/tasks/current-phase.md\` (and \`docs/tasks/phase-backlog.md\`
    if the sub-task satisfies any backlog item)
  - re-run \`git commit\`

If you've already ticked the sub-task in a previous commit on this branch
(rare; usually one commit per sub-task PR), this reminder is a false
positive — proceed and explain in your reply.
</system-reminder>
EOF
exit 0
