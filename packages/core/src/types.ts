/**
 * Public type surface for @identa/core.
 *
 * The core package must remain framework-independent: no React, no DOM-only
 * APIs, no I/O, no persistence. Inputs are raw pixel buffers so the same code
 * runs in Node, browsers, edge workers, and tests.
 */

/** Raw RGBA pixels, row-major, 4 bytes per pixel. */
export interface ImageInput {
  readonly data: Uint8Array;
  readonly width: number;
  readonly height: number;
}

/** A cropped and aligned face ready for embedding. */
export interface FaceInput {
  readonly pixels: ImageInput;
  /** Optional 5-point landmarks, if the engine provides them. */
  readonly landmarks?: ReadonlyArray<readonly [number, number]>;
}

/** Bounding box in pixel coordinates of the source image. */
export interface BoundingBox {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
}

/** A face detection result. */
export interface FaceDetection {
  readonly box: BoundingBox;
  /** Detector confidence in [0, 1]. */
  readonly confidence: number;
  readonly landmarks?: ReadonlyArray<readonly [number, number]>;
}

/** A fixed-size face embedding vector. */
export interface Embedding {
  readonly vector: Float32Array;
}

export type VerificationStatus =
  | "matched"
  | "not_matched"
  | "unable_to_verify";

export interface VerificationResult {
  readonly status: VerificationStatus;
  readonly score?: number;
  readonly threshold?: number;
  readonly reason?: VerificationErrorCode;
}

/**
 * Stable, machine-readable error codes. Technical failures must surface here,
 * never be collapsed into `not_matched`.
 */
export const VerificationErrorCode = {
  INVALID_IMAGE: "INVALID_IMAGE",
  IMAGE_TOO_SMALL: "IMAGE_TOO_SMALL",
  FACE_NOT_DETECTED: "FACE_NOT_DETECTED",
  MULTIPLE_FACES: "MULTIPLE_FACES",
  FACE_TOO_SMALL: "FACE_TOO_SMALL",
  IMAGE_TOO_BLURRY: "IMAGE_TOO_BLURRY",
  MODEL_ERROR: "MODEL_ERROR",
  ENGINE_NOT_CONFIGURED: "ENGINE_NOT_CONFIGURED",
} as const;

export type VerificationErrorCode =
  (typeof VerificationErrorCode)[keyof typeof VerificationErrorCode];

export interface VerifyInput {
  readonly documentImage: ImageInput;
  readonly selfieImage: ImageInput;
}

export interface VerifyOptions {
  /** Cosine-similarity threshold for `matched`. Defaults to engine value. */
  readonly threshold?: number;
}

/**
 * Engine boundary. The core does not know which model runs behind this
 * interface; engines/face implements it.
 *
 * The engine is responsible for:
 *   - loading model weights (if async, expose `load()`; consumer calls
 *     it before `verify()`)
 *   - detecting faces in `ImageInput`
 *   - extracting / cropping / aligning the face (internally, using
 *     detection bounding boxes and any returned landmarks)
 *   - producing a face `Embedding`
 *
 * To surface a documented failure, throw a `FaceEngineError` whose
 * `code` is one of the `VerificationErrorCode` values. Any other thrown
 * error is collapsed to `MODEL_ERROR`.
 */
export interface FaceEngine {
  /**
   * Optional one-time initialization (load model weights, warm up
   * runtimes). Consumer is responsible for calling this before
   * `verify()` if needed. `verify()` does NOT call `load()` itself
   * because the engine may already be loaded by a long-lived host
   * (e.g. a web component).
   */
  load?(): Promise<void>;
  detect(image: ImageInput): Promise<ReadonlyArray<FaceDetection>>;
  embed(face: FaceInput): Promise<Embedding>;
}
