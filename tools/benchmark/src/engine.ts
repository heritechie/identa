/**
 * Vendor-neutral embedding engine interface for benchmarking.
 *
 * Distinct from @identa/core's FaceEngine: a FaceEngine combines detection,
 * alignment, and embedding; an EmbeddingEngine takes a pre-cropped face
 * image and produces a vector. This matches typical face-recognition
 * benchmarks, which assume faces are pre-extracted.
 *
 * Concrete implementations are deferred until engine selection.
 */

import type { Embedding, ImageInput } from "@identa/core";

export interface EmbeddingEngine {
  /** Short identifier for the runtime, e.g. "vladmandic-face-api". */
  readonly name: string;
  /** Identifier for the underlying model, e.g. "tinyFaceDetector+face_recognition". */
  readonly model: string;
  /** Initialize backend(s) and load model weights. */
  load(): Promise<void>;
  /** Produce an embedding vector from a face image. */
  embed(image: ImageInput): Promise<Embedding>;
  /** Optional teardown for backends / GPU resources. */
  dispose?(): Promise<void>;
}
