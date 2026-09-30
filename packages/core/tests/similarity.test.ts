import { describe, expect, it } from "vitest";
import { cosineSimilarity } from "../src/similarity.js";
import type { Embedding } from "../src/types.js";

const vec = (values: number[]): Embedding => ({
  vector: Float32Array.from(values),
});

describe("cosineSimilarity", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity(vec([1, 0, 0]), vec([1, 0, 0]))).toBeCloseTo(1, 6);
  });

  it("returns -1 for opposite vectors", () => {
    expect(cosineSimilarity(vec([1, 0, 0]), vec([-1, 0, 0]))).toBeCloseTo(-1, 6);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity(vec([1, 0, 0]), vec([0, 1, 0]))).toBeCloseTo(0, 6);
  });

  it("returns 0 for zero vectors", () => {
    expect(cosineSimilarity(vec([0, 0, 0]), vec([0, 0, 0]))).toBe(0);
  });

  it("is scale-invariant", () => {
    const a = cosineSimilarity(vec([1, 2, 3]), vec([1, 2, 3]));
    const b = cosineSimilarity(vec([2, 4, 6]), vec([1, 2, 3]));
    expect(a).toBeCloseTo(b, 6);
  });

  it("throws on length mismatch", () => {
    expect(() => cosineSimilarity(vec([1, 2]), vec([1, 2, 3]))).toThrow(
      /length mismatch/,
    );
  });
});
