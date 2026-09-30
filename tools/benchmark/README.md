# @identa/benchmark

Vendor-neutral face-embedding evaluation harness.

## Status

POC. No face model installed yet. The harness is ready to evaluate any
concrete `EmbeddingEngine` once one is selected.

## What it does

Runs a benchmark over a local dataset, computes FAR/FRR/TAR/TRR at a
primary threshold, sweeps a range of thresholds, and records inference
latency. Writes a privacy-clean JSON file with aggregate metrics only.

## What it does NOT do

- No detection or alignment — the engine is expected to take a
  pre-cropped face image.
- No video decoding — the `VideoFrameExtractor` interface is a stub
  for future implementation.
- No face model is bundled. Implementations of `EmbeddingEngine` are
  deferred until engine selection.
- No persistence of biometric data. Only aggregate metrics are written.

## Dataset

The dataset stays outside Git. Layout:

```text
/IDENTA_DATASET_PATH/
  person-001/
    ktp.jpg
    selfie.jpg
    video.mp4        # optional
  person-002/
    ...
```

`person-NNN/` directories are scanned by the engine adapter (not by
this package). The benchmark package only consumes a `Dataset` object
constructed elsewhere.

## Usage (post engine-selection)

```ts
import { runBenchmark, serializeBenchmark } from "@identa/benchmark";

const output = await runBenchmark({
  dataset,
  engine,         // implements EmbeddingEngine
  imageLoader,    // implements ImageLoader
  seed: 42,
});

await writeFile("results.json", serializeBenchmark(output));
```

## Tests

```bash
pnpm --filter @identa/benchmark test
```

Tests cover pair generation, person-disjoint splits, FAR/FRR/TAR/TRR,
threshold sweep monotonicity, latency statistics, JSON serialization
privacy guarantees, and runner end-to-end behavior with a deterministic
mock engine.
