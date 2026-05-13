#!/usr/bin/env bash
# PostToolUse hook: detect DB-touching commits and nudge Claude to dispatch
# the `supabase-validator` agent.
#
# Wiring: .claude/settings.json → hooks.PostToolUse.[matcher: Bash].command
#
# Input (via stdin, JSON from the harness):
#   {
#     "tool_name": "Bash",
#     "tool_input":   { "command": "...", ... },
#     "tool_response": { "stdout": "...", "stderr": "...", "interrupted": false, ... }
#   }
#
# Output (stdout): becomes context for the main Claude session.
#   - When the just-ran command is a successful `git commit` AND the resulting
#     commit touched DB-relevant files, emit a <system-reminder> with the list
#     of files + a nudge to dispatch supabase-validator.
#   - Otherwise: silent (no stdout, exit 0).
#
# Discipline:
#   - Never block the session (exit 0 even on internal errors).
#   - Be quiet on non-matching commands (every Bash call routes here).
#   - Detect failure of git commit (pre-commit hooks rejected, etc.) and skip.

set -uo pipefail

payload=$(cat 2>/dev/null || echo '{}')

# Extract the command. Fall back to empty if jq missing or payload malformed.
command=$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null || true)
stderr=$(printf '%s' "$payload" | jq -r '.tool_response.stderr // empty' 2>/dev/null || true)
interrupted=$(printf '%s' "$payload" | jq -r '.tool_response.interrupted // false' 2>/dev/null || true)

# Bail if we can't tell what ran.
if [[ -z "$command" ]]; then
  exit 0
fi

# Only interested in git commit commands.
# Match `git commit`, `git -C path commit`, etc.
if ! printf '%s' "$command" | grep -qE '(^|[^[:alnum:]])git( -[^ ]+ +[^ ]+)?( +commit)'; then
  exit 0
fi

# Skip if the commit was interrupted or failed (pre-commit hook rejection,
# nothing-to-commit, etc.). Heuristic: a successful commit has no error
# markers in stderr.
if [[ "$interrupted" == "true" ]]; then
  exit 0
fi
if printf '%s' "$stderr" | grep -qiE 'nothing to commit|aborting|hook failed|rejected'; then
  exit 0
fi

# Use the repo root the harness exports. Fall back to pwd otherwise.
repo_dir="${CLAUDE_PROJECT_DIR:-$(pwd)}"

# Files touched by the just-made commit (HEAD).
changed=$(git -C "$repo_dir" diff-tree --no-commit-id --name-only -r HEAD 2>/dev/null || true)
if [[ -z "$changed" ]]; then
  exit 0
fi

# Patterns that count as DB-touching. Keep this in sync with the agent's
# self-description ("What counts as a DB-touching commit") section.
db_pattern='^(supabase/migrations/|supabase/seed\.sql|supabase/config\.toml|src/lib/supabase/|docs/architecture/(auth-and-rls|data-model|photo-upload|share-link)\.md)'

# Server Actions count IF the diff includes an actual Supabase call. We don't
# fire on every actions.ts touch (e.g. validation-only edits don't need a DB
# validator run).
matched_paths=$(printf '%s\n' "$changed" | grep -E "$db_pattern" || true)

# Inspect actions.ts changes specifically — only flag them if the diff line
# count for Supabase API surface area is non-zero.
actions_changed=$(printf '%s\n' "$changed" | grep -E 'src/.*actions\.ts$' || true)
if [[ -n "$actions_changed" ]]; then
  for f in $actions_changed; do
    if git -C "$repo_dir" diff HEAD~1 HEAD -- "$f" 2>/dev/null \
         | grep -qE 'supabase\.(from|rpc|storage|auth\.admin)'; then
      matched_paths=$(printf '%s\n%s' "$matched_paths" "$f")
    fi
  done
fi

# Trim blank lines.
matched_paths=$(printf '%s\n' "$matched_paths" | grep -v '^$' || true)
if [[ -z "$matched_paths" ]]; then
  exit 0
fi

# Build the file bullet list.
bullets=$(printf '%s\n' "$matched_paths" | sed 's/^/  - /')

# Emit the system reminder for Claude.
cat <<EOF
<system-reminder>
The commit that just landed touched DB-relevant files:
${bullets}

Per the project's standing rule, dispatch the \`supabase-validator\` agent
to verify the change end-to-end (apply migrations locally + cross-check QA,
simulate RLS as the relevant roles, run \`mcp__supabase__get_advisors\`,
report PASS / FAIL). See \`.claude/agents/supabase-validator.md\` for the
agent's full workflow.

If you've already validated this commit (e.g. you ran the steps inline
during the work and confirmed clean), skip the dispatch — this reminder
is advisory, not mandatory. Otherwise dispatch it now before moving on.
</system-reminder>
EOF
exit 0
