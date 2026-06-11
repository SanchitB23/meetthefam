"use client";

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
} from "react";
import f3 from "family-chart";
import "family-chart/styles/family-chart.css";
import type { TreeDatum } from "family-chart";

import { type FamilyChartDatum } from "../_lib/family-chart-data";
import {
  SUPER_ROOT_ID,
  transformToFamilyChartShapeShowAll,
} from "../_lib/family-chart-data-show-all";
import { attachNonSpouseParentLinkRewriter } from "../_lib/non-spouse-parent-links";
import {
  getAllInstancesOf,
  panCameraTo,
  panCameraToDatum,
} from "../_lib/pan-camera-to";
import { attachSuperRootLinkSuppressor } from "../_lib/super-root-link-suppressor";
import { personNodeHtml } from "../_lib/person-node-html";
import { usePressActions } from "../_lib/usePressActions";
import type { PersonRow } from "../_lib/types";
import { AddRelativeFab } from "./AddRelativeFab";
import { ExportProgressDialog } from "./ExportProgressDialog";
import { PersonActionMenu, type ActionAnchor } from "./PersonActionMenu";
import { PersonDetailSheet } from "./PersonDetailSheet";
import { ZoomControls } from "./ZoomControls";
import {
  useExportTrigger,
  type CapturePreparation,
  type ExportPreflight,
} from "../_lib/useExportTrigger";
import { ExportDegradeDialog } from "./ExportDegradeDialog";
import {
  measureNativeExtent,
  planExportRaster,
} from "../_lib/export-raster-plan";
// PersonHoverPlus and PersonForm removed in 8b polish FIX 1:
// "+" is now an in-card button child of .mtf-node; form is owned by AddRelativeFab
// via CustomEvent('mtf-add-relative') dispatched from setOnCardClick.

type Props = {
  treeId: string;
  people: PersonRow[];
  /** SSR-derived focus from `?p=<id>` searchParams. May be overridden by `#p=<id>` on mount. */
  initialFocusId?: string | null;
  /**
   * Phase 7 sub-task 3 — typed-only stub so /share/[token]/page.tsx can pass
   * `readOnly` ahead of the actual chrome-lockdown behavior. Wired in
   * sub-task 4 (hides FAB, action menu, and the detail-sheet Edit button).
   */
  readOnly?: boolean;
};

type Chart = ReturnType<typeof f3.createChart>;

const HASH_PATTERN = /^#p=(.+)$/;

function readHashFocus(): string | null {
  if (typeof window === "undefined") return null;
  const match = window.location.hash.match(HASH_PATTERN);
  return match ? decodeURIComponent(match[1]) : null;
}

// `hashchange` is an external source; useSyncExternalStore is the React 19
// idiomatic path that avoids the `react-hooks/set-state-in-effect` lint
// rule. SSR snapshot returns null so the server's "no hash" view matches
// the first client paint, and we hydrate the real hash on the next tick.
function subscribeToHash(callback: () => void): () => void {
  window.addEventListener("hashchange", callback);
  return () => window.removeEventListener("hashchange", callback);
}
function getHashSnapshot(): string | null {
  return readHashFocus();
}
function getServerHashSnapshot(): string | null {
  return null;
}

function FamilyTreeImpl({
  treeId,
  people,
  initialFocusId,
  readOnly = false,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<Chart | null>(null);
  const [detailPersonId, setDetailPersonId] = useState<string | null>(null);
  const [actionAnchor, setActionAnchor] = useState<ActionAnchor | null>(null);

  // #181 — pending overlay state. Toggled by 'mtf-add-pending' CustomEvent
  // dispatched from PersonForm's useTransition hook (isPending → true when the
  // Server Action starts, → false once revalidatePath streams the new tree).
  const [addPending, setAddPending] = useState(false);
  useEffect(() => {
    const handler = (e: Event) => {
      const pending =
        (e as CustomEvent<{ pending: boolean }>).detail?.pending ?? false;
      setAddPending(pending);
    };
    window.addEventListener("mtf-add-pending", handler);
    return () => window.removeEventListener("mtf-add-pending", handler);
  }, []);

  const peopleById = useMemo(
    () => new Map(people.map((p) => [p.id, p])),
    [people],
  );
  const peopleByIdRef = useRef(peopleById);
  useEffect(() => {
    peopleByIdRef.current = peopleById;
  }, [peopleById]);

  // #69 — `main_id` is permanently pinned to `__super_root__` so the
  // progeny walk from there covers every person in the tree (option d'
  // pivot — see `_lib/pan-camera-to.ts` for rationale). The old
  // `fallbackMainIdRef` is no longer needed: the layout never re-roots,
  // so there is no "previous main_id" to restore on un-recenter.

  // #69 — per-person cursor for the ↑ duplicate-jump badge. When a user
  // taps the badge on a card, we cycle the camera to the next instance
  // of that person in the laid-out tree. The cursor persists across
  // taps so repeated taps walk through all instances (wraps at end).
  const duplicateNavCursorRef = useRef<Map<string, number>>(new Map());

  // Hash is the runtime source of truth for the focus id. Server + first
  // client paint see no hash (matches the SSR snapshot); subsequent paints
  // see the real value. If hash is absent, fall back to the SSR `?p=`
  // seed; if both are absent, the focus is null until "Re-center here"
  // sets it explicitly.
  const hashFocus = useSyncExternalStore(
    subscribeToHash,
    getHashSnapshot,
    getServerHashSnapshot,
  );
  const currentFocusId = hashFocus ?? initialFocusId ?? null;

  // #218 — native-scale export: temporarily resize the container to the tree's
  // native pixel extent so family-chart fits it at ≈1× scale, yielding a crisp
  // raster instead of a blurry fit-to-screen capture.
  //
  // Steps:
  //   1. Measure native extent via measureNativeExtent (SVG path bbox / zoom k).
  //      Falls back to a safe default if measurement fails.
  //   2. planExportRaster computes boxW×boxH and pixelRatio within browser caps.
  //   3. Resize the .f3 container to boxW×boxH (inline style, overrides Tailwind
  //      h-[calc(100vh-9rem)]). overflow is handled by withOverflowVisible in the
  //      trigger — we don't need to set it here.
  //   4. updateTree({ initial: true }) so family-chart fits into the big box.
  //   5. Return { pixelRatio, restore } — restore puts the inline size back and
  //      re-fits the chart to the viewport. Called in finally by useExportTrigger.
  const prepareForCapture = useCallback((): CapturePreparation => {
    const chart = chartRef.current;
    const cont = containerRef.current;

    // Save current inline dimensions (may be empty strings if Tailwind class is in charge).
    const prevWidth = cont?.style.width ?? "";
    const prevHeight = cont?.style.height ?? "";

    // Measure native extent.
    const nativeExtent = cont ? measureNativeExtent(cont) : null;
    const usedMeasurementFallback = nativeExtent === null;

    // Fall back to a reasonable large box if measurement fails so the chart at
    // least renders at a larger-than-viewport scale. 2400×1600 is a common
    // "full-screen" size that gives decent output with the default pixelRatio=3.
    const { nativeW, nativeH } = nativeExtent ?? {
      nativeW: 2400,
      nativeH: 1600,
    };

    const plan = planExportRaster({ nativeW, nativeH });

    // Resize the container.
    if (cont) {
      cont.style.width = `${plan.boxW}px`;
      cont.style.height = `${plan.boxH}px`;
    }

    // Fit the chart into the enlarged box.
    chart?.updateTree({ initial: true });

    const restore = () => {
      if (cont) {
        cont.style.width = prevWidth;
        cont.style.height = prevHeight;
      }
      // Re-fit into the normal viewport after restoring container size.
      chart?.updateTree({ initial: true });
    };

    return {
      pixelRatio: plan.pixelRatio,
      restore,
      degraded: usedMeasurementFallback,
      degradeReason: usedMeasurementFallback ? "measurement-failed" : undefined,
    };
  }, [containerRef]);

  // #225 preflight: measure + plan WITHOUT touching the DOM. Measurement
  // failure counts as degraded (spec §7 case 2) — a tree we can't measure
  // must not silently export into an undersized box.
  const [degradeOpen, setDegradeOpen] = useState(false);
  const degradeResolverRef = useRef<((ok: boolean) => void) | null>(null);

  const preflight = useCallback((): ExportPreflight => {
    const cont = containerRef.current;
    const nativeExtent = cont ? measureNativeExtent(cont) : null;
    if (!nativeExtent) return { degraded: true, reason: "measurement-failed" };
    const plan = planExportRaster(nativeExtent);
    if (process.env.NODE_ENV === "development") {
      // #225 §6 ceiling-validation instrumentation (dev-only by design).
      console.info("[export:preflight]", { ...nativeExtent, ...plan });
    }
    return {
      degraded: plan.degraded,
      reason: plan.degraded ? "oversize" : undefined,
    };
  }, [containerRef]);

  const confirmDegrade = useCallback(
    () =>
      new Promise<boolean>((resolve) => {
        degradeResolverRef.current = resolve;
        setDegradeOpen(true);
      }),
    [],
  );

  // Resolves the pending confirmDegrade promise EXACTLY once — the ref is
  // nulled after first use, so duplicate dialog callbacks (button click +
  // Escape/overlay onOpenChange) are harmless no-ops.
  const resolveDegrade = useCallback((ok: boolean) => {
    setDegradeOpen(false);
    degradeResolverRef.current?.(ok);
    degradeResolverRef.current = null;
  }, []);

  // #217 — export trigger seam. Listens for the top-bar Export button's
  // `mtf-export-tree` event, drives the progress dialog, and (#218) runs
  // the real capture. Gated behind readOnly so the share-page instance is inert.
  const {
    exporting,
    exportingBestEffort,
    cancel: cancelExport,
  } = useExportTrigger(containerRef, {
    readOnly,
    prepareForCapture,
    preflight,
    confirmDegrade,
  });

  const { shouldSuppressNextClickRef } = usePressActions(containerRef, {
    onLongPress: readOnly
      ? () => {
          /* no-op in read-only mode */
        }
      : (personId, e) => {
          const node = (e.target as HTMLElement | null)?.closest(
            ".mtf-node",
          ) as HTMLElement | null;
          const rect = node?.getBoundingClientRect();
          setActionAnchor({
            personId,
            x: rect ? rect.right - 4 : e.clientX,
            y: rect ? rect.top + 8 : e.clientY,
          });
        },
  });

  // Chart-bound effect — full teardown + rebuild when `people` changes.
  useEffect(() => {
    const cont = containerRef.current;
    if (!cont) return;

    // #69 — `transformToFamilyChartShapeShowAll` wraps the base transform
    // and grafts a synthetic __super_root__ parent onto every otherwise-
    // rootless person, so family-chart's single-root walk reaches every
    // subtree regardless of main_id. No-op when the tree has 0 or 1 roots.
    const data: FamilyChartDatum[] = transformToFamilyChartShapeShowAll(people);

    const chart = f3
      .createChart(cont, data)
      .setTransitionTime(800)
      .setCardXSpacing(220)
      .setCardYSpacing(130)
      .setOrientationVertical()
      .setAncestryDepth(20)
      .setProgenyDepth(20)
      .setSingleParentEmptyCard(false);

    // v0.0.5 hotfix — family-chart draws a single midpoint-anchored
    // ancestry link for every child, which produces a horizontal bar
    // joining both parents that looks identical to its dedicated "spouse"
    // link. For co-parents who aren't actually married this reads as a
    // marriage. We rewrite those specific links to two independent
    // stepped vertical paths after each update. A MutationObserver keeps
    // the override applied across d3's transition window. See
    // `../_lib/non-spouse-parent-links.ts` for full rationale.
    const linkRewriter = attachNonSpouseParentLinkRewriter(cont, peopleByIdRef);
    // #69 — zero ancestry links that target the invisible super-root
    // every time d3 tweens `d=` during re-center transitions. Without
    // this, the connector lines flash visibly for ~800ms before
    // setAfterUpdate's one-shot suppression catches up.
    const superRootLinkSuppressor = attachSuperRootLinkSuppressor(cont);

    // #187 — track which person IDs are currently rendered so we can
    // identify newly-added nodes after each update and apply the entry
    // animation class to them.
    const renderedPersonIds = new Set<string>();

    chart.setAfterUpdate(() => {
      linkRewriter.kick();
      superRootLinkSuppressor.kick();

      // #187 — new-node entry animation. After each update (which family-chart
      // fires once D3 finishes laying out / transitioning), scan the DOM for
      // .mtf-node cards. Any card whose data-person-id wasn't in the previous
      // render set is a newly-added node; apply .mtf-node--entering so the CSS
      // keyframe fades it in. Remove the class after 350 ms (300 ms animation
      // + 40 ms delay + 10 ms buffer) so repeated re-renders don't re-animate
      // the same card.
      const nodeEls = cont.querySelectorAll<HTMLElement>(
        ".mtf-node[data-person-id]",
      );
      const currentIds = new Set<string>();
      nodeEls.forEach((el) => {
        const pid = el.dataset.personId;
        if (!pid || pid === "__super_root__") return;
        currentIds.add(pid);
        if (!renderedPersonIds.has(pid)) {
          el.classList.add("mtf-node--entering");
          setTimeout(() => el.classList.remove("mtf-node--entering"), 350);
        }
      });
      // Replace the tracked set in-place (can't reassign a const).
      renderedPersonIds.clear();
      currentIds.forEach((id) => renderedPersonIds.add(id));
    });

    chart
      .setCardHtml()
      .setCardDim({ w: 158, h: 110 })
      .setCardInnerHtmlCreator((d) => {
        // #69 — the synthetic super-root has no real person row; render
        // a zero-size sentinel <div> so CSS can target the foreignObject
        // via :has() without disturbing the layout's reserved card slot.
        const datumId = (d.data as unknown as FamilyChartDatum).id;
        if (datumId === SUPER_ROOT_ID) {
          return '<div data-person-id="__super_root__" aria-hidden="true" style="width:0;height:0;overflow:hidden;"></div>';
        }
        return personNodeHtml(d, { readOnly });
      })
      .setOnCardClick((e: Event, d: TreeDatum) => {
        if (shouldSuppressNextClickRef.current) {
          shouldSuppressNextClickRef.current = false;
          return;
        }
        const id = d.data.id;
        if (!peopleByIdRef.current.has(id)) return;

        const target = (e.target as HTMLElement | null) ?? null;

        // #69 v1.1 — duplicate-jump ↑ badge. Tapping the badge cycles the
        // camera to the next instance of this person in the laid-out
        // tree. Fires BEFORE the action-trigger / "+" / detail-sheet
        // branches so the badge button takes priority. Read-only mode
        // still allows duplicate-jump (it's pure navigation; no edits).
        if (target?.closest("[data-duplicate-jump]")) {
          const chart = chartRef.current;
          if (chart) {
            const instances = getAllInstancesOf(chart, id);
            if (instances.length > 1) {
              const cursor = duplicateNavCursorRef.current.get(id) ?? 0;
              const nextIndex = (cursor + 1) % instances.length;
              duplicateNavCursorRef.current.set(id, nextIndex);
              panCameraToDatum(chart, cont, instances[nextIndex]);
            }
          }
          return;
        }

        // #69 v1.1 — action-trigger checks now run BEFORE the duplicate-tap
        // check below. Under option d', family-chart marks EVERY occurrence
        // of a duplicated id as `duplicate > 0` (setupTid at family-chart.js
        // line 897-913), so cross-subtree-married people (Catherine, James,
        // Beth, etc.) end up with every card dashed and would lose their
        // actions if we checked duplicate first. The 3-dot button and the
        // "+" button now render on duplicate cards as well — see
        // person-node-html.ts.
        if (!readOnly) {
          // 8b polish FIX 1 — in-card "+" button dispatches a CustomEvent that
          // AddRelativeFab picks up to open the add-relative form pre-seeded on
          // this specific person (not the currently-centred FAB person).
          if (target?.closest("[data-action-plus]")) {
            const plusEl = target.closest<HTMLElement>("[data-action-plus]");
            const personId2 = plusEl?.dataset.personId ?? id;
            window.dispatchEvent(
              new CustomEvent("mtf-add-relative", {
                detail: { personId: personId2 },
              }),
            );
            return;
          }

          const trigger = target?.closest(
            "[data-action-trigger]",
          ) as HTMLElement | null;
          if (trigger) {
            const rect = trigger.getBoundingClientRect();
            setActionAnchor({
              personId: id,
              x: rect.right,
              y: rect.bottom,
            });
            return;
          }
        }
        setDetailPersonId(id);
      });

    // #69 — pin `main_id` to the synthetic super-root so family-chart's
    // progeny walk reaches every real root → every subtree → every
    // person on the canvas. The hash-derived focus is honoured by
    // panning the camera (not by re-rooting the layout); see
    // `panCameraTo` and the `currentFocusId` sync effect below.
    chart.updateMainId(SUPER_ROOT_ID);
    chart.updateTree({ initial: true });
    chartRef.current = chart;

    // After the initial paint, if there's a hash / SSR-seeded focus,
    // pan the camera to that card. `updateTree({ initial: true })`
    // schedules a transition; we defer the pan to the next tick so it
    // composes cleanly with the auto-fit transition rather than
    // racing it.
    const seedFocus = readHashFocus() ?? initialFocusId ?? null;
    if (seedFocus && peopleByIdRef.current.has(seedFocus)) {
      setTimeout(() => {
        if (chartRef.current) panCameraTo(chartRef.current, cont, seedFocus);
      }, 0);
    }

    return () => {
      linkRewriter.dispose();
      superRootLinkSuppressor.dispose();
      chartRef.current = null;
      cont.innerHTML = "";
    };
    // initialFocusId is read once on first mount only; subsequent changes
    // come through the hash and the hashchange-driven `applyFocus`
    // effect, not through teardown + rebuild.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, shouldSuppressNextClickRef, readOnly]);

  // #69 — React → camera sync. The hash-derived `currentFocusId` no
  // longer drives `main_id` (that's pinned to super-root for life of
  // the chart). Instead we pan the d3-zoom camera to the focused
  // person's card without changing the layout root, so every person
  // stays on canvas across re-centres.
  //
  // Un-recenter path (#62 retained): when `currentFocusId` becomes
  // null (hash cleared by zoom-to-fit, address-bar, or browser back),
  // we just re-fit the whole tree via `updateTree({ initial: true })`
  // — same as the dedicated zoom-to-fit button below.
  const initialMountRef = useRef(true);
  useEffect(() => {
    if (initialMountRef.current) {
      initialMountRef.current = false;
      return;
    }
    const chart = chartRef.current;
    const cont = containerRef.current;
    if (!chart || !cont) return;

    if (currentFocusId == null) {
      // Un-recenter — re-fit the whole tree.
      chart.updateTree({ initial: true });
      return;
    }

    if (!peopleByIdRef.current.has(currentFocusId)) return;
    // Pan the camera; main_id stays pinned to super-root.
    panCameraTo(chart, cont, currentFocusId);
  }, [currentFocusId]);

  // 8b-2 — zoom-to-fit the whole tree. Clears the URL hash (so the canvas
  // isn't still anchored to a specific person), then calls updateTree with
  // initial=true which triggers family-chart's bounding-box auto-fit (the
  // same path the chart takes on first paint). main-id is left as-is — the
  // current focus person becomes the layout root, but all nodes are visible.
  const zoomToFit = useCallback(() => {
    // Use window.location.hash (not replaceState) so the native hashchange
    // fires, useSyncExternalStore clears currentFocusId, and browser back
    // can undo the zoom-to-fit.
    window.location.hash = "";
    chartRef.current?.updateTree({ initial: true });
  }, []);

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
    const cont = containerRef.current;
    if (!cont) return;
    const svg = cont.querySelector<SVGSVGElement>("svg.main_svg");
    if (!svg) return;

    // d3-zoom listener — family-chart attaches it to either svg or parent.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const el = ((svg as any).__zoomObj ? svg : svg.parentNode) as
      | HTMLElement
      | SVGElement
      | null;
    if (!el) return;

    const deltaY = -Math.log2(factor) / 0.002;
    const rect = svg.getBoundingClientRect();
    const evt = new WheelEvent("wheel", {
      deltaY,
      deltaMode: 0,
      clientX: rect.left + rect.width / 2,
      clientY: rect.top + rect.height / 2,
      bubbles: true,
      cancelable: true,
    });
    el.dispatchEvent(evt);
  }, []);

  const zoomIn = useCallback(() => applyZoomDelta(1.2), [applyZoomDelta]);
  const zoomOut = useCallback(() => applyZoomDelta(1 / 1.2), [applyZoomDelta]);

  const handleRecenter = useCallback((personId: string) => {
    // Hash is the single source of truth — write it via window.location.hash
    // so the native hashchange fires and browser back can undo the re-center
    // (#62). If the hash is already current, force the camera pan directly
    // since no hashchange fires for a no-op assignment.
    //
    // #69 — "re-center" no longer re-roots the layout (main_id stays at
    // super-root). It pans the d3-zoom camera so the clicked person's
    // card sits at the viewport centre. Every other person stays on
    // canvas at their existing position.
    const target = `#p=${encodeURIComponent(personId)}`;
    if (window.location.hash === target) {
      const chart = chartRef.current;
      const cont = containerRef.current;
      if (chart && cont && peopleByIdRef.current.has(personId)) {
        panCameraTo(chart, cont, personId);
      }
    } else {
      window.location.hash = target;
    }
  }, []);

  const detailPerson = detailPersonId
    ? (peopleById.get(detailPersonId) ?? null)
    : null;
  const focusPerson = currentFocusId
    ? (peopleById.get(currentFocusId) ?? null)
    : null;

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
            ["--background-color" as string]: "var(--canvas)",
            ["--text-color" as string]: "var(--foreground)",
            backgroundImage:
              "radial-gradient(circle, var(--border) 1px, transparent 1px)",
            backgroundSize: "24px 24px",
          }}
        />
        {/*
         * #181 — pending overlay. Shown while the add-person Server Action is
         * in-flight. A translucent layer over the canvas signals "something is
         * happening" without hiding the tree. The mtf-tree-pending-overlay CSS
         * class fades it in over 50 ms. Dismissed automatically when isPending
         * flips back to false (revalidatePath has streamed the new node).
         */}
        {addPending && !readOnly && (
          <div
            aria-busy="true"
            aria-label="Saving person…"
            className="mtf-tree-pending-overlay pointer-events-none absolute inset-0 rounded-lg bg-background/40 flex items-center justify-center"
          >
            <div className="flex items-center gap-2 rounded-full bg-background/90 border border-border px-4 py-2 text-sm text-foreground shadow-md">
              <svg
                className="animate-spin h-4 w-4 text-primary shrink-0"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              <span>Saving…</span>
            </div>
          </div>
        )}
        <ZoomControls onZoomIn={zoomIn} onZoomOut={zoomOut} onFit={zoomToFit} />
      </div>
      {!readOnly && (
        <ExportProgressDialog
          open={exporting}
          bestEffort={exportingBestEffort}
          onCancel={cancelExport}
        />
      )}
      {!readOnly && (
        <ExportDegradeDialog
          open={degradeOpen}
          onContinue={() => resolveDegrade(true)}
          onCancel={() => resolveDegrade(false)}
        />
      )}
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
  );
}

export const FamilyTree = memo(FamilyTreeImpl);
