// Regression test for the v0.0.5 visual-QA bug where personNodeHtml
// crashed at runtime because the function treated `d.data` (the Datum
// family-chart wraps in its d3-hierarchy node) as the payload, when in
// fact the payload lives at `d.data.data`.
//
// These tests fabricate a TreeDatum the same shape the library produces
// at render time, then assert the rendered HTML actually contains the
// rendered fields. Unit-coverage parity with what we ship to the chart.

import { describe, expect, test } from 'vitest'

import type { TreeDatum } from 'family-chart'

import { personNodeHtml } from '@/app/(app)/tree/[id]/_lib/person-node-html'
import type { FamilyChartDatum } from '@/app/(app)/tree/[id]/_lib/family-chart-data'

function datum(overrides: Partial<FamilyChartDatum['data']> = {}): FamilyChartDatum {
  return {
    id: 'p-1',
    data: {
      gender: 'F',
      full_name: 'Jane Smith',
      first_name: 'Jane',
      last_name: 'Smith',
      nickname: null,
      photo_url: null,
      birth_year: 1972,
      death_year: null,
      deceased: false,
      location: null,
      occupation: null,
      bio: null,
      tone: 'sage',
      gender_raw: 'f',
      ...overrides,
    },
    rels: { parents: [], spouses: [], children: [] },
  }
}

/**
 * Fabricate a `TreeDatum` the same way family-chart's layout step does:
 * the d3 hierarchy wrapping nests our shipped Datum under `node.data`.
 * The real `TreeDatum` has 20+ d3-layout fields (`parents`, `spouses`,
 * `_x`, `psx`, etc.) we never reach during rendering — `unknown as
 * TreeDatum` keeps the lint rule happy without a runtime weight.
 */
function treeNode(d: FamilyChartDatum): TreeDatum {
  return { data: d, x: 0, y: 0, depth: 0, tid: `${d.id}-tid` } as unknown as TreeDatum
}

describe('personNodeHtml', () => {
  test('renders the full name', () => {
    const html = personNodeHtml(treeNode(datum({ full_name: 'Jane Smith' })))
    expect(html).toContain('Jane Smith')
  })

  test('renders `b. YYYY` for a living person with a birth year', () => {
    const html = personNodeHtml(
      treeNode(datum({ birth_year: 1972, deceased: false })),
    )
    expect(html).toContain('b. 1972')
    expect(html).not.toContain('d. ')
  })

  test('renders `b. YYYY – d. YYYY` for a deceased person', () => {
    const html = personNodeHtml(
      treeNode(
        datum({ birth_year: 1900, death_year: 1975, deceased: true }),
      ),
    )
    expect(html).toContain('b. 1900')
    expect(html).toContain('d. 1975')
  })

  test('omits the date line when both years are null', () => {
    const html = personNodeHtml(
      treeNode(datum({ birth_year: null, death_year: null, deceased: false })),
    )
    expect(html).not.toContain('b. ')
    expect(html).not.toContain('d. ')
  })

  test('embeds data-person-id on the wrapper for the press hook', () => {
    const html = personNodeHtml(treeNode(datum({})))
    // Two `data-person-id` attributes appear in the rendered HTML: one on
    // the .mtf-node wrapper, one on the [data-action-trigger] button.
    const matches = html.match(/data-person-id="p-1"/g) ?? []
    expect(matches.length).toBeGreaterThanOrEqual(1)
  })

  test('embeds [data-action-trigger] button for the three-dot fallback', () => {
    const html = personNodeHtml(treeNode(datum({})))
    expect(html).toContain('data-action-trigger')
    // 44×44 hit area per docs/ux/mobile-gestures.md
    expect(html).toMatch(/width:44px;\s*height:44px/)
  })

  test('photo branch renders an <img> with object-fit:cover', () => {
    const html = personNodeHtml(
      treeNode(datum({ photo_url: 'https://example.com/p.jpg' })),
    )
    expect(html).toContain('<img')
    expect(html).toContain('https://example.com/p.jpg')
    expect(html).toContain('object-fit:cover')
    // crossorigin lets the export canvas (#218) rasterise the avatar without
    // tainting — the Supabase photos bucket serves ACAO:* (see #216 spec).
    expect(html).toContain('crossorigin="anonymous"')
  })

  test('initials branch tints by the person\'s tone token', () => {
    const html = personNodeHtml(treeNode(datum({ tone: 'rose' })))
    expect(html).toContain('var(--tone-rose-bg)')
    expect(html).toContain('var(--tone-rose-ink)')
    // Initials computed from full_name = 'Jane Smith' → 'JS'.
    expect(html).toContain('JS')
  })

  test('avatar wrapper is a circle with flex-centered content (both branches)', () => {
    // Regression for the v0.0.5 screenshot bug — square block + top-left
    // initials. Without these wrapper styles the avatar reads as a flat
    // tinted box.
    const initialsHtml = personNodeHtml(treeNode(datum({ photo_url: null })))
    // No-photo path emits no <img> — crossorigin lives only on the photo path.
    expect(initialsHtml).not.toContain('<img')
    expect(initialsHtml).toContain('border-radius:50%')
    expect(initialsHtml).toContain('display:inline-flex')
    expect(initialsHtml).toContain('align-items:center')
    expect(initialsHtml).toContain('justify-content:center')

    const photoHtml = personNodeHtml(
      treeNode(datum({ photo_url: 'https://example.com/p.jpg' })),
    )
    expect(photoHtml).toContain('border-radius:50%')
    expect(photoHtml).toContain('overflow:hidden')
  })

  test('escapes HTML-unsafe characters in name + photo url', () => {
    const html = personNodeHtml(
      treeNode(
        datum({
          full_name: 'O\'Brien <script>',
          photo_url: 'https://a/?q="x"&y=1',
        }),
      ),
    )
    expect(html).not.toContain('<script>')
    expect(html).toContain('&lt;script&gt;')
    expect(html).toContain('&#39;')
    expect(html).toContain('&quot;')
    expect(html).toContain('&amp;')
  })

  test('regression: does not crash on a real-shape TreeDatum', () => {
    // The v0.0.5 visual-QA bug — the renderer treated d.data as the
    // payload directly; this assertion is the smoke test for that.
    expect(() =>
      personNodeHtml(treeNode(datum({ full_name: 'Anon' }))),
    ).not.toThrow()
  })
})

// 8b-1 — gender-shape avatar tests.
// Fixtures set BOTH gender_raw (truthful 4-value field) AND gender (layout-only
// 'M'|'F') so they match the real FamilyChartDatum shape from family-chart-data.ts.
describe('personNodeHtml — gender shape (8b-1)', () => {
  test('male renders rounded-square avatar (border-radius ~18% of 48px = 9px)', () => {
    const html = personNodeHtml(
      treeNode(datum({ gender_raw: 'm', gender: 'M' })),
    )
    expect(html).toContain('border-radius:9px') // Math.round(48 * 0.18) = 9
  })

  test('other renders soft octagon avatar (clip-path polygon, border-radius 0)', () => {
    const html = personNodeHtml(
      treeNode(datum({ gender_raw: 'other', gender: 'M' })),
    )
    expect(html).toContain('clip-path:polygon(')
    expect(html).toContain('border-radius:0')
  })

  test('female renders circle avatar (border-radius 50%)', () => {
    const html = personNodeHtml(
      treeNode(datum({ gender_raw: 'f', gender: 'F' })),
    )
    expect(html).toContain('border-radius:50%')
  })

  test('unknown renders squircle (border-radius ~34% of 48px = 16px)', () => {
    const html = personNodeHtml(
      treeNode(datum({ gender_raw: 'unknown', gender: 'M' })),
    )
    expect(html).toContain('border-radius:16px') // Math.round(48 * 0.34) = 16
  })
})

// 8b-1 — deceased treatment tests.
describe('personNodeHtml — deceased treatment (8b-1)', () => {
  test('deceased adds the † badge', () => {
    const html = personNodeHtml(
      treeNode(datum({ deceased: true, birth_year: 1900, death_year: 1975 })),
    )
    expect(html).toContain('†')
    expect(html).toContain('mtf-node__deceased-badge')
  })

  test('deceased adds desaturate + grayscale filter to the avatar', () => {
    const html = personNodeHtml(
      treeNode(datum({ deceased: true })),
    )
    // 8b polish revision — saturate + grayscale + opacity drop so the
    // treatment is visible on photo avatars (saturate alone was inert
    // on already-low-saturation portraits).
    expect(html).toContain('saturate(0.4)')
    expect(html).toContain('grayscale(0.3)')
    expect(html).toContain('opacity:0.78')
  })

  test('living does NOT add the † badge', () => {
    const html = personNodeHtml(
      treeNode(datum({ deceased: false })),
    )
    expect(html).not.toContain('mtf-node__deceased-badge')
  })
})

// 8b-3 — duplicate-card visual marker tests.
// The duplicate flag lives on the d3 node (`node.duplicate: number`) per
// family-chart.esm.js:880. The `treeNode` helper is extended inline here
// by spreading the duplicate count onto the returned object.
describe('personNodeHtml — duplicate marker (8b-3)', () => {
  /** Build a TreeDatum with d.duplicate set (node-level flag, not data-level). */
  function duplicateNode(
    dataOverrides: Partial<Parameters<typeof datum>[0]> = {},
    duplicateCount = 2,
  ) {
    const base = treeNode(datum(dataOverrides))
    return { ...base, duplicate: duplicateCount } as typeof base
  }

  test('duplicate emits the mtf-node--duplicate class and dashed border', () => {
    const html = personNodeHtml(duplicateNode())
    expect(html).toContain('mtf-node--duplicate')
    // 8b polish: border is split into border-width + border-style (no shorthand)
    // so CSS can set border-color for deceased cards without being overridden.
    expect(html).toContain('border-style:dashed')
  })

  test('duplicate emits the ↑ badge at the expected corner (top:-8px; left:-8px)', () => {
    const html = personNodeHtml(duplicateNode())
    expect(html).toContain('mtf-node__duplicate-badge')
    expect(html).toContain('↑')
    expect(html).toContain('top:-8px')
    expect(html).toContain('left:-8px')
    // Also verifies the "Already shown above" tooltip text is present.
    expect(html).toContain('Already shown above')
  })

  test('duplicate ↑ badge is now a button with [data-duplicate-jump] for cycling through instances', () => {
    // #69 v1.1: tapping the ↑ badge on a duplicate card cycles the
    // camera to the next instance of that person. The button must
    // expose data-duplicate-jump + data-person-id so the click handler
    // in FamilyTree.tsx can resolve it.
    const html = personNodeHtml(duplicateNode())
    expect(html).toContain('data-duplicate-jump')
    expect(html).toContain('aria-label="Jump to next instance')
    // The badge is now a <button>, not an <aria-hidden> <span>.
    expect(html).toMatch(/<button[^>]*data-duplicate-jump/)
  })

  test('duplicate INCLUDES the ellipsis action button — every card needs actions under #69 d\'', () => {
    // #69 v1.1: family-chart's setupTid marks EVERY occurrence of a
    // duplicated id with `duplicate > 0` (not just the second+), so the
    // 8 cross-subtree-married people end up with every Catherine card
    // dashed. If we skipped the action button on duplicates those 8
    // people would have no actions anywhere. Render it on duplicates
    // too; the click handler in FamilyTree.tsx routes a 3-dot click to
    // the action menu (taking priority over the no-longer-used "tap
    // duplicate → recenter" logic).
    const html = personNodeHtml(duplicateNode())
    expect(html).toContain('data-action-trigger')
  })

  // 8b polish FIX 1 — in-card "+" add-relative button.
  // Non-duplicate, non-readonly cards should emit the add-relative button.
  test('non-duplicate non-readonly card emits mtf-node__add-btn with data-action-plus', () => {
    const html = personNodeHtml(treeNode(datum({})))
    expect(html).toContain('mtf-node__add-btn')
    expect(html).toContain('data-action-plus')
    expect(html).toContain('aria-label="Add relative to Jane Smith"')
    // Button is absolutely positioned at bottom:-12px; right:-12px inside the card.
    expect(html).toContain('bottom:-12px')
    expect(html).toContain('right:-12px')
  })

  test('duplicate card INCLUDES the mtf-node__add-btn ("+") — symmetric with the ellipsis fix above', () => {
    // Same rationale as the ellipsis-button test: under #69 d', every
    // cross-subtree-married card is marked duplicate, so suppressing
    // the "+" on duplicates would strip the add-relative affordance
    // from those people entirely.
    const html = personNodeHtml(duplicateNode())
    expect(html).toContain('mtf-node__add-btn')
    expect(html).toContain('data-action-plus')
  })

  test('deceased + duplicate compose without collision: both classes, both badges, different corners', () => {
    const html = personNodeHtml(
      duplicateNode({ deceased: true, birth_year: 1900, death_year: 1975 }),
    )
    // Deceased signals on the AVATAR wrapper
    expect(html).toContain('saturate(0.4)')
    expect(html).toContain('grayscale(0.3)')
    expect(html).toContain('mtf-node__deceased-badge')
    // Duplicate signals on the CARD wrapper (different DOM element)
    expect(html).toContain('mtf-node--duplicate')
    expect(html).toContain('mtf-node__duplicate-badge')
    // 8b polish: border split into border-width + border-style.
    expect(html).toContain('border-style:dashed')
    // Both classes present on the card wrapper
    expect(html).toContain('mtf-node--deceased')
    // Corners do not overlap: † is at top:0;right:0 (avatar wrapper),
    // ↑ is at top:-8px;left:-8px (card wrapper). Both appear in the HTML.
    expect(html).toContain('top:0')
    expect(html).toContain('right:0')
    expect(html).toContain('top:-8px')
    expect(html).toContain('left:-8px')
  })
})
