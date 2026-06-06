# #216 — Avatar `crossorigin` + export CORS validation (design)

> Date: 2026-06-06 · Milestone: **v1.2 — Export & archival** · Epic: #60 (tree export PNG/PDF)
> Sub-issue of #60. Prereq for #218 (PNG export). Independent of #215 (full-tree spike) and #217 (containerRef refactor).

## Problem

Tree export (#218) rasterises the rendered family-chart DOM onto an HTML `<canvas>` to produce a PNG/PDF. Person avatars in that DOM are plain `<img>` tags whose `src` points at public Supabase Storage URLs (cross-origin to the app domain). A cross-origin `<img>` loaded **without** CORS taints the canvas — the subsequent `canvas.toBlob()` / `toDataURL()` throws a `SecurityError`. Photos are the whole point of the export (name → face), so this blocks #218.

## CORS dig — findings (banked 2026-06-06, QA `ljjvwtpifmoshfknlbaj`)

Probed the `photos` bucket public-object endpoint (`/storage/v1/object/public/photos/...`), real 200 object + nonexistent 400:

| Probe | `access-control-allow-origin` | `cf-cache-status` | `Vary` |
|---|---|---|---|
| GET, no `Origin` (today's plain img) | `*` | MISS → cached | none |
| GET, with `Origin` (crossOrigin fetch) | `*` | **HIT** | none |
| OPTIONS preflight | `*` | — | — |

Conclusions:

1. **ACAO `*` is unconditional** — emitted whether or not `Origin` is present, on cached and uncached responses, on 200 and 400.
2. **Cached HIT retains ACAO `*`** — the real-object second fetch (with `Origin`) hit the Cloudflare cache and still carried `access-control-allow-origin: *`.
3. **No cache poisoning is possible** — the feared scenario (a no-`Origin` response cached *without* ACAO, later reused for a CORS request) cannot occur because the value never varies. No `Vary: Origin` is needed.
4. `cache-control: public, max-age=3600` on objects; served behind Cloudflare.

Therefore adding `crossorigin="anonymous"` to the avatar `<img>` is **sufficient and safe** — no bucket / CDN configuration change is required.

Caveat: probed QA only. Prod (`ycnsgkotrbjifsjkqmvn`) is frozen pre-v1 and uses the identical Supabase storage layer, so the behaviour is the same; worth a one-line re-probe at the v1.0 launch cut-over, but it carries no design risk.

## Change

Add `crossorigin="anonymous"` to the single avatar `<img>` in
`src/app/(app)/tree/[id]/_lib/person-node-html.ts` (currently ~line 142, inside the `if (data.photo_url)` branch), with an adjacent code comment explaining that it un-taints the export canvas (#60 / #218) so a future edit doesn't strip it.

This is the only `<img>` in the exportable tree DOM. The initials and deceased-badge paths emit no `<img>`, so they are untouched. The module is shared by both `/tree/[id]` and `/share/[token]`, so both surfaces gain the attribute — a bonus for a future share-link export, at no cost.

## Files

- `src/app/(app)/tree/[id]/_lib/person-node-html.ts` — add the attribute + explanatory comment (photo path only).
- `src/__tests__/tree/person-node-html.test.ts` — assert the photo-path markup contains `crossorigin="anonymous"`; assert the initials path still emits no `<img>` (no regression).
- `docs/architecture/photo-upload.md` — add a short "CORS / canvas export" subsection capturing the dig findings above (the doc already documents the public bucket + URL shape, so this is a natural home).

## Testing (scope = unit only)

Decision: **markup + unit test only.** The dig already empirically proved ACAO `*` works; a real canvas-taint integration test belongs with the code that owns the canvas (#218), where the export pipeline and a real browser canvas exist. Duplicating that scaffolding here would be wasted work.

- Unit: TDD on `person-node-html.test.ts` — write the `crossorigin` assertion first, watch it fail, then edit the markup to pass.
- Manual smoke: load a tree with photos, confirm avatars render normally with the attribute set (no visible regression); confirm the initials path is unchanged.
- Verification before completion: `pnpm typecheck`, `pnpm lint`, `pnpm test` (relevant suite) all green before PR.

## Out of scope

- Canvas / export pipeline code (owned by #218).
- `crossorigin` on other `<img>` surfaces (the `<Avatar>` in person detail / members list) — those are not part of the exported DOM. YAGNI.
- Any bucket / CDN / Supabase config change — the dig confirmed none is needed.
- Prod CORS re-probe — a one-line launch-checklist item, not part of this change.

## Process

TDD → verification-before-completion → requesting-code-review → finishing-a-development-branch (draft PR carrying bare `Closes #216` + the v1.2 milestone, per project conventions). Change is small enough to implement inline; no subagents required.
