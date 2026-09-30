/**
 * Threshold sweep and latency statistics.
 *
 * The default threshold table spans the operational range of cosine
 * similarity for face embeddings (roughly 0.20–0.90). The sweep lets us
 * pick a production threshold empirically rather than arbitrarily.
 */

import { computeMetrics, type Metrics, type ScoredPair } from "./metrics.js";

export const DEFAULT_THRESHOLDS: ReadonlyArray<number> = Object.freeze([
  0.20, 0.25, 0.30, 0.35, 0.40, 0.45, 0.50, 0.55, 0.60, 0.65, 0.70, 0.75, 0.80,
  0.85, 0.90,
]);

export function thresholdSweep(
  pairs: ReadonlyArray<ScoredPair>,
  thresholds: ReadonlyArray<number> = DEFAULT_THRESHOLDS,
): ReadonlyArray<Metrics> {
  return Object.freeze(thresholds.map((t) => computeMetrics(pairs, t)));
}

export interface LatencyStats {
  readonly count: number;
  readonly meanMs: number;
  readonly p50Ms: number;
  readonly p95Ms: number;
  readonly p99Ms: number;
  readonly minMs: number;
  readonly maxMs: number;
}

function percentile(sorted: ReadonlyArray<number>, q: number): number {
  if (sorted.length === 0) return 0;
  if (sorted.length === 1) return sorted[0] ?? 0;
  const rank = q * (sorted.length - 1);
  const low = Math.floor(rank);
  const high = Math.ceil(rank);
  const lo = sorted[low] ?? 0;
  const hi = sorted[high] ?? 0;
  const frac = rank - low;
  return lo + (hi - lo) * frac;
}

export function computeLatencyStats(latenciesMs: ReadonlyArray<number>): LatencyStats {
  const n = latenciesMs.length;
  if (n === 0) {
    return {
      count: 0,
      meanMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      minMs: 0,
      maxMs: 0,
    };
  }
  const sorted = [...latenciesMs].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  return {
    count: n,
    meanMs: sum / n,
    p50Ms: percentile(sorted, 0.5),
    p95Ms: percentile(sorted, 0.95),
    p99Ms: percentile(sorted, 0.99),
    minMs: sorted[0] ?? 0,
    maxMs: sorted[n - 1] ?? 0,
  };
}
