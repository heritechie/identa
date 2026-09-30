/**
 * Person-disjoint dataset splits.
 *
 * Splits assign each person to exactly one of train/dev/test. Pairs are
 * constrained to within-split pairs when evaluated per split, so no person
 * leaks between training and evaluation sets.
 *
 * Default split configuration: evaluation-only (test contains all persons).
 *
 * Deterministic for a given (personIds, seed, ratios) tuple. Implementation
 * uses a small xorshift32 PRNG so output is reproducible without bringing
 * in a randomness dependency.
 */

export type Split = "train" | "dev" | "test";

export interface SplitOptions {
  readonly seed: number;
  /** Ratios for [train, dev, test]. Default: [0.7, 0.15, 0.15]. */
  readonly ratios?: readonly [number, number, number];
  /** Splits to actually assign. Default: all three. */
  readonly splits?: readonly Split[];
}

export type PersonSplitMap = ReadonlyMap<string, Split>;

const DEFAULT_RATIOS: readonly [number, number, number] = [0.7, 0.15, 0.15];

function xorshift32(seed: number): () => number {
  let state = seed | 0;
  if (state === 0) state = 0x12345678;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return ((state >>> 0) / 0xFFFFFFFF);
  };
}

function normalizeRatios(
  ratios: readonly [number, number, number],
): readonly [number, number, number] {
  const sum = ratios[0] + ratios[1] + ratios[2];
  if (sum <= 0) return DEFAULT_RATIOS;
  return [ratios[0] / sum, ratios[1] / sum, ratios[2] / sum];
}

export function splitPersons(
  personIds: ReadonlyArray<string>,
  options: SplitOptions,
): PersonSplitMap {
  const ratios = normalizeRatios(options.ratios ?? DEFAULT_RATIOS);
  const allSplits: readonly Split[] = ["train", "dev", "test"];
  const activeSplits = new Set(options.splits ?? allSplits);

  const sorted = [...personIds].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const indices = sorted.map((_, i) => i);
  const rng = xorshift32(options.seed);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const a = indices[i];
    const b = indices[j];
    if (a === undefined || b === undefined) continue;
    indices[i] = b;
    indices[j] = a;
  }

  const n = sorted.length;
  const trainEnd = Math.floor(n * ratios[0]);
  const devEnd = trainEnd + Math.floor(n * ratios[1]);

  const map = new Map<string, Split>();
  indices.forEach((sortedIndex, shuffledPosition) => {
    const id = sorted[sortedIndex];
    if (id === undefined) return;
    let split: Split;
    if (shuffledPosition < trainEnd) split = "train";
    else if (shuffledPosition < devEnd) split = "dev";
    else split = "test";
    if (!activeSplits.has(split)) {
      // Collapse to the nearest active split.
      split = activeSplits.has("test") ? "test" : activeSplits.has("dev") ? "dev" : "train";
    }
    map.set(id, split);
  });

  return map;
}

/** Filter pairs to those whose both persons are in the given split. */
export function filterPairsBySplit<P extends { personA: string; personB: string }>(
  pairs: ReadonlyArray<P>,
  splitMap: PersonSplitMap,
  split: Split,
): ReadonlyArray<P> {
  return pairs.filter(
    (p) => splitMap.get(p.personA) === split && splitMap.get(p.personB) === split,
  );
}
