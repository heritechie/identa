export type { EmbeddingEngine } from "./engine.js";

export type {
  Dataset,
  DatasetPerson,
  ImageKind,
  ImageLoader,
  VideoFrameExtractor,
} from "./dataset.js";
export { buildDataset } from "./dataset.js";

export type {
  Pair,
  PairLabel,
  PairType,
  PairGenerationOptions,
} from "./pairs.js";
export { generatePairs, countByLabel } from "./pairs.js";

export type { Split, SplitOptions, PersonSplitMap } from "./split.js";
export { splitPersons, filterPairsBySplit } from "./split.js";

export type {
  ScoredPair,
  ClassifiedPair,
  Metrics,
} from "./metrics.js";
export { computeMetrics, classify } from "./metrics.js";

export type { LatencyStats } from "./threshold.js";
export {
  computeLatencyStats,
  thresholdSweep,
  DEFAULT_THRESHOLDS,
} from "./threshold.js";

export type {
  BenchmarkConfig,
  BenchmarkOutput,
  SplitPairCounts,
} from "./runner.js";
export { runBenchmark } from "./runner.js";

export { serializeBenchmark, writeBenchmark } from "./output.js";
export { BenchmarkError, BenchmarkErrorCode } from "./errors.js";
