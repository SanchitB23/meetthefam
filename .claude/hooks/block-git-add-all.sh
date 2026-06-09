#!/usr/bin/env bash
# PreToolUse hook: block broad `git add` staging (`git add -A`, `git add --all`,
# `git add .`) to prevent accidentally committing secrets / unrelated files.
#
# Enforces the standing CLAUDE.md rule:
#   "Stage specific files by name (`git add src/foo.ts`); avoid `git add -A`
#    and `git add .` to prevent accidentally committing secrets."
#
# Wiring: .claude/settings.json → hooks.PreToolUse.[matcher: Bash].command
#
# Input (via stdin, JSON from the harness):
#   { "tool_name": "Bash", "tool_input": { "command": "...", ... } }
#
# Output (stdout): a PreToolUse permission decision.
#   - Offending command  → permissionDecision "deny" + an explanatory reason
#     (fed back to Claude so it re-stages by explicit path).
#   - Anything else      → silent, exit 0 (defers to normal permission flow).
#
# Discipline:
#   - Only ever DENY the specific broad-add forms. Never deny a path-scoped add
#     (`git add src/`, `git add ./app/x.ts`) — those are the sanctioned path.
#   - Fail open: on any internal error (jq missing, malformed payload) exit 0
#     so the hook can't wedge the session.

set -uo pipefail

payload=$(cat 2>/dev/null || echo '{}')

command=$(printf '%s' "$payload" | jq -r '.tool_input.command // empty' 2>/dev/null || true)

# Nothing to inspect — defer.
[[ -z "$command" ]] && exit 0

# Split the command into segments on shell separators (; && || | & and parens),
# then test each segment's LEADING command. Anchoring `git` at the start of a
# segment avoids false positives like `echo git add .` where `git add .` is just
# an argument to another command, not the command being run.
segments=$(printf '%s' "$command" | sed -E 's/(&&|\|\||[;&|()])/\n/g')

# Offending forms (only when the segment's leading command IS `git ... add`):
#   -A / --all                  → stage the whole worktree
#   a bare `.` pathspec token    → stage everything under cwd
# `./path`, `src/.`, and `foo.txt` are NOT bare dots — left untouched.
offending=""
while IFS= read -r seg; do
  # Strip leading whitespace so `^git` can anchor.
  seg="${seg#"${seg%%[![:space:]]*}"}"
  # Leading command must be `git ... add` (tolerate `git -C <path>` / globals).
  printf '%s' "$seg" | grep -qE '^git([[:space:]]+-[^[:space:]]+|[[:space:]]+-C[[:space:]]+[^[:space:]]+)*[[:space:]]+add([[:space:]]|$)' || continue
  if printf '%s' "$seg" | grep -qE '[[:space:]](-A|--all)([[:space:]]|$)'; then
    offending="git add -A / --all"
    break
  elif printf '%s' "$seg" | grep -qE '[[:space:]]\.([[:space:]]|$)'; then
    offending="git add ."
    break
  fi
done <<EOF
$segments
EOF

[[ -z "$offending" ]] && exit 0

reason="Blocked '${offending}'. Project convention (CLAUDE.md): stage files by explicit path (e.g. \`git add src/foo.ts\`) to avoid accidentally committing secrets or unrelated changes. Run \`git status\` to see what changed, then add only the intended files."

# Emit the structured PreToolUse deny decision.
cat <<EOF
{
  "hookSpecificOutput": {
    "hookEventName": "PreToolUse",
    "permissionDecision": "deny",
    "permissionDecisionReason": $(printf '%s' "$reason" | jq -Rs .)
  }
}
EOF
exit 0
