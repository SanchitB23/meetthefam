# Spike #214 — dagre vs d3-dag layout-engine evaluation — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a headless harness that lays the 55-person family graph out through **dagre** and **d3-dag**, prove whether either eliminates the 8 cross-subtree-marriage duplicates compactly, and write up a go/no-go recommendation for [#200](https://github.com/SanchitB23/meetthefam/issues/200).

**Architecture:** A throwaway TypeScript harness under `scripts/spike-214/`, run with `tsx`. Pipeline: parse `supabase/seed.sql` → normalized person graph → union-node DAG → two engine adapters (dagre, d3-dag) → SVG snapshot + metrics per engine. Pure functions get `node:test` coverage; rendering/research are run-and-inspect. No app wiring, no DB, no production code.

**Tech Stack:** Node 24 (repo `.nvmrc`), `tsx` (already installed), `@dagrejs/dagre`, `d3-dag` (throwaway devDeps, branch-local). SVG emitted as hand-built strings — no DOM lib.

---

## Spec → plan deviation (read first)

The spec ([`docs/superpowers/specs/2026-06-06-issue-214-layout-engine-spike-design.md`](../specs/2026-06-06-issue-214-layout-engine-spike-design.md)) names **DB-query as the primary graph source, seed-parse as fallback**. At plan time the local Supabase stack was down and no `pg`/`postgres`/`psql` client was present. This plan **flips to seed-parse primary** (deterministic, zero-dep, stack-independent). Engine adapters never touch the DB either way, so the spec's intent holds. If you prefer the DB path, that's a drop-in replacement of Task 2's `parse-seed.ts` with a `pg` query — not planned here.

## Environment prerequisite (every task)

The interactive shell may default to an old Node. Before running anything:

```bash
cd /Users/sqb6461/Workspace/SelfProjects/meetthefam/.claude/worktrees/spike-214-layout-engine
nvm use            # reads .nvmrc → Node 24.x
node -v            # MUST print v24.x — if not, `nvm install` then `nvm use`
```

All paths below are relative to that worktree root.

## File structure

| File | Responsibility |
|---|---|
| `scripts/spike-214/parse-seed.ts` | Parse `supabase/seed.sql` → `PersonNode[]` (id, name, gender, fatherId, motherId, spouseId) |
| `scripts/spike-214/build-dag.ts` | `PersonNode[]` → union-node DAG (`{ nodes, edges }`) — the core encoding hypothesis |
| `scripts/spike-214/metrics.ts` | Positioned layout → `{ uniquePeople, personCards, duplicates, width, height, aspect }` |
| `scripts/spike-214/render-svg.ts` | Positioned layout → standalone `.svg` string |
| `scripts/spike-214/adapters/dagre-adapter.ts` | DAG → positioned layout via `@dagrejs/dagre` |
| `scripts/spike-214/adapters/d3dag-adapter.ts` | DAG → positioned layout via `d3-dag` |
| `scripts/spike-214/types.ts` | Shared harness types (`PersonNode`, `DagNode`, `DagEdge`, `PositionedLayout`) |
| `scripts/spike-214/run.ts` | Orchestrator: parse → build → both adapters → render + metrics → write `out/` |
| `scripts/spike-214/*.test.ts` | `node:test` coverage for the three pure modules |
| `scripts/spike-214/out/` | Generated `dagre.svg`, `d3dag.svg`, `metrics.json` (gitignored within the dir is fine; commit the final artifacts) |
| `docs/superpowers/specs/2026-06-06-issue-214-layout-engine-spike-findings.md` | The written findings (matrix, metrics, recommendation) |

---

## Task 0: Worktree deps

**Files:** none (installs only)

- [ ] **Step 1: Install base deps in the worktree**

Each worktree needs its own `node_modules` (do NOT symlink — see project memory).

Run:
```bash
nvm use
pnpm install --prefer-offline
```
Expected: completes; `node_modules/.bin/tsx` exists.

- [ ] **Step 2: Add throwaway layout-engine devDeps**

Run:
```bash
pnpm add -D @dagrejs/dagre d3-dag
```
Expected: both added to `devDependencies`. These are **branch-local** and must NOT reach the `qa` PR (see Task 9).

- [ ] **Step 3: Record installed versions (feeds the research task)**

Run:
```bash
node -e "console.log('dagre', require('@dagrejs/dagre/package.json').version); console.log('d3-dag', require('d3-dag/package.json').version)"
```
Expected: prints both versions. Note them — Task 7 cites them.

- [ ] **Step 4: Commit the scaffold dir + a README marker**

Create `scripts/spike-214/README.md`:
```markdown
# Spike #214 harness (throwaway)

Headless POC for dagre vs d3-dag as a family-chart layout-engine replacement.
NOT production code. Run: `nvm use && pnpm exec tsx scripts/spike-214/run.ts`.
See docs/superpowers/specs/2026-06-06-issue-214-layout-engine-spike-design.md.
```

Run:
```bash
git add scripts/spike-214/README.md package.json pnpm-lock.yaml
git commit -m "chore(#214): scaffold spike harness + add dagre/d3-dag devDeps (branch-local)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 1: Shared types

**Files:**
- Create: `scripts/spike-214/types.ts`

- [ ] **Step 1: Write the types**

```typescript
// Throwaway spike #214 harness types. Not production code.

export interface PersonNode {
  id: string
  fullName: string
  gender: 'm' | 'f' | 'other' | 'unknown'
  fatherId: string | null
  motherId: string | null
  spouseId: string | null
}

/** A DAG node is either a real person or a synthetic marriage "union". */
export interface DagNode {
  id: string
  kind: 'person' | 'union'
}

/** Directed edge, parent-rank → child-rank. */
export interface DagEdge {
  from: string
  to: string
}

export interface UnionDag {
  nodes: DagNode[]
  edges: DagEdge[]
}

export interface PositionedNode {
  id: string
  kind: 'person' | 'union'
  x: number
  y: number
}

export interface PositionedEdge {
  from: string
  to: string
  points: Array<{ x: number; y: number }>
}

export interface PositionedLayout {
  engine: 'dagre' | 'd3-dag'
  nodes: PositionedNode[]
  edges: PositionedEdge[]
  width: number
  height: number
}
```

- [ ] **Step 2: Commit**

```bash
git add scripts/spike-214/types.ts
git commit -m "chore(#214): spike harness shared types

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 2: Seed parser (TDD)

**Files:**
- Create: `scripts/spike-214/parse-seed.ts`
- Test: `scripts/spike-214/parse-seed.test.ts`

The seed encodes people across `insert into public.people (<cols>) values (...)` blocks (two column shapes — with and without `father_id, mother_id`) and wires spouses via `update public.people set spouse_id = 'X' where id = 'Y';` lines.

- [ ] **Step 1: Write the failing test**

```typescript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseSeed } from './parse-seed.ts'

const SEED = readFileSync(join(import.meta.dirname, '../../supabase/seed.sql'), 'utf8')

test('parses all 55 seed people', () => {
  const people = parseSeed(SEED)
  assert.equal(people.length, 55)
})

test('extracts parent links from the INSERT column order', () => {
  const people = parseSeed(SEED)
  const withParents = people.filter((p) => p.fatherId || p.motherId)
  assert.ok(withParents.length > 0, 'some people should have parents')
})

test('extracts bidirectional spouse links from UPDATE statements', () => {
  const people = parseSeed(SEED)
  const george = people.find((p) => p.id === '22222222-0000-0000-0000-000000000001')
  assert.equal(george?.spouseId, '22222222-0000-0000-0000-000000000002')
})

test('every parent/spouse id resolves to a known person (no dangling refs)', () => {
  const people = parseSeed(SEED)
  const ids = new Set(people.map((p) => p.id))
  for (const p of people) {
    for (const ref of [p.fatherId, p.motherId, p.spouseId]) {
      if (ref) assert.ok(ids.has(ref), `dangling ref ${ref} from ${p.id}`)
    }
  }
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec tsx --test scripts/spike-214/parse-seed.test.ts`
Expected: FAIL — `parseSeed` not exported / file missing.

- [ ] **Step 3: Implement the parser**

```typescript
import type { PersonNode } from './types.ts'

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

  // 1. INSERT blocks. Match `insert into public.people ( COLS ) values ROWS ;`
  const insertRe = /insert\s+into\s+public\.people\s*\(([^)]*)\)\s*values\s*([\s\S]*?);/gi
  let m: RegExpExecArray | null
  while ((m = insertRe.exec(sql))) {
    const cols = m[1].split(',').map((c) => c.trim())
    const rowsBlob = m[2]
    // Each row is a parenthesised tuple. Split on `),` at top level.
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
  while ((u = updRe.exec(sql))) {
    const [, spouseId, id] = u
    const p = byId.get(id)
    if (p) p.spouseId = spouseId
  }

  return [...byId.values()]
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec tsx --test scripts/spike-214/parse-seed.test.ts`
Expected: PASS — 4 tests, 55 people.

- [ ] **Step 5: Commit**

```bash
git add scripts/spike-214/parse-seed.ts scripts/spike-214/parse-seed.test.ts
git commit -m "chore(#214): seed.sql graph parser (55 people, parents + spouses)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 3: Union-node DAG builder (TDD)

**Files:**
- Create: `scripts/spike-214/build-dag.ts`
- Test: `scripts/spike-214/build-dag.test.ts`

The hypothesis: model each marriage as a synthetic **union** node. A couple's two persons each point *into* their union; the union points *out* to each child. A person who is both a child and a spouse therefore appears as exactly one node with edges from their parents' union AND into their own union — which is what should kill the cross-subtree duplicates.

Union id is the sorted-pair key `union:<lowId>+<highId>` so both spouse rows resolve to the same union. People with no spouse and no children contribute just a person node. A child links to the union of its father+mother if both known; if only one parent is known, link that parent person → child directly (no union).

- [ ] **Step 1: Write the failing test**

```typescript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { buildUnionDag } from './build-dag.ts'
import type { PersonNode } from './types.ts'

const ppl = (xs: Partial<PersonNode>[]): PersonNode[] =>
  xs.map((x, i) => ({
    id: x.id ?? `p${i}`, fullName: x.fullName ?? `P${i}`,
    gender: x.gender ?? 'unknown',
    fatherId: x.fatherId ?? null, motherId: x.motherId ?? null,
    spouseId: x.spouseId ?? null,
  }))

test('a married couple with a child yields one union node and three persons', () => {
  const people = ppl([
    { id: 'a', spouseId: 'b' },
    { id: 'b', spouseId: 'a' },
    { id: 'c', fatherId: 'a', motherId: 'b' },
  ])
  const dag = buildUnionDag(people)
  assert.equal(dag.nodes.filter((n) => n.kind === 'person').length, 3)
  assert.equal(dag.nodes.filter((n) => n.kind === 'union').length, 1)
})

test('each person appears exactly once even when child-of-one-union and spouse-in-another', () => {
  // a+b -> c ; c marries d ; so c is both a child and a spouse.
  const people = ppl([
    { id: 'a', spouseId: 'b' }, { id: 'b', spouseId: 'a' },
    { id: 'c', fatherId: 'a', motherId: 'b', spouseId: 'd' },
    { id: 'd', spouseId: 'c' },
  ])
  const dag = buildUnionDag(people)
  const cNodes = dag.nodes.filter((n) => n.id === 'c')
  assert.equal(cNodes.length, 1)
})

test('union id is stable regardless of spouse order', () => {
  const ab = buildUnionDag(ppl([{ id: 'a', spouseId: 'b' }, { id: 'b', spouseId: 'a' }]))
  const union = ab.nodes.find((n) => n.kind === 'union')
  assert.ok(union)
  assert.ok(union!.id.includes('a') && union!.id.includes('b'))
})

test('produces an acyclic edge set on the 55-seed graph', async () => {
  const { readFileSync } = await import('node:fs')
  const { join } = await import('node:path')
  const { parseSeed } = await import('./parse-seed.ts')
  const seed = readFileSync(join(import.meta.dirname, '../../supabase/seed.sql'), 'utf8')
  const dag = buildUnionDag(parseSeed(seed))
  // Kahn's algorithm — if it consumes every node, the graph is acyclic.
  const indeg = new Map(dag.nodes.map((n) => [n.id, 0]))
  for (const e of dag.edges) indeg.set(e.to, (indeg.get(e.to) ?? 0) + 1)
  const q = [...indeg].filter(([, d]) => d === 0).map(([id]) => id)
  let seen = 0
  while (q.length) {
    const id = q.shift()!; seen++
    for (const e of dag.edges.filter((x) => x.from === id)) {
      indeg.set(e.to, indeg.get(e.to)! - 1)
      if (indeg.get(e.to) === 0) q.push(e.to)
    }
  }
  assert.equal(seen, dag.nodes.length, 'graph must be acyclic')
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec tsx --test scripts/spike-214/build-dag.test.ts`
Expected: FAIL — `buildUnionDag` missing.

- [ ] **Step 3: Implement the builder**

```typescript
import type { PersonNode, UnionDag, DagNode, DagEdge } from './types.ts'

const unionId = (a: string, b: string) =>
  `union:${[a, b].sort().join('+')}`

export function buildUnionDag(people: PersonNode[]): UnionDag {
  const ids = new Set(people.map((p) => p.id))
  const nodes = new Map<string, DagNode>()
  const edgeKeys = new Set<string>()
  const edges: DagEdge[] = []

  const addPerson = (id: string) => {
    if (!nodes.has(id)) nodes.set(id, { id, kind: 'person' })
  }
  const addUnion = (id: string) => {
    if (!nodes.has(id)) nodes.set(id, { id, kind: 'union' })
  }
  const addEdge = (from: string, to: string) => {
    const k = `${from}->${to}`
    if (edgeKeys.has(k)) return
    edgeKeys.add(k)
    edges.push({ from, to })
  }

  // Every person is a node.
  for (const p of people) addPerson(p.id)

  // Spouse unions: both spouse rows resolve to the same union id.
  for (const p of people) {
    if (p.spouseId && ids.has(p.spouseId)) {
      const uid = unionId(p.id, p.spouseId)
      addUnion(uid)
      addEdge(p.id, uid)
      addEdge(p.spouseId, uid)
    }
  }

  // Parent → child wiring.
  for (const p of people) {
    const f = p.fatherId && ids.has(p.fatherId) ? p.fatherId : null
    const m = p.motherId && ids.has(p.motherId) ? p.motherId : null
    if (f && m) {
      // Reuse the parents' marriage union if it exists; else synthesise one.
      const uid = unionId(f, m)
      addUnion(uid)
      addEdge(f, uid)
      addEdge(m, uid)
      addEdge(uid, p.id)
    } else if (f) {
      addEdge(f, p.id)
    } else if (m) {
      addEdge(m, p.id)
    }
  }

  return { nodes: [...nodes.values()], edges }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec tsx --test scripts/spike-214/build-dag.test.ts`
Expected: PASS — including acyclic check on the real seed.

- [ ] **Step 5: Commit**

```bash
git add scripts/spike-214/build-dag.ts scripts/spike-214/build-dag.test.ts
git commit -m "chore(#214): union-node DAG builder (the cross-subtree dedup hypothesis)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 4: Metrics (TDD)

**Files:**
- Create: `scripts/spike-214/metrics.ts`
- Test: `scripts/spike-214/metrics.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { computeMetrics } from './metrics.ts'
import type { PositionedLayout } from './types.ts'

const layout: PositionedLayout = {
  engine: 'dagre',
  nodes: [
    { id: 'a', kind: 'person', x: 0, y: 0 },
    { id: 'b', kind: 'person', x: 100, y: 0 },
    { id: 'union:a+b', kind: 'union', x: 50, y: 50 },
  ],
  edges: [],
  width: 100,
  height: 50,
}

test('counts unique people, ignores union nodes', () => {
  const m = computeMetrics(layout, 2)
  assert.equal(m.personCards, 2)
  assert.equal(m.uniquePeople, 2)
  assert.equal(m.duplicates, 0)
})

test('flags duplicates when a person id appears twice', () => {
  const dup: PositionedLayout = {
    ...layout,
    nodes: [...layout.nodes, { id: 'a', kind: 'person', x: 200, y: 0 }],
  }
  const m = computeMetrics(dup, 2)
  assert.equal(m.personCards, 3)
  assert.equal(m.uniquePeople, 2)
  assert.equal(m.duplicates, 1)
})

test('reports aspect ratio width/height', () => {
  const m = computeMetrics(layout, 2)
  assert.equal(m.aspect, 2)
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `pnpm exec tsx --test scripts/spike-214/metrics.test.ts`
Expected: FAIL — `computeMetrics` missing.

- [ ] **Step 3: Implement metrics**

```typescript
import type { PositionedLayout } from './types.ts'

export interface Metrics {
  engine: string
  personCards: number
  uniquePeople: number
  duplicates: number
  expectedPeople: number
  allRenderedOnce: boolean
  width: number
  height: number
  aspect: number
}

export function computeMetrics(layout: PositionedLayout, expectedPeople: number): Metrics {
  const personIds = layout.nodes.filter((n) => n.kind === 'person').map((n) => n.id)
  const unique = new Set(personIds)
  const duplicates = personIds.length - unique.size
  return {
    engine: layout.engine,
    personCards: personIds.length,
    uniquePeople: unique.size,
    duplicates,
    expectedPeople,
    allRenderedOnce: unique.size === expectedPeople && duplicates === 0,
    width: Math.round(layout.width),
    height: Math.round(layout.height),
    aspect: layout.height === 0 ? 0 : Number((layout.width / layout.height).toFixed(2)),
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `pnpm exec tsx --test scripts/spike-214/metrics.test.ts`
Expected: PASS — 3 tests.

- [ ] **Step 5: Commit**

```bash
git add scripts/spike-214/metrics.ts scripts/spike-214/metrics.test.ts
git commit -m "chore(#214): layout metrics (dupes, unique people, aspect)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 5: dagre adapter

**Files:**
- Create: `scripts/spike-214/adapters/dagre-adapter.ts`

dagre's API is stable. Person nodes get a card-sized box (158×110, matching the app's `setCardDim`); union nodes are near-zero-size connectors.

- [ ] **Step 1: Implement the adapter**

```typescript
import pkg from '@dagrejs/dagre'
import type { UnionDag, PositionedLayout, PositionedNode, PositionedEdge } from '../types.ts'

const { graphlib, layout } = pkg

export function layoutWithDagre(dag: UnionDag): PositionedLayout {
  const g = new graphlib.Graph({ directed: true })
  g.setGraph({ rankdir: 'TB', nodesep: 40, ranksep: 60, marginx: 20, marginy: 20 })
  g.setDefaultEdgeLabel(() => ({}))

  for (const n of dag.nodes) {
    if (n.kind === 'person') g.setNode(n.id, { width: 158, height: 110 })
    else g.setNode(n.id, { width: 8, height: 8 })
  }
  for (const e of dag.edges) g.setEdge(e.from, e.to)

  layout(g)

  const nodes: PositionedNode[] = dag.nodes.map((n) => {
    const d = g.node(n.id)
    return { id: n.id, kind: n.kind, x: d.x, y: d.y }
  })
  const edges: PositionedEdge[] = dag.edges.map((e) => {
    const d = g.edge(e.from, e.to)
    return { from: e.from, to: e.to, points: (d?.points ?? []).map((p) => ({ x: p.x, y: p.y })) }
  })
  const gl = g.graph()
  return { engine: 'dagre', nodes, edges, width: gl.width ?? 0, height: gl.height ?? 0 }
}
```

- [ ] **Step 2: Smoke-run via a one-off**

Run:
```bash
pnpm exec tsx -e "import {readFileSync} from 'node:fs';import {parseSeed} from './scripts/spike-214/parse-seed.ts';import {buildUnionDag} from './scripts/spike-214/build-dag.ts';import {layoutWithDagre} from './scripts/spike-214/adapters/dagre-adapter.ts';const d=buildUnionDag(parseSeed(readFileSync('supabase/seed.sql','utf8')));const l=layoutWithDagre(d);console.log('nodes',l.nodes.length,'wh',Math.round(l.width),Math.round(l.height))"
```
Expected: prints node count + a finite width/height (no NaN, no throw).

- [ ] **Step 3: Commit**

```bash
git add scripts/spike-214/adapters/dagre-adapter.ts
git commit -m "chore(#214): dagre adapter (DAG -> positioned layout)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 6: d3-dag adapter

**Files:**
- Create: `scripts/spike-214/adapters/d3dag-adapter.ts`

> **API caution:** d3-dag had a major 0.x → 1.x rewrite; exported names differ by version. The code below targets the 1.x graph API (`graphConnect` + `sugiyama`). **First read the installed surface**, then reconcile names:
> ```bash
> node -e "console.log(Object.keys(require('d3-dag')))"
> ```
> If your version exposes `dagConnect`/`stratify` (0.x) instead of `graphConnect` (1.x), adapt the calls — the *shape* (build graph from edges → run sugiyama → read `x`/`y`) is the same. Note the exact API used in the findings doc.

- [ ] **Step 1: Implement the adapter**

```typescript
import { graphConnect, sugiyama, layeringLongestPath, decrossOpt, decrossTwoLayer, coordSimplex } from 'd3-dag'
import type { UnionDag, PositionedLayout, PositionedNode, PositionedEdge } from '../types.ts'

export function layoutWithD3Dag(dag: UnionDag): PositionedLayout {
  // d3-dag 1.x builds a graph from [parent, child] id pairs.
  const links: [string, string][] = dag.edges.map((e) => [e.from, e.to])
  const builder = graphConnect()
  const graph = builder(links)

  const nodeSize = (node: { data: string }): readonly [number, number] =>
    node.data.startsWith('union:') ? [8, 8] : [158, 110]

  const layoutFn = sugiyama()
    .layering(layeringLongestPath())
    .decross(dag.edges.length > 400 ? decrossTwoLayer() : decrossOpt())
    .coord(coordSimplex())
    .nodeSize(nodeSize)
    .gap([40, 60])

  const { width, height } = layoutFn(graph)

  const nodes: PositionedNode[] = []
  for (const node of graph.nodes()) {
    const id = node.data as unknown as string
    nodes.push({
      id,
      kind: id.startsWith('union:') ? 'union' : 'person',
      x: node.x ?? 0,
      y: node.y ?? 0,
    })
  }
  const edges: PositionedEdge[] = []
  for (const link of graph.links()) {
    edges.push({
      from: link.source.data as unknown as string,
      to: link.target.data as unknown as string,
      points: (link.points ?? []).map(([x, y]) => ({ x, y })),
    })
  }
  return { engine: 'd3-dag', nodes, edges, width, height }
}
```

- [ ] **Step 2: Smoke-run via a one-off**

Run:
```bash
pnpm exec tsx -e "import {readFileSync} from 'node:fs';import {parseSeed} from './scripts/spike-214/parse-seed.ts';import {buildUnionDag} from './scripts/spike-214/build-dag.ts';import {layoutWithD3Dag} from './scripts/spike-214/adapters/d3dag-adapter.ts';const d=buildUnionDag(parseSeed(readFileSync('supabase/seed.sql','utf8')));const l=layoutWithD3Dag(d);console.log('nodes',l.nodes.length,'wh',Math.round(l.width),Math.round(l.height))"
```
Expected: prints node count + finite width/height. If it throws on API names, reconcile per the caution box, then re-run.

- [ ] **Step 3: Commit**

```bash
git add scripts/spike-214/adapters/d3dag-adapter.ts
git commit -m "chore(#214): d3-dag adapter (DAG -> positioned layout)

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 7: SVG renderer + orchestrator runner

**Files:**
- Create: `scripts/spike-214/render-svg.ts`
- Create: `scripts/spike-214/run.ts`

- [ ] **Step 1: Implement the renderer**

```typescript
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
```

- [ ] **Step 2: Implement the runner**

```typescript
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { parseSeed } from './parse-seed.ts'
import { buildUnionDag } from './build-dag.ts'
import { layoutWithDagre } from './adapters/dagre-adapter.ts'
import { layoutWithD3Dag } from './adapters/d3dag-adapter.ts'
import { renderSvg } from './render-svg.ts'
import { computeMetrics } from './metrics.ts'

const root = join(import.meta.dirname, '../..')
const outDir = join(import.meta.dirname, 'out')
mkdirSync(outDir, { recursive: true })

const people = parseSeed(readFileSync(join(root, 'supabase/seed.sql'), 'utf8'))
const peopleById = new Map(people.map((p) => [p.id, p]))
const dag = buildUnionDag(people)

const engines = [
  { name: 'dagre', fn: layoutWithDagre },
  { name: 'd3dag', fn: layoutWithD3Dag },
] as const

const allMetrics = []
for (const { name, fn } of engines) {
  const t0 = performance.now()
  const layout = fn(dag)
  const ms = Math.round(performance.now() - t0)
  writeFileSync(join(outDir, `${name}.svg`), renderSvg(layout, peopleById))
  const m = { ...computeMetrics(layout, people.length), layoutMs: ms }
  allMetrics.push(m)
  console.log(`\n[${name}] cards=${m.personCards} unique=${m.uniquePeople} dupes=${m.duplicates} ` +
    `allOnce=${m.allRenderedOnce} ${m.width}x${m.height} aspect=${m.aspect} ${ms}ms`)
}

writeFileSync(join(outDir, 'metrics.json'), JSON.stringify({ seedPeople: people.length, engines: allMetrics }, null, 2))
console.log('\nWrote', join(outDir, 'metrics.json'))
```

- [ ] **Step 3: Run the full harness**

Run:
```bash
nvm use && pnpm exec tsx scripts/spike-214/run.ts
```
Expected: prints a metrics line per engine and writes `out/dagre.svg`, `out/d3dag.svg`, `out/metrics.json`. **The headline numbers: `dupes` and `allOnce` per engine, plus `width x height` to compare against option d''s wide strip.**

- [ ] **Step 4: Eyeball the SVGs**

Open `scripts/spike-214/out/dagre.svg` and `out/d3dag.svg` in a browser/Preview. Confirm each person renders once and the layout isn't a degenerate horizontal strip.

- [ ] **Step 5: Commit harness + generated artifacts**

```bash
git add scripts/spike-214/render-svg.ts scripts/spike-214/run.ts scripts/spike-214/out/
git commit -m "chore(#214): SVG renderer + runner; capture dagre/d3-dag metrics + snapshots

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

## Task 8: Engine health + license research

**Files:** none (research → notes for Task 9)

- [ ] **Step 1: Gather maintenance + license signals for both engines**

For `@dagrejs/dagre` and `d3-dag`, collect: latest version (from Task 0 Step 3), last publish date, repo last-commit / release cadence, open-issue count, npm weekly downloads, TS-types story (bundled vs `@types`), license.

Use:
```bash
npm view @dagrejs/dagre version time.modified license
npm view d3-dag version time.modified license
```
And WebFetch the two GitHub repos (`github.com/dagrejs/dagre`, `github.com/erikbrinkman/d3-dag`) for commit/release recency + open issues. Pull any API-migration notes via Context7 if needed.

- [ ] **Step 2: Build the verdict matrix (kept in notes; written up in Task 9)**

Score each against the **two hard gates**: (1) maintenance health, (2) compactness (from `metrics.json` aspect/width vs option d''s 5-wide strip — see #69 spec §"Known limitations"). Card-body reuse and license are reported but not gating (both MIT).

---

## Task 9: Findings write-up, #200 comment, human gate

**Files:**
- Create: `docs/superpowers/specs/2026-06-06-issue-214-layout-engine-spike-findings.md`

- [ ] **Step 1: Write the findings doc**

Sections (fill with REAL data from `metrics.json` + Task 8):
- **Verdict** — recommended engine + version, or "no-go" with reason.
- **Metrics table** — per engine: cards / unique / dupes / allRenderedOnce / W×H / aspect / layoutMs, with the option-d' baseline row (63 cards, 8 dupes, wide strip).
- **Engine health matrix** — the Task 8 signals.
- **Strategy sketch for #200** (only if a "go" looks likely) — union-node encoding recap; how link drawing, d3-zoom pan, and the transition/entry-animation lifecycle get owned once family-chart no longer drives them (sketch, not built). Reference the #200 coupling inventory.
- **Effort re-estimate** for the #200 rebuild.
- **Reproduction** — `nvm use && pnpm exec tsx scripts/spike-214/run.ts` on this branch.

- [ ] **Step 2: Commit the findings doc**

```bash
git add docs/superpowers/specs/2026-06-06-issue-214-layout-engine-spike-findings.md
git commit -m "docs(#214): spike findings — dagre vs d3-dag layout-engine verdict

Refs #214
Co-Authored-By: Claude <noreply@anthropic.com>"
```

- [ ] **Step 3: Post the observations to #200**

Post a comment on [#200](https://github.com/SanchitB23/meetthefam/issues/200) with the verdict, metrics table, health matrix, SVG snapshot references, effort re-estimate, and strategy sketch. Use the GitHub MCP / `gh`:
```bash
gh issue comment 200 --repo SanchitB23/meetthefam --body-file <(...)   # or MCP add_issue_comment
```

- [ ] **Step 4: Flag the human go/no-go gate**

In the #214 thread (or directly to the user), state explicitly: the spike presents evidence; the **go/no-go is the human's call**. List the recommendation framed against the two gates. Do NOT unilaterally re-add #200 to a milestone.

- [ ] **Step 5: Finish the branch**

Use the **superpowers:finishing-a-development-branch** skill. Open a **draft PR** `spike/214-layout-engine → qa`, body per `.github/pull_request_template.md`, with bare `Closes #214` + v1.2 milestone. **Critical:** the `qa`-merged diff must be **docs only** — keep the throwaway harness + `@dagrejs/dagre` / `d3-dag` devDeps out of the PR unless the decision is "go" (e.g. PR only `docs/...findings.md`, or strip the `package.json`/`scripts/spike-214` changes from the merge). The user marks the draft ready.

---

## Verification (end-to-end)

1. `nvm use && pnpm install --prefer-offline` in the worktree (Node 24.x).
2. `pnpm exec tsx --test scripts/spike-214/*.test.ts` → all unit tests PASS (parser=55, builder acyclic + single-instance, metrics dupe count).
3. `pnpm exec tsx scripts/spike-214/run.ts` → `out/metrics.json` written; per-engine `dupes`/`allOnce`/`W×H` printed.
4. Open `out/dagre.svg` + `out/d3dag.svg` → each person once, non-degenerate layout.
5. Findings doc committed; #200 comment posted; human gate flagged.

## Self-review notes

- **Spec coverage:** headless POC (Tasks 2–7) ✓; both engines (Tasks 5–6) ✓; dupe-elimination + compactness metrics (Task 4, 7) ✓; engine-health gate (Task 8) ✓; #200 comment + in-repo findings doc (Task 9) ✓; harness branch-local / docs-only merge (Tasks 0, 9) ✓; human gate (Task 9 Step 4) ✓.
- **Deviation:** seed-parse primary instead of DB-query primary (env: stack down, no pg client) — flagged at top; spec intent preserved.
- **Type consistency:** `PersonNode`, `UnionDag`, `PositionedLayout` defined in Task 1, consumed unchanged in Tasks 2–7. `computeMetrics(layout, expectedPeople)` signature stable across Task 4 + Task 7.
- **Known soft spot:** d3-dag 1.x API names (Task 6) — caution box + read-the-surface step instead of a blind call; the *shape* is correct, names reconciled at runtime.
