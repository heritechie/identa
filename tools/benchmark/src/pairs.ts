/**
 * Deterministic pair generation.
 *
 * Positive: KTP(person A) ↔ selfie(person A)
 * Negative: KTP(person A) ↔ selfie(person B), for A ≠ B
 *
 * Output is deterministic for a given (persons, options) tuple: person IDs
 * are sorted and pairs iterate in a fixed order. No randomness is used.
 *
 * Person IDs are kept inside pairs because the runner uses them to enforce
 * person-disjoint splits. They MUST NOT appear in benchmark output.
 */

import type { DatasetPerson } from "./dataset.js";

export type PairLabel = "positive" | "negative";
export type PairType = "ktp_selfie" | "ktp_frame";

export interface Pair {
  readonly type: PairType;
  readonly label: PairLabel;
  readonly personA: string;
  readonly personB: string;
  readonly imageA: string;
  readonly imageB: string;
}

export interface PairGenerationOptions {
  /** Include KTP↔video-frame pairs in addition to KTP↔selfie. */
  readonly includeVideoFrames?: boolean;
  /**
   * If true, generate negatives in both directions
   * (KTP(A)↔selfie(B) and KTP(B)↔selfie(A)). Default: true.
   */
  readonly symmetricNegatives?: boolean;
}

const DEFAULTS: Required<PairGenerationOptions> = {
  includeVideoFrames: false,
  symmetricNegatives: true,
};

function sortedPersons(
  persons: ReadonlyArray<DatasetPerson>,
): ReadonlyArray<DatasetPerson> {
  return [...persons].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
}

export function generatePairs(
  persons: ReadonlyArray<DatasetPerson>,
  options: PairGenerationOptions = {},
): ReadonlyArray<Pair> {
  const opts = { ...DEFAULTS, ...options };
  const sorted = sortedPersons(persons);
  const pairs: Pair[] = [];

  for (const person of sorted) {
    pairs.push({
      type: "ktp_selfie",
      label: "positive",
      personA: person.id,
      personB: person.id,
      imageA: person.images.ktp,
      imageB: person.images.selfie,
    });
  }

  for (let i = 0; i < sorted.length; i++) {
    const startJ = opts.symmetricNegatives ? 0 : i + 1;
    for (let j = startJ; j < sorted.length; j++) {
      if (i === j) continue;
      const a = sorted[i];
      const b = sorted[j];
      if (!a || !b) continue;
      pairs.push({
        type: "ktp_selfie",
        label: "negative",
        personA: a.id,
        personB: b.id,
        imageA: a.images.ktp,
        imageB: b.images.selfie,
      });
    }
  }

  return Object.freeze(pairs);
}

export function countByLabel(
  pairs: ReadonlyArray<Pair>,
): { positive: number; negative: number } {
  let positive = 0;
  let negative = 0;
  for (const p of pairs) {
    if (p.label === "positive") positive++;
    else if (p.label === "negative") negative++;
  }
  return { positive, negative };
}
