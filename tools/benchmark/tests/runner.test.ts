import { describe, expect, it } from "vitest";
import { runBenchmark } from "../src/runner.js";
import {
  BenchmarkError,
  BenchmarkErrorCode,
} from "../src/errors.js";
import type { EmbeddingEngine } from "../src/engine.js";
import type {
  Dataset,
  ImageLoader,
} from "../src/dataset.js";
import type { ImageInput, Embedding } from "@identa/core";

const fixturePersons = [
  { id: "alpha", images: { ktp: "/data/alpha/ktp.jpg", selfie: "/data/alpha/selfie.jpg" } },
  { id: "bravo", images: { ktp: "/data/bravo/ktp.jpg", selfie: "/data/bravo/selfie.jpg" } },
  { id: "charlie", images: { ktp: "/data/charlie/ktp.jpg", selfie: "/data/charlie/selfie.jpg" } },
];

const dataset: Dataset = {
  sourcePath: "/private/dataset",
  persons: fixturePersons,
};

/**
 * Mock loader: encodes person identity into image width so the mock engine
 * can produce deterministic embeddings without any real model.
 */
const widthByPath: Record<string, number> = {
  alpha: 10,
  bravo: 20,
  charlie: 30,
};
const mockLoader: ImageLoader = {
  async load(path: string): Promise<ImageInput> {
    const id = path.split("/")[2] ?? "";
    const w = widthByPath[id];
    if (w === undefined) throw new Error(`unknown person path: ${path}`);
    return { data: new Uint8Array(4 * w * w), width: w, height: w };
  },
};

/**
 * Mock engine: produces embeddings keyed by image width.
 *
 * Embeddings (orthogonal unit vectors):
 *   width 10 (alpha)   → [1, 0, 0]
 *   width 20 (bravo)   → [0, 1, 0]
 *   width 30 (charlie) → [0, 0, 1]
 *
 * Cosines:
 *   alpha-alpha = 1.0
 *   alpha-bravo = 0
 *   alpha-charlie = 0
 *
 * At threshold 0.5: all positives accepted (TP), all negatives rejected (TN).
 */
const mockEngine: EmbeddingEngine = {
  name: "mock-engine",
  model: "mock-orthogonal-3d",
  async load(): Promise<void> {
    /* noop */
  },
  async embed(image: ImageInput): Promise<Embedding> {
    if (image.width === 10) return { vector: Float32Array.from([1, 0, 0]) };
    if (image.width === 20) return { vector: Float32Array.from([0, 1, 0]) };
    if (image.width === 30) return { vector: Float32Array.from([0, 0, 1]) };
    throw new Error(`mock engine: unknown width ${image.width}`);
  },
};

describe("runBenchmark", () => {
  it("produces expected pair counts on the default evaluation split", async () => {
    const out = await runBenchmark({
      dataset,
      engine: mockEngine,
      imageLoader: mockLoader,
      seed: 42,
    });
    expect(out.pairs.positive).toBe(3);
    expect(out.pairs.negative).toBe(6);
    expect(out.pairs.bySplit.test.positive).toBe(3);
    expect(out.pairs.bySplit.test.negative).toBe(6);
  });

  it("computes FAR and FRR from the mock distribution at threshold 0.5", async () => {
    const out = await runBenchmark({
      dataset,
      engine: mockEngine,
      imageLoader: mockLoader,
      threshold: 0.5,
      seed: 42,
    });
    // All positives score 1.0 → TP=3, FR=0
    // All cross-person negatives score 0 → TN
    expect(out.metrics.far).toBe(0);
    expect(out.metrics.frr).toBe(0);
    expect(out.metrics.tar).toBe(1);
    expect(out.metrics.trr).toBe(1);
  });

  it("records latency for every embed call", async () => {
    const out = await runBenchmark({
      dataset,
      engine: mockEngine,
      imageLoader: mockLoader,
      seed: 42,
    });
    // 9 pairs × 2 images per pair = 18 embed calls
    expect(out.performance.count).toBe(18);
    expect(out.performance.minMs).toBeGreaterThanOrEqual(0);
    expect(out.performance.maxMs).toBeGreaterThanOrEqual(out.performance.minMs);
    expect(out.performance.meanMs).toBeGreaterThanOrEqual(0);
  });

  it("includes a populated threshold sweep", async () => {
    const out = await runBenchmark({
      dataset,
      engine: mockEngine,
      imageLoader: mockLoader,
      seed: 42,
    });
    expect(out.thresholds.length).toBeGreaterThan(1);
    for (const m of out.thresholds) {
      expect(typeof m.threshold).toBe("number");
      expect(typeof m.far).toBe("number");
      expect(typeof m.frr).toBe("number");
    }
  });

  it("is deterministic across runs (same seed)", async () => {
    const a = await runBenchmark({
      dataset,
      engine: mockEngine,
      imageLoader: mockLoader,
      seed: 42,
    });
    const b = await runBenchmark({
      dataset,
      engine: mockEngine,
      imageLoader: mockLoader,
      seed: 42,
    });
    expect(a.metrics).toEqual(b.metrics);
    expect(a.pairs).toEqual(b.pairs);
  });

  it("does NOT leak person IDs or image paths into the output", async () => {
    const out = await runBenchmark({
      dataset,
      engine: mockEngine,
      imageLoader: mockLoader,
      seed: 42,
    });
    const json = JSON.stringify(out);
    expect(json).not.toContain("alpha");
    expect(json).not.toContain("bravo");
    expect(json).not.toContain("charlie");
    expect(json).not.toContain("/data/");
    expect(json).not.toContain("ktp.jpg");
    expect(json).not.toContain("selfie.jpg");
  });

  it("does NOT leak raw embedding vectors into the output", async () => {
    const out = await runBenchmark({
      dataset,
      engine: mockEngine,
      imageLoader: mockLoader,
      seed: 42,
    });
    const json = JSON.stringify(out);
    // No Float32Array serialization markers should appear in the output.
    expect(json).not.toContain("Float32Array");
    // No raw embedding vector markers.
    expect(json).not.toContain('"vector":');
  });

  it("writes the engine / model metadata into the output", async () => {
    const out = await runBenchmark({
      dataset,
      engine: mockEngine,
      imageLoader: mockLoader,
      seed: 42,
    });
    expect(out.engine).toBe("mock-engine");
    expect(out.model).toBe("mock-orthogonal-3d");
    expect(out.dataset).toBe("private");
  });

  it("throws DATASET_EMPTY when the dataset has no persons", async () => {
    await expect(
      runBenchmark({
        dataset: { sourcePath: "/empty", persons: [] },
        engine: mockEngine,
        imageLoader: mockLoader,
        seed: 0,
      }),
    ).rejects.toBeInstanceOf(BenchmarkError);
  });

  it("throws INVALID_CONFIG when engine is missing", async () => {
    await expect(
      runBenchmark({
        dataset,
        // intentionally invalid
        engine: undefined as unknown as EmbeddingEngine,
        imageLoader: mockLoader,
        seed: 0,
      }),
    ).rejects.toMatchObject({
      code: BenchmarkErrorCode.INVALID_CONFIG,
    });
  });

  it("translates engine.embed failures into EMBED_FAILED", async () => {
    const failingEngine: EmbeddingEngine = {
      name: "failing",
      model: "failing",
      async load(): Promise<void> {},
      async embed(): Promise<Embedding> {
        throw new Error("simulated");
      },
    };
    await expect(
      runBenchmark({
        dataset,
        engine: failingEngine,
        imageLoader: mockLoader,
        seed: 0,
      }),
    ).rejects.toMatchObject({
      code: BenchmarkErrorCode.EMBED_FAILED,
    });
  });

  it("translates image loader failures into IMAGE_LOAD_FAILED", async () => {
    const failingLoader: ImageLoader = {
      async load(): Promise<ImageInput> {
        throw new Error("disk error");
      },
    };
    await expect(
      runBenchmark({
        dataset,
        engine: mockEngine,
        imageLoader: failingLoader,
        seed: 0,
      }),
    ).rejects.toMatchObject({
      code: BenchmarkErrorCode.IMAGE_LOAD_FAILED,
    });
  });
});
