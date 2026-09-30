/**
 * Test-only mock FaceEngine. NOT a real biometric engine. NEVER use this in
 * production. Its outputs are deterministic but have no relationship to any
 * real face recognition model.
 *
 * Exposed via the package subpath `@identa/core/testing`. NOT re-exported
 * from the package root, so importing the production `@identa/core` cannot
 * pull in this mock by accident.
 *
 * The mock tracks call order to mirror `verify()`'s exact pipeline:
 *   detect(documentImage) → first response
 *   detect(selfieImage)   → second response
 *   embed(documentFace)   → third response
 *   embed(selfieFace)    → fourth response
 *
 * Tests may configure each response independently. Sensible defaults make
 * the no-argument constructor equivalent to `MockFaceEngine.matched()`.
 */

import { FaceEngineError } from "./errors.js";
import type {
  Embedding,
  FaceDetection,
  FaceEngine,
  FaceInput,
  ImageInput,
  VerificationErrorCode,
} from "./types.js";

/** A response slot returns the value, throws a documented code, or throws a raw error. */
export type MockDetectResponse =
  | ReadonlyArray<FaceDetection>
  | { error: VerificationErrorCode }
  | { throw: unknown };

export type MockEmbedResponse =
  | Embedding
  | { error: VerificationErrorCode }
  | { throw: unknown };

export interface MockFaceEngineConfig {
  /** Default response for `detect(documentImage)` if no override is set. */
  documentDetections?: MockDetectResponse;
  /** Default response for `detect(selfieImage)` if no override is set. */
  selfieDetections?: MockDetectResponse;
  /** Default response for `embed(documentFace)` if no override is set. */
  documentEmbedding?: MockEmbedResponse;
  /** Default response for `embed(selfieFace)` if no override is set. */
  selfieEmbedding?: MockEmbedResponse;
  /**
   * Optional identifier reported via `FaceEngineError.engine` when the
   * mock throws a documented code. Helps tests assert that an error
   * came from the expected engine.
   */
  engineName?: string;
}

/**
 * Sentinel marker. Imported anywhere this mock is imported. Makes it
 * possible for linters / test runners to assert that a module is
 * referencing the mock rather than a real engine.
 */
export const MOCK_ENGINE_MARKER = "@identa/core/testing#MockFaceEngine" as const;

/** Default 100x100 RGBA image, fully opaque. */
const defaultImage = (): ImageInput => ({
  data: new Uint8Array(100 * 100 * 4).fill(255),
  width: 100,
  height: 100,
});

/** Default detection: a 50x50 box centered in a 100x100 image, full confidence. */
const defaultDetection = (): FaceDetection => ({
  box: { x: 25, y: 25, width: 50, height: 50 },
  confidence: 1,
});

/** Default embedding: 3-D unit vector. */
const defaultEmbedding = (values: number[] = [1, 0, 0]): Embedding => ({
  vector: Float32Array.from(values),
});

export class MockFaceEngine implements FaceEngine {
  /** Discriminator so tests / type-narrows can detect this is a mock. */
  public readonly [MOCK_ENGINE_MARKER] = true;
  public readonly engineName: string;

  private documentDetections: MockDetectResponse;
  private selfieDetections: MockDetectResponse;
  private documentEmbedding: MockEmbedResponse;
  private selfieEmbedding: MockEmbedResponse;

  private detectCallCount = 0;
  private embedCallCount = 0;

  constructor(config: MockFaceEngineConfig = {}) {
    this.engineName = config.engineName ?? "mock";
    this.documentDetections = config.documentDetections ?? [defaultDetection()];
    this.selfieDetections = config.selfieDetections ?? [defaultDetection()];
    this.documentEmbedding = config.documentEmbedding ?? defaultEmbedding();
    this.selfieEmbedding = config.selfieEmbedding ?? defaultEmbedding();
  }

  /** Returns a mock whose default embeddings make `verify()` produce `matched`. */
  static matched(extra?: MockFaceEngineConfig): MockFaceEngine {
    return new MockFaceEngine(extra);
  }

  /**
   * Returns a mock whose default embeddings are orthogonal so `verify()`
   * produces `not_matched` at any threshold above 0.
   */
  static notMatched(extra?: MockFaceEngineConfig): MockFaceEngine {
    return new MockFaceEngine({
      ...extra,
      documentEmbedding: defaultEmbedding([1, 0, 0]),
      selfieEmbedding: defaultEmbedding([0, 1, 0]),
    });
  }

  /** Returns a mock that reports no faces for both inputs → `FACE_NOT_DETECTED`. */
  static noFace(extra?: MockFaceEngineConfig): MockFaceEngine {
    return new MockFaceEngine({
      ...extra,
      documentDetections: [],
      selfieDetections: [],
    });
  }

  /** Returns a mock that reports multiple faces for both inputs → `MULTIPLE_FACES`. */
  static multipleFaces(extra?: MockFaceEngineConfig): MockFaceEngine {
    return new MockFaceEngine({
      ...extra,
      documentDetections: [defaultDetection(), defaultDetection()],
      selfieDetections: [defaultDetection(), defaultDetection()],
    });
  }

  /**
   * Returns a mock that throws `FaceEngineError(code)` from both `detect()`
   * and `embed()` calls. The code propagates to the verification result.
   * Override either side individually via `extra` if needed.
   */
  static engineError(
    code: VerificationErrorCode,
    extra?: MockFaceEngineConfig,
  ): MockFaceEngine {
    const errorResp = { error: code };
    return new MockFaceEngine({
      ...extra,
      documentDetections: extra?.documentDetections ?? errorResp,
      selfieDetections: extra?.selfieDetections ?? errorResp,
      documentEmbedding: extra?.documentEmbedding ?? errorResp,
      selfieEmbedding: extra?.selfieEmbedding ?? errorResp,
    });
  }

  /** Returns a mock that throws a raw, non-FaceEngineError. Collapses to `MODEL_ERROR`. */
  static rawError(cause: unknown, extra?: MockFaceEngineConfig): MockFaceEngine {
    return new MockFaceEngine({
      ...extra,
      documentDetections: { throw: cause },
    });
  }

  /** Update the document detection response after construction. */
  withDocumentDetections(response: MockDetectResponse): this {
    this.documentDetections = response;
    return this;
  }

  /** Update the selfie detection response after construction. */
  withSelfieDetections(response: MockDetectResponse): this {
    this.selfieDetections = response;
    return this;
  }

  /** Update the document embedding response after construction. */
  withDocumentEmbedding(response: MockEmbedResponse): this {
    this.documentEmbedding = response;
    return this;
  }

  /** Update the selfie embedding response after construction. */
  withSelfieEmbedding(response: MockEmbedResponse): this {
    this.selfieEmbedding = response;
    return this;
  }

  /** Returns the total number of `detect()` calls observed. */
  get detectCalls(): number {
    return this.detectCallCount;
  }

  /** Returns the total number of `embed()` calls observed. */
  get embedCalls(): number {
    return this.embedCallCount;
  }

  /** Returns the most recently received `ImageInput`. Useful for test assertions. */
  lastImageSeen(): ImageInput | undefined {
    return this.lastImage;
  }

  /** Returns the most recently received `FaceInput`. Useful for test assertions. */
  lastFaceSeen(): FaceInput | undefined {
    return this.lastFace;
  }

  private lastImage?: ImageInput;
  private lastFace?: FaceInput;

  async detect(image: ImageInput): Promise<ReadonlyArray<FaceDetection>> {
    this.lastImage = image;
    // Alternating routing (mod 2) so the mock stays correct across multiple
    // `verify()` invocations. Without modulo, a second `verify()` would start
    // routing from `count === 2`, mis-pairing document and selfie responses.
    const response = this.detectCallCount++ % 2 === 0
      ? this.documentDetections
      : this.selfieDetections;
    return resolveDetect(response, this.engineName);
  }

  async embed(face: FaceInput): Promise<Embedding> {
    this.lastFace = face;
    const response = this.embedCallCount++ % 2 === 0
      ? this.documentEmbedding
      : this.selfieEmbedding;
    return resolveEmbed(response, this.engineName);
  }
}

function resolveDetect(
  response: MockDetectResponse,
  engineName: string,
): ReadonlyArray<FaceDetection> {
  if (Array.isArray(response)) return response;
  if ("error" in response) {
    throw new FaceEngineError(response.error, `${engineName}: detect failed`, {
      engine: engineName,
    });
  }
  if ("throw" in response) throw response.throw;
  throw new Error("MockFaceEngine: invalid detect response shape");
}

function resolveEmbed(
  response: MockEmbedResponse,
  engineName: string,
): Embedding {
  if (response && "vector" in response && response.vector instanceof Float32Array) {
    return response;
  }
  if ("error" in response) {
    throw new FaceEngineError(response.error, `${engineName}: embed failed`, {
      engine: engineName,
    });
  }
  if ("throw" in response) throw response.throw;
  throw new Error("MockFaceEngine: invalid embed response shape");
}

/** Default synthetic images for use with the mock. NOT biometric data. */
export function mockDocumentImage(): ImageInput {
  return defaultImage();
}

export function mockSelfieImage(): ImageInput {
  return defaultImage();
}
