/**
 * Stable, machine-readable error class for face-engine failures.
 *
 * A `FaceEngine` throws this from `detect()` or `embed()` to surface a
 * specific `VerificationErrorCode`. `verify()` catches it and propagates
 * the code into the resulting `VerificationResult.reason`.
 *
 * Other thrown errors are caught and collapsed to `MODEL_ERROR`, so
 * engines SHOULD prefer `FaceEngineError` for any failure that maps to
 * a documented code in the `VerificationErrorCode` table.
 */

import type { VerificationErrorCode } from "./types.js";

export class FaceEngineError extends Error {
  public readonly code: VerificationErrorCode;
  public readonly engine: string | undefined;

  constructor(
    code: VerificationErrorCode,
    message?: string,
    options?: { engine?: string; cause?: unknown },
  ) {
    super(message ?? code, options?.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "FaceEngineError";
    this.code = code;
    this.engine = options?.engine;
  }
}
