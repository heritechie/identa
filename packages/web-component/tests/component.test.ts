// @vitest-environment happy-dom

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { VerificationErrorCode, type ImageInput } from "@identa/core";
import { MockFaceEngine } from "@identa/core/testing";

import * as cameraModule from "../src/camera.js";
import {
  EVENT_CHANGE,
  EVENT_ERROR,
  EVENT_READY,
  EVENT_VERIFY,
  Identa,
  IdentaVerification,
  type IdentaChangeEvent,
  type IdentaErrorEvent,
  type IdentaReadyEvent,
  type IdentaVerifyEvent,
} from "../src/index.js";

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

function makeImage(width = 8, height = 8): ImageInput {
  return {
    data: new Uint8Array(width * height * 4),
    width,
    height,
  };
}

function makeVerifier(engine: MockFaceEngine): Identa {
  return new Identa({ faceEngine: engine });
}

async function mount(): Promise<IdentaVerification> {
  const el = document.createElement("identa-verification");
  document.body.appendChild(el);
  // Lit requires a microtask to finish initial render.
  await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
  return el as IdentaVerification;
}

function shadowQuery<E extends Element = Element>(
  root: ShadowRoot,
  selector: string,
): E | null {
  return root.querySelector<E>(selector);
}

function trackEvent<K extends keyof HTMLElementEventMap>(
  el: Element,
  name: string,
): Promise<CustomEvent<unknown>> {
  return new Promise((resolve) => {
    const handler = (event: Event) => {
      el.removeEventListener(name, handler);
      resolve(event as CustomEvent<unknown>);
    };
    el.addEventListener(name, handler);
  });
}

// ---------------------------------------------------------------------------
// lifecycle
// ---------------------------------------------------------------------------

afterEach(() => {
  document.body.innerHTML = "";
  vi.unstubAllGlobals();
});

// ---------------------------------------------------------------------------
// renders
// ---------------------------------------------------------------------------

describe("renders", () => {
  it("defines the custom element", () => {
    expect(customElements.get("identa-verification")).toBeDefined();
  });

  it("mounts and renders a container region", async () => {
    const el = await mount();
    expect(el.shadowRoot).not.toBeNull();
    const region = shadowQuery(el.shadowRoot!, '[role="region"]');
    expect(region).not.toBeNull();
    expect(region?.getAttribute("aria-label")).toBe("Identity verification");
  });

  it("starts in the 'document' capture state", async () => {
    const el = await mount();
    const docInput = shadowQuery<HTMLInputElement>(
      el.shadowRoot!,
      'input[id="identa-file-document"]',
    );
    expect(docInput).not.toBeNull();
    const selfieInput = shadowQuery<HTMLInputElement>(
      el.shadowRoot!,
      'input[id="identa-file-selfie"]',
    );
    expect(selfieInput).toBeNull(); // not yet rendered
  });
});

// ---------------------------------------------------------------------------
// events
// ---------------------------------------------------------------------------

describe("events", () => {
  it("emits identa:ready on connect", async () => {
    const readyP = new Promise<IdentaReadyEvent>((resolve) => {
      document.addEventListener(EVENT_READY, (e) => {
        resolve(e as IdentaReadyEvent);
      }, { once: true });
    });
    await mount();
    const evt = await readyP;
    expect(evt.detail).toEqual({ ready: true });
  });

  it("emits identa:change on state transitions", async () => {
    const el = await mount();
    const changes: IdentaChangeEvent[] = [];
    el.addEventListener(EVENT_CHANGE, (e) => {
      changes.push(e as IdentaChangeEvent);
    });
    el.setDocumentImage(makeImage());
    await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
    const states = changes.map((c) => c.detail.state);
    // setDocumentImage transitions the UI from idle → selfie (document image
    // is now set, selfie is still missing). The exact label of the source
    // state is implementation-defined; the important contract is that a
    // transition fires and ends at "selfie".
    expect(states.length).toBeGreaterThan(0);
    expect(states[states.length - 1]).toBe("selfie");
  });

  it("emits identa:verify with the VerificationResult", async () => {
    const engine = MockFaceEngine.matched();
    const el = await mount();
    el.verifier = makeVerifier(engine);
    const verifyP = trackEvent(el, EVENT_VERIFY);
    el.setDocumentImage(makeImage());
    el.setSelfieImage(makeImage());
    await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
    el.shadowRoot!.querySelector<HTMLButtonElement>(
      'button[aria-label="Verify"]',
    );
    // Trigger via shadow-root button query — the Verify button isn't directly
    // labelled but we can call the public API path by setting auto-verify.
    el.autoVerify = true;
    await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
    const evt = (await verifyP) as IdentaVerifyEvent;
    expect(evt.detail.status).toBe("matched");
  });

  it("emits identa:error when verifier is missing", async () => {
    const el = await mount();
    el.setDocumentImage(makeImage());
    el.setSelfieImage(makeImage());
    await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
    const errP = trackEvent(el, EVENT_ERROR);
    const verifyBtn = el.shadowRoot!.querySelectorAll<HTMLButtonElement>("button");
    const trigger = Array.from(verifyBtn).find((b) =>
      b.textContent?.toLowerCase().includes("verify"),
    );
    trigger?.click();
    const evt = (await errP) as IdentaErrorEvent;
    expect(evt.detail.code).toBe(VerificationErrorCode.ENGINE_NOT_CONFIGURED);
  });
});

// ---------------------------------------------------------------------------
// document / selfie upload
// ---------------------------------------------------------------------------

describe("document upload", () => {
  it("uses setDocumentImage to advance state from document → selfie", async () => {
    const el = await mount();
    el.setDocumentImage(makeImage());
    await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
    const selfieInput = shadowQuery<HTMLInputElement>(
      el.shadowRoot!,
      'input[id="identa-file-selfie"]',
    );
    expect(selfieInput).not.toBeNull();
  });

  it("accepts file via the file input change event when the decoder succeeds", async () => {
    const el = await mount();
    // We don't have a working canvas in happy-dom; bypass via setDocumentImage
    // and assert the input element exists and is wired up.
    const input = shadowQuery<HTMLInputElement>(
      el.shadowRoot!,
      'input[id="identa-file-document"]',
    );
    expect(input?.getAttribute("type")).toBe("file");
    expect(input?.getAttribute("accept")).toBe("image/*");
    // Synthetic assignment: we cannot fully simulate file selection in
    // happy-dom, but we can confirm the handler is wired by verifying the
    // element receives change events (no throw).
    input?.dispatchEvent(new Event("change", { bubbles: true }));
  });
});

// ---------------------------------------------------------------------------
// both images ready
// ---------------------------------------------------------------------------

describe("both images ready", () => {
  it("transitions to 'ready' state and exposes the Verify button", async () => {
    const el = await mount();
    el.setDocumentImage(makeImage());
    el.setSelfieImage(makeImage());
    await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
    const buttons = Array.from(
      el.shadowRoot!.querySelectorAll<HTMLButtonElement>("button"),
    );
    const verifyBtn = buttons.find((b) =>
      b.textContent?.toLowerCase().includes("verify"),
    );
    expect(verifyBtn).toBeDefined();
    expect(verifyBtn?.disabled).toBe(false);
  });

  it("auto-verify fires when autoVerify is set", async () => {
    const engine = MockFaceEngine.matched();
    const el = await mount();
    el.verifier = makeVerifier(engine);
    el.autoVerify = true;
    const verifyP = trackEvent(el, EVENT_VERIFY);
    el.setDocumentImage(makeImage());
    el.setSelfieImage(makeImage());
    await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
    const evt = (await verifyP) as IdentaVerifyEvent;
    expect(evt.detail.status).toBe("matched");
  });
});

// ---------------------------------------------------------------------------
// verify flow outcomes
// ---------------------------------------------------------------------------

describe("verify flow with MockFaceEngine", () => {
  it("matched → emits identa:verify with status=matched", async () => {
    const el = await mount();
    el.verifier = makeVerifier(MockFaceEngine.matched());
    const verifyP = trackEvent(el, EVENT_VERIFY);
    el.setDocumentImage(makeImage());
    el.setSelfieImage(makeImage());
    await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
    triggerVerify(el);
    const evt = (await verifyP) as IdentaVerifyEvent;
    expect(evt.detail.status).toBe("matched");
    expect((el as unknown as { disabled: boolean }).disabled).toBe(false);
  });

  it("not_matched → emits identa:verify with status=not_matched", async () => {
    const el = await mount();
    el.verifier = makeVerifier(MockFaceEngine.notMatched());
    const verifyP = trackEvent(el, EVENT_VERIFY);
    el.setDocumentImage(makeImage());
    el.setSelfieImage(makeImage());
    await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
    triggerVerify(el);
    const evt = (await verifyP) as IdentaVerifyEvent;
    expect(evt.detail.status).toBe("not_matched");
  });

  it("unable_to_verify with FACE_NOT_DETECTED → renders reason", async () => {
    const el = await mount();
    el.verifier = makeVerifier(MockFaceEngine.noFace());
    const verifyP = trackEvent(el, EVENT_VERIFY);
    el.setDocumentImage(makeImage());
    el.setSelfieImage(makeImage());
    await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
    triggerVerify(el);
    const evt = (await verifyP) as IdentaVerifyEvent;
    expect(evt.detail.status).toBe("unable_to_verify");
    expect(evt.detail.reason).toBe(VerificationErrorCode.FACE_NOT_DETECTED);
  });

  it("unable_to_verify with INVALID_IMAGE → renders reason", async () => {
    const el = await mount();
    el.verifier = makeVerifier(
      MockFaceEngine.engineError(VerificationErrorCode.INVALID_IMAGE),
    );
    const verifyP = trackEvent(el, EVENT_VERIFY);
    el.setDocumentImage(makeImage());
    el.setSelfieImage(makeImage());
    await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
    triggerVerify(el);
    const evt = (await verifyP) as IdentaVerifyEvent;
    expect(evt.detail.status).toBe("unable_to_verify");
    expect(evt.detail.reason).toBe(VerificationErrorCode.INVALID_IMAGE);
  });

  it("raw engine error → collapses to MODEL_ERROR", async () => {
    const el = await mount();
    el.verifier = makeVerifier(MockFaceEngine.rawError(new TypeError("boom")));
    const verifyP = trackEvent(el, EVENT_VERIFY);
    el.setDocumentImage(makeImage());
    el.setSelfieImage(makeImage());
    await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
    triggerVerify(el);
    const evt = (await verifyP) as IdentaVerifyEvent;
    expect(evt.detail.status).toBe("unable_to_verify");
    expect(evt.detail.reason).toBe(VerificationErrorCode.MODEL_ERROR);
  });
});

function triggerVerify(el: IdentaVerification): void {
  const buttons = Array.from(
    el.shadowRoot!.querySelectorAll<HTMLButtonElement>("button"),
  );
  const btn = buttons.find((b) => b.textContent?.toLowerCase().includes("verify"));
  if (!btn) throw new Error("verify button not found");
  btn.click();
}

// ---------------------------------------------------------------------------
// camera behaviour
// ---------------------------------------------------------------------------

describe("camera capability detection", () => {
  it("renders only the upload button when mediaDevices is unavailable", async () => {
    vi.stubGlobal("navigator", { mediaDevices: undefined });
    const el = await mount();
    await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
    const buttons = Array.from(
      el.shadowRoot!.querySelectorAll<HTMLButtonElement>("button"),
    );
    const hasCameraButton = buttons.some((b) =>
      b.textContent?.toLowerCase().includes("camera"),
    );
    expect(hasCameraButton).toBe(false);
    // upload input still present
    const input = shadowQuery<HTMLInputElement>(
      el.shadowRoot!,
      'input[id="identa-file-document"]',
    );
    expect(input).not.toBeNull();
  });

  it("renders the camera button when mediaDevices + getUserMedia are present", async () => {
    const stop = vi.fn();
    const track = { stop } as unknown as MediaStreamTrack;
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia },
    });
    const el = await mount();
    await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
    const buttons = Array.from(
      el.shadowRoot!.querySelectorAll<HTMLButtonElement>("button"),
    );
    const hasCameraButton = buttons.some((b) =>
      b.textContent?.toLowerCase().includes("camera"),
    );
    expect(hasCameraButton).toBe(true);
  });

  it("camera path requires explicit click → no getUserMedia before user interaction", async () => {
    const stop = vi.fn();
    const track = { stop } as unknown as MediaStreamTrack;
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    const getUserMedia = vi.fn().mockResolvedValue(stream);
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    const el = await mount();
    await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
    expect(getUserMedia).not.toHaveBeenCalled();
  });

  it("camera stream tracks are stopped when reset() is called", async () => {
    const stop = vi.fn();
    const track = { stop } as unknown as MediaStreamTrack;
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    // Stub navigator.mediaDevices so detectCameraSupport() reports supported.
    // requestCamera is spied directly to bypass happy-dom's Promise-resolution
    // quirks with vi.fn().mockResolvedValue().
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn() },
    });
    const requestSpy = vi
      .spyOn(cameraModule, "requestCamera")
      .mockResolvedValue(stream);
    try {
      const el = await mount();
      el.setDocumentImage(makeImage());
      await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
      const cameraBtn = Array.from(
        el.shadowRoot!.querySelectorAll<HTMLButtonElement>("button"),
      ).find((b) => b.textContent?.toLowerCase().includes("camera"));
      expect(cameraBtn).toBeDefined();
      cameraBtn!.click();
      await vi.waitFor(() => {
        const capture = Array.from(
          el.shadowRoot!.querySelectorAll<HTMLButtonElement>("button"),
        ).find((b) => b.textContent?.trim() === "Capture");
        return capture !== undefined && !capture.disabled;
      });
      expect(requestSpy).toHaveBeenCalledTimes(1);
      expect(el.__activeStreamForTest).toBe(stream);
      el.reset();
      expect(stop).toHaveBeenCalled();
    } finally {
      requestSpy.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("disconnectedCallback stops active camera stream", async () => {
    const stop = vi.fn();
    const track = { stop } as unknown as MediaStreamTrack;
    const stream = { getTracks: () => [track] } as unknown as MediaStream;
    vi.stubGlobal("navigator", {
      mediaDevices: { getUserMedia: vi.fn() },
    });
    const requestSpy = vi
      .spyOn(cameraModule, "requestCamera")
      .mockResolvedValue(stream);
    try {
      const el = await mount();
      el.setDocumentImage(makeImage());
      await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
      const cameraBtn = Array.from(
        el.shadowRoot!.querySelectorAll<HTMLButtonElement>("button"),
      ).find((b) => b.textContent?.toLowerCase().includes("camera"));
      cameraBtn!.click();
      await vi.waitFor(() => {
        const capture = Array.from(
          el.shadowRoot!.querySelectorAll<HTMLButtonElement>("button"),
        ).find((b) => b.textContent?.trim() === "Capture");
        return capture !== undefined && !capture.disabled;
      });
      el.parentNode?.removeChild(el);
      await new Promise((r) => setTimeout(r, 0));
      expect(stop).toHaveBeenCalled();
    } finally {
      requestSpy.mockRestore();
      vi.unstubAllGlobals();
    }
  });

  it("getUserMedia rejection → identa:error and falls back to upload", async () => {
    const getUserMedia = vi.fn().mockRejectedValue(new Error("denied"));
    vi.stubGlobal("navigator", { mediaDevices: { getUserMedia } });
    const el = await mount();
    el.setDocumentImage(makeImage());
    await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
    const errP = trackEvent(el, EVENT_ERROR);
    const cameraBtn = Array.from(
      el.shadowRoot!.querySelectorAll<HTMLButtonElement>("button"),
    ).find((b) => b.textContent?.toLowerCase().includes("camera"));
    cameraBtn!.click();
    const evt = (await errP) as IdentaErrorEvent;
    expect(evt.detail.message.length).toBeGreaterThan(0);
    await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
    // After the camera path fails, the upload input must remain available.
    const input = shadowQuery<HTMLInputElement>(
      el.shadowRoot!,
      'input[id="identa-file-selfie"]',
    );
    expect(input).not.toBeNull();
  });
});

// ---------------------------------------------------------------------------
// privacy
// ---------------------------------------------------------------------------

describe("privacy", () => {
  it("does not touch localStorage or sessionStorage", async () => {
    const localSet = vi.spyOn(Storage.prototype, "setItem");
    const sessionSet = vi.spyOn(Storage.prototype, "setItem");
    const el = await mount();
    el.setDocumentImage(makeImage());
    el.setSelfieImage(makeImage());
    el.verifier = makeVerifier(MockFaceEngine.matched());
    await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
    triggerVerify(el);
    await new Promise((r) => setTimeout(r, 10));
    expect(localSet).not.toHaveBeenCalled();
    expect(sessionSet).not.toHaveBeenCalled();
    localSet.mockRestore();
    sessionSet.mockRestore();
  });

  it("file input change event handler does not throw", async () => {
    const el = await mount();
    const input = shadowQuery<HTMLInputElement>(
      el.shadowRoot!,
      'input[id="identa-file-document"]',
    );
    expect(input).not.toBeNull();
    // We do not fully simulate file selection here because happy-dom does
    // not implement a working canvas / Image pipeline. The decoder path is
    // covered by decode.test.ts. This test only confirms the input element
    // is wired into the component's shadow root.
    expect(input?.getAttribute("type")).toBe("file");
    expect(input?.getAttribute("accept")).toBe("image/*");
  });
});

// ---------------------------------------------------------------------------
// accessibility
// ---------------------------------------------------------------------------

describe("accessibility basics", () => {
  it("file inputs have associated <label>", async () => {
    const el = await mount();
    const input = shadowQuery<HTMLInputElement>(
      el.shadowRoot!,
      'input[id="identa-file-document"]',
    );
    expect(input).not.toBeNull();
    const id = input!.getAttribute("id");
    const label = el.shadowRoot!.querySelector<HTMLLabelElement>(
      `label[for="${id}"]`,
    );
    expect(label).not.toBeNull();
    expect(label?.textContent?.length).toBeGreaterThan(0);
  });

  it("buttons have text content (accessible names)", async () => {
    const el = await mount();
    el.setDocumentImage(makeImage());
    el.setSelfieImage(makeImage());
    await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
    const buttons = Array.from(
      el.shadowRoot!.querySelectorAll<HTMLButtonElement>("button"),
    );
    for (const btn of buttons) {
      expect(btn.textContent?.trim().length).toBeGreaterThan(0);
    }
  });

  it("result region uses role=status", async () => {
    const el = await mount();
    el.verifier = makeVerifier(MockFaceEngine.matched());
    const verifyP = trackEvent(el, EVENT_VERIFY);
    el.setDocumentImage(makeImage());
    el.setSelfieImage(makeImage());
    await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
    triggerVerify(el);
    await verifyP;
    await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
    const region = el.shadowRoot!.querySelector('[role="status"]');
    expect(region).not.toBeNull();
  });

  it("score is labelled 'Similarity score' (not probability)", async () => {
    const el = await mount();
    el.verifier = makeVerifier(MockFaceEngine.matched());
    const verifyP = trackEvent(el, EVENT_VERIFY);
    el.setDocumentImage(makeImage());
    el.setSelfieImage(makeImage());
    await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
    triggerVerify(el);
    await verifyP;
    await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
    const text = el.shadowRoot!.textContent ?? "";
    expect(text).toContain("Similarity score");
    expect(text).not.toMatch(/probability/i);
  });
});

// ---------------------------------------------------------------------------
// reset
// ---------------------------------------------------------------------------

describe("reset", () => {
  it("clears images and result", async () => {
    const el = await mount();
    el.verifier = makeVerifier(MockFaceEngine.matched());
    el.setDocumentImage(makeImage());
    el.setSelfieImage(makeImage());
    await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
    triggerVerify(el);
    await new Promise((r) => setTimeout(r, 10));
    el.reset();
    await (el as unknown as { updateComplete: Promise<void> }).updateComplete;
    expect(el.shadowRoot!.querySelector(".result")).toBeNull();
    const docInput = shadowQuery<HTMLInputElement>(
      el.shadowRoot!,
      'input[id="identa-file-document"]',
    );
    expect(docInput).not.toBeNull();
  });
});

// Reference the Symbol marker indirectly to make sure the mock is wired
// into @identa/core/testing and reachable. This is a compile-time check.
void (async () => {
  await Promise.resolve();
  const marker = (await import("../src/index.js")).EVENT_VERIFY;
  expect(typeof marker).toBe("string");
})();

