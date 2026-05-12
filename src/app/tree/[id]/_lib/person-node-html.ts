// Phase 4 sub-task 2 — custom HTML person card for family-chart.
//
// The library's `setCardInnerHtmlCreator((d) => string)` API takes a function
// that returns a raw HTML string injected into each node card. We can't mount
// the React <Avatar> component here — instead this helper templates the same
// visual contract (photo or tone-tinted serif initials) inline.
//
// Card spec (per ADR 0008 → PersonNode + docs/ux/tree-view.md):
//   - 158×110 wrapper, rounded, heirloom border, bg-card.
//   - 48 px circular avatar at top-center: photo when available, else tinted
//     initials (--tone-X-bg / --tone-X-ink, font-serif).
//   - Serif name, line-clamped to 2 lines.
//   - Date line: `b. 1972`, or `b. 1900 – d. 1975` when deceased, or empty.
//
// Out of scope (Phase 8 polish per ADR 0008): deceased † badge, gender-shape
// variation, hover "+", role label, branch decorations.

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

function avatarHtml(data: FamilyChartDatum['data']): string {
  const sizePx = 48
  if (data.photo_url) {
    return `
      <span
        class="mtf-node__avatar"
        style="width:${sizePx}px;height:${sizePx}px;"
      >
        <img
          src="${escapeHtml(data.photo_url)}"
          alt=""
          width="${sizePx}"
          height="${sizePx}"
          style="width:100%;height:100%;object-fit:cover;"
        />
      </span>
    `
  }

  const initials = escapeHtml(computeInitials(data.full_name))
  // Initials ride at ~34% of the diameter — matches <Avatar>.
  const fontSize = Math.round(sizePx * 0.34)
  return `
    <span
      class="mtf-node__avatar"
      style="
        width:${sizePx}px;
        height:${sizePx}px;
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
  `
}

export function personNodeHtml(d: TreeDatum): string {
  // family-chart's TreeDatum.data is typed loosely (`{ gender, [k]: any }`).
  // At runtime it's exactly the object the transform produced.
  const data = d.data as unknown as FamilyChartDatum['data']

  const name = escapeHtml(data.full_name)
  const dates = formatDates(data.birth_year, data.death_year, data.deceased)

  return `
    <div
      class="mtf-node"
      style="
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
        overflow:hidden;
      "
    >
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
      >${name}</div>
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
