// src/__tests__/lib/useExportTrigger.test.ts
/** @vitest-environment jsdom */
import { renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RefObject } from "react";
import {
  dispatchExportTree,
  onExportPending,
  type ExportPendingDetail,
} from "@/app/(app)/tree/[id]/_lib/export-events";
import { useExportTrigger } from "@/app/(app)/tree/[id]/_lib/useExportTrigger";
import { captureTree } from "@/app/(app)/tree/[id]/_lib/capture-tree";
import { isMobileLike } from "@/app/(app)/tree/[id]/_lib/isMobileLike";

const { toastError } = vi.hoisted(() => ({
  toastError: vi.fn(),
}));
vi.mock("sonner", () => ({
  toast: { error: toastError },
}));

// Stub the real rasteriser — jsdom has no canvas; we only assert orchestration.
vi.mock("@/app/(app)/tree/[id]/_lib/capture-tree", () => ({
  captureTree: vi.fn(async () => undefined),
}));
const captureTreeMock = vi.mocked(captureTree);

vi.mock("@/app/(app)/tree/[id]/_lib/isMobileLike", () => ({
  isMobileLike: vi.fn(() => false),
}));
const isMobileLikeMock = vi.mocked(isMobileLike);

function makeContainer(): {
  el: HTMLDivElement;
  ref: RefObject<HTMLElement | null>;
} {
  const el = document.createElement("div");
  el.style.overflow = "hidden";
  return { el, ref: { current: el } };
}

beforeEach(() => {
  captureTreeMock.mockReset();
  captureTreeMock.mockResolvedValue(undefined);
  isMobileLikeMock.mockReturnValue(false);
  toastError.mockClear();
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useExportTrigger", () => {
  it("round-trips pending true→false and restores overflow on export", async () => {
    const { el, ref } = makeContainer();
    const pending: boolean[] = [];
    const off = onExportPending((d: ExportPendingDetail) =>
      pending.push(d.pending),
    );

    const { unmount } = renderHook(() =>
      useExportTrigger(ref, { readOnly: false }),
    );
    dispatchExportTree({ format: "png", treeName: "Smith Family" });

    await waitFor(() => expect(pending).toContain(false));
    expect(pending[0]).toBe(true);
    expect(pending[pending.length - 1]).toBe(false);
    expect(el.style.overflow).toBe("hidden"); // restored after capture
    unmount();
    off();
  });

  it("passes the format + treeName from the event through to captureTree", async () => {
    const { el, ref } = makeContainer();
    const { unmount } = renderHook(() =>
      useExportTrigger(ref, { readOnly: false }),
    );
    dispatchExportTree({ format: "png", treeName: "Smith Family" });

    await waitFor(() => expect(captureTreeMock).toHaveBeenCalled());
    // Fifth arg is pixelRatio (defaults to 3 when no prepareForCapture).
    expect(captureTreeMock).toHaveBeenCalledWith(
      el,
      "png",
      "Smith Family",
      expect.anything(),
      3,
    );
    unmount();
  });

  it("ignores a second export event while a run is active", async () => {
    let resolveCapture!: () => void;
    captureTreeMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCapture = resolve;
        }),
    );
    const { ref } = makeContainer();
    const pending: boolean[] = [];
    const off = onExportPending((d: ExportPendingDetail) =>
      pending.push(d.pending),
    );
    const { unmount } = renderHook(() =>
      useExportTrigger(ref, { readOnly: false }),
    );

    dispatchExportTree({ format: "png", treeName: "First" });
    dispatchExportTree({ format: "pdf", treeName: "Second" });

    await waitFor(() => expect(captureTreeMock).toHaveBeenCalledTimes(1));
    expect(captureTreeMock).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      "png",
      "First",
      expect.anything(),
      3,
    );
    resolveCapture();
    await waitFor(() => expect(pending).toEqual([true, false]));

    unmount();
    off();
  });

  it("ignores the event when readOnly (share page)", async () => {
    const { ref } = makeContainer();
    const pending: boolean[] = [];
    const off = onExportPending((d: ExportPendingDetail) =>
      pending.push(d.pending),
    );

    const { unmount } = renderHook(() =>
      useExportTrigger(ref, { readOnly: true }),
    );
    dispatchExportTree({ format: "png", treeName: "Smith Family" });

    // Give any (incorrect) async handler a chance to run.
    await new Promise((r) => setTimeout(r, 20));
    expect(pending).toEqual([]);
    unmount();
    off();
  });

  it("calls fitFn before captureTree", async () => {
    // Verify call order: fitFn is invoked, then captureTree follows.
    const callOrder: string[] = [];
    const fitFn = vi.fn(() => {
      callOrder.push("fit");
    });

    // Make captureTree record its invocation order.
    captureTreeMock.mockImplementation(async () => {
      callOrder.push("capture");
    });

    const { ref } = makeContainer();
    const { unmount } = renderHook(() =>
      useExportTrigger(ref, { readOnly: false, fitFn }),
    );

    dispatchExportTree({ format: "png", treeName: "Test" });

    // Wait for the full export cycle to complete (fitFn → delay → captureTree).
    await waitFor(() => expect(callOrder).toContain("capture"), {
      timeout: 2000,
    });
    // fitFn must have been called BEFORE captureTree.
    expect(callOrder.indexOf("fit")).toBeLessThan(callOrder.indexOf("capture"));

    unmount();
  });

  it("prepareForCapture is called before captureTree and restore() is called in finally", async () => {
    const callOrder: string[] = [];
    const restore = vi.fn(() => {
      callOrder.push("restore");
    });
    const prepareForCapture = vi.fn(() => {
      callOrder.push("prepare");
      return { pixelRatio: 2.5, restore };
    });
    captureTreeMock.mockImplementation(async () => {
      callOrder.push("capture");
    });

    const { ref } = makeContainer();
    const { unmount } = renderHook(() =>
      useExportTrigger(ref, { readOnly: false, prepareForCapture }),
    );

    dispatchExportTree({ format: "png", treeName: "NativeScale" });
    await waitFor(() => expect(callOrder).toContain("restore"), {
      timeout: 2000,
    });

    // Order must be: prepare → capture → restore
    expect(callOrder.indexOf("prepare")).toBeLessThan(
      callOrder.indexOf("capture"),
    );
    expect(callOrder.indexOf("capture")).toBeLessThan(
      callOrder.indexOf("restore"),
    );
    unmount();
  });

  it("prepareForCapture pixelRatio is forwarded to captureTree", async () => {
    const restore = vi.fn();
    const prepareForCapture = vi.fn(() => ({ pixelRatio: 1.72, restore }));

    const { el, ref } = makeContainer();
    const { unmount } = renderHook(() =>
      useExportTrigger(ref, { readOnly: false, prepareForCapture }),
    );

    dispatchExportTree({ format: "png", treeName: "NativeScale" });
    await waitFor(() => expect(captureTreeMock).toHaveBeenCalled(), {
      timeout: 2000,
    });

    // Fifth arg is the pixelRatio from prepareForCapture
    expect(captureTreeMock).toHaveBeenCalledWith(
      el,
      "png",
      "NativeScale",
      expect.anything(),
      1.72,
    );
    await waitFor(() => expect(restore).toHaveBeenCalled());
    unmount();
  });

  it("restore() is called even when captureTree throws", async () => {
    const restore = vi.fn();
    const prepareForCapture = vi.fn(() => ({ pixelRatio: 3, restore }));
    captureTreeMock.mockRejectedValueOnce(new Error("raster failed"));

    const { ref } = makeContainer();
    const { unmount } = renderHook(() =>
      useExportTrigger(ref, { readOnly: false, prepareForCapture }),
    );

    dispatchExportTree({ format: "png", treeName: "ErrorCase" });
    await waitFor(() => expect(restore).toHaveBeenCalled(), { timeout: 2000 });

    unmount();
  });

  it("shows a toast and resets pending when captureTree throws", async () => {
    const restore = vi.fn();
    const prepareForCapture = vi.fn(() => ({ pixelRatio: 3, restore }));
    captureTreeMock.mockRejectedValueOnce(new Error("raster failed"));
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const pending: boolean[] = [];
    const off = onExportPending((d: ExportPendingDetail) =>
      pending.push(d.pending),
    );

    const { ref } = makeContainer();
    const { unmount } = renderHook(() =>
      useExportTrigger(ref, { readOnly: false, prepareForCapture }),
    );

    dispatchExportTree({ format: "png", treeName: "ErrorCase" });

    await waitFor(() => expect(restore).toHaveBeenCalled(), { timeout: 2000 });
    expect(consoleSpy).toHaveBeenCalledWith(
      "[export] Tree capture failed:",
      expect.any(Error),
    );
    expect(toastError).toHaveBeenCalledWith(
      "Export failed. Please try again, or use a desktop browser for large trees.",
    );
    expect(pending[pending.length - 1]).toBe(false);

    unmount();
    off();
  });

  it("cancel resets pending and exporting; signal passed to captureTree reflects aborted state", async () => {
    // Make captureTree record the signal object it receives.
    const receivedSignals: Array<{ aborted: boolean } | undefined> = [];
    let resolveCapture!: () => void;
    captureTreeMock.mockImplementation(async (_el, _fmt, _name, signal) => {
      receivedSignals.push(signal as { aborted: boolean } | undefined);
      await new Promise<void>((resolve) => {
        resolveCapture = resolve;
      });
    });

    const { ref } = makeContainer();
    const pending: boolean[] = [];
    const off = onExportPending((d: ExportPendingDetail) =>
      pending.push(d.pending),
    );

    const { result, unmount } = renderHook(() =>
      useExportTrigger(ref, { readOnly: false }),
    );

    dispatchExportTree({ format: "png", treeName: "Smith Family" });

    // Wait for captureTree to be invoked (export is in progress).
    await waitFor(() => expect(captureTreeMock).toHaveBeenCalled());

    // Cancel while capture is running.
    result.current.cancel();

    // The signal object shared with captureTree should now report aborted.
    await waitFor(() => {
      const sig = receivedSignals[0];
      expect(sig?.aborted).toBe(true);
    });

    // pending reset to false by cancel().
    expect(pending).toContain(false);
    expect(pending[pending.length - 1]).toBe(false);

    resolveCapture();
    unmount();
    off();
  });

  it("cancel during the settle delay aborts the run and still restores preparation", async () => {
    const restore = vi.fn();
    const prepareForCapture = vi.fn(() => ({ pixelRatio: 3, restore }));
    const { ref } = makeContainer();
    const pending: boolean[] = [];
    const off = onExportPending((d: ExportPendingDetail) =>
      pending.push(d.pending),
    );
    const { result, unmount } = renderHook(() =>
      useExportTrigger(ref, { readOnly: false, prepareForCapture }),
    );

    dispatchExportTree({ format: "png", treeName: "Smith Family" });
    await waitFor(() => expect(prepareForCapture).toHaveBeenCalled());

    result.current.cancel();

    await waitFor(() => expect(restore).toHaveBeenCalled(), { timeout: 2000 });
    expect(captureTreeMock).not.toHaveBeenCalled();
    expect(pending[pending.length - 1]).toBe(false);
    expect(toastError).not.toHaveBeenCalled();

    unmount();
    off();
  });

  it("continues as best-effort when preparation reports a degraded fallback", async () => {
    let resolveCapture!: () => void;
    captureTreeMock.mockImplementation(
      () =>
        new Promise<void>((resolve) => {
          resolveCapture = resolve;
        }),
    );
    const restore = vi.fn();
    const prepareForCapture = vi.fn(() => ({
      pixelRatio: 1,
      restore,
      degraded: true,
      degradeReason: "measurement-failed" as const,
    }));
    const { ref } = makeContainer();
    const { result, unmount } = renderHook(() =>
      useExportTrigger(ref, {
        readOnly: false,
        preflight: () => ({ degraded: false }),
        confirmDegrade: vi.fn(async () => true),
        prepareForCapture,
      }),
    );

    dispatchExportTree({ format: "png", treeName: "Fallback" });

    await waitFor(() => expect(captureTreeMock).toHaveBeenCalled(), {
      timeout: 2000,
    });
    expect(result.current.exportingBestEffort).toBe(true);
    expect(captureTreeMock).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      "png",
      "Fallback",
      expect.anything(),
      1,
    );

    resolveCapture();
    await waitFor(() => expect(result.current.exporting).toBe(false));
    expect(restore).toHaveBeenCalled();
    unmount();
  });
});

describe("useExportTrigger — preflight degrade gate (#225)", () => {
  it("skips the gate and captures when preflight is clean and not mobile", async () => {
    const { ref } = makeContainer();
    const confirmDegrade = vi.fn(async () => true);
    const { unmount } = renderHook(() =>
      useExportTrigger(ref, {
        readOnly: false,
        preflight: () => ({ degraded: false }),
        confirmDegrade,
      }),
    );
    dispatchExportTree({ format: "pdf", treeName: "Smith Family" });
    await waitFor(() => expect(captureTreeMock).toHaveBeenCalled());
    expect(confirmDegrade).not.toHaveBeenCalled();
    unmount();
  });

  it("asks for confirmation when preflight reports degraded; declining aborts after one pending cycle", async () => {
    const { ref } = makeContainer();
    const pending: boolean[] = [];
    const off = onExportPending((d: ExportPendingDetail) =>
      pending.push(d.pending),
    );
    const confirmDegrade = vi.fn(async () => false);
    const { unmount } = renderHook(() =>
      useExportTrigger(ref, {
        readOnly: false,
        preflight: () => ({ degraded: true }),
        confirmDegrade,
      }),
    );
    dispatchExportTree({ format: "pdf", treeName: "Smith Family" });
    await waitFor(() => expect(confirmDegrade).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(captureTreeMock).not.toHaveBeenCalled();
    expect(pending).toEqual([true, false]); // pending covers the confirm dialog too.
    unmount();
    off();
  });

  it("proceeds with capture when the user confirms a degraded export", async () => {
    const { ref } = makeContainer();
    const confirmDegrade = vi.fn(async () => true);
    const { unmount } = renderHook(() =>
      useExportTrigger(ref, {
        readOnly: false,
        preflight: () => ({ degraded: true }),
        confirmDegrade,
      }),
    );
    dispatchExportTree({ format: "pdf", treeName: "Smith Family" });
    await waitFor(() => expect(captureTreeMock).toHaveBeenCalled());
    expect(confirmDegrade).toHaveBeenCalledTimes(1);
    unmount();
  });

  it("uses the same degraded gate for PNG exports", async () => {
    const { ref } = makeContainer();
    const confirmDegrade = vi.fn(async () => true);
    const { unmount } = renderHook(() =>
      useExportTrigger(ref, {
        readOnly: false,
        preflight: () => ({ degraded: true, reason: "oversize" }),
        confirmDegrade,
      }),
    );
    dispatchExportTree({ format: "png", treeName: "Smith Family" });
    await waitFor(() => expect(captureTreeMock).toHaveBeenCalled());
    expect(confirmDegrade).toHaveBeenCalledTimes(1);
    expect(captureTreeMock).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      "png",
      "Smith Family",
      expect.anything(),
      3,
    );
    unmount();
  });

  it("keeps the first degraded confirmation resolver when a second event is dispatched", async () => {
    let resolveConfirm!: (ok: boolean) => void;
    const confirmDegrade = vi.fn(
      () =>
        new Promise<boolean>((resolve) => {
          resolveConfirm = resolve;
        }),
    );
    const { ref } = makeContainer();
    const { unmount } = renderHook(() =>
      useExportTrigger(ref, {
        readOnly: false,
        preflight: () => ({ degraded: true, reason: "oversize" }),
        confirmDegrade,
      }),
    );

    dispatchExportTree({ format: "pdf", treeName: "First" });
    await waitFor(() => expect(confirmDegrade).toHaveBeenCalledTimes(1));
    dispatchExportTree({ format: "png", treeName: "Second" });
    await new Promise((r) => setTimeout(r, 20));
    expect(confirmDegrade).toHaveBeenCalledTimes(1);

    resolveConfirm(true);
    await waitFor(() => expect(captureTreeMock).toHaveBeenCalledTimes(1));
    expect(captureTreeMock).toHaveBeenCalledWith(
      expect.any(HTMLElement),
      "pdf",
      "First",
      expect.anything(),
      3,
    );
    unmount();
  });

  it("gates on mobile even when preflight is clean", async () => {
    isMobileLikeMock.mockReturnValue(true);
    const { ref } = makeContainer();
    const pending: boolean[] = [];
    const off = onExportPending((d: ExportPendingDetail) =>
      pending.push(d.pending),
    );
    const confirmDegrade = vi.fn(async () => false);
    const { unmount } = renderHook(() =>
      useExportTrigger(ref, {
        readOnly: false,
        preflight: () => ({ degraded: false }),
        confirmDegrade,
      }),
    );
    dispatchExportTree({ format: "pdf", treeName: "Smith Family" });
    await waitFor(() => expect(confirmDegrade).toHaveBeenCalled());
    await new Promise((r) => setTimeout(r, 20));
    expect(captureTreeMock).not.toHaveBeenCalled();
    expect(pending).toEqual([true, false]);
    off();
    unmount();
  });
});
