import { describe, expect, it } from "vitest";
import { serializeBenchmark, writeBenchmark } from "../src/output.js";
import type { BenchmarkOutput } from "../src/runner.js";

const sample: BenchmarkOutput = {
  engine: "example-engine",
  model: "example-model",
  dataset: "private",
  pairs: {
    positive: 3,
    negative: 6,
    bySplit: {
      train: { positive: 0, negative: 0 },
      dev: { positive: 0, negative: 0 },
      test: { positive: 3, negative: 6 },
    },
  },
  metrics: {
    threshold: 0.5,
    positives: 3,
    negatives: 6,
    tp: 3,
    tn: 6,
    fa: 0,
    fr: 0,
    far: 0,
    frr: 0,
    tar: 1,
    trr: 1,
  },
  thresholds: [
    {
      threshold: 0.5,
      positives: 3,
      negatives: 6,
      tp: 3,
      tn: 6,
      fa: 0,
      fr: 0,
      far: 0,
      frr: 0,
      tar: 1,
      trr: 1,
    },
  ],
  performance: {
    count: 18,
    meanMs: 12,
    p50Ms: 10,
    p95Ms: 20,
    p99Ms: 25,
    minMs: 5,
    maxMs: 30,
  },
};

describe("serializeBenchmark", () => {
  it("emits valid JSON", () => {
    const json = serializeBenchmark(sample);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it("includes engine / model / dataset metadata", () => {
    const parsed = JSON.parse(serializeBenchmark(sample));
    expect(parsed.engine).toBe("example-engine");
    expect(parsed.model).toBe("example-model");
    expect(parsed.dataset).toBe("private");
  });

  it("never contains image paths or person IDs", () => {
    const json = serializeBenchmark({
      ...sample,
      pairs: {
        ...sample.pairs,
        bySplit: {
          ...sample.pairs.bySplit,
          test: { positive: 3, negative: 6 },
        },
      },
    });
    expect(json).not.toContain("/data/person-001");
    expect(json).not.toContain("person-001");
    expect(json).not.toContain("ktp.jpg");
    expect(json).not.toContain("selfie.jpg");
  });
});

describe("writeBenchmark", () => {
  it("writes JSON to disk", async () => {
    const fs = await import("node:fs/promises");
    const path = "/tmp/identa-benchmark-output.test.json";
    await writeBenchmark(sample, path);
    const read = await fs.readFile(path, "utf8");
    expect(() => JSON.parse(read)).not.toThrow();
    await fs.unlink(path);
  });
});
