export {
  VerificationErrorCode,
  type BoundingBox,
  type Embedding,
  type FaceDetection,
  type FaceEngine,
  type FaceInput,
  type ImageInput,
  type VerificationResult,
  type VerificationStatus,
  type VerifyInput,
  type VerifyOptions,
} from "./types.js";

export { verify } from "./verify.js";
export { cosineSimilarity, unableToVerify } from "./similarity.js";
export { applyThreshold, DEFAULT_THRESHOLD } from "./threshold.js";
export { FaceEngineError } from "./errors.js";
