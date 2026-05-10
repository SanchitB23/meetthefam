# MCP server setup

The project's [.mcp.json](../../.mcp.json) declares **two** Tier 1 MCP servers (supabase + context7) that Claude Code sessions in this repo should have available. The two **user-scope** MCPs (`github-meetthefam`, `vercel`) live in `~/.claude/settings.json` instead — see below for why.

No tokens are committed — project-scope tokens are referenced via `${env:VAR_NAME}` and live in `.env.local` (gitignored, loaded by direnv); user-scope tokens are stored as literals in `~/.claude/settings.json` (private to the machine).

## The two project-scope MCPs

| Name | Type / Source | Token env var | Purpose |
|---|---|---|---|
| `supabase` | stdio — `@supabase/mcp-server-supabase@latest` | `SUPABASE_ACCESS_TOKEN` | SQL queries, schema, migrations, RLS |
| `context7` | stdio — `@upstash/context7-mcp@latest` | *(none)* | Live docs for Next.js, Supabase, family-chart, Tailwind, shadcn |

These two use stdio servers with `${env:VAR}` interpolation in their `env` block. Claude Code reliably resolves env-var references in stdio configs, so the PAT stays in `.env.local` (gitignored, loaded by direnv) and `.mcp.json` itself is safe to commit.

> **Verify package names before first run.** MCP package names occasionally rename or split — confirm the current package on the registry / vendor docs the first time you set this up.

## GitHub and Vercel MCPs — kept at user scope

Both `github-meetthefam` and `vercel` are configured at **user scope** in `~/.claude/settings.json` — *not* in this project's `.mcp.json`.

### Why user scope

- **GitHub MCP** uses GitHub's official remote HTTP server at `https://api.githubcopilot.com/mcp`, authenticated via a `Bearer` header. Claude Code does not interpolate `${env:VAR}` inside `headers.Authorization` (only inside stdio `env` blocks). The header therefore needs a **literal PAT** — which we don't want in a committed file. User-scope `~/.claude/settings.json` is private to the machine.
- **Vercel MCP** was already user-scope before this project existed; no reason to duplicate.
- The deprecated `@modelcontextprotocol/server-github` stdio npm package would work with `${env:VAR}`, but it does not expose tools to modern Claude Code sessions (so isn't a real workaround).

### Why the custom name `github-meetthefam`

User-scope MCPs load in *every* claude session. The PAT we mint is fine-grained-scoped to only `SanchitB23/meetthefam`, so any call from an unrelated session would 404. Naming the server `github-meetthefam` instead of generic `github` keeps that limit visible on every `claude mcp list` line — and prevents collision if you ever need a separate, broader-scoped GitHub MCP later.

### Fresh-machine GitHub MCP install

```bash
# 1) Mint a fine-grained PAT scoped only to this repo
#    https://github.com/settings/personal-access-tokens
#    Permissions: Administration / Contents / Issues / Pull requests R/W, Metadata R

# 2) Install at user scope (literal PAT goes to ~/.claude/settings.json — never any repo)
claude mcp add-json --scope user github-meetthefam "$(cat <<'EOF'
{
  "type": "http",
  "url": "https://api.githubcopilot.com/mcp",
  "headers": {
    "Authorization": "Bearer YOUR_GITHUB_PAT"
  }
}
EOF
)"

# 3) Verify
claude mcp list | grep -i meetthefam
# Expect: github-meetthefam: https://api.githubcopilot.com/mcp (HTTP) - ✓ Connected

# 4) Use it from chat
#    "use github-meetthefam to list any open issues in this repo"
```

### Fresh-machine Vercel MCP install

Confirm the current Vercel MCP package on Vercel's docs at install time, then:

```bash
claude mcp add --scope user vercel -e VERCEL_ACCESS_TOKEN=YOUR_VERCEL_TOKEN -- npx -y <vercel-mcp-package>
```

## Getting tokens for the project-scope MCPs

| Token | Where to mint |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | https://supabase.com/dashboard/account/tokens — populated in Phase 0 |

Place into `.env.local` (gitignored):

```
# .env.local
SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxxxxxxxxxx
```

(The GitHub PAT is **not** in `.env.local` — it's in `~/.claude/settings.json` because GitHub MCP is user-scope.)

## Making env vars visible to Claude Code (already wired in this repo)

`.mcp.json`'s `${env:VAR}` resolves against the **shell environment** of the process running `claude`, not against `.env.local` automatically. This repo bridges the gap with [direnv](https://direnv.net/) and a committed `.envrc`.

### Already done in this repo

- `.envrc` at the repo root contains `dotenv .env.local`.
- The author's `~/.zshrc` runs `eval "$(direnv hook zsh)"` so direnv loads on `cd`.
- After cloning on a fresh machine, run `direnv allow` once and the env vars load automatically every time you `cd` into the repo.

### Fresh-machine setup checklist

```bash
brew install direnv                       # if not installed
echo 'eval "$(direnv hook zsh)"' >> ~/.zshrc   # add to your zshrc once
exec zsh                                  # reload shell
cd <this-repo>
cp .env.local.example .env.local          # then fill in real tokens
direnv allow                              # authorize the .envrc
```

### Alternatives (NOT used here)

- **Manual `set -a; source .env.local; set +a`** before `claude` — works but you have to remember.
- **Per-MCP literal value in `.mcp.json`** — only acceptable if you also gitignore `.mcp.json`. Don't do this here.

## Workspace trust

Project-scope MCPs declared in `.mcp.json` need explicit **workspace trust** approval before their tools register into a Claude Code session. The trust dialog appears at session startup; if it never appears for you, run `claude mcp reset-project-choices` and restart `claude`.

`claude mcp list` and `/doctor` both **bypass** the trust dialog — they spawn servers for health checks and report ✓ Connected even when the session lacks tool registration. So a green status from those is necessary but not sufficient — you have to actually *use* a tool to confirm.

## Adding / removing servers later

Use `claude mcp add` and `claude mcp remove` (run in this directory):

```bash
# Add at project scope (writes to this repo's .mcp.json)
claude mcp add --scope project <name> -e VAR=${VAR} -- npx -y <package>

# Add at user scope (writes to ~/.claude/settings.json — applies to all repos)
claude mcp add --scope user <name> -e VAR=${VAR} -- npx -y <package>

# Verify what's loaded in the current session
claude mcp list
```

Run `claude mcp add --help` to see the exact flag set in your installed version of Claude Code — the syntax has shifted between releases.

## Tier 2 / Tier 3 — explicitly NOT in `.mcp.json`

Per the spec, we don't connect these in Phase −1:

- **Playwright MCP** — connect during Phase 9 (E2E)
- **Browser / Chrome DevTools MCP** — connect during Phase 8 (visual polish)
- **Sentry / PostHog / Stripe MCPs** — post-launch only, optional

Adding them now bloats Claude Code's context window for no current benefit.
