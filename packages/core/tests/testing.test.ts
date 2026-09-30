import { describe, expect, it } from "vitest";
import { FaceEngineError } from "../src/errors.js";
import { VerificationErrorCode } from "../src/types.js";
import {
  MOCK_ENGINE_MARKER,
  MockFaceEngine,
  mockDocumentImage,
  mockSelfieImage,
} from "../src/testing.js";

const baseInput = {
  documentImage: mockDocumentImage(),
  selfieImage: mockSelfieImage(),
};

describe("MockFaceEngine: defaults", () => {
  it("default constructor returns matched embeddings (1 face each, identical vectors)", async () => {
    const engine = MockFaceEngine.matched();
    const faces = await engine.detect(mockDocumentImage());
    expect(faces).toHaveLength(1);
    expect(faces[0]?.confidence).toBe(1);
    const e1 = await engine.embed({
      pixels: mockDocumentImage(),
    });
    const e2 = await engine.embed({
      pixels: mockSelfieImage(),
    });
    expect(Array.from(e1.vector)).toEqual([1, 0, 0]);
    expect(Array.from(e2.vector)).toEqual([1, 0, 0]);
  });
});

describe("MockFaceEngine: call order", () => {
  it("first detect() returns document response, second returns selfie response", async () => {
    const engine = new MockFaceEngine({
      documentDetections: [
        {
          box: { x: 0, y: 0, width: 10, height: 10 },
          confidence: 1,
        },
      ],
      selfieDetections: [
        {
          box: { x: 0, y: 0, width: 20, height: 20 },
          confidence: 1,
        },
      ],
    });
    const doc = await engine.detect(mockDocumentImage());
    const selfie = await engine.detect(mockSelfieImage());
    expect(doc[0]?.box.width).toBe(10);
    expect(selfie[0]?.box.width).toBe(20);
  });

  it("first embed() returns document response, second returns selfie response", async () => {
    const engine = new MockFaceEngine({
      documentEmbedding: { vector: Float32Array.from([1, 0, 0]) },
      selfieEmbedding: { vector: Float32Array.from([0, 1, 0]) },
    });
    const doc = await engine.embed({ pixels: mockDocumentImage() });
    const selfie = await engine.embed({ pixels: mockSelfieImage() });
    expect(Array.from(doc.vector)).toEqual([1, 0, 0]);
    expect(Array.from(selfie.vector)).toEqual([0, 1, 0]);
  });

  it("records detectCalls and embedCalls", async () => {
    const engine = MockFaceEngine.matched();
    await engine.detect(mockDocumentImage());
    await engine.detect(mockSelfieImage());
    await engine.embed({ pixels: mockDocumentImage() });
    await engine.embed({ pixels: mockSelfieImage() });
    expect(engine.detectCalls).toBe(2);
    expect(engine.embedCalls).toBe(2);
  });
});

describe("MockFaceEngine: factory methods", () => {
  it("matched() returns a mock that produces a matched result", async () => {
    const engine = MockFaceEngine.matched();
    const faces = await engine.detect(mockDocumentImage());
    expect(faces).toHaveLength(1);
  });

  it("notMatched() returns orthogonal embeddings", async () => {
    const engine = MockFaceEngine.notMatched();
    const doc = await engine.embed({ pixels: mockDocumentImage() });
    const selfie = await engine.embed({ pixels: mockSelfieImage() });
    expect(doc.vector[0]).toBe(1);
    expect(selfie.vector[0]).toBe(0);
    expect(selfie.vector[1]).toBe(1);
  });

  it("noFace() returns empty detections for both images", async () => {
    const engine = MockFaceEngine.noFace();
    expect(await engine.detect(mockDocumentImage())).toHaveLength(0);
    expect(await engine.detect(mockSelfieImage())).toHaveLength(0);
  });

  it("multipleFaces() returns 2 detections per image", async () => {
    const engine = MockFaceEngine.multipleFaces();
    expect(await engine.detect(mockDocumentImage())).toHaveLength(2);
    expect(await engine.detect(mockSelfieImage())).toHaveLength(2);
  });

  it("engineError(code) throws FaceEngineError from document detect", async () => {
    const engine = MockFaceEngine.engineError(VerificationErrorCode.FACE_TOO_SMALL);
    const promise = engine.detect(mockDocumentImage());
    await expect(promise).rejects.toBeInstanceOf(FaceEngineError);
    await expect(promise).rejects.toMatchObject({
      code: VerificationErrorCode.FACE_TOO_SMALL,
      engine: "mock",
    });
  });

  it("rawError(cause) throws the raw cause", async () => {
    const cause = new TypeError("not a FaceEngineError");
    const engine = MockFaceEngine.rawError(cause);
    await expect(engine.detect(mockDocumentImage())).rejects.toBe(cause);
  });
});

describe("MockFaceEngine: builder methods", () => {
  it("withDocumentDetections updates the response", async () => {
    const engine = MockFaceEngine.matched()
      .withDocumentDetections([]);
    // First detect call routes to documentDetections (counter even).
    expect(await engine.detect(mockDocumentImage())).toHaveLength(0);
  });

  it("withSelfieDetections updates the response", async () => {
    const engine = MockFaceEngine.matched()
      .withSelfieDetections([]);
    // Advance past the first (document) call, then assert on the selfie call.
    await engine.detect(mockDocumentImage());
    expect(await engine.detect(mockSelfieImage())).toHaveLength(0);
  });

  it("withDocumentEmbedding updates the response", async () => {
    const engine = MockFaceEngine.matched()
      .withDocumentEmbedding({ vector: Float32Array.from([0.5, 0.5, 0]) });
    // First embed call routes to documentEmbedding (counter even).
    const e = await engine.embed({ pixels: mockDocumentImage() });
    expect(e.vector[0]).toBe(0.5);
  });

  it("withSelfieEmbedding updates the response", async () => {
    const engine = MockFaceEngine.matched()
      .withSelfieEmbedding({ vector: Float32Array.from([0.5, 0.5, 0]) });
    // Advance past the first (document) call, then assert on the selfie call.
    await engine.embed({ pixels: mockDocumentImage() });
    const e = await engine.embed({ pixels: mockSelfieImage() });
    expect(e.vector[0]).toBe(0.5);
  });

  it("builder methods are chainable", () => {
    const engine = MockFaceEngine.matched()
      .withDocumentDetections([])
      .withSelfieDetections([])
      .withDocumentEmbedding({ vector: Float32Array.from([0]) })
      .withSelfieEmbedding({ vector: Float32Array.from([0]) });
    expect(engine).toBeInstanceOf(MockFaceEngine);
  });
});

describe("MockFaceEngine: marker and isolation", () => {
  it("carries the MOCK_ENGINE_MARKER discriminator", () => {
    const engine = MockFaceEngine.matched();
    expect(engine[MOCK_ENGINE_MARKER]).toBe(true);
  });

  it("engineName defaults to 'mock' and is propagated to errors", async () => {
    const engine = MockFaceEngine.engineError(VerificationErrorCode.MODEL_ERROR);
    try {
      await engine.detect(mockDocumentImage());
      throw new Error("expected throw");
    } catch (e) {
      expect(e).toBeInstanceOf(FaceEngineError);
      expect((e as FaceEngineError).engine).toBe("mock");
    }
  });

  it("engineName can be overridden via config", async () => {
    const engine = MockFaceEngine.engineError(
      VerificationErrorCode.MODEL_ERROR,
      { engineName: "my-mock" },
    );
    try {
      await engine.detect(mockDocumentImage());
      throw new Error("expected throw");
    } catch (e) {
      expect((e as FaceEngineError).engine).toBe("my-mock");
    }
  });
});

describe("MockFaceEngine: invalid response shapes", () => {
  it("detect() with a malformed response throws a generic error", async () => {
    const engine = new MockFaceEngine();
    // @ts-expect-error: deliberately bypass type check to test runtime guard
    engine.withDocumentDetections({ garbage: true });
    await expect(engine.detect(mockDocumentImage())).rejects.toThrow(/invalid detect response/);
  });

  it("embed() with a malformed response throws a generic error", async () => {
    const engine = new MockFaceEngine();
    // @ts-expect-error: deliberately bypass type check to test runtime guard
    engine.withDocumentEmbedding({ garbage: true });
    await expect(engine.embed({ pixels: mockDocumentImage() })).rejects.toThrow(/invalid embed response/);
  });
});

void baseInput; // documented as a typical input shape; not used in this file's assertions
