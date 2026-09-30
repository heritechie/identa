/**
 * Browser-side entry for the Identa web component test fixture.
 *
 * Bundled by esbuild into a single ESM file. The bundle contains the
 * full Identa web component, `@identa/core`, and `MockFaceEngine`
 * (from `@identa/core/testing`) so the fixture runs in a plain browser
 * without a bundler.
 *
 * Exposes `window.__IDENTA_TEST__` with the test API Playwright drives.
 */

import { Identa } from "../../../packages/web-component/dist/index.js";
import { MockFaceEngine } from "../../../packages/core/dist/testing.js";

interface IdentaTestApi {
  readonly Identa: typeof Identa;
  readonly MockFaceEngine: typeof MockFaceEngine;
  readonly element: HTMLElement;
  setVerifier(engine: unknown): void;
  reset(): void;
  getState(): string;
  setMockEngine(kind: "matched" | "notMatched" | "noFace" | "engineError", code?: string): void;
}

declare global {
  interface Window {
    __IDENTA_TEST__?: IdentaTestApi;
  }
}

function init(): void {
  const element = document.querySelector(
    "identa-verification",
  ) as HTMLElement | null;
  if (!element) {
    window.dispatchEvent(new Event("identa-fixture-error"));
    return;
  }

  const api: IdentaTestApi = {
    Identa,
    MockFaceEngine,
    element,
    setVerifier(engine) {
      (element as unknown as { verifier: Identa | null }).verifier = new Identa({
        faceEngine: engine as never,
      });
    },
    reset() {
      (element as unknown as { reset: () => void }).reset();
    },
    getState() {
      return element.getAttribute("data-ui-state") ?? "unknown";
    },
    setMockEngine(kind, code) {
      let engine: InstanceType<typeof MockFaceEngine>;
      if (kind === "matched") engine = MockFaceEngine.matched();
      else if (kind === "notMatched") engine = MockFaceEngine.notMatched();
      else if (kind === "noFace") engine = MockFaceEngine.noFace();
      else if (kind === "engineError") {
        engine = MockFaceEngine.engineError(
          (code ?? "MODEL_ERROR") as Parameters<
            typeof MockFaceEngine.engineError
          >[0],
        );
      } else {
        engine = MockFaceEngine.matched();
      }
      api.setVerifier(engine);
    },
  };
  window.__IDENTA_TEST__ = api;
  window.dispatchEvent(new Event("identa-fixture-ready"));
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init, { once: true });
} else {
  init();
}
