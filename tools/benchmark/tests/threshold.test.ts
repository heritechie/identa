import { describe, expect, it } from "vitest";
import {
  computeLatencyStats,
  DEFAULT_THRESHOLDS,
  thresholdSweep,
} from "../src/threshold.js";
import type { ScoredPair } from "../src/metrics.js";

const pos = (score: number): ScoredPair => ({ label: "positive", score });
const neg = (score: number): ScoredPair => ({ label: "negative", score });

describe("thresholdSweep", () => {
  it("produces one Metrics entry per threshold", () => {
    const sweep = thresholdSweep([pos(0.9), neg(0.1)], [0.3, 0.5, 0.7]);
    expect(sweep).toHaveLength(3);
    expect(sweep.map((m) => m.threshold)).toEqual([0.3, 0.5, 0.7]);
  });

  it("uses DEFAULT_THRESHOLDS by default", () => {
    const sweep = thresholdSweep([]);
    expect(sweep.length).toBe(DEFAULT_THRESHOLDS.length);
    expect(sweep[0]?.threshold).toBe(DEFAULT_THRESHOLDS[0]);
  });

  it("FAR is monotonically non-increasing as threshold rises", () => {
    const pairs: ScoredPair[] = [
      pos(0.92), pos(0.88), pos(0.81), pos(0.76),
      neg(0.70), neg(0.65), neg(0.55), neg(0.30),
    ];
    const sweep = thresholdSweep(pairs, [0.4, 0.5, 0.6, 0.7, 0.8]);
    for (let i = 1; i < sweep.length; i++) {
      const prev = sweep[i - 1];
      const curr = sweep[i];
      if (!prev || !curr) continue;
      expect(curr.far).toBeLessThanOrEqual(prev.far + 1e-9);
    }
  });

  it("FRR is monotonically non-decreasing as threshold rises", () => {
    const pairs: ScoredPair[] = [
      pos(0.92), pos(0.88), pos(0.81), pos(0.76),
      neg(0.70), neg(0.65), neg(0.55), neg(0.30),
    ];
    const sweep = thresholdSweep(pairs, [0.4, 0.5, 0.6, 0.7, 0.8]);
    for (let i = 1; i < sweep.length; i++) {
      const prev = sweep[i - 1];
      const curr = sweep[i];
      if (!prev || !curr) continue;
      expect(curr.frr).toBeGreaterThanOrEqual(prev.frr - 1e-9);
    }
  });

  it("default sweep covers 0.20 to 0.90 in 0.05 steps", () => {
    expect(DEFAULT_THRESHOLDS[0]).toBe(0.2);
    expect(DEFAULT_THRESHOLDS[DEFAULT_THRESHOLDS.length - 1]).toBe(0.9);
    for (let i = 1; i < DEFAULT_THRESHOLDS.length; i++) {
      const a = DEFAULT_THRESHOLDS[i - 1];
      const b = DEFAULT_THRESHOLDS[i];
      if (a === undefined || b === undefined) continue;
      expect(b - a).toBeCloseTo(0.05, 10);
    }
  });

  it("produces frozen output", () => {
    const sweep = thresholdSweep([], [0.5]);
    expect(Object.isFrozen(sweep)).toBe(true);
  });
});

describe("computeLatencyStats", () => {
  it("returns zeros on empty input", () => {
    expect(computeLatencyStats([])).toEqual({
      count: 0,
      meanMs: 0,
      p50Ms: 0,
      p95Ms: 0,
      p99Ms: 0,
      minMs: 0,
      maxMs: 0,
    });
  });

  it("reports correct count, min, max, mean on simple input", () => {
    const s = computeLatencyStats([10, 20, 30, 40, 50]);
    expect(s.count).toBe(5);
    expect(s.minMs).toBe(10);
    expect(s.maxMs).toBe(50);
    expect(s.meanMs).toBe(30);
  });

  it("handles a single sample", () => {
    const s = computeLatencyStats([42]);
    expect(s.count).toBe(1);
    expect(s.meanMs).toBe(42);
    expect(s.p50Ms).toBe(42);
    expect(s.minMs).toBe(42);
    expect(s.maxMs).toBe(42);
  });

  it("percentiles lie within [min, max]", () => {
    const samples = Array.from({ length: 200 }, (_, i) => i + 1);
    const s = computeLatencyStats(samples);
    expect(s.p50Ms).toBeGreaterThanOrEqual(s.minMs);
    expect(s.p50Ms).toBeLessThanOrEqual(s.maxMs);
    expect(s.p95Ms).toBeGreaterThanOrEqual(s.p50Ms);
    expect(s.p99Ms).toBeGreaterThanOrEqual(s.p95Ms);
  });

  it("does not mutate the input array", () => {
    const input = [3, 1, 2];
    const snapshot = [...input];
    computeLatencyStats(input);
    expect(input).toEqual(snapshot);
  });
});
