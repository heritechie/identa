// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { captureFromVideo, decodeFile } from "../src/decode.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/**
 * happy-dom does not implement a real canvas. We patch the minimal slice
 * of `HTMLCanvasElement.getContext` that the decoder uses so we can drive
 * the success path deterministically.
 */
function mockCanvas2D(opts: {
  width: number;
  height: number;
  /** When true, simulate canvas failure (returns null). */
  fail?: boolean;
}) {
  const spy = vi.spyOn(
    HTMLCanvasElement.prototype,
    "getContext",
  );
  if (opts.fail) {
    spy.mockReturnValue(null);
    return spy;
  }
  const fakeContext = {
    drawImage: vi.fn(),
    getImageData: vi.fn((_x: number, _y: number, w: number, h: number) => ({
      data: new Uint8ClampedArray(w * h * 4),
      width: w,
      height: h,
    })),
  };
  spy.mockReturnValue(fakeContext as unknown as CanvasRenderingContext2D);
  return spy;
}

describe("decodeFile", () => {
  it("revokes the object URL on success", async () => {
    const createSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    mockCanvas2D({ width: 4, height: 4 });

    vi.spyOn(globalThis, "Image").mockImplementation(() => {
      const fake = {
        naturalWidth: 4,
        naturalHeight: 4,
        set src(_v: string) {
          queueMicrotask(() => fake.onload?.(new Event("load")));
        },
      } as unknown as HTMLImageElement;
      return fake;
    });

    const file = new File([new Uint8Array([0])], "x.png", { type: "image/png" });
    await decodeFile(file);
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledTimes(1);
  });

  it("revokes the object URL even when decoding fails", async () => {
    const createSpy = vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    const revokeSpy = vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(globalThis, "Image").mockImplementation(() => {
      const fake = {
        naturalWidth: 0,
        naturalHeight: 0,
        set src(_v: string) {
          queueMicrotask(() => fake.onerror?.(new Event("error")));
        },
      } as unknown as HTMLImageElement;
      return fake;
    });

    const file = new File([new Uint8Array([0])], "x.png", { type: "image/png" });
    await expect(decodeFile(file)).rejects.toThrow(/image decode failed/);
    expect(createSpy).toHaveBeenCalledTimes(1);
    expect(revokeSpy).toHaveBeenCalledTimes(1);
  });

  it("propagates an error when the canvas context is unavailable", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    mockCanvas2D({ width: 4, height: 4, fail: true });
    vi.spyOn(globalThis, "Image").mockImplementation(() => {
      const fake = {
        naturalWidth: 4,
        naturalHeight: 4,
        set src(_v: string) {
          queueMicrotask(() => fake.onload?.(new Event("load")));
        },
      } as unknown as HTMLImageElement;
      return fake;
    });

    const file = new File([new Uint8Array([0])], "x.png", { type: "image/png" });
    await expect(decodeFile(file)).rejects.toThrow(/2d canvas context unavailable/);
  });

  it("rejects after the load timeout when the image never resolves", async () => {
    vi.spyOn(URL, "createObjectURL").mockReturnValue("blob:test");
    vi.spyOn(URL, "revokeObjectURL").mockImplementation(() => undefined);
    vi.spyOn(globalThis, "Image").mockImplementation(() => {
      // Image never fires onload or onerror.
      const fake = {
        naturalWidth: 0,
        naturalHeight: 0,
        set src(_v: string) {
          // intentionally do nothing
        },
      } as unknown as HTMLImageElement;
      return fake;
    });

    const file = new File([new Uint8Array([0])], "x.png", { type: "image/png" });
    await expect(decodeFile(file, 50)).rejects.toThrow(/timed out/);
  });
});

describe("captureFromVideo", () => {
  it("throws when the video element has no dimensions", async () => {
    const video = {
      videoWidth: 0,
      videoHeight: 0,
      readyState: 4,
    } as unknown as HTMLVideoElement;
    await expect(captureFromVideo(video)).rejects.toThrow(/zero dimensions/);
  });

  it("throws when the video is not ready", async () => {
    const video = {
      videoWidth: 100,
      videoHeight: 100,
      readyState: 0, // HAVE_NOTHING
    } as unknown as HTMLVideoElement;
    await expect(captureFromVideo(video)).rejects.toThrow(/not ready/);
  });
});
