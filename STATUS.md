# meetthefam — Service status

This page is the canonical place to check on **meetthefam** during an incident.
It is updated by hand by the maintainer — there is no automated uptime probe
behind it yet (see "How this page works" below).

## Current status

🟢 **Operational** — all systems normal.

_Last reviewed: 2026-05-29_

| Component | Status |
|---|---|
| Web app (Vercel) | 🟢 Operational |
| Auth + magic links (Supabase Auth) | 🟢 Operational |
| Database (Supabase Postgres) | 🟢 Operational |
| Photo storage (Supabase Storage) | 🟢 Operational |

Status key: 🟢 Operational · 🟡 Degraded / partial outage · 🔴 Major outage · 🔧 Maintenance

## Incident log

_No incidents recorded yet._

<!--
When an incident happens, prepend a new entry at the top of this list using the
template below. Keep it short — full analysis belongs in a postmortem
(docs/runbooks/postmortem-template.md), which this entry links to.

### YYYY-MM-DD — <short title>
- **Status:** Investigating → Identified → Monitoring → Resolved
- **Impact:** what users saw (e.g. "magic-link emails delayed ~20 min")
- **Started / resolved:** HH:MM–HH:MM UTC
- **Postmortem:** link to the filled-in postmortem, if one was written
-->

## How this page works

meetthefam ships with a **zero-infrastructure status surface** for v1.0: this
Markdown file, committed to the repo, is the source of truth for incident
comms. It costs nothing, has no third-party account to keep alive, and is
versioned alongside the code.

**Trade-off:** there is no automated uptime history or component health-check
behind it — the maintainer updates it manually during an incident. A real
hosted status page (BetterStack / Instatus / statuspage.io) with automated
probes is deferred to v1.1, gated on the observability / uptime-monitor
decision tracked in [issue #103](https://github.com/SanchitB23/meetthefam/issues/103).
When that lands, this file becomes a pointer to the hosted page.

## Reporting an issue

Hitting a problem that this page doesn't reflect? Open an issue on
[GitHub](https://github.com/SanchitB23/meetthefam/issues) or contact the
maintainer directly.
