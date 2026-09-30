import { describe, expect, it } from "vitest";
import { classify, computeMetrics, type ScoredPair } from "../src/metrics.js";

const pos = (score: number): ScoredPair => ({ label: "positive", score });
const neg = (score: number): ScoredPair => ({ label: "negative", score });

describe("computeMetrics", () => {
  it("all positives accepted at threshold 0.5", () => {
    const m = computeMetrics([pos(0.9), pos(0.8), pos(0.7)], 0.5);
    expect(m).toEqual({
      threshold: 0.5,
      positives: 3,
      negatives: 0,
      tp: 3,
      tn: 0,
      fa: 0,
      fr: 0,
      far: 0,
      frr: 0,
      tar: 1,
      // negatives=0 → trr undefined, reported as 0
      trr: 0,
    });
  });

  it("all positives rejected at threshold 0.5 (FRR = 1)", () => {
    const m = computeMetrics([pos(0.1), pos(0.2), pos(0.3)], 0.5);
    expect(m.fr).toBe(3);
    expect(m.frr).toBe(1);
    expect(m.tar).toBe(0);
    expect(m.far).toBe(0);
  });

  it("all negatives accepted at threshold 0.5 (FAR = 1)", () => {
    const m = computeMetrics([neg(0.9), neg(0.8), neg(0.7)], 0.5);
    expect(m.fa).toBe(3);
    expect(m.far).toBe(1);
    expect(m.trr).toBe(0);
    expect(m.frr).toBe(0);
  });

  it("all negatives rejected at threshold 0.5", () => {
    const m = computeMetrics([neg(0.1), neg(0.2), neg(0.3)], 0.5);
    expect(m.tn).toBe(3);
    expect(m.fa).toBe(0);
    expect(m.far).toBe(0);
    expect(m.trr).toBe(1);
  });

  it("treats score == threshold as accepted", () => {
    const m = computeMetrics([pos(0.5)], 0.5);
    expect(m.tp).toBe(1);
    expect(m.frr).toBe(0);
  });

  it("computes FAR and FRR on a mixed distribution", () => {
    const pairs: ScoredPair[] = [
      pos(0.95), pos(0.85), pos(0.75), pos(0.65), pos(0.55),
      neg(0.45), neg(0.35), neg(0.25), neg(0.15), neg(0.05),
    ];
    const m = computeMetrics(pairs, 0.5);
    expect(m.positives).toBe(5);
    expect(m.negatives).toBe(5);
    expect(m.tp).toBe(5);
    expect(m.tn).toBe(5);
    expect(m.fa).toBe(0);
    expect(m.fr).toBe(0);
    expect(m.far).toBe(0);
    expect(m.frr).toBe(0);
    expect(m.tar).toBe(1);
    expect(m.trr).toBe(1);
  });

  it("computes FAR > 0 and FRR > 0 on overlap", () => {
    // Below-threshold pos = FR, above-threshold pos = TP.
    // Below-threshold neg = TN, above-threshold neg = FA.
    const pairs: ScoredPair[] = [
      pos(0.4), pos(0.6),
      neg(0.3), neg(0.7),
    ];
    const m = computeMetrics(pairs, 0.5);
    expect(m.tp).toBe(1);
    expect(m.fr).toBe(1);
    expect(m.tn).toBe(1);
    expect(m.fa).toBe(1);
    expect(m.frr).toBe(0.5);
    expect(m.far).toBe(0.5);
    expect(m.tar).toBe(0.5);
    expect(m.trr).toBe(0.5);
  });

  it("returns zero rates on empty input", () => {
    const m = computeMetrics([], 0.5);
    expect(m.positives).toBe(0);
    expect(m.negatives).toBe(0);
    expect(m.far).toBe(0);
    expect(m.frr).toBe(0);
    expect(m.tar).toBe(0);
    expect(m.trr).toBe(0);
  });

  it("preserves TAR + FRR == 1 and TRR + FAR == 1", () => {
    const pairs: ScoredPair[] = [
      pos(0.1), pos(0.9),
      neg(0.2), neg(0.8),
    ];
    const m = computeMetrics(pairs, 0.5);
    expect(m.tar + m.frr).toBeCloseTo(1, 10);
    expect(m.trr + m.far).toBeCloseTo(1, 10);
  });
});

describe("classify", () => {
  it("annotates each pair with its accepted flag", () => {
    const pairs: ScoredPair[] = [pos(0.6), neg(0.4)];
    const out = classify(pairs, 0.5);
    expect(out[0]?.accepted).toBe(true);
    expect(out[1]?.accepted).toBe(false);
  });

  it("returns frozen objects", () => {
    const out = classify([pos(0.5)], 0.5);
    expect(Object.isFrozen(out[0])).toBe(true);
  });
});
