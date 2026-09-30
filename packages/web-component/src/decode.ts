/**
 * Image decoding utilities. Browser-only.
 *
 * - `decodeFile` reads a `File` / `Blob` into raw RGBA `ImageInput` via
 *   an `<img>` element and a 2D canvas.
 * - `captureFromVideo` captures a single frame from an `<video>`
 *   element into the same shape.
 *
 * Object URLs are always revoked before the function returns, even on
 * error, so we never leak the user's image back to the page.
 */

import type { ImageInput } from "@identa/core";

/** Decode a browser File/Blob to raw RGBA pixels. Throws on decode failure. */
export async function decodeFile(
  file: Blob,
  timeoutMs: number = DEFAULT_IMAGE_LOAD_TIMEOUT_MS,
): Promise<ImageInput> {
  const url = URL.createObjectURL(file);
  try {
    const img = await loadHtmlImage(url, timeoutMs);
    return rasterize(img);
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Capture a single frame from an HTMLVideoElement to raw RGBA pixels. */
export async function captureFromVideo(video: HTMLVideoElement): Promise<ImageInput> {
  if (video.readyState < 2) {
    throw new Error("video element is not ready");
  }
  return rasterize(video);
}

interface Rasterizable {
  readonly naturalWidth?: number;
  readonly naturalHeight?: number;
  readonly videoWidth?: number;
  readonly videoHeight?: number;
}

const DEFAULT_IMAGE_LOAD_TIMEOUT_MS = 15_000;

function loadHtmlImage(
  url: string,
  timeoutMs: number = DEFAULT_IMAGE_LOAD_TIMEOUT_MS,
): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new Error("image load timed out"));
    }, timeoutMs);
    img.onload = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(img);
    };
    img.onerror = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(new Error("image decode failed"));
    };
    img.src = url;
  });
}

function rasterize(source: Rasterizable): ImageInput {
  const w = source.naturalWidth ?? source.videoWidth ?? 0;
  const h = source.naturalHeight ?? source.videoHeight ?? 0;
  if (!w || !h) {
    throw new Error("image has zero dimensions");
  }
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("2d canvas context unavailable");
  }
  // The canvas 2D context accepts CanvasImageSource at runtime; the
  // Rasterizable shape covers HTMLImageElement and HTMLVideoElement. The
  // cast is safe at runtime and lets us treat the union uniformly.
  ctx.drawImage(
    source as unknown as CanvasImageSource,
    0,
    0,
    w,
    h,
  );
  const data = ctx.getImageData(0, 0, w, h);
  return {
    data: new Uint8Array(data.data.buffer),
    width: w,
    height: h,
  };
}
