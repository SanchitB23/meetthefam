# MCP server setup

The project's [.mcp.json](../../.mcp.json) declares four Tier 1 MCP servers that Claude Code sessions in this repo should have available. None of the tokens are committed — all are referenced via `${env:VAR_NAME}` and live in `.env.local` (gitignored).

## The four MCPs

| Name | Package | Token env var | Purpose |
|---|---|---|---|
| `supabase` | `@supabase/mcp-server-supabase@latest` | `SUPABASE_ACCESS_TOKEN` | SQL queries, schema, migrations, RLS |
| `context7` | `@upstash/context7-mcp@latest` | *(none)* | Live docs for Next.js, Supabase, family-chart, Tailwind, shadcn |
| `github` | `@modelcontextprotocol/server-github` | `GITHUB_PERSONAL_ACCESS_TOKEN` | Branches, PRs, issues, repo metadata |
| `vercel` | `@vercel/mcp-adapter@latest` | `VERCEL_ACCESS_TOKEN` | Deployments, env vars, custom domains |

> **Verify package names before first run.** MCP server packages occasionally rename or split — confirm the current package on the registry / vendor docs the first time you set this up.

## Getting the tokens

| Token | Where to mint |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | https://supabase.com/dashboard/account/tokens |
| `GITHUB_PERSONAL_ACCESS_TOKEN` | https://github.com/settings/personal-access-tokens — fine-grained, scope to this repo, `Contents: read/write`, `Pull requests: read/write`, `Issues: read/write` |
| `VERCEL_ACCESS_TOKEN` | https://vercel.com/account/tokens |

Place each into `.env.local` (gitignored):

```
# .env.local
SUPABASE_ACCESS_TOKEN=sbp_xxxxxxxxxxxxxxxxxxxxxxxx
GITHUB_PERSONAL_ACCESS_TOKEN=github_pat_xxxxxxxxxxxxxxxxxxxxxxxx
VERCEL_ACCESS_TOKEN=xxxxxxxxxxxxxxxxxxxxxxxx
```

## Making env vars visible to Claude Code

`.mcp.json`'s `${env:VAR}` resolves against the **shell environment** of the process running `claude`, not against `.env.local` automatically.

Pick one of these to bridge the gap:

### Option A — direnv (recommended)

Install [direnv](https://direnv.net/), then in the repo root:

```bash
echo 'dotenv .env.local' > .envrc
direnv allow
```

Now every `cd` into this directory loads the env vars. `claude` inherits them.

### Option B — Manual export per shell session

```bash
set -a; source .env.local; set +a
claude
```

Or wrap into a tiny launcher script you run instead of `claude` directly.

### Option C — Per-MCP literal value (last resort, NOT recommended)

Edit `.mcp.json` and replace `${env:VAR}` with the literal token. **Then add `.mcp.json` to `.gitignore`** — never commit the result.

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
