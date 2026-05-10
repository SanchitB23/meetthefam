# MCP server setup

The project's [.mcp.json](../../.mcp.json) declares four Tier 1 MCP servers that Claude Code sessions in this repo should have available. None of the tokens are committed — all are referenced via `${env:VAR_NAME}` and live in `.env.local` (gitignored).

## The three project-scope MCPs

| Name | Package | Token env var | Purpose |
|---|---|---|---|
| `supabase` | `@supabase/mcp-server-supabase@latest` | `SUPABASE_ACCESS_TOKEN` | SQL queries, schema, migrations, RLS |
| `context7` | `@upstash/context7-mcp@latest` | *(none)* | Live docs for Next.js, Supabase, family-chart, Tailwind, shadcn |
| `github` | `@modelcontextprotocol/server-github` | `GITHUB_PERSONAL_ACCESS_TOKEN` | Branches, PRs, issues, repo metadata |

> **Verify package names before first run.** MCP server packages occasionally rename or split — confirm the current package on the registry / vendor docs the first time you set this up.

## Vercel MCP — kept at user scope, not in `.mcp.json`

The author's `~/.claude/settings.json` already includes the Vercel MCP at user scope, so the project deliberately does **not** duplicate it at project scope. If you're cloning this repo on a fresh machine and you want Vercel MCP available, add it at user scope:

```bash
claude mcp add --scope user vercel -e VERCEL_ACCESS_TOKEN=$VERCEL_TOKEN -- npx -y <vercel-mcp-package>
```

Confirm the current Vercel MCP package name from Vercel's docs at the time of install.

## Getting the tokens

| Token | Where to mint |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | https://supabase.com/dashboard/account/tokens |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | https://github.com/settings/personal-access-tokens — fine-grained; for the existing personal account; permissions: Administration / Contents / Issues / Pull requests R/W, Metadata R |

Place each into `.env.local` (gitignored):

```
# .env.local
SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_PERSONAL_ACCESS_TOKEN=github_pat_xxxxxxxxxxxxxxxxxxxxxxxx
```

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
