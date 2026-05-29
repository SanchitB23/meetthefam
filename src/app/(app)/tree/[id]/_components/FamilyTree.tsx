'use client'

// Phase 4 sub-task 1 — smoke render.
// Phase 4 sub-task 2 — custom PersonNode HTML card.
// Phase 4 sub-task 3 — tap → detail sheet.
// Phase 4 sub-task 4 — long-press / "…" → action menu.
// Phase 4 sub-task 5 — URL hash sync + context-aware FAB + manual memo.
//
// Focus-state contract:
//   - SSR seed from `?p=<id>` arrives as the `initialFocusId` prop.
//   - On first mount we promote the hash `#p=<id>` over `initialFocusId`
//     when both are present (the hash is more current — the user navigated
//     within the session). The chosen id is fed to family-chart via
//     `chart.updateMainId(...)` BEFORE the first `updateTree({ initial })`.
//   - "Re-center here" and "zoom-to-fit" write the hash via
//     `window.location.hash` (Phase 9 fix — was `history.replaceState`,
//     which silenced browser back/undo). A `hashchange` listener picks it
//     up and applies the new focus. Hash is the single source of truth.
//   - React mirrors the focus id in `currentFocusId` state for the FAB.
//
// <ViewTransition> defer-or-promote (per Phase 4 backlog item):
//   DEFER to Phase 8 polish. family-chart's built-in `setTransitionTime(800)`
//   already animates re-centering at a reasonable pace on mobile; layering a
//   React 19.2 view transition on top doesn't add enough to justify the
//   complexity here. Revisit in Phase 8 if user feedback wants snappier
//   transitions or page-level (landing → dashboard → tree) crossfades.
//
// Memoization:
//   `FamilyTree` is wrapped in `React.memo` (manual — defers React
//   Compiler per the Phase 4 backlog). Defaults to reference equality on
//   the `people` array. The Server Component returns a fresh array on each
//   revalidate so the memo is a no-op there; its value is preventing
//   re-renders from intermediate parent state if any later phase wraps the
//   tree in client-side state owners.

import {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react'
import f3 from 'family-chart'
import 'family-chart/styles/family-chart.css'
import type { TreeDatum } from 'family-chart'

import {
  transformToFamilyChartShape,
  type FamilyChartDatum,
} from '../_lib/family-chart-data'
import { attachNonSpouseParentLinkRewriter } from '../_lib/non-spouse-parent-links'
import { personNodeHtml } from '../_lib/person-node-html'
import { usePressActions } from '../_lib/usePressActions'
import type { PersonRow } from '../_lib/types'
import { AddRelativeFab } from './AddRelativeFab'
import { PersonActionMenu, type ActionAnchor } from './PersonActionMenu'
import { PersonDetailSheet } from './PersonDetailSheet'
import { ZoomControls } from './ZoomControls'
// PersonHoverPlus and PersonForm removed in 8b polish FIX 1:
// "+" is now an in-card button child of .mtf-node; form is owned by AddRelativeFab
// via CustomEvent('mtf-add-relative') dispatched from setOnCardClick.

type Props = {
  treeId: string
  people: PersonRow[]
  /** SSR-derived focus from `?p=<id>` searchParams. May be overridden by `#p=<id>` on mount. */
  initialFocusId?: string | null
  /**
   * Phase 7 sub-task 3 — typed-only stub so /share/[token]/page.tsx can pass
   * `readOnly` ahead of the actual chrome-lockdown behavior. Wired in
   * sub-task 4 (hides FAB, action menu, and the detail-sheet Edit button).
   */
  readOnly?: boolean
}

type Chart = ReturnType<typeof f3.createChart>

const HASH_PATTERN = /^#p=(.+)$/

function readHashFocus(): string | null {
  if (typeof window === 'undefined') return null
  const match = window.location.hash.match(HASH_PATTERN)
  return match ? decodeURIComponent(match[1]) : null
}

// `hashchange` is an external source; useSyncExternalStore is the React 19
// idiomatic path that avoids the `react-hooks/set-state-in-effect` lint
// rule. SSR snapshot returns null so the server's "no hash" view matches
// the first client paint, and we hydrate the real hash on the next tick.
function subscribeToHash(callback: () => void): () => void {
  window.addEventListener('hashchange', callback)
  return () => window.removeEventListener('hashchange', callback)
}
function getHashSnapshot(): string | null {
  return readHashFocus()
}
function getServerHashSnapshot(): string | null {
  return null
}


function FamilyTreeImpl({ treeId, people, initialFocusId, readOnly = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<Chart | null>(null)
  const [detailPersonId, setDetailPersonId] = useState<string | null>(null)
  const [actionAnchor, setActionAnchor] = useState<ActionAnchor | null>(null)

  const peopleById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  )
  const peopleByIdRef = useRef(peopleById)
  useEffect(() => {
    peopleByIdRef.current = peopleById
  }, [peopleById])

  // Captured in the chart-init effect — see "un-recenter fallback" comment
  // there. Holds the main_id we restore when `currentFocusId` flips to null
  // (hash cleared / browser back from a `#p=` URL / zoom-to-fit button).
  const fallbackMainIdRef = useRef<string | null>(null)

  // Hash is the runtime source of truth for the focus id. Server + first
  // client paint see no hash (matches the SSR snapshot); subsequent paints
  // see the real value. If hash is absent, fall back to the SSR `?p=`
  // seed; if both are absent, the focus is null until "Re-center here"
  // sets it explicitly.
  const hashFocus = useSyncExternalStore(
    subscribeToHash,
    getHashSnapshot,
    getServerHashSnapshot,
  )
  const currentFocusId = hashFocus ?? initialFocusId ?? null

  const { shouldSuppressNextClickRef } = usePressActions(containerRef, {
    onLongPress: readOnly
      ? () => {
          /* no-op in read-only mode */
        }
      : (personId, e) => {
          const node = (e.target as HTMLElement | null)?.closest('.mtf-node') as HTMLElement | null
          const rect = node?.getBoundingClientRect()
          setActionAnchor({
            personId,
            x: rect ? rect.right - 4 : e.clientX,
            y: rect ? rect.top + 8 : e.clientY,
          })
        },
  })

  // Chart-bound effect — full teardown + rebuild when `people` changes.
  useEffect(() => {
    const cont = containerRef.current
    if (!cont) return

    const data: FamilyChartDatum[] = transformToFamilyChartShape(people)

    const chart = f3.createChart(cont, data)
      .setTransitionTime(800)
      .setCardXSpacing(220)
      .setCardYSpacing(130)
      .setOrientationVertical()
      .setAncestryDepth(20)
      .setProgenyDepth(20)
      .setSingleParentEmptyCard(false)

    // v0.0.5 hotfix — family-chart draws a single midpoint-anchored
    // ancestry link for every child, which produces a horizontal bar
    // joining both parents that looks identical to its dedicated "spouse"
    // link. For co-parents who aren't actually married this reads as a
    // marriage. We rewrite those specific links to two independent
    // stepped vertical paths after each update. A MutationObserver keeps
    // the override applied across d3's transition window. See
    // `../_lib/non-spouse-parent-links.ts` for full rationale.
    const linkRewriter = attachNonSpouseParentLinkRewriter(cont, peopleByIdRef)
    chart.setAfterUpdate(() => {
      linkRewriter.kick()
    })

    chart
      .setCardHtml()
      .setCardDim({ w: 158, h: 110 })
      .setCardInnerHtmlCreator((d) => personNodeHtml(d, { readOnly }))
      .setOnCardClick((e: Event, d: TreeDatum) => {
        if (shouldSuppressNextClickRef.current) {
          shouldSuppressNextClickRef.current = false
          return
        }
        const id = d.data.id
        if (!peopleByIdRef.current.has(id)) return

        const target = (e.target as HTMLElement | null) ?? null

        // 8b-3: tap on a duplicate card → jump to the primary instance.
        // family-chart marks duplicates with the same data.id as the primary,
        // so setting the hash to that id re-centers on the canonical occurrence
        // via the existing hash-driven re-center wiring (handleRecenter /
        // useSyncExternalStore). Use window.location.hash (not replaceState)
        // so a new hashchange event fires and the subscriber picks it up.
        // This branch fires BEFORE the action-trigger branch so a duplicate
        // card never falls through to the action menu path.
        if (target?.closest('[data-duplicate="true"]')) {
          window.location.hash = `#p=${encodeURIComponent(id)}`
          return
        }

        if (!readOnly) {
          // 8b polish FIX 1 — in-card "+" button dispatches a CustomEvent that
          // AddRelativeFab picks up to open the add-relative form pre-seeded on
          // this specific person (not the currently-centred FAB person).
          if (target?.closest('[data-action-plus]')) {
            const plusEl = target.closest<HTMLElement>('[data-action-plus]')
            const personId2 = plusEl?.dataset.personId ?? id
            window.dispatchEvent(
              new CustomEvent('mtf-add-relative', { detail: { personId: personId2 } }),
            )
            return
          }

          const trigger = target?.closest('[data-action-trigger]') as HTMLElement | null
          if (trigger) {
            const rect = trigger.getBoundingClientRect()
            setActionAnchor({
              personId: id,
              x: rect.right,
              y: rect.bottom,
            })
            return
          }
        }
        setDetailPersonId(id)
      })

    // Seed initial focus before the first render so the chart paints
    // already-centered on the SSR / hash-derived person. Hash wins over
    // the SSR seed (matches the rendering contract above).
    const seedFocus = readHashFocus() ?? initialFocusId ?? null
    if (seedFocus && peopleByIdRef.current.has(seedFocus)) {
      chart.updateMainId(seedFocus)
    }

    // Capture the "un-recenter" fallback target — the main_id we restore
    // when the hash is cleared (zoom-to-fit button, manual address-bar
    // clear, browser back from a `#p=` URL). Priority:
    //   1. `initialFocusId` (the `?p=` deep-link the user opened with)
    //   2. `people[0].id` (family-chart's natural default when no main_id
    //      is set explicitly — matches the first-paint behaviour when
    //      `seedFocus` is null)
    // Without this fallback, the un-recenter path stays anchored on the
    // most recent `#p=` person because family-chart's `main_id` is sticky
    // and there's no implicit "no focus" state to revert to.
    fallbackMainIdRef.current =
      initialFocusId ?? people[0]?.id ?? null

    chart.updateTree({ initial: true })
    chartRef.current = chart

    return () => {
      linkRewriter.dispose()
      chartRef.current = null
      cont.innerHTML = ''
    }
    // initialFocusId is read once on first mount only; subsequent changes
    // come through the hash and the hashchange-driven `applyFocus`
    // effect, not through teardown + rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, shouldSuppressNextClickRef, readOnly])

  // React → chart sync. The hash-derived `currentFocusId` is the source;
  // whenever it changes we push the new id into family-chart's store.
  // Initial mount is handled inline in the chart-init effect above to
  // avoid the first-paint flicker that a separate effect would cause.
  //
  // Un-recenter path (#62): when `currentFocusId` becomes null (hash
  // cleared by the zoom-to-fit button, the address-bar, or browser back),
  // we restore `fallbackMainIdRef` and force a zoom-fit. Without this
  // family-chart's `main_id` is sticky and the previous focus stays the
  // layout root even though the URL no longer says so.
  const initialMountRef = useRef(true)
  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false
      return
    }
    const chart = chartRef.current
    if (!chart) return

    if (currentFocusId == null) {
      // Un-recenter — restore the fallback main_id (initialFocusId or
      // people[0]) and zoom-fit so the canvas matches the initial view.
      const fallback = fallbackMainIdRef.current
      if (fallback && peopleByIdRef.current.has(fallback)) {
        chart.updateMainId(fallback)
      }
      chart.updateTree({ initial: true })
      return
    }

    if (!peopleByIdRef.current.has(currentFocusId)) return
    chart.updateMainId(currentFocusId)
    chart.updateTree()
  }, [currentFocusId])

  // 8b-2 — zoom-to-fit the whole tree. Clears the URL hash (so the canvas
  // isn't still anchored to a specific person), then calls updateTree with
  // initial=true which triggers family-chart's bounding-box auto-fit (the
  // same path the chart takes on first paint). main-id is left as-is — the
  // current focus person becomes the layout root, but all nodes are visible.
  const zoomToFit = useCallback(() => {
    // Use window.location.hash (not replaceState) so the native hashchange
    // fires, useSyncExternalStore clears currentFocusId, and browser back
    // can undo the zoom-to-fit.
    window.location.hash = ''
    chartRef.current?.updateTree({ initial: true })
  }, [])

  // Programmatic zoom via a synthetic wheel event. family-chart doesn't
  // expose a JS zoom API, so dispatch a `wheel` event on d3-zoom's listener
  // element — d3-zoom's own wheel handler then computes the new transform
  // and routes it through `zoom.transform`, which fires the 'zoom' event
  // family-chart subscribes to (line 1138 of family-chart.js sets
  // `transform` on `g.view`). Going through d3's apply path is the only
  // reliable way: directly mutating `el.__zoom` + setting the inner `<g>`
  // transform attribute (the previous approach) doesn't survive d3-zoom's
  // next tick — d3 reads from its own internal state and overwrites the
  // manually-set transform, so the +/− buttons appeared to do nothing.
  //
  // d3-zoom's default wheelDelta(): `event.deltaY * -0.002` for
  // `deltaMode 0` (pixels). The scale multiplier d3 applies is
  // `Math.pow(2, wheelDelta)`. To apply a factor f, we need
  // wheelDelta = log2(f), so deltaY = -log2(f) / 0.002.
  const applyZoomDelta = useCallback((factor: number) => {
    const cont = containerRef.current
    if (!cont) return
    const svg = cont.querySelector<SVGSVGElement>('svg.main_svg')
    if (!svg) return

    // d3-zoom listener — family-chart attaches it to either svg or parent.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const el = ((svg as any).__zoomObj ? svg : svg.parentNode) as HTMLElement | SVGElement | null
    if (!el) return

    const deltaY = -Math.log2(factor) / 0.002
    const rect = svg.getBoundingClientRect()
    const evt = new WheelEvent('wheel', {
      deltaY,
      deltaMode: 0,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      bubbles: true,
      cancelable: true,
    })
    el.dispatchEvent(evt)
  }, [])

  const zoomIn = useCallback(() => applyZoomDelta(1.2), [applyZoomDelta])
  const zoomOut = useCallback(() => applyZoomDelta(1 / 1.2), [applyZoomDelta])

  const handleRecenter = useCallback((personId: string) => {
    // Hash is the single source of truth — write it via window.location.hash
    // so the native hashchange fires and browser back can undo the re-center
    // (Phase 9 fix — was history.replaceState which silenced the back stack).
    // If the hash is already current, force the chart update directly since
    // no hashchange fires for a no-op assignment.
    const target = `#p=${encodeURIComponent(personId)}`
    if (window.location.hash === target) {
      const chart = chartRef.current
      if (chart && peopleByIdRef.current.has(personId)) {
        chart.updateMainId(personId)
        chart.updateTree()
      }
    } else {
      window.location.hash = target
    }
  }, [])

  const detailPerson = detailPersonId ? peopleById.get(detailPersonId) ?? null : null
  const focusPerson = currentFocusId ? peopleById.get(currentFocusId) ?? null : null

  return (
    <>
      {/*
        Outer wrapper: position:relative so ZoomControls can use
        `absolute` positioning relative to the canvas area. The inner f3 div
        keeps overflow:hidden for family-chart's own pan/zoom chrome; the
        overlay sits on top, outside the clip region.
      */}
      <div className="relative">
        <div
          ref={containerRef}
          className="f3 w-full h-[calc(100vh-9rem)] rounded-lg border border-border bg-canvas overflow-hidden"
          style={{
            ['--background-color' as string]: 'var(--canvas)',
            ['--text-color' as string]: 'var(--foreground)',
            backgroundImage: 'radial-gradient(circle, var(--border) 1px, transparent 1px)',
            backgroundSize: '24px 24px',
          }}
        />
        <ZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} onFit={zoomToFit} />
      </div>
      <PersonDetailSheet
        person={detailPerson}
        peopleById={peopleById}
        treeId={treeId}
        readOnly={readOnly}
        onOpenChange={(next) => setDetailPersonId(next?.id ?? null)}
      />
      {!readOnly && (
        <>
          <PersonActionMenu
            anchor={actionAnchor}
            treeId={treeId}
            people={people}
            peopleById={peopleById}
            onClose={() => setActionAnchor(null)}
            onRecenter={handleRecenter}
          />
          {/* 8b polish FIX 1 — AddRelativeFab now also handles the in-card "+"
              via CustomEvent('mtf-add-relative') dispatched from setOnCardClick. */}
          <AddRelativeFab
            treeId={treeId}
            focusPerson={focusPerson}
            peopleById={peopleById}
          />
        </>
      )}
    </>
  )
}

export const FamilyTree = memo(FamilyTreeImpl)
