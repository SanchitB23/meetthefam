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
//   - "Re-center here" writes the hash; a `hashchange` listener picks it up
//     and applies the new focus. Hash is the single source of truth.
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
import { PersonForm } from './PersonForm'
import { TreeOverviewButton } from './TreeOverviewButton'
import { PersonHoverPlus } from './PersonHoverPlus'

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

/**
 * Converts a node element's bounding rect into a { top, left } position
 * that represents the bottom-right corner of the node, relative to its
 * nearest positioned ancestor (the chart container).
 *
 * Used by both the pointer-hover effect and the long-press callback so the
 * PersonHoverPlus "+" lands at a consistent offset in both interaction modes.
 */
function rectToPosition(
  node: HTMLElement,
  container: HTMLElement,
): { top: number; left: number } {
  const nodeRect = node.getBoundingClientRect()
  const containerRect = container.getBoundingClientRect()
  return {
    top: nodeRect.bottom - containerRect.top,
    left: nodeRect.right - containerRect.left,
  }
}

function FamilyTreeImpl({ treeId, people, initialFocusId, readOnly = false }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  // 8b-2 — wrapperRef points to the outer position:relative div so that
  // rectToPosition always computes offsets relative to the overlay container,
  // not the inner f3 div. If the outer wrapper ever gains padding or border
  // the math stays correct; containerRef stays for D3/event listeners only.
  const wrapperRef = useRef<HTMLDivElement>(null)
  const chartRef = useRef<Chart | null>(null)
  const [detailPersonId, setDetailPersonId] = useState<string | null>(null)
  const [actionAnchor, setActionAnchor] = useState<ActionAnchor | null>(null)

  // 8b-2 — hover state: which node the pointer is currently over, plus the
  // bottom-right corner of that node (in container-relative coords) so
  // PersonHoverPlus can position its "+" button without its own DOM access.
  const [hoverState, setHoverState] = useState<{
    personId: string
    position: { top: number; left: number }
  } | null>(null)

  // 8b-2 — form state for the hover-plus "+" click path. Separate from the
  // AddRelativeFab so we don't have to invasively lift its internal state.
  const [hoverFormOpen, setHoverFormOpen] = useState(false)
  const [hoverLinkPersonId, setHoverLinkPersonId] = useState<string | null>(null)

  const peopleById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  )
  const peopleByIdRef = useRef(peopleById)
  useEffect(() => {
    peopleByIdRef.current = peopleById
  }, [peopleById])

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
          // 8b-2 mobile parity — also surface hover state after long-press so
          // the PersonHoverPlus "+" is reachable on touch devices. The position
          // is the bottom-right of the node relative to the wrapper container.
          // 8b-3: skip duplicate cards — echoes don't get the "+" affordance.
          if (node && node.dataset.duplicate !== 'true') {
            const wrapper = wrapperRef.current ?? containerRef.current
            if (wrapper) {
              setHoverState({
                personId,
                position: rectToPosition(node, wrapper),
              })
            }
          }
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
  const initialMountRef = useRef(true)
  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false
      return
    }
    if (!currentFocusId) return
    if (!peopleByIdRef.current.has(currentFocusId)) return
    const chart = chartRef.current
    if (!chart) return
    chart.updateMainId(currentFocusId)
    chart.updateTree()
  }, [currentFocusId])

  // 8b-2 — zoom-to-fit the whole tree. Clears the URL hash (so the canvas
  // isn't still anchored to a specific person), then calls updateTree with
  // initial=true which triggers family-chart's bounding-box auto-fit (the
  // same path the chart takes on first paint). main-id is left as-is — the
  // current focus person becomes the layout root, but all nodes are visible.
  const zoomToFit = useCallback(() => {
    history.replaceState(null, '', window.location.pathname)
    // replaceState doesn't fire hashchange; dispatch manually so the
    // useSyncExternalStore subscription clears `currentFocusId` and the FAB
    // / "Re-center here" path see the correct (null) focus state.
    window.dispatchEvent(new HashChangeEvent('hashchange'))
    chartRef.current?.updateTree({ initial: true })
  }, [])

  // 8b-2 — delegated pointer-hover wiring on the chart container.
  // Attached in a SEPARATE effect from the chart-init effect so we never
  // tear down + rebuild D3 on every hover (the chart-init deps array must
  // stay [people, shouldSuppressNextClickRef, readOnly] — see its eslint-
  // disable comment). This effect has empty deps: the containerRef.current
  // element is stable for the lifetime of this component mount, and we clean
  // up on unmount via the returned cleanup fn.
  useEffect(() => {
    if (readOnly) return
    const cont = containerRef.current
    if (!cont) return

    const onPointerOver = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null
      const node = target?.closest('.mtf-node') as HTMLElement | null
      if (!node) return
      if (node.dataset.duplicate === 'true') return  // 8b-3: echoes don't get the "+" hover
      const personId = node.dataset.personId
      if (!personId) return
      const wrapper = wrapperRef.current ?? cont
      setHoverState({ personId, position: rectToPosition(node, wrapper) })
    }

    const onPointerOut = (e: PointerEvent) => {
      const target = e.target as HTMLElement | null
      const node = target?.closest('.mtf-node') as HTMLElement | null
      if (!node) return
      if (node.dataset.duplicate === 'true') return  // 8b-3: defensive — echoes don't own hover state

      // Avoid flicker when the pointer transitions between children inside the
      // same .mtf-node. Only clear hover when the relatedTarget is outside
      // the current node entirely.
      const related = e.relatedTarget
      if (related instanceof Node && node.contains(related)) return

      setHoverState(null)
    }

    cont.addEventListener('pointerover', onPointerOver)
    cont.addEventListener('pointerout', onPointerOut)

    return () => {
      cont.removeEventListener('pointerover', onPointerOver)
      cont.removeEventListener('pointerout', onPointerOut)
    }
    // Intentionally empty deps — the container element is stable for this
    // component's lifetime; readOnly check is inside the effect body.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleRecenter = useCallback((personId: string) => {
    // Hash is the single source of truth — write it and let the
    // useSyncExternalStore subscription propagate. history.replaceState
    // avoids growing the back-stack with every re-center; if the hash is
    // already current we still need to force the update because no
    // hashchange event fires for a no-op assignment.
    const target = `#p=${encodeURIComponent(personId)}`
    if (window.location.hash === target) {
      const chart = chartRef.current
      if (chart && peopleByIdRef.current.has(personId)) {
        chart.updateMainId(personId)
        chart.updateTree()
      }
    } else {
      window.history.replaceState(null, '', target)
      // replaceState doesn't fire hashchange; dispatch manually so the
      // subscription updates `currentFocusId` and the React → chart
      // sync effect runs.
      window.dispatchEvent(new HashChangeEvent('hashchange'))
    }
  }, [])

  const detailPerson = detailPersonId ? peopleById.get(detailPersonId) ?? null : null
  const focusPerson = currentFocusId ? peopleById.get(currentFocusId) ?? null : null

  // Derive the hovered person row so we can pre-seed the hover-plus form.
  const hoverLinkPerson = hoverLinkPersonId
    ? (peopleById.get(hoverLinkPersonId) ?? null)
    : null

  return (
    <>
      {/*
        Outer wrapper: position:relative so TreeOverviewButton and
        PersonHoverPlus can use `absolute` positioning relative to the canvas
        area. The inner f3 div keeps overflow:hidden for family-chart's own
        pan/zoom chrome; the overlays sit on top, outside the clip region.
      */}
      <div ref={wrapperRef} className="relative">
        <div
          ref={containerRef}
          className="f3 w-full h-[calc(100vh-9rem)] rounded-lg border border-border bg-card overflow-hidden"
          style={{
            ['--background-color' as string]: 'var(--card)',
            ['--text-color' as string]: 'var(--foreground)',
          }}
        />
        {!readOnly && (
          <>
            <TreeOverviewButton onActivate={zoomToFit} />
            <PersonHoverPlus
              position={hoverState?.position ?? null}
              onActivate={() => {
                if (!hoverState) return
                setHoverLinkPersonId(hoverState.personId)
                setHoverFormOpen(true)
              }}
            />
          </>
        )}
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
          <AddRelativeFab treeId={treeId} focusPerson={focusPerson} />
          {/* 8b-2 — inline PersonForm for the hover-plus "+" click path.
              Separate from AddRelativeFab so we don't need to lift its internal
              state. Pre-seeds linkSpec as 'child' of the hovered person. */}
          <PersonForm
            mode="create"
            open={hoverFormOpen}
            onOpenChange={setHoverFormOpen}
            treeId={treeId}
            linkSpec={
              hoverLinkPerson
                ? {
                    focusPersonId: hoverLinkPerson.id,
                    focusPersonName: hoverLinkPerson.full_name,
                    defaultRelation: 'child',
                  }
                : undefined
            }
          />
        </>
      )}
    </>
  )
}

export const FamilyTree = memo(FamilyTreeImpl)
