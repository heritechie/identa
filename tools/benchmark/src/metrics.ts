/**
 * Biometric metrics: FAR, FRR, TAR, TRR.
 *
 * Definitions (per the brief):
 *   - TP: positive pair with score >= threshold (correctly accepted)
 *   - TN: negative pair with score <  threshold (correctly rejected)
 *   - FA: negative pair with score >= threshold (incorrectly accepted)
 *   - FR: positive pair with score <  threshold (incorrectly rejected)
 *   - FAR = FA / total_negatives
 *   - FRR = FR / total_positives
 *   - TAR = 1 - FRR   (true accept rate)
 *   - TRR = 1 - FAR   (true reject rate)
 *
 * Scores are bounded in [-1, 1] for cosine similarity but the formulas are
 * agnostic to that; the engine returns the score it uses.
 */

import type { PairLabel } from "./pairs.js";

export interface ScoredPair {
  readonly label: PairLabel;
  readonly score: number;
}

export interface Metrics {
  readonly threshold: number;
  readonly positives: number;
  readonly negatives: number;
  readonly tp: number;
  readonly tn: number;
  readonly fa: number;
  readonly fr: number;
  readonly far: number;
  readonly frr: number;
  readonly tar: number;
  readonly trr: number;
}

function safeRate(numerator: number, denominator: number): number {
  return denominator === 0 ? 0 : numerator / denominator;
}

export function computeMetrics(
  pairs: ReadonlyArray<ScoredPair>,
  threshold: number,
): Metrics {
  let positives = 0;
  let negatives = 0;
  let tp = 0;
  let tn = 0;
  let fa = 0;
  let fr = 0;

  for (const pair of pairs) {
    const accepted = pair.score >= threshold;
    if (pair.label === "positive") {
      positives++;
      if (accepted) tp++;
      else fr++;
    } else {
      negatives++;
      if (accepted) fa++;
      else tn++;
    }
  }

  const far = safeRate(fa, negatives);
  const frr = safeRate(fr, positives);
  // When there are no samples in a class, the rate is undefined. We surface
  // that as 0 instead of "1 - 0 = 1", which would falsely imply perfect
  // performance on an empty class.
  const tar = positives === 0 ? 0 : 1 - frr;
  const trr = negatives === 0 ? 0 : 1 - far;

  return {
    threshold,
    positives,
    negatives,
    tp,
    tn,
    fa,
    fr,
    far,
    frr,
    tar,
    trr,
  };
}

export interface ClassifiedPair extends ScoredPair {
  readonly accepted: boolean;
}

export function classify(
  pairs: ReadonlyArray<ScoredPair>,
  threshold: number,
): ReadonlyArray<ClassifiedPair> {
  return pairs.map((p) =>
    Object.freeze({ ...p, accepted: p.score >= threshold }),
  );
}
