# Postmortem template

<!-- 
USE THIS TEMPLATE FOR S1 AND S2 INCIDENTS ONLY.

- S1 (critical): production is down or data is being lost for all/most users.
- S2 (major): a core feature is broken or severely degraded for a significant subset of users.
- S3 (minor): a non-critical feature is affected or impact is narrow.
  → S3 incidents get a Slack-thread debrief instead of a full postmortem.

Copy this file to docs/runbooks/postmortems/YYYY-MM-DD-<slug>.md and fill in every section.
Delete placeholder lines once filled. Do not leave template scaffolding in a completed postmortem.
-->

---

## Header

| Field | Value |
|---|---|
| **Incident title** | *Short, factual description of what broke* |
| **Severity** | *S1 / S2* |
| **Date** | *YYYY-MM-DD* |
| **Duration** | *HH:MM (detection → resolution)* |
| **On-call / author** | *GitHub handle* |

---

## 1. Summary

*2–3 sentences. What broke, who noticed it first, and how it was resolved. Write as if the reader has zero context.*

---

## 2. Impact

- **Users affected:** *e.g. "all authenticated users", "users whose tree had >10 members", "~40% of invite recipients"*
- **Features degraded:** *list each affected feature and how it was degraded (unavailable / slow / incorrect)*
- **Data impact:** *any data lost, corrupted, or exposed? If none, state "None."*
- **SLA / SLO consequences:** *did we breach any stated SLA? which SLO was missed (availability, latency, error rate)?*

---

## 3. Timeline

*All times in UTC. Be precise — copy from Vercel deploy logs, Supabase logs, or monitoring alerts where possible.*

| Time (UTC) | Event |
|---|---|
| `HH:MM` | *First signal — user report / alert / error spike* |
| `HH:MM` | *Incident declared / on-call paged* |
| `HH:MM` | *Diagnosis started* |
| `HH:MM` | *Root cause identified* |
| `HH:MM` | *Mitigation applied (rollback, feature flag off, hotfix deployed)* |
| `HH:MM` | *Incident resolved — normal service confirmed* |
| `HH:MM` | *Postmortem opened* |

**External references:**
- Vercel deploy IDs: *e.g. `dpl_abc123`*
- Supabase incident IDs: *e.g. Supabase status page incident `#XXXX`, if applicable*
- User reports: *link to Slack thread, GitHub issue, or support ticket*

---

## 4. Root cause

*What actually went wrong. Trace the full chain of contributing factors, not just the proximate trigger. Answer the question: "Why did this happen, and why did our existing safeguards not catch it?"*

*Use 5-Whys or a similar technique if the chain is non-obvious. Each "why" should be a complete sentence.*

---

## 5. What went well

*Genuine wins only — no morale fluff. Things that worked as designed, caught the problem early, or limited the blast radius.*

- *e.g. "RLS policies prevented the data-corruption from spreading to other tenants' trees."*
- *e.g. "The share-link token design meant unauthenticated users were never exposed."*

---

## 6. What went poorly

*Be honest and specific. This is not about blame — it is about friction. What slowed detection? What slowed diagnosis? What slowed recovery?*

- *e.g. "No uptime monitor on the `/api/share` route — we learned about the outage from a user report, 40 minutes after it started."*
- *e.g. "Migration was applied to prod without a dry-run on QA first."*

---

## 7. Action items

*Each item must be a concrete code change, process change, or tooling change. "Be more careful" is not an action item.*

| # | Action | Type | Owner | GH issue |
|---|---|---|---|---|
| 1 | *Concise description of the action* | *code / process / tooling* | *@handle* | *#NNN* |
| 2 | | | | |
| 3 | | | | |

---

## 8. Lessons learned

*2–3 sentences of reusable insight for the next on-call. What would a future engineer need to know to prevent or resolve a similar incident faster?*
