# Gender shape system remap — design

> Spec for [#188](https://github.com/SanchitB23/meetthefam/issues/188)
> ("what should `Gender = 'Unknown'` surface as on the person card + tree node?").
> Authored via `superpowers:brainstorming` on 2026-06-02 with the visual companion.
> The original issue framed the question as "pick a treatment for `unknown`"; the
> brainstorm reframed it as a 4-way shape remap once the existing visual lever
> (avatar border-radius) was surfaced. See "Decisions locked" below.

## Goal

Replace the current avatar shape mapping so that:

1. `unknown` is no longer collapsed onto `f`'s circle (today's bug — the values are
   visually indistinguishable on every surface that consumes `<Avatar>`).
2. The four enum values render along a semantically meaningful axis: shape position
   on the soft-to-round spectrum encodes how committed the gender info is, with
   `other` jumping off the spectrum onto its own distinctive shape.

Pure renderer change. No data migration, no DB change, no enum change.

## Decisions locked (from brainstorming)

| Decision | Choice | Rationale |
|---|---|---|
| **Visual lever** | Avatar `border-radius` / `clip-path` only — no new icon, no badge, no color | Tone is forbidden from encoding gender (`docs/ux/avatars-and-tones.md`). Adding an icon or badge would invent a new visual axis the rest of the system doesn't use. The shape system already exists; this fix stays inside it. |
| **`unknown` shape** | Squircle (~34% border-radius) — geometric midpoint of `m` and `f` | "Unset" semantically reads as "between the two known values." Squircle sits on the existing soft-to-round spectrum at exactly that midpoint. |
| **`other` shape** | Soft octagon (8 sides, ~5% corner softening via Bezier-sampled polygon) | `other` is a deliberate identity choice, not a halfway point. Deserves a distinctive shape off the m → unknown → f spectrum. Octagon's symmetry (square bounding box, no horizontal-spread cost) fits next to `m` in PersonPicker rows without crowding. |
| **`m` / `f` shapes** | Unchanged (rounded-square 18%, circle 50%) | These values have stable visual identities in the existing system. Touching them would force a wider migration and break user expectations. |
| **Implementation approach** | CSS `clip-path: polygon(…)` — 40-vertex polygon sampled from a Bezier-rounded octagon | Visually indistinguishable from a true SVG `<path>` at every avatar size in use (max 80px). Same `<div>` + CSS markup as the other 3 shapes — no SVG branch, no two-surface divergence. Percentage coords auto-scale to any size. |
| **Octagon softness (`d`)** | `d = 5` (medium) — corner inset ~5% of side length | Sharp octagon (`d=0`) reads as the only hard-edged shape in the system and is out of place. Heavy softening (`d≥8`) blurs the octagon toward `other`'s old squircle territory at 48px (the tree-node size that matters most). `d=5` keeps the 8 facets readable while the corners feel soft enough to belong with `m`/`unknown`/`f`. |
| **Issue anchor** | #188 itself; PR `Closes #188` | Original issue's acceptance criteria already cover "decision recorded + implementation matches + UX doc updated" — the broader remap fits inside that scope without needing a new umbrella issue. |

## Architecture

### Files in scope

```
src/components/ui/avatar.tsx                    # MODIFIED — borderRadiusForGender() grows
src/app/(app)/tree/[id]/_lib/person-node-html.ts # MODIFIED — same swap inside the inline HTML string
docs/ux/avatars-and-tones.md                    # MODIFIED — table + contract update
```

No new files. Three touched. No DB / migration / RLS / route changes.

### Component contract change

`src/components/ui/avatar.tsx` currently exports:

```ts
export function borderRadiusForGender(
  gender: 'm' | 'f' | 'other' | 'unknown' | undefined,
  px: number,
): string
```

Returns a single CSS `border-radius` string. After this change, three of four values
still return a `border-radius` string and one returns a `clip-path` string. The
function signature gains a discriminated return:

```ts
export type GenderShape =
  | { kind: 'radius'; borderRadius: string }
  | { kind: 'clip-path'; clipPath: string }

export function shapeCssForGender(
  gender: 'm' | 'f' | 'other' | 'unknown' | undefined,
  px: number,
): GenderShape
```

The old `borderRadiusForGender()` is removed (no external callers besides
`person-node-html.ts`, which is migrated in the same PR). The rename is part of the
diff so that grep-finds match the new semantics.

### The shape constants

A single exported constant captures the octagon polygon, used by both surfaces:

```ts
// src/components/ui/avatar.tsx
//
// Soft octagon (~5% corner softening) — `other` gender's distinctive shape.
// Vertex list samples a quadratic Bezier curve at each of 8 corners, 5 points
// per corner, producing a 40-vertex polygon visually indistinguishable from a
// true SVG <path> at every avatar size in use (max 80px).
//
// Coordinates are percentages, so the same string scales to any size.
export const SOFT_OCTAGON_CLIP_PATH = `polygon(
  35% 0%, 65% 0%,
  67.41% 0.22%, 69.64% 0.89%, 71.68% 1.99%, 73.54% 3.54%,
  96.46% 26.46%,
  98.01% 28.32%, 99.12% 30.36%, 99.78% 32.59%, 100% 35%,
  100% 65%,
  99.78% 67.41%, 99.12% 69.64%, 98.01% 71.68%, 96.46% 73.54%,
  73.54% 96.46%,
  71.68% 98.01%, 69.64% 99.12%, 67.41% 99.78%, 65% 100%,
  35% 100%,
  32.59% 99.78%, 30.36% 99.12%, 28.32% 98.01%, 26.46% 96.46%,
  3.54% 73.54%,
  1.99% 71.68%, 0.89% 69.64%, 0.22% 67.41%, 0% 65%,
  0% 35%,
  0.22% 32.59%, 0.89% 30.36%, 1.99% 28.32%, 3.54% 26.46%,
  26.46% 3.54%,
  28.32% 1.99%, 30.36% 0.89%, 32.59% 0.22%
)`
```

The percentage coords are derived from a regular octagon inscribed at 30% inset
(vertices at `(35,0)`, `(65,0)`, `(73.54,3.54)`, …) with each 45° corner replaced
by a quadratic Bezier curve sampled at `t ∈ {0.25, 0.5, 0.75}` (the corner-start
and corner-end vertices come from the adjacent straight edges and aren't
duplicated).

### `shapeCssForGender()` body

```ts
export function shapeCssForGender(
  gender: 'm' | 'f' | 'other' | 'unknown' | undefined,
  px: number,
): GenderShape {
  switch (gender) {
    case 'm':
      // rounded-square (~18% of px)
      return { kind: 'radius', borderRadius: `${Math.round(px * 0.18)}px` }
    case 'unknown':
      // squircle (~34% of px) — geometric midpoint of m and f; signals "unset"
      return { kind: 'radius', borderRadius: `${Math.round(px * 0.34)}px` }
    case 'f':
      // circle
      return { kind: 'radius', borderRadius: '50%' }
    case 'other':
      // soft octagon — distinctive shape for a distinctive identity
      return { kind: 'clip-path', clipPath: SOFT_OCTAGON_CLIP_PATH }
    case undefined:
    default:
      // Backstop: same as the old function (50% circle). Reachable only if a
      // caller forgets to pass `gender`; the default in <Avatar> below is
      // 'unknown' which now maps to a squircle, so this fallback exists only
      // for callers outside the standard component.
      return { kind: 'radius', borderRadius: '50%' }
  }
}
```

Note the explicit `case undefined`: it's separate from the four enum values and
maps to circle (50%) — matches the existing function's behaviour. The default in
the `<Avatar>` component remains `gender = 'unknown'`, which now resolves to a
squircle, so the visible default treatment when no gender is provided shifts from
circle to squircle. This is consistent with what `unknown` means and a wanted
side-effect.

### React surface — `src/components/ui/avatar.tsx`

The inner span's inline style today reads:

```ts
const innerStyle: React.CSSProperties = {
  width: px,
  height: px,
  borderRadius,           // ← from borderRadiusForGender(gender, px)
  outline: ring ? '…' : undefined,
  // …
}
```

After the change, branch on the discriminated union:

```ts
const shape = shapeCssForGender(gender, px)
const innerStyle: React.CSSProperties = {
  width: px,
  height: px,
  ...(shape.kind === 'radius'
    ? { borderRadius: shape.borderRadius }
    : { clipPath: shape.clipPath, borderRadius: 0 }),
  outline: ring ? `2px solid var(--tone-${tone}-ring)` : undefined,
  // …
}
```

`borderRadius: 0` is set explicitly in the clip-path branch to remove the default
50% the inner span might otherwise inherit — keeps the polygon shape crisp.

### Family-chart surface — `src/app/(app)/tree/[id]/_lib/person-node-html.ts`

The avatar HTML string today builds:

```ts
const radius = borderRadiusForGender(data.gender_raw, sizePx)
const innerStyle = `
  width:${sizePx}px;
  height:${sizePx}px;
  border-radius:${radius};
  …
`
```

After the change:

```ts
const shape = shapeCssForGender(data.gender_raw, sizePx)
const shapeStyle =
  shape.kind === 'radius'
    ? `border-radius:${shape.borderRadius};`
    : `clip-path:${shape.clipPath};border-radius:0;`
const innerStyle = `
  width:${sizePx}px;
  height:${sizePx}px;
  ${shapeStyle}
  …
`
```

The import switches from `borderRadiusForGender` to `shapeCssForGender` from
`@/components/ui/avatar`. No new imports beyond the rename.

### Photo handling

Unchanged. Both `border-radius` and `clip-path` apply to the inner span's content
via the existing `overflow:hidden` — the photo (rendered as a `<img>` or a
background image inside the span) crops to whichever shape is set. The 40-vertex
polygon and the simple border-radius values use the same CSS containing-block, so
no change to the photo render path.

### Deceased † badge

Unchanged. The deceased badge is `position: absolute` on the **outer** wrapper,
which never receives the clip-path — only the inner span does. The badge escapes
the clipping naturally and renders at the top-right corner of the bounding box
(same place it sits for the other 3 shapes).

### Ring highlight forward-compatibility

`<Avatar ring={true}>` draws a `2px solid var(--tone-X-ring)` outline on the
inner span. `outline` respects `border-radius` but **not** `clip-path` — so a
ring on an `other` person would draw a square outline around an octagonally
clipped avatar. This is acceptable for now because **no caller currently passes
`ring={true}`** (verified by `grep -rn "ring={true\|ring=\"true\|ring={ring\|<Avatar.*ring"` —
the prop is declared but unused). When ring eventually wires up, the fix is
either:

- Layer two clipped divs (outer with the polygon, inner inset by 2px with the
  polygon, ring color = outer's `background-color`), or
- Use a CSS `filter: drop-shadow(0 0 2px var(--tone-X-ring))` for a
  shape-following glow.

Either is straightforward; both are tracked as "do later if ring lands" and
explicitly out of scope for this PR.

## UX doc update

`docs/ux/avatars-and-tones.md` carries the avatar contract. Two updates inside
the same PR:

1. Replace the `Avatar` component contract bullet on gender shapes:
   ```
   gender prop drives shape:
     'm'       → rounded-square (~18% of px)
     'unknown' → squircle (~34% of px)   [NEW — was circle]
     'f'       → circle (50%)
     'other'   → soft octagon            [NEW — was squircle]
   ```
2. Add a short paragraph after the contract explaining the spectrum (`m → unknown
   → f` as soft-to-round) and `other`'s off-axis distinctive shape. Reference
   this spec by date for the full rationale.

## Testing

### Vitest — pure function

Add `src/__tests__/components/avatar.shape.test.ts`:

- `shapeCssForGender('m', 48)` → `{kind:'radius', borderRadius:'9px'}` (round(48*0.18)=9)
- `shapeCssForGender('unknown', 48)` → `{kind:'radius', borderRadius:'16px'}` (round(48*0.34)=16)
- `shapeCssForGender('f', 48)` → `{kind:'radius', borderRadius:'50%'}`
- `shapeCssForGender('other', 48)` → `{kind:'clip-path', clipPath: <starts with 'polygon('>}`
- `shapeCssForGender(undefined, 48)` → `{kind:'radius', borderRadius:'50%'}` (backstop)
- The clip-path string contains the expected 40 vertex tokens (regex test on
  `polygon` prefix + count of `%`).

### Render test — Avatar component

Augment `src/__tests__/components/avatar.test.tsx` (if it exists; otherwise
create) to render `<Avatar gender="other" />` and assert the inner span's
`style.clipPath` is set and `style.borderRadius` is `'0px'` or `'0'`. Mirror with
`gender="unknown"` asserting the squircle radius.

### Family-chart smoke

The existing `family-chart-data-show-all.test.ts` fixture sets `gender_raw:
'unknown'`. After the swap, the rendered tree-node HTML for that fixture should
contain `border-radius:` (the squircle value) and NOT `clip-path:`. Mirror with
an `'other'`-gendered fixture asserting `clip-path:polygon(` is present.

No Playwright change required — the visual difference is below the threshold of
the existing E2E happy-paths, and the unit tests cover the renderer correctness.

## Constraints honored

- **No prod changes pre-v1.0 milestone close** — pure app code, no DB / Vercel /
  migration touch. Lands on `qa` and rides the next feature release.
- **`docs/adrs/0008-design-system.md` alignment** — tones remain non-demographic
  (only the `tone` field is involved in color decisions); the gender→shape
  mapping documented in `docs/ux/avatars-and-tones.md` is the only place that
  encodes demographic information visually, and this change keeps that
  containment.
- **Issue-anchored branching** — single branch `feat/188-gender-shape-remap`,
  single PR with bare `Closes #188`.
- **Test conventions** — Vitest for the pure function + the render assertion;
  existing fixtures get the field they already need (`gender_raw`); no Playwright
  flow added.

## Out of scope

- Ring implementation for `other` (no current caller; deferred).
- Dark-mode tuning of tone backgrounds (Phase 8 polish; separate work).
- Changing the gender enum (the four values stay; this is a shape-mapping change).
- Changes to the `<PersonForm>` gender `<select>` (the four options stay; the
  label-and-helper-text already cover all four).
- Migration of any existing rows (no data change — the renderer just produces
  different shapes from the same values).

## Acceptance (mirrors issue #188)

- [ ] Decision recorded with rationale (this spec satisfies it; PR body
      references the spec date).
- [ ] Implementation matches: `m` / `f` unchanged, `unknown` → squircle,
      `other` → soft octagon, in both `<Avatar>` and the family-chart inline
      HTML renderer.
- [ ] `docs/ux/avatars-and-tones.md` updated to reflect the new mapping.
- [ ] Vitest gate green (`pnpm test`, `pnpm typecheck`, `pnpm lint`,
      `pnpm build`).
