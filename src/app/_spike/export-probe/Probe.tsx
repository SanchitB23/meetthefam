// src/app/_spike/export-probe/Probe.tsx
// SPIKE #215 — throwaway. DELETE with the page.
'use client'
import { useRef, useState } from 'react'
import { FamilyTree } from '@/app/(app)/tree/[id]/_components/FamilyTree'
import type { PersonRow } from '@/app/(app)/tree/[id]/_lib/types'

type Metrics = {
  path: string
  ok: boolean
  width?: number
  height?: number
  bytes?: number
  ms?: number
  error?: string
}

export function Probe({
  treeId,
  treeName,
  people,
}: {
  treeId: string
  treeName: string
  people: PersonRow[]
}) {
  const wrapRef = useRef<HTMLDivElement>(null)
  const [metrics, setMetrics] = useState<Metrics[]>([])

  async function captureClient(format: 'png' | 'pdf') {
    const t0 = performance.now()
    const root = wrapRef.current
    const svg = root?.querySelector('svg.main_svg') as SVGSVGElement | null
    const m: Metrics = { path: `client-${format}`, ok: false }
    try {
      if (!svg) throw new Error('svg.main_svg not found')
      const bbox = svg.getBBox()
      const { toBlob } = await import('html-to-image')
      const blob = await toBlob(svg as unknown as HTMLElement, {
        pixelRatio: 2,
        width: Math.ceil(bbox.width),
        height: Math.ceil(bbox.height),
        backgroundColor: '#FAF6F0',
      })
      if (!blob) throw new Error('toBlob returned null')
      m.bytes = blob.size
      m.width = Math.ceil(bbox.width * 2)
      m.height = Math.ceil(bbox.height * 2)

      if (format === 'pdf') {
        const { jsPDF } = await import('jspdf')
        const url = URL.createObjectURL(blob)
        const img = new Image()
        await new Promise((res, rej) => {
          img.onload = res
          img.onerror = rej
          img.src = url
        })
        const pdf = new jsPDF({ orientation: img.width > img.height ? 'l' : 'p', unit: 'px', format: [img.width, img.height] })
        pdf.addImage(img, 'PNG', 0, 0, img.width, img.height)
        pdf.save(`${treeName}-${treeId}.pdf`)
        URL.revokeObjectURL(url)
      } else {
        const url = URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${treeName}-${treeId}.png`
        a.click()
        URL.revokeObjectURL(url)
      }
      m.ok = true
    } catch (e) {
      m.error = e instanceof Error ? e.message : String(e)
    }
    m.ms = Math.round(performance.now() - t0)
    setMetrics((prev) => [...prev, m])
    ;(window as unknown as { __spikeMetrics?: Metrics[] }).__spikeMetrics = [
      ...((window as unknown as { __spikeMetrics?: Metrics[] }).__spikeMetrics ?? []),
      m,
    ]
  }

  return (
    <div style={{ padding: 12 }}>
      <div data-export-exclude style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
        <strong>
          {treeName} — {people.length} people
        </strong>
        <button data-testid="cap-png" onClick={() => captureClient('png')}>
          Client PNG
        </button>
        <button data-testid="cap-pdf" onClick={() => captureClient('pdf')}>
          Client PDF
        </button>
        <pre data-testid="metrics" style={{ margin: 0 }}>
          {JSON.stringify(metrics, null, 0)}
        </pre>
      </div>
      <div ref={wrapRef}>
        <FamilyTree treeId={treeId} people={people} readOnly />
      </div>
    </div>
  )
}
