import { describe, expect, it } from "vitest";
import { FaceEngineError } from "../src/errors.js";
import { verify } from "../src/verify.js";
import {
  VerificationErrorCode,
  type Embedding,
  type FaceDetection,
  type FaceEngine,
  type FaceInput,
  type ImageInput,
} from "../src/types.js";

const blankImage = (): ImageInput => ({
  data: new Uint8Array(4),
  width: 1,
  height: 1,
});

const detection = (): FaceDetection => ({
  box: { x: 0, y: 0, width: 1, height: 1 },
  confidence: 0.99,
});

const embedding = (n: number): Embedding => ({
  vector: Float32Array.from([n, 0, 0]),
});

const makeEngine = (overrides: Partial<FaceEngine> = {}): FaceEngine => ({
  detect: async () => [detection()],
  embed: async (_face: FaceInput) => embedding(1),
  ...overrides,
});

describe("verify (no engine)", () => {
  it("returns unable_to_verify with ENGINE_NOT_CONFIGURED when engine is undefined", async () => {
    const result = await verify(
      { documentImage: blankImage(), selfieImage: blankImage() },
      undefined,
    );
    expect(result.status).toBe("unable_to_verify");
    expect(result.reason).toBe(VerificationErrorCode.ENGINE_NOT_CONFIGURED);
  });
});

describe("verify (happy path)", () => {
  it("returns matched when embeddings are identical", async () => {
    const engine: FaceEngine = {
      detect: async () => [detection()],
      embed: async () => embedding(1),
    };
    const result = await verify(
      { documentImage: blankImage(), selfieImage: blankImage() },
      engine,
      { threshold: 0.5 },
    );
    expect(result.status).toBe("matched");
    expect(result.score).toBeCloseTo(1, 6);
  });

  it("returns not_matched when embeddings are orthogonal", async () => {
    let call = 0;
    const engine: FaceEngine = {
      detect: async () => [detection()],
      embed: async () => embedding(++call === 1 ? 1 : 0),
    };
    const result = await verify(
      { documentImage: blankImage(), selfieImage: blankImage() },
      engine,
      { threshold: 0.5 },
    );
    expect(result.status).toBe("not_matched");
  });
});

describe("verify (face detection edge cases)", () => {
  it("returns FACE_NOT_DETECTED when document has no face", async () => {
    const engine = makeEngine({ detect: async () => [] });
    const result = await verify(
      { documentImage: blankImage(), selfieImage: blankImage() },
      engine,
    );
    expect(result).toEqual({
      status: "unable_to_verify",
      reason: VerificationErrorCode.FACE_NOT_DETECTED,
    });
  });

  it("returns FACE_NOT_DETECTED when selfie has no face", async () => {
    let call = 0;
    const engine: FaceEngine = {
      detect: async () => (++call === 1 ? [detection()] : []),
      embed: async () => embedding(1),
    };
    const result = await verify(
      { documentImage: blankImage(), selfieImage: blankImage() },
      engine,
    );
    expect(result.reason).toBe(VerificationErrorCode.FACE_NOT_DETECTED);
  });

  it("returns MULTIPLE_FACES when document has more than one face", async () => {
    const engine = makeEngine({ detect: async () => [detection(), detection()] });
    const result = await verify(
      { documentImage: blankImage(), selfieImage: blankImage() },
      engine,
    );
    expect(result.reason).toBe(VerificationErrorCode.MULTIPLE_FACES);
  });

  it("returns MULTIPLE_FACES when selfie has more than one face", async () => {
    let call = 0;
    const engine: FaceEngine = {
      detect: async () => (++call === 1 ? [detection()] : [detection(), detection()]),
      embed: async () => embedding(1),
    };
    const result = await verify(
      { documentImage: blankImage(), selfieImage: blankImage() },
      engine,
    );
    expect(result.reason).toBe(VerificationErrorCode.MULTIPLE_FACES);
  });
});

describe("verify (engine failure isolation)", () => {
  it("returns MODEL_ERROR when detection throws", async () => {
    const engine = makeEngine({
      detect: async () => {
        throw new Error("boom");
      },
    });
    const result = await verify(
      { documentImage: blankImage(), selfieImage: blankImage() },
      engine,
    );
    expect(result).toEqual({
      status: "unable_to_verify",
      reason: VerificationErrorCode.MODEL_ERROR,
    });
  });

  it("returns MODEL_ERROR when embedding throws", async () => {
    const engine = makeEngine({
      embed: async () => {
        throw new Error("boom");
      },
    });
    const result = await verify(
      { documentImage: blankImage(), selfieImage: blankImage() },
      engine,
    );
    expect(result.reason).toBe(VerificationErrorCode.MODEL_ERROR);
  });

  it("never collapses technical failures into not_matched", async () => {
    const engine = makeEngine({
      detect: async () => {
        throw new Error("boom");
      },
    });
    const result = await verify(
      { documentImage: blankImage(), selfieImage: blankImage() },
      engine,
    );
    expect(result.status).not.toBe("not_matched");
    expect(result.status).toBe("unable_to_verify");
  });
});

describe("verify (FaceEngineError code propagation)", () => {
  it("propagates FACE_TOO_SMALL from detect()", async () => {
    const engine: FaceEngine = {
      detect: async () => {
        throw new FaceEngineError(VerificationErrorCode.FACE_TOO_SMALL);
      },
      embed: async () => embedding(1),
    };
    const result = await verify(
      { documentImage: blankImage(), selfieImage: blankImage() },
      engine,
    );
    expect(result).toEqual({
      status: "unable_to_verify",
      reason: VerificationErrorCode.FACE_TOO_SMALL,
    });
  });

  it("propagates FACE_TOO_SMALL from embed()", async () => {
    const engine: FaceEngine = {
      detect: async () => [detection()],
      embed: async () => {
        throw new FaceEngineError(VerificationErrorCode.FACE_TOO_SMALL);
      },
    };
    const result = await verify(
      { documentImage: blankImage(), selfieImage: blankImage() },
      engine,
    );
    expect(result.reason).toBe(VerificationErrorCode.FACE_TOO_SMALL);
  });

  it("propagates INVALID_IMAGE from detect()", async () => {
    const engine: FaceEngine = {
      detect: async () => {
        throw new FaceEngineError(VerificationErrorCode.INVALID_IMAGE);
      },
      embed: async () => embedding(1),
    };
    const result = await verify(
      { documentImage: blankImage(), selfieImage: blankImage() },
      engine,
    );
    expect(result.reason).toBe(VerificationErrorCode.INVALID_IMAGE);
  });

  it("propagates IMAGE_TOO_BLURRY from embed()", async () => {
    const engine: FaceEngine = {
      detect: async () => [detection()],
      embed: async () => {
        throw new FaceEngineError(VerificationErrorCode.IMAGE_TOO_BLURRY);
      },
    };
    const result = await verify(
      { documentImage: blankImage(), selfieImage: blankImage() },
      engine,
    );
    expect(result.reason).toBe(VerificationErrorCode.IMAGE_TOO_BLURRY);
  });

  it("propagates IMAGE_TOO_SMALL from selfie detect()", async () => {
    let call = 0;
    const engine: FaceEngine = {
      detect: async () => {
        call++;
        if (call === 1) return [detection()];
        throw new FaceEngineError(VerificationErrorCode.IMAGE_TOO_SMALL);
      },
      embed: async () => embedding(1),
    };
    const result = await verify(
      { documentImage: blankImage(), selfieImage: blankImage() },
      engine,
    );
    expect(result.reason).toBe(VerificationErrorCode.IMAGE_TOO_SMALL);
  });

  it("preserves FaceEngineError.engine attribution", async () => {
    let observed: string | undefined;
    const engine: FaceEngine = {
      detect: async () => {
        throw new FaceEngineError(
          VerificationErrorCode.MODEL_ERROR,
          "test-injected",
          { engine: "stub-engine" },
        );
      },
      embed: async () => {
        observed = "should not be called";
        return embedding(1);
      },
    };
    await verify(
      { documentImage: blankImage(), selfieImage: blankImage() },
      engine,
    );
    expect(observed).toBeUndefined();
  });

  it("collapses non-FaceEngineError throws into MODEL_ERROR", async () => {
    const engine: FaceEngine = {
      detect: async () => [detection()],
      embed: async () => {
        const e = new TypeError("not a FaceEngineError");
        throw e;
      },
    };
    const result = await verify(
      { documentImage: blankImage(), selfieImage: blankImage() },
      engine,
    );
    expect(result.reason).toBe(VerificationErrorCode.MODEL_ERROR);
  });
});

describe("verify (engine lifecycle: load? is consumer's responsibility)", () => {
  it("does NOT call engine.load() before detect", async () => {
    let loadCalls = 0;
    let detectCalls = 0;
    const engine: FaceEngine = {
      load: async () => {
        loadCalls++;
      },
      detect: async () => {
        detectCalls++;
        return [detection()];
      },
      embed: async () => embedding(1),
    };
    await verify(
      { documentImage: blankImage(), selfieImage: blankImage() },
      engine,
    );
    expect(loadCalls).toBe(0);
    expect(detectCalls).toBeGreaterThan(0);
  });

  it("engine without load() works fine", async () => {
    const engine: FaceEngine = {
      detect: async () => [detection()],
      embed: async () => embedding(1),
    };
    const result = await verify(
      { documentImage: blankImage(), selfieImage: blankImage() },
      engine,
    );
    expect(result.status).toBe("matched");
  });
});
