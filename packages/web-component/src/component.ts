/**
 * `<identa-verification>` — framework-independent Web Component.
 *
 * Standards-based. Uses Lit for the small amount of reactive plumbing
 * but does not depend on any framework. Shadow DOM encapsulates the
 * default styles. All browser-specific code stays in this package;
 * `@identa/core` remains framework-agnostic.
 *
 * Public API:
 *   - attribute/property `disabled` (boolean, reflected)
 *   - attribute/property `auto-verify` (boolean, reflected as `auto-verify`)
 *   - property `verifier` (Identa instance)
 *   - method `setDocumentImage(ImageInput | null)`
 *   - method `setSelfieImage(ImageInput | null)`
 *   - method `reset()`
 *
 * Events (bubbles + composed, detail strongly typed):
 *   - `identa:ready`
 *   - `identa:change`  → { state: UIState }
 *   - `identa:verify`  → VerificationResult
 *   - `identa:error`   → { message, code? }
 *
 * Privacy:
 *   - no fetch / HTTP upload
 *   - no localStorage / IndexedDB
 *   - no image data in logs or error messages
 *   - object URLs revoked immediately after decode
 *   - camera MediaStream tracks stopped on capture / cancel / disconnect
 */

import { LitElement, html, css, nothing, type PropertyValues, type TemplateResult } from "lit";
import type {
  ImageInput,
  VerificationErrorCode,
  VerificationResult,
} from "@identa/core";

import {
  detectCameraSupport,
  requestCamera,
  stopStream,
  type CameraSupport,
} from "./camera.js";
import { captureFromVideo, decodeFile } from "./decode.js";
import {
  EVENT_CHANGE,
  EVENT_ERROR,
  EVENT_READY,
  EVENT_VERIFY,
  type IdentaChangeEvent,
  type IdentaErrorEvent,
  type IdentaReadyEvent,
  type IdentaVerifyEvent,
} from "./events.js";
import { Identa } from "./idena.js";
import type { ErrorPayload, UIState } from "./state.js";

export class IdentaVerification extends LitElement {
  static override styles = css`
    :host {
      display: block;
      font: inherit;
      color: inherit;
      box-sizing: border-box;
    }
    *,
    *::before,
    *::after {
      box-sizing: inherit;
    }
    .container {
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      padding: 1rem;
      border: 1px solid #ccc;
      border-radius: 0.5rem;
    }
    .row {
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    .controls {
      display: flex;
      gap: 0.5rem;
      flex-wrap: wrap;
    }
    button {
      font: inherit;
      padding: 0.4rem 0.8rem;
      border: 1px solid #888;
      border-radius: 0.25rem;
      background: #f7f7f7;
      cursor: pointer;
    }
    button[disabled] {
      cursor: not-allowed;
      opacity: 0.6;
    }
    input[type="file"] {
      font: inherit;
    }
    video {
      width: 100%;
      max-width: 320px;
      background: #000;
      border-radius: 0.25rem;
    }
    .result {
      padding: 0.75rem;
      border-radius: 0.5rem;
    }
    .result[data-status="matched"] {
      background: #e6f7e6;
      border: 1px solid #2a8a2a;
    }
    .result[data-status="not_matched"] {
      background: #fde6e6;
      border: 1px solid #b22a2a;
    }
    .result[data-status="unable_to_verify"] {
      background: #fff7d6;
      border: 1px solid #b58a2a;
    }
    .sr-only {
      position: absolute;
      width: 1px;
      height: 1px;
      padding: 0;
      margin: -1px;
      overflow: hidden;
      clip: rect(0, 0, 0, 0);
      white-space: nowrap;
      border: 0;
    }
  `;

  static override properties = {
    verifier: { attribute: false },
    disabled: { type: Boolean, reflect: true },
    autoVerify: { attribute: "auto-verify", type: Boolean, reflect: true },
  } as const;

  /** Inject a pre-bound verifier (engine + default threshold). */
  verifier: Identa | null = null;

  /** Disable all user inputs and actions. */
  disabled = false;

  /** Automatically run verification as soon as both images are set. */
  autoVerify = false;

  // ----- internal state -----
  #uiState: UIState = "idle";
  #documentImage: ImageInput | null = null;
  #selfieImage: ImageInput | null = null;
  #result: VerificationResult | null = null;
  #error: ErrorPayload | null = null;
  #cameraSupport: CameraSupport = { supported: false, reason: "navigator-unavailable" };
  #activeStream: MediaStream | null = null;
  #cameraMode: "document" | "selfie" | null = null;
  #cameraInitializing = false;

  /**
   * Test-only accessor for the active camera stream. Returns the current
   * `MediaStream` if the camera is active, otherwise `null`. Used by the
   * component test suite to verify that `requestCamera()` resolved and
   * the stream was wired up. Not part of the public API.
   *
   * @internal
   */
  get __activeStreamForTest(): MediaStream | null {
    return this.#activeStream;
  }

  // ----- lifecycle -----
  override connectedCallback(): void {
    super.connectedCallback();
    this.#cameraSupport = detectCameraSupport();
    this.requestUpdate();
    queueMicrotask(() => this.#emitReady());
  }

  override disconnectedCallback(): void {
    super.disconnectedCallback();
    this.#stopActiveStream();
  }

  protected override updated(changed: PropertyValues): void {
    super.updated(changed);
    if (
      this.autoVerify &&
      this.#documentImage &&
      this.#selfieImage &&
      this.#uiState === "ready"
    ) {
      void this.#runVerify();
    }
  }

  // ----- public API -----

  /** Reset the component to its initial state. Releases any active camera stream. */
  reset(): void {
    this.#stopActiveStream();
    this.#documentImage = null;
    this.#selfieImage = null;
    this.#result = null;
    this.#error = null;
    this.#cameraMode = null;
    this.#setUiState("idle");
  }

  /** Set the document image programmatically (skips file decoding). */
  setDocumentImage(image: ImageInput | null): void {
    this.#documentImage = image;
    this.#recomputeReadyState();
  }

  /** Set the selfie image programmatically (skips file decoding). */
  setSelfieImage(image: ImageInput | null): void {
    this.#selfieImage = image;
    this.#recomputeReadyState();
  }

  // ----- state transitions -----
  #recomputeReadyState(): void {
    if (this.#documentImage && this.#selfieImage) {
      this.#setUiState("ready");
    } else if (this.#documentImage) {
      this.#setUiState("selfie");
    } else {
      this.#setUiState("document");
    }
    this.requestUpdate();
  }

  #setUiState(state: UIState): void {
    if (this.#uiState === state) return;
    this.#uiState = state;
    this.#emitChange({ state });
    this.requestUpdate();
  }

  // ----- file upload handlers -----
  #handleDocumentFile = async (event: Event): Promise<void> => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      const image = await decodeFile(file);
      this.setDocumentImage(image);
    } catch (cause) {
      this.#handleError(cause, "INVALID_IMAGE");
    }
  };

  #handleSelfieFile = async (event: Event): Promise<void> => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      const image = await decodeFile(file);
      this.setSelfieImage(image);
    } catch (cause) {
      this.#handleError(cause, "INVALID_IMAGE");
    }
  };

  // ----- camera handlers -----
  #handleStartCamera = async (
    target: "document" | "selfie",
  ): Promise<void> => {
    if (!this.#cameraSupport.supported) return;
    this.#cameraMode = target;
    this.#cameraInitializing = true;
    this.requestUpdate();
    let stream: MediaStream;
    try {
      stream = await requestCamera();
    } catch (cause) {
      // Camera failure is non-fatal: emit error and fall back to upload.
      // Do NOT transition to "error" UI state — the user can still upload.
      const message =
        cause instanceof Error ? cause.message : "camera unavailable";
      this.#emitError({ message });
      this.#cameraMode = null;
      this.#cameraInitializing = false;
      this.requestUpdate();
      return;
    }
    // Set activeStream synchronously before any awaits that might hang.
    this.#activeStream = stream;
    this.#cameraInitializing = false;
    this.requestUpdate();
    await this.updateComplete;
    const video = this.renderRoot.querySelector<HTMLVideoElement>("video");
    if (video) {
      // srcObject assignment can throw in non-real DOM environments that
      // don't accept the mock MediaStream shape. Best-effort: don't let a
      // preview failure abort the capture flow.
      try {
        video.srcObject = stream;
      } catch {
        // ignore — preview unavailable in this environment
      }
      // video.play() can hang in some environments (jsdom, headless). Don't
      // block on it; the capture path doesn't need playback to start.
      void video.play().catch(() => undefined);
    }
  };

  #handleCaptureFromCamera = async (): Promise<void> => {
    if (!this.#activeStream) return;
    try {
      const video =
        this.renderRoot.querySelector<HTMLVideoElement>("video");
      if (!video) throw new Error("internal: video element missing");
      const image = await captureFromVideo(video);
      if (this.#cameraMode === "document") {
        this.setDocumentImage(image);
      } else if (this.#cameraMode === "selfie") {
        this.setSelfieImage(image);
      }
    } catch (cause) {
      this.#handleError(cause);
    } finally {
      this.#stopActiveStream();
      this.#cameraMode = null;
      this.requestUpdate();
    }
  };

  #handleCancelCamera = (): void => {
    this.#stopActiveStream();
    this.#cameraMode = null;
    this.#recomputeReadyState();
  };

  #stopActiveStream(): void {
    stopStream(this.#activeStream);
    this.#activeStream = null;
  }

  // ----- verify -----
  #handleVerify = async (): Promise<void> => {
    await this.#runVerify();
  };

  async #runVerify(): Promise<void> {
    if (!this.verifier) {
      this.#handleError(new Error("verifier not configured"), "ENGINE_NOT_CONFIGURED");
      return;
    }
    if (!this.#documentImage || !this.#selfieImage) return;
    this.#stopActiveStream();
    this.#setUiState("verifying");
    this.#result = null;
    this.#error = null;
    try {
      const result = await this.verifier.verify({
        documentImage: this.#documentImage,
        selfieImage: this.#selfieImage,
      });
      this.#result = result;
      this.#setUiState("result");
      this.#emitVerify(result);
    } catch (cause) {
      this.#handleError(cause);
    }
  }

  // ----- error / events -----
  #handleError(cause: unknown, code?: VerificationErrorCode): void {
    const message =
      cause instanceof Error ? cause.message : "unknown error";
    const payload: ErrorPayload = code ? { message, code } : { message };
    this.#error = payload;
    this.#setUiState("error");
    this.#emitError(payload);
  }

  #emitReady(): void {
    const event: IdentaReadyEvent = new CustomEvent(EVENT_READY, {
      detail: { ready: true },
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  #emitChange(detail: IdentaChangeEvent["detail"]): void {
    const event: IdentaChangeEvent = new CustomEvent(EVENT_CHANGE, {
      detail,
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  #emitVerify(detail: IdentaVerifyEvent["detail"]): void {
    const event: IdentaVerifyEvent = new CustomEvent(EVENT_VERIFY, {
      detail,
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  #emitError(detail: IdentaErrorEvent["detail"]): void {
    const event: IdentaErrorEvent = new CustomEvent(EVENT_ERROR, {
      detail,
      bubbles: true,
      composed: true,
    });
    this.dispatchEvent(event);
  }

  // ----- render -----
  protected override render(): TemplateResult {
    return html`
      <div class="container" role="region" aria-label="Identity verification">
        ${this.#renderStatus()}
        ${this.#renderBody()}
      </div>
    `;
  }

  #renderStatus(): TemplateResult {
    const label = this.#statusLabel();
    return html`
      <p class="sr-only" role="status" aria-live="polite">${label}</p>
      <p>${label}</p>
    `;
  }

  #statusLabel(): string {
    switch (this.#uiState) {
      case "idle":
        return "Ready to begin identity verification.";
      case "document":
        return "Document image required.";
      case "selfie":
        return "Selfie image required.";
      case "ready":
        return "Both images ready. You may verify.";
      case "verifying":
        if (this.#cameraMode) return "Camera active.";
        return "Verifying…";
      case "result":
        return this.#resultLabel(this.#result);
      case "error":
        return `Error: ${this.#error?.message ?? "unknown"}`;
    }
  }

  #resultLabel(result: VerificationResult | null): string {
    if (!result) return "Verification complete.";
    switch (result.status) {
      case "matched":
        return "Match confirmed.";
      case "not_matched":
        return "No match.";
      case "unable_to_verify":
        return result.reason
          ? `Verification failed: ${result.reason}.`
          : "Verification failed.";
    }
  }

  #renderBody(): TemplateResult {
    if (this.#cameraMode) return this.#renderCamera();
    switch (this.#uiState) {
      case "idle":
      case "document":
        return this.#renderCapture("document");
      case "selfie":
      case "ready":
        return html`
          ${this.#renderCapture("selfie")} ${this.#renderVerifyArea()}
        `;
      case "verifying":
        return html`<p role="status">Verifying…</p>`;
      case "result":
        return this.#renderResult();
      case "error":
        return this.#renderError();
    }
  }

  #renderCapture(target: "document" | "selfie"): TemplateResult {
    const label = target === "document" ? "Document" : "Selfie";
    const onChange =
      target === "document"
        ? this.#handleDocumentFile
        : this.#handleSelfieFile;
    return html`
      <div class="row">
        <label for="identa-file-${target}">${label} image</label>
        <input
          id="identa-file-${target}"
          type="file"
          accept="image/*"
          ?disabled=${this.disabled}
          @change=${onChange}
        />
        ${this.#cameraSupport.supported
          ? html`
              <button
                type="button"
                ?disabled=${this.disabled}
                @click=${() => this.#handleStartCamera(target)}
              >
                Use camera for ${label.toLowerCase()}
              </button>
            `
          : nothing}
      </div>
    `;
  }

  #renderVerifyArea(): TemplateResult {
    return html`
      <div class="row">
        <button
          type="button"
          ?disabled=${this.disabled ||
          !this.#documentImage ||
          !this.#selfieImage}
          @click=${this.#handleVerify}
        >
          Verify
        </button>
      </div>
    `;
  }

  #renderCamera(): TemplateResult {
    const label = this.#cameraMode === "document" ? "document" : "selfie";
    return html`
      <div class="row">
        <p>Capturing ${label} from camera.</p>
        <video autoplay playsinline muted aria-label="Camera preview"></video>
        <div class="controls">
          <button
            type="button"
            ?disabled=${this.#cameraInitializing}
            @click=${this.#handleCaptureFromCamera}
          >
            Capture
          </button>
          <button type="button" @click=${this.#handleCancelCamera}>
            Cancel
          </button>
        </div>
      </div>
    `;
  }

  #renderResult(): TemplateResult {
    const result = this.#result;
    if (!result) return html``;
    const score =
      typeof result.score === "number"
        ? html`<p>Similarity score: ${result.score.toFixed(3)}</p>`
        : nothing;
    const threshold =
      typeof result.threshold === "number"
        ? html`<p>Threshold: ${result.threshold.toFixed(3)}</p>`
        : nothing;
    const reason =
      result.status === "unable_to_verify" && result.reason
        ? html`<p>Reason: ${result.reason}</p>`
        : nothing;
    return html`
      <div class="result" data-status=${result.status} role="status" aria-live="polite">
        <p>${this.#resultLabel(result)}</p>
        ${score} ${threshold} ${reason}
        <div class="controls">
          <button type="button" @click=${this.reset}>Start over</button>
        </div>
      </div>
    `;
  }

  #renderError(): TemplateResult {
    return html`
      <div class="result" data-status="unable_to_verify" role="alert">
        <p>${this.#error?.message ?? "An error occurred."}</p>
        ${this.#error?.code
          ? html`<p>Code: ${this.#error.code}</p>`
          : nothing}
        <div class="controls">
          <button type="button" @click=${this.reset}>Start over</button>
        </div>
      </div>
    `;
  }
}

if (
  typeof customElements !== "undefined" &&
  !customElements.get("identa-verification")
) {
  customElements.define("identa-verification", IdentaVerification);
}

declare global {
  interface HTMLElementTagNameMap {
    "identa-verification": IdentaVerification;
  }
}
