/**
 * Benchmark runner.
 *
 * Orchestrates: load engine → split persons (person-disjoint) → generate
 * pairs → for each pair load + embed → score via cosine → aggregate.
 *
 * Privacy rules enforced here:
 *   - Person IDs never appear in the returned output.
 *   - File paths never appear in the returned output.
 *   - Raw embeddings never appear in the returned output.
 *   - Only aggregate counts and metrics are returned.
 *   - The dataset label defaults to "private" to discourage accidental
 *     disclosure of internal dataset names.
 */

import type {
  Embedding,
  ImageInput,
} from "@identa/core";
import { cosineSimilarity } from "@identa/core";

import type {
  Dataset,
  ImageLoader,
} from "./dataset.js";
import { BenchmarkError, BenchmarkErrorCode } from "./errors.js";
import type { EmbeddingEngine } from "./engine.js";
import { computeMetrics, type Metrics, type ScoredPair } from "./metrics.js";
import { generatePairs, type Pair } from "./pairs.js";
import {
  filterPairsBySplit,
  splitPersons,
  type PersonSplitMap,
  type Split,
} from "./split.js";
import {
  computeLatencyStats,
  thresholdSweep,
  type LatencyStats,
} from "./threshold.js";

export interface BenchmarkConfig {
  readonly dataset: Dataset;
  readonly engine: EmbeddingEngine;
  readonly imageLoader: ImageLoader;
  /** Primary threshold for the headline `metrics` block. Default: 0.5. */
  readonly threshold?: number;
  /** Thresholds for the threshold sweep. Default: 0.20..0.90 step 0.05. */
  readonly thresholds?: ReadonlyArray<number>;
  readonly seed: number;
  /** Splits to evaluate. Default: ["test"]. */
  readonly splits?: ReadonlyArray<Split>;
  /** Ratios for [train, dev, test]. Default: [0.7, 0.15, 0.15]. */
  readonly ratios?: readonly [number, number, number];
  /** Opaque dataset label written to output. Default: "private". */
  readonly datasetLabel?: string;
}

export interface SplitPairCounts {
  readonly positive: number;
  readonly negative: number;
}

export interface BenchmarkOutput {
  readonly engine: string;
  readonly model: string;
  readonly dataset: string;
  readonly pairs: {
    readonly positive: number;
    readonly negative: number;
    readonly bySplit: Readonly<Record<Split, SplitPairCounts>>;
  };
  readonly metrics: Metrics;
  readonly thresholds: ReadonlyArray<Metrics>;
  readonly performance: LatencyStats;
}

const DEFAULT_THRESHOLD = 0.5;

function emptySplitCounts(): Record<Split, SplitPairCounts> {
  return {
    train: { positive: 0, negative: 0 },
    dev: { positive: 0, negative: 0 },
    test: { positive: 0, negative: 0 },
  };
}

function countByLabel(pairs: ReadonlyArray<Pair>): SplitPairCounts {
  let positive = 0;
  let negative = 0;
  for (const p of pairs) {
    if (p.label === "positive") positive++;
    else negative++;
  }
  return { positive, negative };
}

async function timedEmbed(
  image: ImageInput,
  engine: EmbeddingEngine,
  latencies: number[],
): Promise<Embedding> {
  const start = performance.now();
  let embedding: Embedding;
  try {
    embedding = await engine.embed(image);
  } catch (cause) {
    throw new BenchmarkError(
      BenchmarkErrorCode.EMBED_FAILED,
      `engine.embed failed: ${(cause as Error)?.message ?? String(cause)}`,
    );
  }
  latencies.push(performance.now() - start);
  return embedding;
}

async function loadAndEmbed(
  path: string,
  engine: EmbeddingEngine,
  loader: ImageLoader,
  latencies: number[],
): Promise<Embedding> {
  let image: ImageInput;
  try {
    image = await loader.load(path);
  } catch (cause) {
    throw new BenchmarkError(
      BenchmarkErrorCode.IMAGE_LOAD_FAILED,
      `failed to load image at ${path}: ${(cause as Error)?.message ?? String(cause)}`,
    );
  }
  return timedEmbed(image, engine, latencies);
}

export async function runBenchmark(
  config: BenchmarkConfig,
): Promise<BenchmarkOutput> {
  if (!config.engine) {
    throw new BenchmarkError(BenchmarkErrorCode.INVALID_CONFIG, "engine is required");
  }
  if (!config.dataset) {
    throw new BenchmarkError(BenchmarkErrorCode.INVALID_CONFIG, "dataset is required");
  }
  if (config.dataset.persons.length === 0) {
    throw new BenchmarkError(BenchmarkErrorCode.DATASET_EMPTY, "dataset has no persons");
  }

  await config.engine.load();

  const activeSplits: ReadonlyArray<Split> = config.splits ?? (["test"] as const);
  const splitMap: PersonSplitMap = splitPersons(
    config.dataset.persons.map((p) => p.id),
    {
      seed: config.seed,
      ...(config.ratios ? { ratios: config.ratios } : {}),
      splits: activeSplits,
    },
  );

  const allPairs = generatePairs(config.dataset.persons);
  if (allPairs.length === 0) {
    throw new BenchmarkError(
      BenchmarkErrorCode.NO_PAIRS_GENERATED,
      "no pairs were generated from the dataset",
    );
  }

  const scored: ScoredPair[] = [];
  const latencies: number[] = [];
  const bySplit = emptySplitCounts();

  for (const split of activeSplits) {
    const splitPairs = filterPairsBySplit(allPairs, splitMap, split);
    bySplit[split] = countByLabel(splitPairs);
    for (const pair of splitPairs) {
      const left = await loadAndEmbed(pair.imageA, config.engine, config.imageLoader, latencies);
      const right = await loadAndEmbed(pair.imageB, config.engine, config.imageLoader, latencies);
      let score: number;
      try {
        score = cosineSimilarity(left, right);
      } catch {
        throw new BenchmarkError(
          BenchmarkErrorCode.EMBED_FAILED,
          "failed to compute similarity (embedding length mismatch)",
        );
      }
      scored.push({ label: pair.label, score });
    }
  }

  if (scored.length === 0) {
    throw new BenchmarkError(
      BenchmarkErrorCode.NO_PAIRS_GENERATED,
      "no pairs matched the active splits",
    );
  }

  const headMetrics = computeMetrics(scored, config.threshold ?? DEFAULT_THRESHOLD);
  const sweep = thresholdSweep(scored, config.thresholds);

  const totalPositive = activeSplits.reduce(
    (acc, s) => acc + bySplit[s].positive,
    0,
  );
  const totalNegative = activeSplits.reduce(
    (acc, s) => acc + bySplit[s].negative,
    0,
  );

  return {
    engine: config.engine.name,
    model: config.engine.model,
    dataset: config.datasetLabel ?? "private",
    pairs: {
      positive: totalPositive,
      negative: totalNegative,
      bySplit,
    },
    metrics: headMetrics,
    thresholds: sweep,
    performance: computeLatencyStats(latencies),
  };
}
