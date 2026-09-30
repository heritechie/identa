/**
 * Stable benchmark error codes. Technical failures must surface here so
 * they can be distinguished from biometric outcomes (matched/not_matched).
 */

export const BenchmarkErrorCode = {
  ENGINE_NOT_LOADED: "ENGINE_NOT_LOADED",
  IMAGE_LOAD_FAILED: "IMAGE_LOAD_FAILED",
  EMBED_FAILED: "EMBED_FAILED",
  VIDEO_FRAME_EXTRACTOR_MISSING: "VIDEO_FRAME_EXTRACTOR_MISSING",
  VIDEO_EXTRACT_FAILED: "VIDEO_EXTRACT_FAILED",
  DATASET_EMPTY: "DATASET_EMPTY",
  NO_PAIRS_GENERATED: "NO_PAIRS_GENERATED",
  INVALID_CONFIG: "INVALID_CONFIG",
} as const;

export type BenchmarkErrorCode =
  (typeof BenchmarkErrorCode)[keyof typeof BenchmarkErrorCode];

export class BenchmarkError extends Error {
  constructor(
    public readonly code: BenchmarkErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "BenchmarkError";
  }
}
