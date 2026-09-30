/**
 * Camera capability detection and MediaStream lifecycle.
 *
 * - `detectCameraSupport` is a pure capability check: it never opens a
 *   stream. It must be called client-side only; on the server it
 *   returns `{ supported: false, reason: "navigator-unavailable" }`.
 * - `requestCamera` opens a stream on demand (after user interaction)
 *   and `stopStream` releases every track. The component is responsible
 *   for calling `stopStream` on capture, cancel, and disconnect.
 */

export interface CameraSupport {
  readonly supported: boolean;
  readonly reason?: CameraSupportReason;
}

export type CameraSupportReason =
  | "navigator-unavailable"
  | "no-mediaDevices"
  | "no-getUserMedia";

const SUPPORTED: CameraSupport = { supported: true };
const UNSUPPORTED_NO_NAVIGATOR: CameraSupport = {
  supported: false,
  reason: "navigator-unavailable",
};
const UNSUPPORTED_NO_MEDIA_DEVICES: CameraSupport = {
  supported: false,
  reason: "no-mediaDevices",
};
const UNSUPPORTED_NO_GET_USER_MEDIA: CameraSupport = {
  supported: false,
  reason: "no-getUserMedia",
};

export function detectCameraSupport(): CameraSupport {
  if (typeof navigator === "undefined") return UNSUPPORTED_NO_NAVIGATOR;
  const md = navigator.mediaDevices;
  if (!md) return UNSUPPORTED_NO_MEDIA_DEVICES;
  if (typeof md.getUserMedia !== "function") return UNSUPPORTED_NO_GET_USER_MEDIA;
  return SUPPORTED;
}

export interface CameraRequest {
  readonly facingMode?: "user" | "environment";
}

export async function requestCamera(
  options: CameraRequest = {},
): Promise<MediaStream> {
  const support = detectCameraSupport();
  if (!support.supported) {
    throw new Error(`camera not supported: ${support.reason ?? "unknown"}`);
  }
  // After detectCameraSupport, navigator.mediaDevices is guaranteed.
  return navigator.mediaDevices.getUserMedia({
    video: { facingMode: options.facingMode ?? "user" },
    audio: false,
  });
}

/**
 * Stop every track on the given stream. Safe to call with `null` and
 * safe to call on already-stopped tracks (best-effort).
 */
export function stopStream(stream: MediaStream | null | undefined): void {
  if (!stream) return;
  for (const track of stream.getTracks()) {
    try {
      track.stop();
    } catch {
      // ignore — best-effort cleanup
    }
  }
}
