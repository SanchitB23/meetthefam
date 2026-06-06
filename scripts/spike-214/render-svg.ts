import type { PositionedLayout, PersonNode } from './types.ts'

export function renderSvg(layout: PositionedLayout, peopleById: Map<string, PersonNode>): string {
  const W = 158, H = 110
  const parts: string[] = []
  parts.push(`<svg xmlns="http://www.w3.org/2000/svg" width="${Math.ceil(layout.width)}" height="${Math.ceil(layout.height)}" viewBox="0 0 ${Math.ceil(layout.width)} ${Math.ceil(layout.height)}">`)
  parts.push(`<rect width="100%" height="100%" fill="#fbf7ee"/>`)

  // edges first (under cards)
  for (const e of layout.edges) {
    const pts = e.points.length >= 2 ? e.points : []
    if (pts.length) {
      const d = pts.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`).join(' ')
      parts.push(`<path d="${d}" fill="none" stroke="#7a6f63" stroke-width="1.5"/>`)
    }
  }

  // nodes
  for (const n of layout.nodes) {
    if (n.kind === 'union') {
      parts.push(`<circle cx="${n.x}" cy="${n.y}" r="3" fill="#b5462f"/>`)
      continue
    }
    const person = peopleById.get(n.id)
    const name = (person?.fullName ?? n.id).replace(/&/g, '&amp;').replace(/</g, '&lt;')
    parts.push(`<g transform="translate(${n.x - W / 2},${n.y - H / 2})">`)
    parts.push(`<rect width="${W}" height="${H}" rx="10" fill="#fffdf8" stroke="#2f3b2f" stroke-width="1.5"/>`)
    parts.push(`<text x="${W / 2}" y="${H / 2}" text-anchor="middle" font-family="sans-serif" font-size="13" fill="#2b2b2b">${name}</text>`)
    parts.push(`</g>`)
  }
  parts.push(`</svg>`)
  return parts.join('\n')
}
