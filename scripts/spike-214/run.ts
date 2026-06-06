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
