# Export run-state review fixes — design

> **PR:** [#235](https://github.com/SanchitB23/meetthefam/pull/235) — `fix: serialize tree export runs` (branch `fix/60-export-run-state` → `feat/60-tree-export`)
> **Epic:** [#60](https://github.com/SanchitB23/meetthefam/issues/60) — **Milestone:** v1.2 — Export & archival
> **Date:** 2026-06-12
> **Follows:** code review of PR #235, which found 2 behavioral issues + 1 churn issue.

## 1. Goal

Fix the three review findings on PR #235 without weakening the run-serialization it introduced:

1. **Stacked modals** — `ExportProgressDialog` opens during the `confirming` phase, stacking behind/over `ExportDegradeDialog`.
2. **Orphanable degrade resolver** — a `cancel()` (or any future caller) during `confirming` can leave `degradeOpen` stale and a resolver promise permanently unresolved.
3. **Format churn** — all touched files were converted to double-quotes + semicolons (Cursor prettier defaults), bloating the diff ~3× and polluting `git blame` on `FamilyTree.tsx`.

All fixes land as new commits on `fix/60-export-run-state` so PR #235 merges in one review cycle. A summary comment goes on the PR describing findings + fixes.

## 2. Fix 1 — progress dialog gating (`useExportTrigger.ts`)

Narrow the `exporting` derivation so the progress dialog only shows during actual work:

```ts
const exporting = status.phase === 'preparing' || status.phase === 'capturing'
```

(currently `status.phase !== 'idle'`, which includes `confirming`).

- The export **button** stays disabled for the whole run, including confirmation — that's driven by `emitExportPending({ pending: true })` at run acceptance, which is unchanged. This preserves the PR's core guarantee (no duplicate runs, resolver can't be overwritten via the button).
- During `confirming`, the degrade dialog is the only thing on screen — restoring the pre-PR UX contract ("the warn dialog is the only thing on screen").
- No API change for `FamilyTree`; no new state exposed (YAGNI — nothing needs the raw phase).

## 3. Fix 2 — defensive resolver swap (`FamilyTree.tsx`)

In `confirmDegrade`, settle any prior resolver before storing a new one:

```ts
const confirmDegrade = useCallback(
  () =>
    new Promise<boolean>((resolve) => {
      // Defensively settle an orphaned prior confirm (e.g. a run cancelled
      // while its dialog was open) so no promise can leak.
      degradeResolverRef.current?.(false)
      degradeResolverRef.current = resolve
      setDegradeOpen(true)
    }),
  [],
)
```

- With Fix 1, the orphan path is unreachable through the UI (Cancel isn't visible during `confirming`); this guards the programmatic path (`cancel()` is public) and future regressions.
- Resolving the orphaned promise with `false` is safe: the old run's `await confirmDegrade()` resumes, hits its `signal.aborted` / `!proceed` guards, and exits through `finally` — which is a no-op for UI because the runId no longer matches.
- Kept inline (no new `confirm-gate` abstraction) — 2 lines of defense don't justify a new module.

## 4. Fix 3 — revert format-only churn (all 5 code files)

Restore the repo's hand-written style (single quotes, no semicolons) in:

- `src/app/(app)/tree/[id]/_components/FamilyTree.tsx`
- `src/app/(app)/tree/[id]/_components/ExportProgressDialog.tsx`
- `src/app/(app)/tree/[id]/_lib/useExportTrigger.ts`
- `src/__tests__/lib/useExportTrigger.test.ts`
- `src/__tests__/components/ExportProgressDialog.test.tsx`

**Method:** start from the base versions (`git show $(git merge-base feat/60-tree-export fix/60-export-run-state):<file>`), re-apply only the substantive changes in original style. New test cases are rewritten in repo style. The design doc added by the PR is markdown — untouched by this fix except for §6 content updates (below).

**Acceptance:** `git diff feat/60-tree-export...fix/60-export-run-state` contains no hunks that only change quotes/semicolons/line-wrapping; tests + typecheck + lint pass identically.

No prettier config is added — explicitly out of scope (can be its own `style:` PR later if wanted).

## 5. Cleanup — drop dead degrade-reason plumbing

Remove unconsumed fields introduced by the PR:

- `DegradeReason` type and `ExportPreflight.reason` (`useExportTrigger.ts`)
- `CapturePreparation.degradeReason` (`useExportTrigger.ts`)
- the `reason: ...` / `degradeReason: ...` assignments in `FamilyTree.tsx`'s `preflight` / `prepareForCapture`

Only the `degraded` booleans are consumed (gate + best-effort copy). Reason-specific dialog copy can reintroduce these *with* a consumer if ever wanted.

## 6. Spec-doc amendment (in-PR)

Update `docs/superpowers/specs/2026-06-12-export-run-state-fixes-design.md` (added by PR #235) to match shipped behavior:

- §4: `confirming` does **not** open the progress dialog; only the pending event covers confirmation. Remove `error?: string` from the `ExportStatus` sketch (toast is the error surface).
- §5: remove `DegradeReason` / `reason` / `degradeReason` from the type sketches (booleans only).
- §4: note the defensive resolver swap in `confirmDegrade`.

## 7. Tests

Adjust/add in `src/__tests__/lib/useExportTrigger.test.ts`:

- **New:** during `confirming` (a pending `confirmDegrade`), `result.current.exporting === false` — the progress dialog is closed while the degrade dialog is up; flips to `true` after confirmation resolves.
- **Existing suite:** all current tests must pass unchanged in behavior (pending `[true, false]` on decline, resolver-keep on duplicate dispatch, cancel/restore, best-effort fallback, failure toast, PNG gate parity). Tests touching the removed `reason` fields are updated to drop them.

No dedicated test for Fix 2 (the swap is defense-in-depth; hook-level dedup tests already cover the reachable paths).

## 8. PR comment

After fixes are pushed, post one summary comment on PR #235 (new top-level comment, not an edit of anything):

- the three findings (stacked modals, orphanable resolver, format churn), one line each
- the fix for each, with the fixing commit SHA
- note of the dead-plumbing cleanup + spec-doc amendment

## 9. Verification

- `pnpm vitest run src/__tests__/lib/useExportTrigger.test.ts src/__tests__/components/ExportProgressDialog.test.tsx` (plus the other export suites from the PR's test plan)
- `pnpm typecheck` and `pnpm lint`
- `git diff feat/60-tree-export...fix/60-export-run-state --stat` — diff shrinks to roughly a third (~500 lines)
- Manual: with a degraded tree (or `isMobileLike` forced), trigger export → only the degrade dialog is visible; Continue → progress dialog appears; Cancel on progress dialog → silent idle.

## 10. Success criteria

- During degrade confirmation, exactly one dialog is on screen; the export button remains disabled for the entire run.
- No code path can leave an unresolved `confirmDegrade` promise.
- The PR diff contains only substantive changes in the repo's existing style.
- All export test suites, typecheck, and lint pass.
- PR #235 carries a review-summary comment mapping findings → fixing commits.
