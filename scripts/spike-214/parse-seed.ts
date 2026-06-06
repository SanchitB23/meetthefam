import type { PersonNode } from './types.ts'

// Strip SQL line comments (-- ...) from a string while respecting
// single-quoted string literals (so comment-like sequences inside
// strings are preserved).
function stripLineComments(s: string): string {
  let result = ''
  let inStr = false
  let i = 0
  while (i < s.length) {
    const ch = s[i]
    if (inStr) {
      if (ch === "'" && s[i + 1] === "'") {
        result += "''"
        i += 2
        continue
      }
      if (ch === "'") {
        inStr = false
        result += ch
        i++
        continue
      }
      result += ch
      i++
    } else if (ch === "'") {
      inStr = true
      result += ch
      i++
    } else if (ch === '-' && s[i + 1] === '-') {
      // Skip to end of line (keep the newline itself)
      while (i < s.length && s[i] !== '\n') i++
    } else {
      result += ch
      i++
    }
  }
  return result
}

// Parse a single SQL tuple body into trimmed cell strings, respecting
// single-quoted strings (which may contain commas) and `null`.
function splitRow(body: string): string[] {
  const cells: string[] = []
  let cur = ''
  let inStr = false
  for (let i = 0; i < body.length; i++) {
    const ch = body[i]
    if (inStr) {
      if (ch === "'" && body[i + 1] === "'") { cur += "''"; i++; continue }
      if (ch === "'") { inStr = false; cur += ch; continue }
      cur += ch
    } else if (ch === "'") { inStr = true; cur += ch }
    else if (ch === ',') { cells.push(cur.trim()); cur = '' }
    else cur += ch
  }
  if (cur.trim()) cells.push(cur.trim())
  return cells
}

function unquote(cell: string): string | null {
  if (cell === 'null' || cell === 'NULL') return null
  if (cell.startsWith("'") && cell.endsWith("'")) {
    return cell.slice(1, -1).replace(/''/g, "'")
  }
  return cell
}

export function parseSeed(sql: string): PersonNode[] {
  const byId = new Map<string, PersonNode>()

  // Strip SQL line comments once up-front so that inline comments like
  // `'22222222-...',  -- George` don't bleed into the cell values.
  const cleaned = stripLineComments(sql)

  // 1. INSERT blocks. Match `insert into public.people ( COLS ) values ROWS ;`
  const insertRe = /insert\s+into\s+public\.people\s*\(([^)]*)\)\s*values\s*([\s\S]*?);/gi
  let m: RegExpExecArray | null
  while ((m = insertRe.exec(cleaned))) {
    const cols = m[1].split(',').map((c) => c.trim())
    const rowsBlob = m[2]
    // Each row is a parenthesised tuple. Split on `),` at top level.
    // Use `$` (end-of-string anchor) so the last tuple in each block
    // is captured even when not followed by a comma.
    const rowRe = /\(([\s\S]*?)\)\s*(?:,|$)/g
    let r: RegExpExecArray | null
    while ((r = rowRe.exec(rowsBlob))) {
      const cells = splitRow(r[1])
      if (cells.length !== cols.length) continue
      const rec: Record<string, string | null> = {}
      cols.forEach((c, i) => { rec[c] = unquote(cells[i]) })
      const id = rec['id']
      if (!id) continue
      byId.set(id, {
        id,
        fullName: rec['full_name'] ?? '',
        gender: (rec['gender'] as PersonNode['gender']) ?? 'unknown',
        fatherId: rec['father_id'] ?? null,
        motherId: rec['mother_id'] ?? null,
        spouseId: null,
      })
    }
  }

  // 2. spouse_id UPDATE statements.
  const updRe = /update\s+public\.people\s+set\s+spouse_id\s*=\s*'([^']+)'\s+where\s+id\s*=\s*'([^']+)'/gi
  let u: RegExpExecArray | null
  while ((u = updRe.exec(cleaned))) {
    const [, spouseId, id] = u
    const p = byId.get(id)
    if (p) p.spouseId = spouseId
  }

  return [...byId.values()]
}
