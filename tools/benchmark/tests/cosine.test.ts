import { describe, expect, it } from "vitest";
import { cosineSimilarity } from "@identa/core";
import type { Embedding } from "@identa/core";

const vec = (values: number[]): Embedding => ({
  vector: Float32Array.from(values),
});

describe("cosineSimilarity (smoke, benchmark-side)", () => {
  it("returns 1 for identical vectors", () => {
    expect(cosineSimilarity(vec([1, 0, 0]), vec([1, 0, 0]))).toBeCloseTo(1, 6);
  });

  it("returns 0 for orthogonal vectors", () => {
    expect(cosineSimilarity(vec([1, 0, 0]), vec([0, 1, 0]))).toBeCloseTo(0, 6);
  });

  it("returns 0 for zero vectors", () => {
    expect(cosineSimilarity(vec([0, 0, 0]), vec([0, 0, 0]))).toBe(0);
  });

  it("throws on length mismatch", () => {
    expect(() => cosineSimilarity(vec([1, 2]), vec([1, 2, 3]))).toThrow(
      /length mismatch/,
    );
  });
});
