import type { VerificationResult } from "./types.js";

/**
 * Apply a similarity threshold to produce the final verification status.
 * Threshold selection must be based on evaluation data and documented; the
 * default here is a placeholder and is NOT a production recommendation.
 */
export const DEFAULT_THRESHOLD = 0.5;

export function applyThreshold(
  score: number,
  threshold: number = DEFAULT_THRESHOLD,
): VerificationResult {
  return {
    status: score >= threshold ? "matched" : "not_matched",
    score,
    threshold,
  };
}
