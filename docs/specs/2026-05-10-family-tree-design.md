# Family Tree Web App — Implementation Plan

## Context

Building a multi-tenant SaaS family tree website. Initial driving use case: the author is getting married and wants a polished, mobile-friendly tool he and his wife can use to learn each other's families before the wedding. Long-term: anyone can sign up and build their own private trees.

Driving constraints:

- **Multi-tenant** — public signup, anyone can create trees.
- **Lightweight "meet-the-family"** scope — names, photos, short bios, parent / child / spouse links. Not a genealogy power-tool.
- **Multi-editor collaboration** per tree (owner + invited editors).
- **Simple relationships only** — one spouse, one parent pair. No step / adoption / multiple marriages in v1.
- **Mobile-first UI** — phones are the primary device.
- **Tree size target: 50–200 people** per tree.
- **Privacy default**: private + optional read-only share link.
- **Cost**: must run on free tiers initially (Vercel Hobby + Supabase Free).
- **Timeline**: 1–3 months target, AI-assisted (Claude Code, Claude.ai chat / Desktop, the `frontend-design` skill, and ChatGPT for second opinions — see *AI tooling strategy* below).
- **Tree rendering paradigm**: horizontal focus-person tree (re-center on tap), built on the [donatso/family-chart](https://github.com/donatso/family-chart) D3-based MIT library.

## Architecture (locked)

```
[Vercel: Next.js 16 App Router]
        │
        ├── React Server Components + Server Actions
        ├── Route Handlers for share-link / auth callbacks
        │
        └── Supabase
              ├─ Postgres (people, trees, memberships)
              ├─ Auth (email + magic link, Google OAuth)
              ├─ Storage (photo bucket)
              └─ Row-Level Security policies enforce multi-tenancy
```

No separate Node / Go backend. All server logic in Next.js Server Actions.

---

## Data model

### Tables

```sql
-- Extends Supabase auth.users with display info
profiles (
  id            uuid pk references auth.users,
  display_name  text,
  avatar_url    text,
  created_at    timestamptz default now()
)

-- A family tree
trees (
  id           uuid pk default gen_random_uuid(),
  name         text not null,
  description  text,
  owner_id     uuid not null references auth.users,
  share_token  text unique,        -- null = sharing off; non-null = read-only link
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
)

-- Who can edit a tree (owner is also a row here for uniform queries)
tree_members (
  tree_id      uuid references trees on delete cascade,
  user_id      uuid references auth.users on delete cascade,
  role         text check (role in ('owner','editor')),
  invited_by   uuid references auth.users,
  joined_at    timestamptz default now(),
  primary key (tree_id, user_id)
)

-- A person in a tree
people (
  id           uuid pk default gen_random_uuid(),
  tree_id      uuid not null references trees on delete cascade,
  full_name    text not null,
  nickname     text,
  gender       text check (gender in ('m','f','other','unknown')) default 'unknown',
  photo_url    text,           -- Supabase Storage public URL
  bio          text,
  birth_year   int,
  birth_date   date,           -- optional full date if known
  location     text,           -- current city / "where they live"
  occupation   text,
  deceased     boolean default false,
  death_year   int,
  father_id    uuid references people,
  mother_id    uuid references people,
  spouse_id    uuid references people,   -- bidirectionally synced in app code
  created_at   timestamptz default now(),
  updated_at   timestamptz default now(),
  created_by   uuid references auth.users
)
```

### Why FKs on `people` instead of a relationships table

For "simple only" relationships (one spouse, one parent pair), three nullable self-FKs on `people` is the simplest representation. If we ever extend to multiple marriages / step / adoption, we migrate to a `relationships(person_a, person_b, type)` join table. Not now.

### Why a `gender` field

The family-chart library uses gender to style cards (color / icon). We support `'m' | 'f' | 'other' | 'unknown'` — `'other'` and `'unknown'` are first-class so the app stays inclusive.

### Edge cases handled in app code, not the DB

- **Spouse symmetry** — when setting `A.spouse_id = B`, the same transaction also sets `B.spouse_id = A` and clears any prior spouses. Wrapped in a single Server Action.
- **Cycle prevention** — a person can't be their own ancestor. Validated on insert/update.
- **Photo cleanup on delete** — when a person row is deleted, the Server Action also deletes the file in Supabase Storage.

### Authorization (Row-Level Security)

```
trees:
  SELECT  → owner_id = auth.uid() OR exists(tree_members where ...)
  UPDATE  → owner_id = auth.uid()
  DELETE  → owner_id = auth.uid()

tree_members:
  SELECT  → user_id = auth.uid() OR (caller is owner of the tree)
  WRITE   → only the owner of the tree

people:
  SELECT  → caller is owner or member of the tree
  WRITE   → caller has role in ('owner','editor') on the tree
```

**Read-only share link** — does not use RLS. A Route Handler at `/share/[token]` uses the Supabase `service_role` key (server-only) to look up the tree by `share_token` and return its data without auth. The 256-bit random token *is* the auth.

---

## Pages / routes

Six routes total (mobile-first; modals/bottom-sheets handle most secondary flows so we don't fragment into many pages).

| Route | Auth | Purpose |
|---|---|---|
| `/` | Public | Landing — what the product is, sign-up CTA |
| `/login` | Public | Email + magic link, Google OAuth |
| `/signup` | Public | Same form, "create account" mode |
| `/auth/callback` | Public | Supabase OAuth callback handler |
| `/dashboard` | Logged in | List of trees the user owns or is a member of, plus "+ New tree" |
| `/tree/[id]` | Member or owner | Core experience — family-chart canvas, "+" FAB, bottom-sheet person detail, "..." menu opens settings/members/share modals |
| `/share/[token]` | Public, token-gated | Read-only tree view; banner with "Sign up to create your own" |

Modals (not separate routes): person add/edit, tree rename, member management, share-link toggle.

## Tree view (the core experience)

```
┌──────────────────────────────────┐
│  ← Mom's family       [...]     │  ← header: tree name, menu
├──────────────────────────────────┤
│                                  │
│       [Grandpa] [Grandma]        │
│              │                   │
│     [Aunt][Mom][Dad][Uncle]      │  ← family-chart canvas
│              │                   │     pan + zoom + tap to recenter
│           [YOU]                  │
│                                  │
│                                  │
│                          [ + ]   │  ← FAB: add person
└──────────────────────────────────┘
```

- **Tap a person** → bottom sheet with avatar, name, bio, birth year, location, occupation. Edit button visible iff user has edit role.
- **Long-press / "..." on a person** → action menu: "Re-center here," "Edit," "Set spouse," "Set parents," "Add child," "Delete."
- **Pinch-zoom + pan**: handled by family-chart out of the box.
- **Re-centering**: clicking another person calls `chart.setMainId(id)` and updates the URL hash to `#p=<id>` so it's bookmarkable / shareable.

## Add / edit / link person

A single form covers add and edit. Fields: full_name (required), nickname, photo, bio, gender, birth_year, birth_date, location, occupation, deceased toggle, death_year. When opened from `+` it's empty; when opened from a person it's prefilled.

**Linking** can happen at creation time (preferred) or after:

- **At creation**: form has a "How is this person related?" picker — "spouse of X," "parent of X," "child of X" — where X is preselected if the form was opened from a specific person's menu.
- **After**: from a person's action menu, "Set spouse" / "Set parents" / "Add child" opens a person-picker filtered to the current tree. "Add child" prefills parents and opens the add-person form.

## family-chart integration

family-chart is framework-agnostic D3. We wrap it in a `'use client'` React component. Data flow:

1. **Server Component** at `/tree/[id]/page.tsx` fetches `trees` + all `people` rows in two Supabase queries (RLS auth-checks for free).
2. Server transforms the rows into family-chart's expected shape — adding `children: [...]` arrays computed from `father_id` / `mother_id`.
3. Initial data passes as a prop to `<FamilyTree>` Client Component, which calls `f3.createChart(...)`.
4. **Edits** go through Server Actions. After mutation, `revalidatePath('/tree/[id]')` re-fetches; the client component diffs and re-renders.
5. **No real-time in v1.** Last-write-wins with revalidate is fine for ≤10 concurrent editors. Supabase Realtime is out of scope for this plan; can be revisited later if a user actually reports a collision problem.

## Photo upload

- Single avatar per person (per scope decision).
- **Client-side resize before upload** — using `createImageBitmap` + canvas, max 1024×1024 JPEG quality 0.85. Cuts a 5 MB phone photo to ~150 KB.
- Upload path: `trees/<tree_id>/people/<person_id>/avatar.jpg` in a single Supabase Storage bucket called `photos`.
- Storage policies mirror the people table's authorization (only members of the tree can write).
- On person delete: same Server Action removes the storage file.
- 1 GB free tier × ~150 KB per photo = ~6,500 photos before we hit Pro. Plenty for v1.

## Auth

- **Email magic link** + **Google OAuth**. No password fields in v1 — magic link is simpler to build, more secure, and avoids password-reset flows.
- **Custom form**, not `@supabase/auth-ui-react` — the prebuilt component is hard to style and dated. A custom form is ~50 lines and looks better.
- Supabase session lives in a secure cookie via `@supabase/ssr`. Server Components and Server Actions read it via the standard pattern.

## Share link mechanics

- Owner toggles "Enable read-only share link" in tree settings → backend mints a 32-byte random `share_token` and stores it on the tree row.
- The toggle exposes a copy-able URL `https://app/share/<token>`.
- "Regenerate token" replaces the token (old URL stops working).
- "Disable sharing" sets `share_token = null`.
- `/share/[token]` is a Route Handler that uses the Supabase **`service_role`** key (server-only env var) to fetch the tree + people without auth. Renders the same `FamilyTree` component in read-only mode + a banner: "You're viewing a shared family tree. [Create your own]."

---

## AI tooling strategy

Four tools, four jobs. The point is to use the right one for the right step rather than asking one tool to do everything.

| Tool | What it's best at | What it's NOT for |
|---|---|---|
| **Claude Code** (CLI) | The bulk of the build. Reads/edits files, runs commands, scaffolds the app, wires Supabase, writes Server Actions, runs tests, fixes type errors. **Primary executor.** | Visual exploration of "what should this screen look like?" |
| **Claude Code's `frontend-design` skill** ("Claude Design") | Generating distinctive, polished React + Tailwind UI for individual screens. Tree-view canvas styling, person cards, bottom sheets, landing page hero, empty states. | Backend logic, data flow, RLS, business rules. |
| **Claude.ai chat (Desktop / Web)** | Thinking partner — architecture discussions like this plan, code review, doc drafting, "is this approach sane?" check-ins. | Direct file editing — that's Claude Code's job. |
| **ChatGPT** | Second opinion / sanity check on tricky problems. Different model bias sometimes catches what Claude misses. | The bulk of the build — splitting context across two tools wastes time. |

### Do we *need* Claude Design?

Yes, but only at the visual-design stage. The frontend-design skill is specifically tuned to avoid generic AI-looking UI ("rounded cards on a gradient") and produce distinctive, production-grade design. For a "meet-the-family" product where photos and personality matter, that polish is the difference between "useful" and "I want to show this to my wife."

We do **not** need it for: schema, auth, RLS, server actions, the family-chart wrapper logic, deployment, anything backend.

### Concrete usage map

| Build step | Primary tool | Notes |
|---|---|---|
| Scaffold Next.js + Supabase + Tailwind | Claude Code | One session; CLI can run `npx create-next-app`, write env files, run migrations |
| Initial visual direction (3-5 mockups, pick one) | ~~Claude Design~~ **Resolved out-of-band** | **Locked in via [ADR 0008](../adrs/0008-design-system.md)** — heirloom-journal direction anchored on the [Kintree prototype](../ux/inspiration/kintree/). The `frontend-design` skill use-case shifts to *executing* those tokens at Phase 8, not exploring style. |
| Auth (login / signup / callback) | Claude Code | Custom form, magic-link flow |
| Dashboard (tree list) | Claude Code, polished by Claude Design | Function first, polish after |
| Tree CRUD + member CRUD | Claude Code | Pure backend + form work |
| family-chart wrapper + data transform | Claude Code | Reads family-chart docs, wires to Supabase |
| Tree-view canvas styling, person card design | Claude Design | The defining visual surface — worth the polish |
| Bottom sheet, action menu, modals | Claude Design | Mobile-feel polish matters here |
| Photo upload + client-side resize | Claude Code | Pure code |
| Share link page | Claude Code, polished by Claude Design | Read-only canvas + signup CTA banner |
| QA / regression / debugging | Claude Code | TDD / verification before completion |
| Stuck on a tricky bug or design call | ChatGPT (second opinion) | Optional |

### Workflow rules of thumb

- **Don't ask Claude.ai chat to write code that should land in the repo** — paste it into Claude Code instead so file state is correct.
- **Don't ask Claude Code to do open-ended visual exploration** — it'll over-converge on safe choices. Use the `frontend-design` skill explicitly when you want distinctive output.
- **One session per logical task.** Don't try to scaffold + auth + dashboard in one Claude Code session — fresh context per coherent unit produces better edits.
- **Commit between tools.** When handing off Claude Design output to Claude Code (or vice versa), commit the previous step first so any tool can roll back cleanly.
- **Always ask before committing.** Claude Code never auto-commits in this repo. After each mini-task — even the small ones — pause and ask the user "want to commit this now?" before running `git commit`. The user reviews the diff, then says yes/no. This applies throughout Phase −1 and every later phase. Encoded in the project's `CLAUDE.md` so any future session inherits the rule.

### MCP servers to connect to Claude Code

MCPs (Model Context Protocol servers) plug specialized tools into Claude Code so it can talk to Supabase, Vercel, GitHub, etc. directly instead of via shell. **Connect only what you actively use** — each MCP adds context-window cost.

**Tier 1 — Connect at project start (high leverage, low setup):**

| MCP | Why for this project | Setup |
|---|---|---|
| **Supabase MCP** | Run SQL, inspect schema, manage migrations and RLS policies, debug auth — without leaving the terminal | Official from `supabase-community` — needs a Supabase personal access token |
| **Context7** | Pulls live docs for Next.js 16, Supabase, family-chart, Tailwind, shadcn/ui, react-hook-form. Cuts API-spec hallucinations dramatically | `@upstash/context7-mcp`; no auth needed |
| **GitHub MCP** | Branches, PRs, issues, repo operations from inside the Claude Code session | Official Anthropic — needs a GitHub fine-grained personal access token |
| **Vercel MCP** | List / manage deployments, env vars, custom domains without flipping to the dashboard | Official Vercel MCP — needs a Vercel access token |

**Tier 2 — Connect when relevant (during specific phases):**

| MCP | Why | Connect during |
|---|---|---|
| **Playwright MCP** | Drive a real browser for E2E tests; Claude Code can write *and* run Playwright tests interactively | Phase 9 (QA + edge cases) |
| **Browser / Chrome DevTools MCP** | Inspect the running dev server visually, take screenshots, feed them back into the `frontend-design` loop | Phase 8 (visual polish) |

**Tier 3 — Skip for now, revisit only post-launch:**

| MCP | Why we're skipping |
|---|---|
| Sentry MCP | Error monitoring — only worth it once real users are reporting bugs |
| PostHog MCP | Product analytics — only worth it once you have flows to measure |
| Stripe MCP | Billing — out of scope for v1.0 |

**Important — keep them isolated to this project:**

- Configure these MCPs in **`.mcp.json` at the project root**, not globally. Your work MCPs (Datadog, GitLab, Kubernetes, Azure, etc.) shouldn't pollute this project's context, and vice versa.
- `.mcp.json` is committed to the repo so any future Claude Code session opened in this repo automatically gets the same toolset.
- Tokens for the MCPs (Supabase PAT, GitHub PAT, Vercel token) go in **`.env.local`** (gitignored), referenced from `.mcp.json` via `${env:VAR_NAME}` syntax. Never commit tokens.
- If you find Claude Code feeling slow / context-heavy, drop the Tier 2 / Tier 3 MCPs back out — minimum viable set is Supabase + Context7 + GitHub.

---

## Build phasing

Two milestones: **v0.1** (private MVP — works for you alone, no sharing yet) and **v1.0** (multi-tenant public launch). Each phase has a clear "Done when…" gate so you can demo / use the app at every step.

### Phase −1 — Project AI infrastructure (before any feature code)

Goal: a clean repo where Claude Code sessions auto-load full project context — conventions, specs, MCP tools, and project-specific subagents — so every Claude session starts productive instead of re-discovering the project. **Done before any feature code is written.**

**Confirmation gates (Claude Code asks user, then proceeds):**

1. **Working directory name** — ask user; create `/Users/sqb6461/Workspace/SelfProjects/<name>/`. Suggestions: `family-tree-app`, `meetthefam`, `kintree`. Verify the path doesn't already exist.
2. **GitHub repo name + visibility** — ask user; default to private.
3. **SSH alias verification** — `Read ~/.ssh/config`, locate `github-personal` alias (per the user's `git-remote-guard` skill convention), confirm with user. Only then run `git remote add origin git@github-personal:<user>/<repo>.git`.

**Artifacts created in Phase −1:**

```
<work-dir>/
├── README.md                         # Public-facing one-pager
├── CLAUDE.md                         # Top-level conventions for any Claude Code session
├── .gitignore                        # node_modules, .env.local, .next, .vercel, .superpowers, etc.
├── .mcp.json                         # Tier 1 MCPs: Supabase, Context7, GitHub, Vercel
├── .env.local.example                # Template — real .env.local is gitignored
│
├── docs/                             # Spec-driven knowledge base
│   ├── README.md                     # Index of all docs
│   ├── specs/
│   │   └── 2026-05-10-family-tree-design.md   # This plan, lifted in
│   ├── architecture/
│   │   ├── overview.md               # System diagram, data flow
│   │   ├── data-model.md             # Tables, FK rationale, edge cases
│   │   ├── auth-and-rls.md           # RLS policies + share-link bypass
│   │   ├── photo-upload.md           # Client resize, storage paths
│   │   └── share-link.md             # Token mechanics
│   ├── ux/
│   │   ├── pages-and-routes.md
│   │   ├── tree-view.md              # family-chart integration, gestures
│   │   ├── add-edit-person.md        # Form + linking flow
│   │   └── mobile-gestures.md        # Tap, long-press, pan, zoom
│   ├── adrs/                         # Architecture Decision Records
│   │   ├── 0001-supabase-over-firebase.md
│   │   ├── 0002-fks-on-people-not-relationships-table.md
│   │   ├── 0003-no-realtime-in-v1.md
│   │   ├── 0004-magic-link-only-no-passwords.md
│   │   ├── 0005-three-environments.md
│   │   └── 0006-frontend-design-skill-for-visual-polish-only.md
│   └── tasks/
│       └── current-phase.md          # Living task list — Claude updates as work progresses
│
└── .claude/                          # Project-specific Claude Code config
    ├── settings.json                 # Project-level Claude Code settings
    └── agents/                       # Project-specific subagents
        ├── supabase-engineer.md      # Schema, migrations, RLS, DB-touching server actions
        ├── frontend-engineer.md      # React components, gestures, family-chart wrapper
        └── test-engineer.md          # Vitest (RLS, server actions), Playwright (E2E)
```

**Why each piece earns its place:**

- **CLAUDE.md (root)** — Loaded automatically by every Claude Code session in this repo. Contains: one-paragraph project context, "where to look first" pointers (`docs/specs/`, `docs/adrs/`), naming + commit conventions, "always run `npm run typecheck` before committing" type rules, **and the standing rule "always ask the user before running `git commit`, even for small changes."**
- **docs/specs/** — The brainstorming spec (this plan) becomes the canonical reference. ADRs in `docs/adrs/` are short (~1 page each) records of *why* a non-obvious decision was made.
- **docs/architecture/ + docs/ux/** — The plan, sliced into bite-sized files Claude can load just-in-time without pulling the whole spec into context.
- **docs/tasks/current-phase.md** — Living checklist for whichever phase we're in. Claude updates as it finishes items. Survives session resets.
- **.claude/agents/** — Three subagents tuned for this project:
  - `supabase-engineer` — knows our schema, RLS philosophy, migration workflow
  - `frontend-engineer` — knows family-chart, our component patterns, mobile gestures
  - `test-engineer` — knows Vitest setup + the three E2E flows we test
  - These let `Agent` tool calls stay focused with the right system prompt instead of every Claude Code session re-establishing context.
- **.claude/skills/** — *Deliberately empty in Phase −1.* Skills are best added once we've seen which workflows actually repeat. Premature skills bloat the kit.
- **.mcp.json** — Tier 1 MCPs only (Supabase, Context7, GitHub, Vercel). Tokens read from `.env.local` via `${env:VAR}`.

**Phase −1 ship gate**: from a fresh terminal in the work directory, `claude` opens a session that auto-loads CLAUDE.md, has Tier 1 MCPs available, has access to the three agents, and can answer questions about the data model from `docs/architecture/data-model.md` without re-reading the spec.

**Driver tool**: Claude Code (executing the steps in this plan). Estimated: 1–2 days.

---

### v0.1 — Personal MVP (you can use it yourself)

| # | Phase | Days | Driver tool | Done when |
|---|---|---|---|---|
| 0 | Foundation | 1–2 | Claude Code | Next.js 16 + Tailwind v4 + shadcn/ui app scaffolded inside the Phase −1 repo; **local Supabase stack** (`supabase start`) running with all tables + RLS policies migrated; **QA Supabase project** created on the hosted free tier and pointed at by a Vercel deployment from the `qa` branch (production project deferred until v0.1 ship); a "logged-in placeholder" page proves auth + DB are wired end-to-end. |
| 1 | Auth | 2–3 | Claude Code | Magic-link + Google OAuth login; sessions persist; `/dashboard` is protected. |
| 2 | Tree CRUD + dashboard | 3–5 | Claude Code | Logged-in user can create / rename / delete trees; sees a list of their trees on `/dashboard`. |
| 3 | People CRUD + linking | 4–7 | Claude Code | Add / edit / delete people; set spouse / parents / add child; bidirectional spouse sync works; cycle detection works. **No visualization yet** — verify via DB rows. |
| 4 | Tree visualization | 3–5 | Claude Code | family-chart renders a real tree from real data; tap → bottom sheet; long-press / "…" → action menu; pan + zoom; URL hash carries focus person. |
| 5 | Photo upload | 2–3 | Claude Code | Single avatar per person; client-side resize to 1024 px; uploaded to Supabase Storage; rendered on cards; deleted on person delete. |

**v0.1 ship gate**: you can build and use your own family tree end-to-end on your phone. ~15–25 working days *on top of* the 1–2 days for Phase −1.

### v1.0 — Multi-tenant launch

| # | Phase | Days | Driver tool | Done when |
|---|---|---|---|---|
| 6 | Collaboration | 2–4 | Claude Code | Owner invites editors by email (Supabase magic-link invite); editors can edit; owner can revoke. UI permission-gates correctly. |
| 7 | Share link | 1–2 | Claude Code | Owner toggles share on/off; copy link; regenerate token; `/share/[token]` renders read-only tree without auth via `service_role`. |
| 8 | Visual polish + landing | 3–5 | **Claude Design** (frontend-design skill) | Distinctive tree-view styling, person cards, bottom sheet, landing-page hero, empty / loading / error states. |
| 9 | QA + edge cases + launch | 2–3 | Claude Code + ChatGPT for review | Common flows tested end-to-end; deleting people works without orphans; unlinking spouses correct; performance OK on 200-person tree. Domain pointed; live. |

**v1.0 ship gate**: anyone can sign up, build a tree, invite collaborators, share read-only. ~10–20 working days on top of v0.1.

**Total calendar estimate (AI-assisted side project)**: ~4–6 weeks for v0.1, ~6–9 weeks for v1.0. Comfortably inside the 1–3 month target.

Anything past v1.0 is intentionally out of scope for this plan.

---

## Testing + cost + deployment

### Testing strategy (lightweight, not exhaustive)

| Tier | Tooling | Coverage target |
|---|---|---|
| **RLS tests** | Vitest + Supabase test client | **Critical.** Every multi-tenant SaaS gets bitten by RLS holes. Test that user A cannot SELECT / UPDATE user B's tree, people, or membership rows. |
| **Server-action integration tests** | Vitest | Critical actions only — `createPerson`, `setSpouse` (symmetry), `deleteTree` (cascade + photo cleanup), `share-link generation`. |
| **E2E happy paths** | Playwright | One flow each: signup → create tree → add 5 people → link → view; share-link round trip; collaborator invite + edit. |
| Component unit tests | — | Skip. Not worth the time for this scope. |
| Visual regression | — | Skip. Manual + screenshots in PRs is enough. |

### Cost (early stage = $0)

| Service | Free tier | When this breaks |
|---|---|---|
| Vercel Hobby | 100 GB bandwidth / mo, 100 GB-hours compute. One Hobby account hosts QA + production deployments fine. | If a tree goes viral. Then: Pro at $20/mo. |
| Supabase Free | 500 MB Postgres, 1 GB Storage, 50K MAU **per project**. The free org allows up to 2 active projects, which exactly matches our QA + production setup; local development uses the free local Docker stack and doesn't count. | At ~6,500 photos (avg 150 KB) or 50K active users. Then: Pro at $25/mo per project. |
| Custom domain | Cost of the domain itself (~$12/yr). One domain, with `qa.<domain>` as a subdomain. | — |

**Realistic monthly cost for the first year**: ~$1–2/mo (just the domain, amortized). Pro tier kicks in only if it actually grows.

**Inactivity caveat**: Supabase auto-pauses free-tier projects after ~1 week of no activity. Both QA and production should see at least weekly traffic from your own usage; if a project pauses, restoring it is a one-click action.

### Deployment — three environments

| Env | Where | Supabase | Vercel | Branch |
|---|---|---|---|---|
| **Local** | Developer machine | Supabase CLI local stack (`supabase start`) — full Postgres + Auth + Storage in Docker, free | Next.js dev server (`npm run dev`) | feature branches |
| **QA** | `qa.<your-domain>` | A dedicated hosted Supabase project — `family-tree-qa` | Vercel deployment tracking the `qa` branch | `qa` |
| **Production** | `<your-domain>` | A separate hosted Supabase project — `family-tree-prod` | Vercel deployment tracking `main` | `main` |

Promotion flow: feature branch → PR into `qa` (auto-deploys to QA) → smoke-test on QA → merge `qa` into `main` (auto-deploys to production). Vercel preview URLs on feature-branch PRs share the **QA** Supabase project (so previews aren't running against a fresh empty DB).

- **Migrations**: Supabase CLI; migrations live in `supabase/migrations/` in the repo. Apply locally first, then to QA, then to prod via CI on the relevant branch.
- **Secrets per environment**: each Vercel environment (Production / Preview / Development) holds its own copy of `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (server-only for the share-link route). Local uses `.env.local` pointing at the local Supabase stack.
- **Custom domain**: pick something simple — `meetthefam.app`, `kintree.app`, your own choice. QA uses a subdomain like `qa.meetthefam.app`.

---

## Verification (how to know v1 is real)

1. **Sign up two accounts** (you + a test address). Confirm magic-link works.
2. From account A: create a tree, add 10 people across 3 generations, link them, upload photos.
3. **Mobile check**: open on a phone. Tap, long-press, pinch-zoom, re-center on tap. Confirm bottom sheet feels native.
4. From account A: invite account B as editor. From B: log in, edit a person.
5. Toggle share link from A. Open in private/incognito (no auth). Confirm read-only.
6. **Negative test**: from a third unrelated account, confirm you cannot fetch A's tree by guessing IDs (RLS test).
7. Generate a 200-person tree (script or seed data). Confirm pan/zoom/re-center stay smooth on mobile.
8. Delete a person — confirm photo file in Storage is also gone.
9. Delete the whole tree — confirm cascade removed all people + members + photos.

Each item is a checkable end-to-end demo, not a unit test.


