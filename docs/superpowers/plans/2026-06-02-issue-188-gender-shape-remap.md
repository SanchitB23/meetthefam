# Issue #188 — Gender shape system remap — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remap the four-value avatar shape system so `unknown` becomes a squircle (geometric midpoint of `m` and `f`), `other` becomes a soft octagon (a distinctive shape for a distinctive identity), and `m` / `f` stay unchanged.

**Architecture:** Pure renderer change. A new `shapeCssForGender(gender, px)` function in `src/components/ui/avatar.tsx` returns a discriminated union — either `{kind:'radius', borderRadius:'…'}` for m/unknown/f or `{kind:'clip-path', clipPath:'polygon(…)'}` for `other`. The 40-vertex polygon string is a Bezier-sampled approximation of a soft octagon, visually indistinguishable from a true SVG `<path>` at every avatar size in use (max 80px). Two surfaces — `src/components/ui/avatar.tsx` (React) and `src/app/(app)/tree/[id]/_lib/person-node-html.ts` (inline HTML for family-chart) — both switch to the new function. No DB / migration / enum change.

**Tech Stack:** TypeScript, React 19, Tailwind v4, Vitest + React Testing Library, vanilla CSS `clip-path: polygon()`.

**Branch:** `feat/188-gender-shape-remap` (already created off `qa` HEAD `d5f6256`; spec already committed as `975b1a1`).

**Spec:** [`docs/superpowers/specs/2026-06-02-gender-shape-system-remap-design.md`](../specs/2026-06-02-gender-shape-system-remap-design.md)

---

## File structure

| File | Action | Responsibility |
|---|---|---|
| `src/components/ui/avatar.tsx` | Modify | Replace `borderRadiusForGender` with `shapeCssForGender`; export `SOFT_OCTAGON_CLIP_PATH` + `GenderShape` type; update `<Avatar>` component to branch on shape kind |
| `src/app/(app)/tree/[id]/_lib/person-node-html.ts` | Modify | Remove internal `borderRadiusForGender`; import `shapeCssForGender` from avatar.tsx; emit either `border-radius` or `clip-path` inline style based on shape kind |
| `src/__tests__/components/avatar.shape.test.ts` | Create | Pure-function tests for `shapeCssForGender` (all 5 cases including `undefined` backstop) + `SOFT_OCTAGON_CLIP_PATH` validity |
| `src/__tests__/components/Avatar.test.tsx` | Create | Render assertion that `<Avatar gender="other">` produces `clipPath` style + `borderRadius: 0`, and `gender="unknown"` produces squircle radius |
| `src/__tests__/tree/person-node-html.test.ts` | Create | Smoke test asserting the generated HTML string contains the right shape style for each `gender_raw` value |
| `docs/ux/avatars-and-tones.md` | Modify | Update gender-shape table in the `<Avatar>` contract section; add a paragraph explaining the m → unknown → f spectrum + `other`'s off-axis shape |

No new files outside the test directory. No file deletions. No new dependencies.

---

## Task 1: Add `shapeCssForGender` + types + octagon constant to `avatar.tsx` (TDD)

**Files:**
- Modify: `src/components/ui/avatar.tsx`
- Test (Create): `src/__tests__/components/avatar.shape.test.ts`

- [ ] **Step 1: Write the failing tests**

Create `src/__tests__/components/avatar.shape.test.ts` with this exact content:

```ts
import { describe, expect, it } from 'vitest'

import {
  SOFT_OCTAGON_CLIP_PATH,
  shapeCssForGender,
} from '@/components/ui/avatar'

describe('shapeCssForGender', () => {
  it('m → rounded-square radius at ~18% of px', () => {
    expect(shapeCssForGender('m', 48)).toEqual({
      kind: 'radius',
      borderRadius: '9px', // Math.round(48 * 0.18) = 9
    })
    expect(shapeCssForGender('m', 80)).toEqual({
      kind: 'radius',
      borderRadius: '14px', // Math.round(80 * 0.18) = 14
    })
  })

  it('unknown → squircle radius at ~34% of px (geometric midpoint of m and f)', () => {
    expect(shapeCssForGender('unknown', 48)).toEqual({
      kind: 'radius',
      borderRadius: '16px', // Math.round(48 * 0.34) = 16
    })
    expect(shapeCssForGender('unknown', 80)).toEqual({
      kind: 'radius',
      borderRadius: '27px', // Math.round(80 * 0.34) = 27
    })
  })

  it('f → circle (50%)', () => {
    expect(shapeCssForGender('f', 48)).toEqual({
      kind: 'radius',
      borderRadius: '50%',
    })
  })

  it('other → soft octagon clip-path (distinctive shape)', () => {
    const result = shapeCssForGender('other', 48)
    expect(result.kind).toBe('clip-path')
    if (result.kind === 'clip-path') {
      expect(result.clipPath).toBe(SOFT_OCTAGON_CLIP_PATH)
      expect(result.clipPath.startsWith('polygon(')).toBe(true)
    }
  })

  it('undefined → circle (50%) backstop', () => {
    expect(shapeCssForGender(undefined, 48)).toEqual({
      kind: 'radius',
      borderRadius: '50%',
    })
  })

  it('SOFT_OCTAGON_CLIP_PATH is a polygon with exactly 40 vertices', () => {
    // 40 vertices means 40 "X% Y%" pairs separated by commas.
    // Sanity-check the polygon shape spec (5 Bezier samples × 8 corners,
    // collapsing shared edge endpoints — see spec for derivation).
    const matches = SOFT_OCTAGON_CLIP_PATH.match(/\d+(\.\d+)?%\s+\d+(\.\d+)?%/g)
    expect(matches).not.toBeNull()
    expect(matches!.length).toBe(40)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- avatar.shape
```

Expected: All tests FAIL with "shapeCssForGender is not exported" / "SOFT_OCTAGON_CLIP_PATH is not exported" (or compile error).

- [ ] **Step 3: Add the implementation to `src/components/ui/avatar.tsx`**

Open `src/components/ui/avatar.tsx`. At the top of the file (just after the existing `import` lines and the file-leading comment), add:

```ts
/**
 * Soft octagon (~5% corner softening via Bezier-sampled polygon) — the shape
 * for `other`. Coordinates are percentages so the same string scales to any
 * avatar size. Visually indistinguishable from a true SVG <path> at every
 * avatar size in use (max 80px).
 *
 * Spec: docs/superpowers/specs/2026-06-02-gender-shape-system-remap-design.md
 */
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

/**
 * Gender → shape mapping. Discriminated union so callers can branch between a
 * plain border-radius CSS value (m / unknown / f) and a clip-path string
 * (other). The shape spectrum encodes how committed the gender info is:
 *
 *   m       → rounded-square (~18%)   — known, sharp-ish corners
 *   unknown → squircle      (~34%)   — geometric midpoint, signals "unset"
 *   f       → circle         (50%)   — known, fully rounded
 *   other   → soft octagon          — off-axis, distinctive identity
 *
 * Spec: docs/superpowers/specs/2026-06-02-gender-shape-system-remap-design.md
 */
export type GenderShape =
  | { kind: 'radius'; borderRadius: string }
  | { kind: 'clip-path'; clipPath: string }

export function shapeCssForGender(
  gender: 'm' | 'f' | 'other' | 'unknown' | undefined,
  px: number,
): GenderShape {
  switch (gender) {
    case 'm':
      return { kind: 'radius', borderRadius: `${Math.round(px * 0.18)}px` }
    case 'unknown':
      return { kind: 'radius', borderRadius: `${Math.round(px * 0.34)}px` }
    case 'f':
      return { kind: 'radius', borderRadius: '50%' }
    case 'other':
      return { kind: 'clip-path', clipPath: SOFT_OCTAGON_CLIP_PATH }
    case undefined:
    default:
      return { kind: 'radius', borderRadius: '50%' }
  }
}
```

**Important:** Do NOT delete the existing `borderRadiusForGender` function yet — Task 2 migrates the `<Avatar>` component to use the new function, then removes the old one in the same commit. The intermediate state (both functions exported) is fine for one commit.

- [ ] **Step 4: Run test to verify it passes**

```bash
pnpm test -- avatar.shape
```

Expected: All 6 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/components/ui/avatar.tsx src/__tests__/components/avatar.shape.test.ts
git commit -m "$(cat <<'EOF'
feat(#188): add shapeCssForGender + SOFT_OCTAGON_CLIP_PATH

Pure function + 40-vertex polygon constant. The old borderRadiusForGender
stays in place until <Avatar> migrates in the next commit.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Migrate `<Avatar>` to `shapeCssForGender` + remove old function (TDD)

**Files:**
- Modify: `src/components/ui/avatar.tsx` (`Avatar` component body + delete `borderRadiusForGender`)
- Test (Create): `src/__tests__/components/Avatar.test.tsx`

- [ ] **Step 1: Write the failing render tests**

Create `src/__tests__/components/Avatar.test.tsx`:

```tsx
/** @vitest-environment jsdom */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { Avatar } from '@/components/ui/avatar'

describe('<Avatar>', () => {
  it("renders 'other' with clipPath set and borderRadius zeroed", () => {
    const { container } = render(
      <Avatar fullName="Alex Doe" tone="indigo" gender="other" size={64} />,
    )
    // The inner span (the avatar circle/shape) is the deepest span inside the
    // outer wrapper. Find it via querySelector.
    const inner = container.querySelector('span[style*="clip-path"]')
    expect(inner).not.toBeNull()
    const style = inner!.getAttribute('style') ?? ''
    expect(style).toMatch(/clip-path:\s*polygon\(/)
    // border-radius is set to 0 in the clip-path branch to prevent inherited
    // 50% from clashing with the polygon clip.
    expect(style).toMatch(/border-radius:\s*0(px|;|$)/)
  })

  it("renders 'unknown' as a squircle at ~34% of px", () => {
    const { container } = render(
      <Avatar fullName="Pat Doe" tone="sage" gender="unknown" size={48} />,
    )
    const inner = container.querySelector('span[style*="border-radius"]')
    expect(inner).not.toBeNull()
    const style = inner!.getAttribute('style') ?? ''
    // Math.round(48 * 0.34) = 16
    expect(style).toMatch(/border-radius:\s*16px/)
    // Must NOT have a clip-path.
    expect(style).not.toMatch(/clip-path:\s*polygon/)
  })

  it("renders 'm' as a rounded-square at ~18% of px (unchanged)", () => {
    const { container } = render(
      <Avatar fullName="Sam Doe" tone="rose" gender="m" size={48} />,
    )
    const inner = container.querySelector('span[style*="border-radius"]')
    const style = inner!.getAttribute('style') ?? ''
    expect(style).toMatch(/border-radius:\s*9px/)
  })

  it("renders 'f' as a circle (unchanged)", () => {
    const { container } = render(
      <Avatar fullName="Jane Doe" tone="amber" gender="f" size={48} />,
    )
    const inner = container.querySelector('span[style*="border-radius"]')
    const style = inner!.getAttribute('style') ?? ''
    expect(style).toMatch(/border-radius:\s*50%/)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- Avatar.test
```

Expected: Tests for `gender="other"` and `gender="unknown"` FAIL — the component still uses `borderRadiusForGender` which returns `'34%'` for `other` (not the clip-path) and `'50%'` for `unknown` (not the squircle).

- [ ] **Step 3: Migrate the `<Avatar>` component body**

Open `src/components/ui/avatar.tsx`. Find the `Avatar` component (around line 76). Locate this block inside the function body:

```ts
  const borderRadius = borderRadiusForGender(gender, px)
```

Replace it with:

```ts
  const shape = shapeCssForGender(gender, px)
```

Then find the `innerStyle` object (around line 95):

```ts
  const innerStyle: React.CSSProperties = {
    width: px,
    height: px,
    borderRadius,
    // Ring is drawn as an outline so it doesn't change layout dimensions.
    outline: ring ? `2px solid var(--tone-${tone}-ring)` : undefined,
    outlineOffset: ring ? 2 : undefined,
    // Deceased: aggressive desaturation + small grayscale so the effect
    // lands on PHOTO avatars too (a low-saturation portrait at saturate(0.55)
    // alone is visually indistinguishable from a living one).
    filter: deceased ? 'saturate(0.4) grayscale(0.3)' : undefined,
    opacity: deceased ? 0.78 : undefined,
  }
```

Replace the `borderRadius,` line with the discriminated spread:

```ts
  const innerStyle: React.CSSProperties = {
    width: px,
    height: px,
    ...(shape.kind === 'radius'
      ? { borderRadius: shape.borderRadius }
      : { clipPath: shape.clipPath, borderRadius: 0 }),
    // Ring is drawn as an outline so it doesn't change layout dimensions.
    // Note: outline follows border-radius but NOT clip-path, so for `other`
    // a ring will currently draw a square outline around the octagon. The
    // ring prop has no callers today; tracked in the spec for a follow-up.
    outline: ring ? `2px solid var(--tone-${tone}-ring)` : undefined,
    outlineOffset: ring ? 2 : undefined,
    filter: deceased ? 'saturate(0.4) grayscale(0.3)' : undefined,
    opacity: deceased ? 0.78 : undefined,
  }
```

- [ ] **Step 4: Delete the old `borderRadiusForGender` function**

Still in `src/components/ui/avatar.tsx`, find and delete the entire `borderRadiusForGender` function and its preceding JSDoc block (lines roughly 51-75 — the JSDoc starting with `Maps a gender value to a CSS border-radius string` through the closing `}` of the `switch`). The function is no longer referenced from this file or any external file (Task 3 migrates the only external caller, `person-node-html.ts`, which keeps its own internal copy until that task — so deleting from `avatar.tsx` only affects this file's exports, and there are no other callers).

After deletion, verify no stale reference remains in this file:

```bash
grep -n "borderRadiusForGender" src/components/ui/avatar.tsx
```

Expected: no matches.

- [ ] **Step 5: Run tests to verify they pass**

```bash
pnpm test -- Avatar.test avatar.shape
```

Expected: All 10 tests PASS (4 Avatar render + 6 shape function).

- [ ] **Step 6: Run typecheck to catch any other callers of the old function**

```bash
pnpm typecheck
```

Expected: Clean. If there's a typecheck error about `borderRadiusForGender` no longer being exported, it means a caller outside `person-node-html.ts` exists — investigate, but Task 3 covers the known one.

- [ ] **Step 7: Commit**

```bash
git add src/components/ui/avatar.tsx src/__tests__/components/Avatar.test.tsx
git commit -m "$(cat <<'EOF'
feat(#188): migrate <Avatar> to shapeCssForGender; remove old fn

Component now branches on shape.kind. `other` gets clip-path:polygon,
`unknown` becomes a squircle, m and f are unchanged. Deletes the old
borderRadiusForGender from avatar.tsx — person-node-html.ts still has
its own internal copy and migrates in the next commit.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Migrate `person-node-html.ts` to `shapeCssForGender` (TDD)

**Files:**
- Modify: `src/app/(app)/tree/[id]/_lib/person-node-html.ts`
- Test (Create): `src/__tests__/tree/person-node-html.test.ts`

- [ ] **Step 1: Write the failing test**

First, check whether the directory exists:

```bash
ls src/__tests__/tree/ 2>/dev/null || mkdir -p src/__tests__/tree
```

Create `src/__tests__/tree/person-node-html.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { cardInnerHtmlCreator } from '@/app/(app)/tree/[id]/_lib/person-node-html'

// `cardInnerHtmlCreator` is the public function the file exports for
// family-chart; it calls avatarHtml() internally. Passing the right node
// shape gives us a one-shot way to validate the avatar shape style.
function makeNode(genderRaw: 'm' | 'f' | 'other' | 'unknown', overrides: Record<string, unknown> = {}) {
  return {
    data: {
      id: 'p1',
      full_name: 'Test Person',
      gender: 'M' as const,
      gender_raw: genderRaw,
      tone: 'sage' as const,
      deceased: false,
      photo_url: null,
      ...overrides,
    },
  }
}

describe('cardInnerHtmlCreator avatar shape', () => {
  it("emits border-radius for gender_raw 'm'", () => {
    const html = cardInnerHtmlCreator(makeNode('m'))
    expect(html).toMatch(/border-radius:\s*9px/) // Math.round(48 * 0.18)
    expect(html).not.toMatch(/clip-path:\s*polygon/)
  })

  it("emits squircle border-radius for gender_raw 'unknown'", () => {
    const html = cardInnerHtmlCreator(makeNode('unknown'))
    expect(html).toMatch(/border-radius:\s*16px/) // Math.round(48 * 0.34)
    expect(html).not.toMatch(/clip-path:\s*polygon/)
  })

  it("emits border-radius 50% for gender_raw 'f'", () => {
    const html = cardInnerHtmlCreator(makeNode('f'))
    expect(html).toMatch(/border-radius:\s*50%/)
    expect(html).not.toMatch(/clip-path:\s*polygon/)
  })

  it("emits clip-path: polygon for gender_raw 'other'", () => {
    const html = cardInnerHtmlCreator(makeNode('other'))
    expect(html).toMatch(/clip-path:\s*polygon\(/)
    // The fallback border-radius is set to 0 in the clip-path branch.
    expect(html).toMatch(/border-radius:\s*0/)
  })
})
```

> If the `cardInnerHtmlCreator` export isn't directly usable from a test (e.g., it expects a complete family-chart datum shape), inspect the actual export shape in `src/app/(app)/tree/[id]/_lib/person-node-html.ts` and adjust the `makeNode` fixture to satisfy the type. The assertions on the generated HTML string stay the same.

- [ ] **Step 2: Run test to verify it fails**

```bash
pnpm test -- person-node-html
```

Expected: The `'unknown'` test fails (current code returns `'50%'` not `'16px'`). The `'other'` test fails (current code returns `'16px'` not a `clip-path`). The `'m'` and `'f'` tests pass (those values are unchanged).

- [ ] **Step 3: Migrate `person-node-html.ts`**

Open `src/app/(app)/tree/[id]/_lib/person-node-html.ts`. Find the internal `borderRadiusForGender` function (around line 60-87) and **delete the entire function plus its preceding JSDoc comment block**. Replace it with this import at the top of the file (add to the existing imports, do not duplicate):

```ts
import { shapeCssForGender } from '@/components/ui/avatar'
```

Then find the `avatarHtml` function body (around line 89). Locate this line:

```ts
  const radius = borderRadiusForGender(data.gender_raw, sizePx)
```

Replace with:

```ts
  const shape = shapeCssForGender(data.gender_raw, sizePx)
  const shapeStyle =
    shape.kind === 'radius'
      ? `border-radius:${shape.borderRadius};`
      : `clip-path:${shape.clipPath};border-radius:0;`
```

Then find the `innerStyle` template-literal block (a few lines below):

```ts
  const innerStyle = `
    width:${sizePx}px;
    height:${sizePx}px;
    border-radius:${radius};
    display:inline-flex;
    align-items:center;
    justify-content:center;
    overflow:hidden;
    flex-shrink:0;
    ${deceasedStyles}
  `
```

Replace the `border-radius:${radius};` line with `${shapeStyle}`:

```ts
  const innerStyle = `
    width:${sizePx}px;
    height:${sizePx}px;
    ${shapeStyle}
    display:inline-flex;
    align-items:center;
    justify-content:center;
    overflow:hidden;
    flex-shrink:0;
    ${deceasedStyles}
  `
```

Verify no stale references remain in this file:

```bash
grep -n "borderRadiusForGender" src/app/\(app\)/tree/\[id\]/_lib/person-node-html.ts
```

Expected: no matches.

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test -- person-node-html avatar.shape Avatar.test
```

Expected: All previously-passing tests still pass; the 4 new `person-node-html` tests now also pass.

- [ ] **Step 5: Run typecheck**

```bash
pnpm typecheck
```

Expected: Clean. If errors appear, they're either real or the import path needs adjustment (verify `@/components/ui/avatar` matches the project's path alias — should be `paths` in `tsconfig.json`).

- [ ] **Step 6: Commit**

```bash
git add src/app/\(app\)/tree/\[id\]/_lib/person-node-html.ts src/__tests__/tree/person-node-html.test.ts
git commit -m "$(cat <<'EOF'
feat(#188): migrate person-node-html.ts to shared shapeCssForGender

Removes the file-local borderRadiusForGender copy and imports the
discriminated-union version from @/components/ui/avatar. Tree-node
avatars now render unknown as squircle and other as soft octagon.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Update the UX doc

**Files:**
- Modify: `docs/ux/avatars-and-tones.md`

- [ ] **Step 1: Locate the `<Avatar>` component contract section**

Open `docs/ux/avatars-and-tones.md`. Search for `gender prop drives` or `8b-1: gender prop drives border-radius shape:` — that's the contract block. (Lives in the `<Avatar> component contract` section, around the second half of the file.)

- [ ] **Step 2: Replace the four-line contract block**

Find this block in the file:

```
//   'm'       → rounded-square (~18% of px)
//   'other'   → squircle (~34% of px)
//   'f'       → circle (50%)
//   'unknown' → circle (50%, default)
```

Replace with:

```
//   'm'       → rounded-square (~18% of px)
//   'unknown' → squircle (~34% of px)
//   'f'       → circle (50%)
//   'other'   → soft octagon (40-vertex CSS clip-path polygon)
```

(Order changed to reflect the new shape spectrum: m → unknown → f, with `other` listed last as the off-spectrum value.)

- [ ] **Step 3: Add a spectrum paragraph after the contract block**

Immediately after the contract block (or in a logical nearby spot — use your judgment based on the existing flow), add:

```markdown
### Gender shape spectrum

The four gender values render along a deliberate visual axis:

- **`m` → `unknown` → `f`** form a soft-to-round spectrum. `unknown` sits at the
  geometric midpoint of `m` and `f`, encoding "the gender is unset" as "between
  the two known states."
- **`other`** jumps off that spectrum onto its own distinctive shape — a soft
  octagon. `other` represents a deliberate identity choice, not a halfway
  point, and earns a shape with a different geometric character (8 sides
  rather than a varying border-radius on a square).

Implementation: see `src/components/ui/avatar.tsx#shapeCssForGender` and the
`SOFT_OCTAGON_CLIP_PATH` constant. Full design rationale:
[`docs/superpowers/specs/2026-06-02-gender-shape-system-remap-design.md`](../superpowers/specs/2026-06-02-gender-shape-system-remap-design.md).
```

- [ ] **Step 4: Commit**

```bash
git add docs/ux/avatars-and-tones.md
git commit -m "$(cat <<'EOF'
docs(#188): update avatars-and-tones with new gender shape mapping

Reflects the remap: unknown is now squircle, other is now soft octagon.
Adds the spectrum-explanation paragraph. References the spec for full
rationale.

Co-Authored-By: Claude <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Pre-PR verification gates

**Files:** none modified.

- [ ] **Step 1: Full typecheck**

```bash
pnpm typecheck
```

Expected: Clean. If errors appear, they MUST be fixed before the PR. Don't paper them over.

- [ ] **Step 2: Lint**

```bash
pnpm lint
```

Expected: 0 errors. Pre-existing warnings are acceptable but do not introduce new ones in the files this PR touches.

- [ ] **Step 3: Full test suite**

```bash
pnpm test
```

Expected: All tests pass (previously-passing tests + the new shape + Avatar + person-node-html suites).

- [ ] **Step 4: Production build**

```bash
pnpm build
```

Expected: Clean build. Next.js 16 Turbopack picks up the changes; the `/tree/[id]` route still emits as `λ (Dynamic)` (no static change). No new build warnings introduced.

If any of the four gates fail, **do not open the PR** — diagnose and fix first. Do NOT use `--no-verify` to bypass commit hooks.

- [ ] **Step 5: Smoke check the family-chart canvas locally (optional but recommended)**

If `pnpm exec supabase start` is feasible:

```bash
pnpm exec supabase start
pnpm dev
```

Then in a browser:
1. Sign in, open any tree with a person whose `gender = 'other'`
2. Confirm the avatar in the tree canvas renders as a soft octagon (not a squircle)
3. Open a person whose `gender = 'unknown'` (or create one via the add-relative form with gender = "Unknown")
4. Confirm the avatar renders as a squircle (not a circle)
5. Open the detail sheet for each — same shapes there
6. Open the person-picker (e.g., "Add relative" → "Link to existing") — same shapes in the list rows

Quick visual sanity check; not a hard gate. If the local stack isn't available, the QA Vercel preview after PR open serves the same purpose.

---

## Task 6: Open the draft PR

**Files:** none modified. This task pushes the branch and opens the PR.

- [ ] **Step 1: Push the branch**

```bash
git push -u origin feat/188-gender-shape-remap
```

Expected: Branch created on origin with all 5 commits (1 spec commit from before, 4 task commits from this plan).

- [ ] **Step 2: Open the draft PR**

```bash
gh pr create --draft --base qa --title "feat(#188): gender shape system remap — unknown → squircle, other → soft octagon" --body "$(cat <<'EOF'
## Summary

- Remaps the avatar shape system so `unknown` becomes a squircle (~34% — the geometric midpoint of `m` and `f`, encoding "unset") and `other` becomes a soft octagon (a distinctive shape for a distinctive identity). `m` and `f` are unchanged.
- Replaces the file-local `borderRadiusForGender` function in `person-node-html.ts` with a shared `shapeCssForGender` exported from `src/components/ui/avatar.tsx`. Both surfaces (React Avatar + family-chart inline HTML) consume the same function.
- Implementation via a 40-vertex CSS `clip-path: polygon()` — Bezier-sampled approximation, visually indistinguishable from a true SVG `<path>` at every avatar size in use (max 80px), but stays inside the existing `<div>` + CSS markup so no SVG branch or two-surface markup divergence.

## Changes

- `src/components/ui/avatar.tsx` — adds `SOFT_OCTAGON_CLIP_PATH` constant, `GenderShape` discriminated-union type, and `shapeCssForGender(gender, px)` function; removes old `borderRadiusForGender`; updates `<Avatar>` to branch on shape kind.
- `src/app/(app)/tree/[id]/_lib/person-node-html.ts` — removes file-local `borderRadiusForGender`; imports `shapeCssForGender` from avatar; emits either `border-radius` or `clip-path` inline style based on shape kind.
- `docs/ux/avatars-and-tones.md` — updated `<Avatar>` contract table + new "Gender shape spectrum" paragraph.
- New tests: `avatar.shape.test.ts` (pure function), `Avatar.test.tsx` (component render), `person-node-html.test.ts` (HTML string).

## Closes

Closes #188

## Spec

[`docs/superpowers/specs/2026-06-02-gender-shape-system-remap-design.md`](docs/superpowers/specs/2026-06-02-gender-shape-system-remap-design.md) — brainstormed via `superpowers:brainstorming` with the visual companion on 2026-06-02.

## Test plan

- [x] `pnpm typecheck` clean
- [x] `pnpm lint` clean
- [x] `pnpm test` — all suites pass, including new avatar.shape + Avatar + person-node-html suites
- [x] `pnpm build` clean
- [ ] Local dev smoke: avatars for `gender='unknown'` render as squircle (not circle); avatars for `gender='other'` render as soft octagon (not squircle); `m` and `f` unchanged. Tree canvas, detail sheet, person-picker, set-parents-dialog all consistent.
- [ ] QA Vercel preview: same smoke against QA Supabase.
- [ ] Mobile viewport (375 × 667): no layout regression around avatars in any surface.

## Manual human-testable checklist

### App walkthrough (local dev — `pnpm dev` against `pnpm exec supabase start`)

- [ ] Pulled the branch, ran `pnpm install`, started Supabase + Next.js dev server
- [ ] Walked the golden path:
  - [ ] Open a tree with a person whose gender is `other` — avatar in the tree canvas is a soft octagon
  - [ ] Open the same person's detail sheet — same octagon shape
  - [ ] Find/create a person with gender `unknown` — avatar is a squircle (visibly different from `f`'s circle)
  - [ ] Confirm `m` and `f` avatars unchanged
- [ ] Triggered the obvious failure path — N/A (renderer-only change, no user input)
- [ ] Checked the browser console — no new errors / warnings vs. `qa`
- [ ] Checked Network tab — no new requests

### QA preview (after the QA Vercel deploy goes green)

- [ ] Opened the Vercel preview URL for this PR on the QA project
- [ ] Repeated the golden-path walkthrough above against QA Supabase

### Mobile viewport

- [ ] Tested at 375 × 667 (iPhone SE) in DevTools or on a real device
- [ ] Avatar shapes render correctly at all sizes (40 / 48 / 56 / 80 px)

### Multi-tenant / RLS sanity

N/A — pure renderer change, no DB queries.

## Quality gates

- [x] `pnpm typecheck` is clean
- [x] `pnpm lint` is clean
- [x] Relevant tests pass (`pnpm test`)
- [x] No secrets staged
- [x] PR opened as **draft** — will be marked ready once CI + self-review pass

### If this PR has UI changes

- [ ] Screenshot or short clip attached for each affected screen (tree canvas, detail sheet, picker)
- [ ] Verified on a mobile viewport
EOF
)"
```

Expected: PR opens as draft, with bare `Closes #188` so it auto-closes the issue on merge.

- [ ] **Step 6 — wait, that's it.** Hand the PR URL back to the user. CI runs automatically; the user marks ready when they're satisfied with the green checks.

---

## Self-review

**Spec coverage check:**
- ✅ Spec § "Decisions locked" → all 7 decisions appear in Tasks 1–4
- ✅ Spec § "Component contract change" → Task 1 introduces `GenderShape` + `shapeCssForGender`; Task 2 removes old `borderRadiusForGender` from avatar.tsx
- ✅ Spec § "The shape constants" → `SOFT_OCTAGON_CLIP_PATH` exact polygon string lives in Task 1 step 3
- ✅ Spec § "React surface" → Task 2 step 3 covers the exact innerStyle change
- ✅ Spec § "Family-chart surface" → Task 3 step 3 covers the exact swap
- ✅ Spec § "Photo handling" → no test needed (covered by existing photo-render path; called out in PR test plan)
- ✅ Spec § "Deceased badge" → no code change required (verified in spec); not testable as a delta
- ✅ Spec § "Ring forward-compat" → comment added in Task 2's innerStyle block referencing the unblocked future state
- ✅ Spec § "UX doc update" → Task 4
- ✅ Spec § "Testing" → all three test surfaces covered (Tasks 1, 2, 3)
- ✅ Spec § "Acceptance" → all four items satisfied across Tasks 1–6

**Placeholder scan:** No TBD / TODO / "implement later" / vague "handle edge cases" / "similar to Task N without code" patterns found. Each step contains the exact code, file paths, and commands needed.

**Type/name consistency:**
- `SOFT_OCTAGON_CLIP_PATH` — same name in spec, Task 1 step 3, and the test in Task 1 step 1.
- `GenderShape` type — same name + same discriminator (`kind: 'radius' | 'clip-path'`) in spec and Task 1.
- `shapeCssForGender` — same signature `(gender, px) → GenderShape` everywhere.
- The test in Task 3 references `cardInnerHtmlCreator` — flagged in step 1 with a fallback note if the exact export shape needs adjustment (the implementer should verify the actual export but the test ASSERTIONS stay valid).

No gaps. No conflicts. Plan is ready for execution.
