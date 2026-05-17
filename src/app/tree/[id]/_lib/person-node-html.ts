// Phase 4 sub-task 2 — custom HTML person card for family-chart.
//
// The library's `setCardInnerHtmlCreator((d) => string)` API takes a function
// that returns a raw HTML string injected into each node card. We can't mount
// the React <Avatar> component here — instead this helper templates the same
// visual contract (photo or tone-tinted serif initials) inline.
//
// Card spec (per ADR 0008 → PersonNode + docs/ux/tree-view.md):
//   - 158×110 wrapper, rounded, heirloom border, bg-card.
//   - 48 px avatar at top-center: photo when available, else tinted
//     initials (--tone-X-bg / --tone-X-ink, font-serif).
//     Avatar shape driven by gender_raw: male → rounded-square (18%),
//     other → squircle (34%), female/unknown → circle (50%).
//   - Serif name, line-clamped to 2 lines. Deceased: † prefix in muted-foreground.
//   - Date line: `b. 1972`, or `b. 1900 – d. 1975` when deceased, or empty.
//   - Deceased treatment (8b-1): avatar saturate(0.55) + opacity 0.82;
//     † corner badge (top-right, 14×14px); mtf-node--deceased class on wrapper.
//
// 8b-3 (duplicate-card visual marker) adds to this file: dashed border +
// ↑ badge at top-left + tooltip. Out of scope for 8b-1.

import type { TreeDatum } from 'family-chart'
import { computeInitials } from '@/components/ui/avatar'
import type { FamilyChartDatum } from './family-chart-data'

const ESCAPE_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => ESCAPE_MAP[ch] ?? ch)
}

function formatDates(
  birthYear: number | null,
  deathYear: number | null,
  deceased: boolean,
): string {
  if (birthYear == null && deathYear == null) return ''
  if (deceased && (birthYear != null || deathYear != null)) {
    const b = birthYear ?? '?'
    const d = deathYear ?? '?'
    return `b. ${b} – d. ${d}`
  }
  if (birthYear != null) return `b. ${birthYear}`
  // Edge: deceased flag missing but death_year set — show what we have.
  return `d. ${deathYear}`
}

/**
 * Maps a gender_raw value to a CSS border-radius string for the inline avatar.
 * Mirrors the exported `borderRadiusForGender` in avatar.tsx but operates on
 * raw string templates (no React) for the family-chart HTML context.
 *
 * 'm'       → rounded-square (~18% of px)
 * 'other'   → squircle (~34% of px)
 * 'f'       → circle (50%)
 * 'unknown' → circle (50%)
 * undefined → circle (50%)
 */
function borderRadiusForGender(
  gender: 'm' | 'f' | 'other' | 'unknown' | undefined,
  px: number,
): string {
  switch (gender) {
    case 'm':
      return `${Math.round(px * 0.18)}px`
    case 'other':
      return `${Math.round(px * 0.34)}px`
    case 'f':
      return '50%'
    case 'unknown':
      return '50%'
    default:
      return '50%'
  }
}

function avatarHtml(data: FamilyChartDatum['data']): string {
  const sizePx = 48
  // Mirror the React <Avatar>'s chrome — `inline-flex items-center
  // justify-center overflow-hidden shrink-0`. Inlined here because
  // cardInnerHtmlCreator hands HTML strings to family-chart, not React
  // elements, so the Tailwind classes don't reach.
  //
  // Correction (8b-1): read data.gender_raw (truthful 4-value field),
  // NOT data.gender (layout-only 'M'|'F' for the library's spouse positioning).
  const radius = borderRadiusForGender(data.gender_raw, sizePx)
  const deceasedStyles = data.deceased
    ? 'filter:saturate(0.55);opacity:0.82;'
    : ''

  // The inner span clips the photo / background to the correct border-radius
  // via overflow:hidden. It must NOT be position:relative — that role belongs
  // to the outer wrapper so the deceased badge (position:absolute) escapes
  // the overflow:hidden clipping.
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

  // Outer wrapper: position:relative (NO overflow:hidden) so the deceased badge
  // (position:absolute) sits at top:0;right:0 of the outer box and is NOT
  // clipped by the inner container's border-radius.
  const outerStyle = `
    position:relative;
    display:inline-flex;
    width:${sizePx}px;
    height:${sizePx}px;
  `

  // Deceased † badge — top-right corner (top:0; right:0).
  // 8b-3's ↑ duplicate badge will sit at top:-6px; left:-6px so corners
  // don't collide. Badge is aria-hidden; the name prefix carries the semantic.
  const deceasedBadge = data.deceased
    ? `<span
        class="mtf-node__deceased-badge"
        aria-hidden="true"
        style="
          position:absolute;
          top:0;
          right:0;
          width:14px;
          height:14px;
          border-radius:50%;
          background:var(--card);
          color:var(--muted-foreground);
          display:inline-flex;
          align-items:center;
          justify-content:center;
          font-family:var(--font-serif);
          font-size:10px;
          line-height:1;
          border:1px solid var(--border);
        ">†</span>`
    : ''

  if (data.photo_url) {
    return `
      <span style="${outerStyle}">
        <span class="mtf-node__avatar" style="${innerStyle}">
          <img
            src="${escapeHtml(data.photo_url)}"
            alt=""
            width="${sizePx}"
            height="${sizePx}"
            style="width:100%;height:100%;object-fit:cover;"
          />
        </span>
        ${deceasedBadge}
      </span>
    `
  }

  const initials = escapeHtml(computeInitials(data.full_name))
  // Initials ride at ~34% of the diameter — matches <Avatar>.
  const fontSize = Math.round(sizePx * 0.34)
  return `
    <span style="${outerStyle}">
      <span
        class="mtf-node__avatar"
        style="
          ${innerStyle}
          background:var(--tone-${data.tone}-bg);
          color:var(--tone-${data.tone}-ink);
        "
      >
        <span
          style="
            font-family:var(--font-serif);
            font-size:${fontSize}px;
            font-weight:600;
            letter-spacing:0.02em;
            line-height:1;
          "
        >${initials}</span>
      </span>
      ${deceasedBadge}
    </span>
  `
}

type PersonNodeHtmlOptions = { readOnly?: boolean }

export function personNodeHtml(
  d: TreeDatum,
  options: PersonNodeHtmlOptions = {},
): string {
  // `d` is a d3 hierarchy node. `d.data` is the Datum we shipped to
  // family-chart (`{ id, data: payload, rels }`). The renderable payload
  // (full_name, birth_year, tone, …) lives at `d.data.data` — one level
  // deeper than the typed TreeDatum surface suggests.
  //
  // Synthetic spouse nodes the library generates for layout (see
  // family-chart.esm.js line ~707) wrap a real Datum the same way, so
  // this path stays valid for them too.
  const datum = d.data as unknown as FamilyChartDatum
  const data = datum.data

  const name = escapeHtml(data.full_name)
  const dates = formatDates(data.birth_year, data.death_year, data.deceased)
  const id = escapeHtml(datum.id)

  // Deceased name prefix — † in muted-foreground, aria-hidden (Memoriam
  // component pattern mirrored in raw HTML). Screen readers see the date
  // line for "deceased" signal; the glyph is a visual-only ornament.
  const namePrefix = data.deceased
    ? `<span aria-hidden="true" style="color:var(--muted-foreground);opacity:0.6;font-weight:400;margin-right:0.32em;">†</span>`
    : ''

  // Three-dot trigger SVG inlined (EllipsisVertical from Lucide). The button
  // is the non-gesture fallback per docs/ux/mobile-gestures.md — taps open
  // the action menu just like long-press does. The 44×44 hit-area (Apple
  // HIG minimum) wraps a smaller 16×16 icon so the icon stays subtle
  // while the tap target meets accessibility.
  const ellipsisButton = `
    <button
      type="button"
      data-action-trigger
      data-person-id="${id}"
      aria-label="Actions for ${name}"
      style="
        position:absolute;
        top:-6px;
        right:-6px;
        width:44px;
        height:44px;
        display:flex;
        align-items:center;
        justify-content:center;
        background:transparent;
        border:0;
        padding:0;
        cursor:pointer;
        color:var(--foreground);
        opacity:0.5;
      "
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        stroke-width="2"
        stroke-linecap="round"
        stroke-linejoin="round"
        aria-hidden="true"
      >
        <circle cx="12" cy="12" r="1"></circle>
        <circle cx="12" cy="5" r="1"></circle>
        <circle cx="12" cy="19" r="1"></circle>
      </svg>
    </button>
  `

  // mtf-node--deceased: softened card chrome (border opacity + subtle gradient)
  // defined in globals.css. Composes with 8b-3's mtf-node--duplicate class
  // (separate class — no conflict).
  const cardClass = `mtf-node${data.deceased ? ' mtf-node--deceased' : ''}`

  return `
    <div
      class="${cardClass}"
      data-person-id="${id}"
      style="
        position:relative;
        width:158px;
        height:110px;
        padding:8px 10px;
        border-radius:10px;
        border:1px solid var(--border);
        background:var(--card);
        color:var(--foreground);
        display:flex;
        flex-direction:column;
        align-items:center;
        justify-content:flex-start;
        gap:4px;
        box-sizing:border-box;
        overflow:visible;
      "
    >
      ${options.readOnly ? '' : ellipsisButton}
      ${avatarHtml(data)}
      <div
        style="
          font-family:var(--font-serif);
          font-size:14px;
          line-height:1.15;
          font-weight:600;
          text-align:center;
          display:-webkit-box;
          -webkit-line-clamp:2;
          -webkit-box-orient:vertical;
          overflow:hidden;
          word-break:break-word;
        "
      >${namePrefix}${name}</div>
      ${
        dates
          ? `<div
              style="
                font-family:var(--font-sans);
                font-size:11px;
                line-height:1;
                opacity:0.7;
              "
            >${escapeHtml(dates)}</div>`
          : ''
      }
    </div>
  `
}
