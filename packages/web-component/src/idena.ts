/**
 * Thin wrapper around `@identa/core`'s `verify()` that pre-binds a
 * `FaceEngine` and a default threshold.
 *
 * Consumers construct one `Identa` per verifier (per engine) and assign
 * it to the `<identa-verification>` element via the `verifier` property.
 * The component itself never knows which model is used.
 *
 * This is intentionally minimal: no caching, no batching, no plugin
 * registry. Future extensions (multiple engines, pre/post hooks,
 * telemetry) belong here, not in `@identa/core`.
 */

import {
  DEFAULT_THRESHOLD,
  verify,
  type FaceEngine,
  type VerifyInput,
  type VerifyOptions,
  type VerificationResult,
} from "@identa/core";

export interface IdentaOptions {
  readonly faceEngine: FaceEngine;
  readonly threshold?: number;
}

export class Identa {
  readonly #engine: FaceEngine;
  readonly #threshold: number;

  constructor(options: IdentaOptions) {
    if (!options.faceEngine) {
      throw new Error("Identa: `faceEngine` is required");
    }
    this.#engine = options.faceEngine;
    this.#threshold = options.threshold ?? DEFAULT_THRESHOLD;
  }

  /** Default threshold applied when an explicit threshold is not passed to `verify`. */
  get defaultThreshold(): number {
    return this.#threshold;
  }

  /** The underlying face engine. Exposed for introspection, not for direct use. */
  get faceEngine(): FaceEngine {
    return this.#engine;
  }

  async verify(
    input: VerifyInput,
    options: VerifyOptions = {},
  ): Promise<VerificationResult> {
    return verify(input, this.#engine, {
      ...options,
      threshold: options.threshold ?? this.#threshold,
    });
  }
}
