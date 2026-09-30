import type {
  Embedding,
  VerificationErrorCode,
  VerificationResult,
} from "./types.js";

/** Build an `unable_to_verify` result carrying a stable error code. */
export function unableToVerify(reason: VerificationErrorCode): VerificationResult {
  return { status: "unable_to_verify", reason };
}

/**
 * Cosine similarity in [-1, 1]. Returns 0 for zero vectors.
 * Identity is not a probability; threshold selection must be empirical.
 */
export function cosineSimilarity(a: Embedding, b: Embedding): number {
  const av = a.vector;
  const bv = b.vector;
  if (av.length !== bv.length) {
    throw new Error(`embedding length mismatch: ${av.length} vs ${bv.length}`);
  }
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < av.length; i++) {
    const x = av[i] ?? 0;
    const y = bv[i] ?? 0;
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}
