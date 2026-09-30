# Face Engine Contract

Status: current. Last updated with the `@identa/core` FaceEngine abstraction
introduced in this iteration.

## Scope

This document describes the boundary between `@identa/core` and any face
recognition engine. It is normative for both core maintainers and engine
implementers.

## Core principles

1. **`@identa/core` does not know which model is used.** The verification
   primitive is model-agnostic. It accepts a `FaceEngine` implementation
   and asks it to detect faces and embed them. Core performs no inference
   and ships no model weights.

2. **Detection and embedding are replaceable.** Any `FaceEngine`
   implementation can be swapped at the call site without changes to
   `@identa/core`. This includes detection-only engines, embedding-only
   engines, and engines that bundle both — as long as they implement the
   documented interface.

3. **Model weights are not part of `@identa/core`.** Core has zero runtime
   dependencies on any specific model, runtime, framework, or inference
   engine. Engine adapters (e.g. `engines/face`) live in separate packages.

4. **Model licensing is the responsibility of the selected engine/distribution.**
   The engine adapter that ships a specific model is responsible for
   documenting and verifying the license chain (model code license,
   pretrained weight license, training-data license) before any production
   use. `@identa/core` is agnostic to this.

5. **Technical benchmark results do not establish legal rights.** Public
   benchmarks (LFW, CFP-FP, AgeDB, etc.) are useful as a coarse filter and
   for relative comparison. They do not constitute license clearance for
   commercial use. A model with strong public benchmark results may
   still be unusable commercially if its training data is
   non-commercial-research-only.

6. **Production thresholds must come from evaluation.** The
   `DEFAULT_THRESHOLD = 0.5` in `@identa/core` is a placeholder for the
   POC. Production deployment must derive the threshold from a
   threshold sweep over Identa's private benchmark dataset, picking the
   operating point that satisfies Identa's FAR/FRR targets.

## The `FaceEngine` interface

`packages/core/src/types.ts`:

```ts
interface FaceEngine {
  /** Optional one-time async initialization. Consumer's responsibility. */
  load?(): Promise<void>;
  detect(image: ImageInput): Promise<ReadonlyArray<FaceDetection>>;
  embed(face: FaceInput): Promise<Embedding>;
}
```

The interface is intentionally minimal:

- **`detect`** receives raw RGBA pixels and returns bounding boxes plus
  optional landmarks. No preprocessing contract is specified — engines
  decide what to do with the input.
- **`embed`** receives the original `ImageInput` plus optional landmarks
  from the matching `detect()` result. The engine is responsible for
  cropping / aligning internally using those landmarks (or its own
  alignment logic if no landmarks were returned).
- **`load?`** is optional. If present, the consumer (e.g. a web component,
  a CLI, a server) is responsible for calling it before invoking
  `verify()`. Core does NOT call `load()` itself.

## Engine error signaling

Engines throw `FaceEngineError` from `detect()` or `embed()` to surface
specific failure modes. The `code` field carries a `VerificationErrorCode`
that propagates into `VerificationResult.reason`:

```ts
class FaceEngineError extends Error {
  readonly code: VerificationErrorCode;
  readonly engine: string | undefined;
  constructor(code, message?, options?: { engine?, cause? });
}
```

`verify()` catches `FaceEngineError` and propagates the code. Any other
thrown error is collapsed to `MODEL_ERROR`. This means engines SHOULD
prefer `FaceEngineError` for any failure that maps to a documented code,
and only use plain `Error` for genuinely unexpected failures.

Codes that engines can surface:

| Code | When an engine should throw it |
|---|---|
| `INVALID_IMAGE` | The input image cannot be decoded or is otherwise unusable. |
| `IMAGE_TOO_SMALL` | The input image resolution is too low to attempt detection. |
| `FACE_NOT_DETECTED` | Detection ran but found no face. (Core also surfaces this when `detect()` returns an empty array — engines may choose either signal.) |
| `MULTIPLE_FACES` | Detection ran and found more than one face. (Same as above — empty vs throw is engine choice for these two cases.) |
| `FACE_TOO_SMALL` | Detection succeeded but the face bounding box is too small for reliable embedding. |
| `IMAGE_TOO_BLURRY` | Image or aligned face is too blurry for reliable embedding. |
| `MODEL_ERROR` | Any non-engine-specific failure (math error, NaN, etc.). |

The split between "return empty array" and "throw `FACE_NOT_DETECTED`"
is engine choice. Core handles both identically.

## Lifecycle

`@identa/core` does not own the engine lifecycle.

```text
+--------------------+
|  consumer (UI, CLI)|
+--------------------+
        |
        | await engine.load?.()   <-- optional
        |
        v
+--------------------+
|  verify(input, eng)|
+--------------------+
        |
        +--> engine.detect(...)
        +--> engine.embed(...)
```

A long-lived consumer (web component, server) may load the engine once
and reuse it across many `verify()` calls. A short-lived consumer (CLI,
test) may construct the engine, optionally load, run verify, then
discard. Core does not impose either pattern.

## Engine adapter placement

Engine adapters live outside `@identa/core`. The repository structure
allocates `engines/face/` for a future engine adapter. The core package
never imports from `engines/face/` or any specific engine.

The benchmark harness (`tools/benchmark/`) deliberately uses a
different interface (`EmbeddingEngine`) because it benchmarks
embedding models on pre-cropped faces — a different concern from the
core verify pipeline, which handles detection + alignment + embedding.

## Test isolation

A test-only `MockFaceEngine` is shipped via the subpath
`@identa/core/testing`. It is NOT exported from the package root and
should NOT be imported by production code. The mock:

- is clearly labelled as a mock (`MOCK_ENGINE_MARKER` discriminator);
- produces deterministic but biometrically meaningless outputs;
- exposes factory methods (`matched`, `notMatched`, `noFace`,
  `multipleFaces`, `engineError`, `rawError`) for common test scenarios.

Tests that need a deterministic engine use `MockFaceEngine`. Production
code uses a real engine adapter (none currently shipped — production
engine selection is deferred per ADR 0001).

## Privacy rules

The FaceEngine contract inherits Identa's core privacy rules:

- Engines MUST NOT log images, embeddings, or identifying metadata by
  default.
- Engines MUST NOT persist anything to local storage, IndexedDB, or
  remote endpoints unless explicitly configured to do so.
- Engines returning results must not include identifying metadata in
  the embedding vector alone — embeddings are opaque numeric vectors.

These rules are not enforced by the type system; they are documented
expectations. Engine implementers are responsible for compliance.

## Extension points (intentionally not provided)

The following are deliberately NOT part of the contract:

- No provider / plugin registry. Consumers pick an engine and pass it
  directly to `verify()`.
- No model lifecycle hooks beyond `load?()`. No `unload()`, `warmup()`,
  `cache()`, etc.
- No engine-specific configuration surface. Each engine can take its
  own configuration in its constructor.
- No built-in image decoding. `ImageInput` is raw RGBA pixels; the
  consumer is responsible for decoding image formats before calling
  `verify()`.

These constraints keep the contract minimal and the core
framework-independent, per AGENTS.md §4.

## Verification of license / provenance

Before any engine is shipped as the Identa default, the following
must be checked and documented in
`docs/research/face-engine-evaluation.md` or successor:

1. Repository license (e.g. Apache-2.0, MIT).
2. Pretrained weight license.
3. Training-data license.
4. Whether the license chain permits commercial use.
5. Whether redistribution of the weights is permitted.
6. SHA256 / commit pinning for reproducible audits.

Public benchmark accuracy is NOT a substitute for license verification.
A model with strong accuracy that cannot be legally used is worse than
no model.

## Status

- Current: `@identa/core` defines the `FaceEngine` interface, the
  `FaceEngineError` class, and the `verify()` orchestration.
- Current: `MockFaceEngine` is shipped via `@identa/core/testing`
  for tests and research.
- Deferred: any production engine adapter. See ADR 0001.
