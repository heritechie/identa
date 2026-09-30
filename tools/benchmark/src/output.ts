/**
 * JSON output for benchmark results.
 *
 * Defensive serialization: drops anything that is not part of the documented
 * BenchmarkOutput shape, so a future field added to the output object cannot
 * accidentally leak PII (e.g. embeddings, paths, person IDs) into the file.
 */

import { writeFile } from "node:fs/promises";

import type { BenchmarkOutput } from "./runner.js";

export function serializeBenchmark(output: BenchmarkOutput): string {
  const safe = {
    engine: output.engine,
    model: output.model,
    dataset: output.dataset,
    pairs: {
      positive: output.pairs.positive,
      negative: output.pairs.negative,
      bySplit: {
        train: output.pairs.bySplit.train,
        dev: output.pairs.bySplit.dev,
        test: output.pairs.bySplit.test,
      },
    },
    metrics: output.metrics,
    thresholds: output.thresholds,
    performance: output.performance,
  };
  return JSON.stringify(safe, null, 2);
}

export async function writeBenchmark(
  output: BenchmarkOutput,
  path: string,
): Promise<void> {
  await writeFile(path, serializeBenchmark(output), { encoding: "utf8" });
}
