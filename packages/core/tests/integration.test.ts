import { describe, expect, it } from "vitest";
import { verify } from "../src/verify.js";
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

describe("integration: matched path (KTP -> detect -> embed -> similarity -> threshold)", () => {
  it("produces matched at threshold 0.5 with identical embeddings", async () => {
    const engine = MockFaceEngine.matched();
    const result = await verify(baseInput, engine, { threshold: 0.5 });
    expect(result.status).toBe("matched");
    expect(result.score).toBeCloseTo(1, 6);
    expect(result.threshold).toBe(0.5);
    expect(result.reason).toBeUndefined();
  });

  it("exercises the full pipeline: 2 detect calls + 2 embed calls", async () => {
    const engine = MockFaceEngine.matched();
    await verify(baseInput, engine, { threshold: 0.5 });
    expect(engine.detectCalls).toBe(2);
    expect(engine.embedCalls).toBe(2);
  });
});

describe("integration: not_matched path", () => {
  it("produces not_matched with orthogonal embeddings", async () => {
    const engine = MockFaceEngine.notMatched();
    const result = await verify(baseInput, engine, { threshold: 0.5 });
    expect(result.status).toBe("not_matched");
    expect(result.score).toBe(0);
  });

  it("applies a custom threshold to a sub-threshold score", async () => {
    const engine = new MockFaceEngine({
      documentEmbedding: { vector: Float32Array.from([1, 0, 0]) },
      selfieEmbedding: { vector: Float32Array.from([0.7, 0.714, 0]) }, // cos = 0.7
    });
    const above = await verify(baseInput, engine, { threshold: 0.5 });
    expect(above.status).toBe("matched");
    const below = await verify(baseInput, engine, { threshold: 0.9 });
    expect(below.status).toBe("not_matched");
  });
});

describe("integration: detection edge cases", () => {
  it("FACE_NOT_DETECTED from document", async () => {
    const engine = MockFaceEngine.noFace();
    const result = await verify(baseInput, engine);
    expect(result).toEqual({
      status: "unable_to_verify",
      reason: VerificationErrorCode.FACE_NOT_DETECTED,
    });
  });

  it("MULTIPLE_FACES from document", async () => {
    const engine = MockFaceEngine.multipleFaces();
    const result = await verify(baseInput, engine);
    expect(result.reason).toBe(VerificationErrorCode.MULTIPLE_FACES);
  });

  it("FACE_NOT_DETECTED from selfie only (document ok)", async () => {
    const engine = new MockFaceEngine({
      selfieDetections: [],
    });
    const result = await verify(baseInput, engine);
    expect(result.reason).toBe(VerificationErrorCode.FACE_NOT_DETECTED);
  });

  it("MULTIPLE_FACES from selfie only (document ok)", async () => {
    const engine = new MockFaceEngine({
      selfieDetections: [
        {
          box: { x: 10, y: 10, width: 50, height: 50 },
          confidence: 0.9,
        },
        {
          box: { x: 80, y: 80, width: 30, height: 30 },
          confidence: 0.8,
        },
      ],
    });
    const result = await verify(baseInput, engine);
    expect(result.reason).toBe(VerificationErrorCode.MULTIPLE_FACES);
  });
});

describe("integration: FaceEngineError code propagation through MockFaceEngine", () => {
  it("INVALID_IMAGE from document detect -> unable_to_verify", async () => {
    const engine = MockFaceEngine.engineError(VerificationErrorCode.INVALID_IMAGE);
    const result = await verify(baseInput, engine);
    expect(result.reason).toBe(VerificationErrorCode.INVALID_IMAGE);
  });

  it("FACE_TOO_SMALL from document detect -> unable_to_verify", async () => {
    const engine = MockFaceEngine.engineError(VerificationErrorCode.FACE_TOO_SMALL);
    const result = await verify(baseInput, engine);
    expect(result.reason).toBe(VerificationErrorCode.FACE_TOO_SMALL);
  });

  it("IMAGE_TOO_BLURRY from embed -> unable_to_verify", async () => {
    const engine = new MockFaceEngine({
      documentEmbedding: { error: VerificationErrorCode.IMAGE_TOO_BLURRY },
    });
    const result = await verify(baseInput, engine);
    expect(result.reason).toBe(VerificationErrorCode.IMAGE_TOO_BLURRY);
  });

  it("raw (non-FaceEngineError) error -> MODEL_ERROR", async () => {
    const engine = MockFaceEngine.rawError(new TypeError("boom"));
    const result = await verify(baseInput, engine);
    expect(result.reason).toBe(VerificationErrorCode.MODEL_ERROR);
  });
});

describe("integration: MockFaceEngine observation API", () => {
  it("exposes the most recently seen ImageInput and FaceInput", async () => {
    const engine = MockFaceEngine.matched();
    await verify(baseInput, engine);
    expect(engine.lastImageSeen()).toBeDefined();
    expect(engine.lastFaceSeen()).toBeDefined();
  });

  it("exposes a MOCK_ENGINE_MARKER discriminator for test-time type narrowing", () => {
    const engine = MockFaceEngine.matched();
    expect(engine[MOCK_ENGINE_MARKER]).toBe(true);
  });
});
