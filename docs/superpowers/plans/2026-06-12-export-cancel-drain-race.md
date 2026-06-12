# Export Cancel Drain-Race Fix Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After Cancel, the export run keeps the single-run lock until its `finally` executes, so a new export can never overlap a draining (cancelled) run's raster or container restore.

**Architecture:** Approach A from the approved spec ([2026-06-12-export-cancel-drain-race-design.md](../specs/2026-06-12-export-cancel-drain-race-design.md)): `cancel()` only flips the abort signal and closes the progress dialog; the run's `finally` becomes the single point that restores the container, releases `activeRunRef`, and emits `pending: false`. The existing accept-guard (`if (activeRunRef.current) return`) then correctly drops export events during the drain.

**Tech Stack:** React hook (`useExportTrigger`), Vitest + @testing-library/react `renderHook` (jsdom), `captureTree` mocked.

**Branch / worktree:** `feat/60-tree-export` checked out at `/Users/sqb6461/Workspace/SelfProjects/mtf-wt-pr229`. All commands below run from that directory.

---

### Task 1: Update cancel tests to the drain-lock contract (red)

**Files:**
- Modify: `src/__tests__/lib/useExportTrigger.test.ts:226-266` (rewrite one test)
- Modify: `src/__tests__/lib/useExportTrigger.test.ts` (add one new test after line 290, i.e. after the `'cancel during the settle delay…'` test)

Note: the `'cancel during the settle delay aborts the run and still restores preparation'` test (lines 268-290) needs **no changes** — its observable `pending` sequence is `[true, false]` under both old and new behavior (the `false` just moves from `cancel()` to `finally`, which runs immediately after the aborted settle delay).

- [ ] **Step 1: Rewrite the `'cancel resets pending…'` test**

Replace the whole test at lines 226-266 with:

```ts
  it('cancel closes the dialog immediately but holds pending until the raster drains', async () => {
    // Make captureTree record the signal object it receives and stay open
    // until we resolve it manually (simulates the un-abortable raster).
    const receivedSignals: Array<{ aborted: boolean } | undefined> = []
    let resolveCapture!: () => void
    captureTreeMock.mockImplementation(async (_el, _fmt, _name, signal) => {
      receivedSignals.push(signal as { aborted: boolean } | undefined)
      await new Promise<void>((resolve) => {
        resolveCapture = resolve
      })
    })

    const { ref } = makeContainer()
    const pending: boolean[] = []
    const off = onExportPending((d: ExportPendingDetail) => pending.push(d.pending))

    const { result, unmount } = renderHook(() =>
      useExportTrigger(ref, { readOnly: false }),
    )

    dispatchExportTree({ format: 'png', treeName: 'Smith Family' })

    // Wait for captureTree to be invoked (export is in progress).
    await waitFor(() => expect(captureTreeMock).toHaveBeenCalled())

    // Cancel while capture is running.
    result.current.cancel()

    // The signal object shared with captureTree should now report aborted,
    // and the progress dialog closes immediately…
    await waitFor(() => {
      const sig = receivedSignals[0]
      expect(sig?.aborted).toBe(true)
    })
    await waitFor(() => expect(result.current.exporting).toBe(false))

    // …but the run still holds the lock: pending stays true (button disabled)
    // until the in-flight raster drains.
    expect(pending).toEqual([true])

    // Drain the raster — NOW the run's finally releases pending.
    resolveCapture()
    await waitFor(() => expect(pending[pending.length - 1]).toBe(false))

    unmount()
    off()
  })
```

- [ ] **Step 2: Add the overlap regression test**

Insert directly after the `'cancel during the settle delay…'` test (after its closing `})` at line 290):

```ts
  it('drops an export dispatched after cancel while the cancelled raster is still draining', async () => {
    // Regression for the #229-review race: cancel() used to release the
    // single-run lock immediately, letting a new run start while the old
    // raster was still draining — the old run's restore() then stomped the
    // new run's enlarged container mid-capture.
    let resolveCapture!: () => void
    captureTreeMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCapture = resolve
        }),
    )
    const restore = vi.fn()
    const prepareForCapture = vi.fn(() => ({ pixelRatio: 3, restore }))
    const { ref } = makeContainer()
    const pending: boolean[] = []
    const off = onExportPending((d: ExportPendingDetail) => pending.push(d.pending))
    const { result, unmount } = renderHook(() =>
      useExportTrigger(ref, { readOnly: false, prepareForCapture }),
    )

    // Run A: start and reach the (held-open) capture.
    dispatchExportTree({ format: 'png', treeName: 'First' })
    await waitFor(() => expect(captureTreeMock).toHaveBeenCalledTimes(1))

    // Cancel A, then immediately try to start run B while A is draining.
    result.current.cancel()
    dispatchExportTree({ format: 'png', treeName: 'Second' })
    await new Promise((r) => setTimeout(r, 20))

    // B must be dropped: no second capture, no second preparation.
    expect(captureTreeMock).toHaveBeenCalledTimes(1)
    expect(prepareForCapture).toHaveBeenCalledTimes(1)
    expect(restore).not.toHaveBeenCalled() // A still draining — not restored yet

    // Drain A: its finally restores exactly once and releases the lock.
    resolveCapture()
    await waitFor(() => expect(restore).toHaveBeenCalledTimes(1))
    await waitFor(() => expect(pending[pending.length - 1]).toBe(false))

    // Lock released — a third export is accepted again.
    dispatchExportTree({ format: 'png', treeName: 'Third' })
    await waitFor(() => expect(captureTreeMock).toHaveBeenCalledTimes(2))

    resolveCapture()
    unmount()
    off()
  })
```

- [ ] **Step 3: Run the two tests to verify they fail against current behavior**

Run:

```bash
cd /Users/sqb6461/Workspace/SelfProjects/mtf-wt-pr229 && pnpm vitest run src/__tests__/lib/useExportTrigger.test.ts -t 'cancel closes the dialog|drops an export dispatched after cancel'
```

Expected: **both FAIL** —
- `'cancel closes the dialog…'` fails at `expect(pending).toEqual([true])` (current `cancel()` emits `false` immediately, so pending is `[true, false]`).
- `'drops an export dispatched after cancel…'` fails at `expect(captureTreeMock).toHaveBeenCalledTimes(1)` (current `cancel()` clears `activeRunRef`, so run B is accepted and capture is called twice).

Do NOT commit yet — red state.

---

### Task 2: Hold the lock in `cancel()`; `finally` is the single release point (green)

**Files:**
- Modify: `src/app/(app)/tree/[id]/_lib/useExportTrigger.ts:17-19` (header comment), `:99-130` (ActiveRun comment + `cancel`), `:206-218` (`finally` comment)

- [ ] **Step 1: Update the header comment**

At lines 17-19, replace:

```ts
//   - Cancel support: `cancel()` aborts the pending download (the raster may
//     still run in the background, but the result is silently discarded).
//   - `restore()` is ALWAYS called in `finally` (also on cancel + error).
```

with:

```ts
//   - Cancel support: `cancel()` aborts the pending download (the raster may
//     still run in the background, but the result is silently discarded).
//     The run KEEPS the single-run lock until its raster drains — cancel
//     discards the result, it does not end the run (#229 review).
//   - `restore()` is ALWAYS called in `finally` (also on cancel + error).
```

- [ ] **Step 2: Rewrite `cancel()` to keep the lock**

The current code (around lines 105-130; the `activeRunRef` declaration comment plus `cancel`):

```ts
  // activeRunRef holds the accepted run's id + CaptureSignal. cancel() flips
  // the signal and clears the ref; the run's `finally` only resets UI when it
  // still owns the ref, so an older async branch can never close a newer run.
  const activeRunRef = useRef<ActiveRun | null>(null)
  const nextRunIdRef = useRef(0)

  // Stable cancel callback: flip the current signal and reset UI immediately.
  // The in-flight raster may still produce a blob, but captureTree checks the
  // flag before calling triggerDownload, so no download fires.
  const cancel = useCallback(() => {
    const active = activeRunRef.current
    if (!active) return
    active.signal.aborted = true
    activeRunRef.current = null
    setStatus({ phase: 'idle' })
    emitExportPending({ pending: false })
  }, [])
```

becomes:

```ts
  // activeRunRef holds the accepted run's id + CaptureSignal. The lock is
  // held from acceptance until the run's `finally` — INCLUDING after cancel
  // (#229 review): the raster can't be aborted and the pending restore()
  // belongs to this run, so releasing early would let a new run's container
  // mutations interleave with this one's. `finally` is the single point that
  // clears the ref, restores the container, and resets pending.
  const activeRunRef = useRef<ActiveRun | null>(null)
  const nextRunIdRef = useRef(0)

  // Stable cancel callback: flip the current signal and close the progress
  // dialog. The in-flight raster may still produce a blob, but captureTree
  // checks the flag before calling triggerDownload, so no download fires.
  // Pending stays true (header button disabled) until the raster drains and
  // the run's `finally` releases the lock.
  const cancel = useCallback(() => {
    const active = activeRunRef.current
    if (!active) return
    active.signal.aborted = true
    setStatus({ phase: 'idle' })
  }, [])
```

(The two removed lines are `activeRunRef.current = null` and `emitExportPending({ pending: false })`.)

- [ ] **Step 3: Update the `finally` comment**

The current code (around lines 206-218):

```ts
      } finally {
        // Always restore the container, even on cancel or error.
        if (preparation) {
          preparation.restore()
        }
        // Only the active run may clear UI. If cancel() already cleared the
        // run, this older async branch must not emit another pending reset.
        if (activeRunRef.current?.runId === runId) {
          activeRunRef.current = null
          emitExportPending({ pending: false })
          setStatus({ phase: 'idle' })
        }
      }
```

becomes (code identical, comment rewritten):

```ts
      } finally {
        // Always restore the container, even on cancel or error.
        if (preparation) {
          preparation.restore()
        }
        // Single release point for the run lock (#229 review): cancel() does
        // NOT clear activeRunRef, so this branch is reached with ownership on
        // every exit path — success, error, cancel drain, degrade-decline.
        // The runId check stays as a defensive guard only.
        if (activeRunRef.current?.runId === runId) {
          activeRunRef.current = null
          emitExportPending({ pending: false })
          setStatus({ phase: 'idle' })
        }
      }
```

- [ ] **Step 4: Run the two tests to verify they pass**

Run:

```bash
cd /Users/sqb6461/Workspace/SelfProjects/mtf-wt-pr229 && pnpm vitest run src/__tests__/lib/useExportTrigger.test.ts
```

Expected: **all tests in the file PASS** (including the untouched cancel-during-settle, degrade-gate, and double-dispatch tests).

- [ ] **Step 5: Run the full gate**

Run:

```bash
cd /Users/sqb6461/Workspace/SelfProjects/mtf-wt-pr229 && pnpm test && pnpm typecheck && pnpm lint
```

Expected: vitest suite green; typecheck exit 0 (requires the `.next/dev/types` symlink already present in this worktree); lint reports only the pre-existing `PersonForm.tsx` `react-hooks/incompatible-library` warning, 0 errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/sqb6461/Workspace/SelfProjects/mtf-wt-pr229 && git add 'src/app/(app)/tree/[id]/_lib/useExportTrigger.ts' src/__tests__/lib/useExportTrigger.test.ts && git commit -m "fix(#60): hold export run lock until cancelled raster drains

cancel() now only aborts the signal and closes the dialog; the run's
finally is the single point that restores the container, releases
activeRunRef, and resets pending. Closes the #229-review race where a
new export accepted during the drain got its container stomped by the
old run's restore().

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: Push and tick the PR #229 blocker

- [ ] **Step 1: Push**

```bash
cd /Users/sqb6461/Workspace/SelfProjects/mtf-wt-pr229 && git push origin feat/60-tree-export
```

- [ ] **Step 2: Tick the blocker checkbox in the PR body**

Fetch the current body, flip the line, push it back (replace `<sha>` with the commit from Task 2):

```bash
gh pr view 229 --json body --jq .body > /tmp/pr229-body.md
python3 - <<'EOF'
body = open('/tmp/pr229-body.md').read()
old = "- [ ] **Cancel/restore race**"
new = "- [x] **Cancel/restore race** — fixed in <sha>"
assert old in body
open('/tmp/pr229-body.md','w').write(body.replace(old, new, 1))
EOF
gh pr edit 229 --body-file /tmp/pr229-body.md
```

Expected: PR #229 "Remaining blockers" shows only the iOS Safari canvas-cap item unticked.

- [ ] **Step 3: Confirm CI green**

```bash
until s=$(gh pr checks 229 2>/dev/null) && ! grep -q pending <<<"$s"; do sleep 30; done; gh pr checks 229
```

Expected: `gate`, `vitest`, `claude-review`, `Vercel` all `pass`.
