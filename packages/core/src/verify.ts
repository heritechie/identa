import { cosineSimilarity, unableToVerify } from "./similarity.js";
import { applyThreshold, DEFAULT_THRESHOLD } from "./threshold.js";
import {
  VerificationErrorCode,
  type Embedding,
  type FaceDetection,
  type FaceEngine,
  type FaceInput,
  type ImageInput,
  type VerifyInput,
  type VerifyOptions,
  type VerificationResult,
} from "./types.js";

/**
 * Run a verification pass: detect + embed on both images, score, threshold.
 *
 * Stateless: no I/O, no persistence. Images and embeddings are never logged.
 *
 * The face engine is injected so the core stays decoupled from any specific
 * model/runtime. Engine evaluation is tracked separately (engines/face).
 *
 * NOTE: MVP pipeline. MVP does not perform alignment inside core — the
 * engine is expected to crop/align from landmarks. A future revision may
 * add a quality-validation step (blur, brightness) before embedding.
 */
export async function verify(
  input: VerifyInput,
  engine: FaceEngine | undefined,
  options: VerifyOptions = {},
): Promise<VerificationResult> {
  if (!engine) {
    return unableToVerify(VerificationErrorCode.ENGINE_NOT_CONFIGURED);
  }

  const docFaces = await safeDetect(engine, input.documentImage);
  if (docFaces.kind === "error") return docFaces.result;
  if (docFaces.faces.length === 0) {
    return unableToVerify(VerificationErrorCode.FACE_NOT_DETECTED);
  }
  if (docFaces.faces.length > 1) {
    return unableToVerify(VerificationErrorCode.MULTIPLE_FACES);
  }

  const selfieFaces = await safeDetect(engine, input.selfieImage);
  if (selfieFaces.kind === "error") return selfieFaces.result;
  if (selfieFaces.faces.length === 0) {
    return unableToVerify(VerificationErrorCode.FACE_NOT_DETECTED);
  }
  if (selfieFaces.faces.length > 1) {
    return unableToVerify(VerificationErrorCode.MULTIPLE_FACES);
  }

  const docFace = docFaces.faces[0];
  const selfieFace = selfieFaces.faces[0];
  if (!docFace || !selfieFace) {
    return unableToVerify(VerificationErrorCode.MODEL_ERROR);
  }

  const docFaceInput = toFaceInput(input.documentImage, docFace);
  const selfieFaceInput = toFaceInput(input.selfieImage, selfieFace);

  const docEmbedding = await safeEmbed(engine, docFaceInput);
  if (docEmbedding.kind === "error") return docEmbedding.result;
  const selfieEmbedding = await safeEmbed(engine, selfieFaceInput);
  if (selfieEmbedding.kind === "error") return selfieEmbedding.result;

  let score: number;
  try {
    score = cosineSimilarity(docEmbedding.embedding, selfieEmbedding.embedding);
  } catch {
    return unableToVerify(VerificationErrorCode.MODEL_ERROR);
  }

  return applyThreshold(score, options.threshold ?? DEFAULT_THRESHOLD);
}

type DetectOutcome =
  | { kind: "ok"; faces: ReadonlyArray<FaceDetection> }
  | { kind: "error"; result: VerificationResult };

type EmbedOutcome =
  | { kind: "ok"; embedding: Embedding }
  | { kind: "error"; result: VerificationResult };

async function safeDetect(
  engine: FaceEngine,
  image: ImageInput,
): Promise<DetectOutcome> {
  try {
    const faces = await engine.detect(image);
    return { kind: "ok", faces };
  } catch {
    return {
      kind: "error",
      result: unableToVerify(VerificationErrorCode.MODEL_ERROR),
    };
  }
}

async function safeEmbed(
  engine: FaceEngine,
  face: FaceInput,
): Promise<EmbedOutcome> {
  try {
    const embedding = await engine.embed(face);
    return { kind: "ok", embedding };
  } catch {
    return {
      kind: "error",
      result: unableToVerify(VerificationErrorCode.MODEL_ERROR),
    };
  }
}

function toFaceInput(image: ImageInput, detection: FaceDetection): FaceInput {
  return {
    pixels: image,
    ...(detection.landmarks ? { landmarks: detection.landmarks } : {}),
  };
}
