/**
 * Real-browser smoke tests for `<identa-verification>`.
 *
 * These run in a real Chromium browser via Playwright. The fixture is
 * served by `tests/browser/fixture-server.mjs` and the JS bundle is
 * built by `tools/build-test-fixture.mjs`. Run `pnpm exec playwright test`
 * (after `pnpm build && node tools/build-test-fixture.mjs`).
 */

import { expect, test, type ConsoleMessage } from "@playwright/test";

const FIXTURE_URL = "/";

/**
 * Minimal 1×1 white PNG, used for the file-input tests. A real PNG that
 * the browser's native decoder accepts and renders to RGBA pixels.
 */
const PNG_1x1_WHITE = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
  0x49, 0x48, 0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01,
  0x08, 0x06, 0x00, 0x00, 0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00,
  0x0d, 0x49, 0x44, 0x41, 0x54, 0x78, 0x9c, 0x62, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00, 0x00, 0x00, 0x00,
  0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
]);

/** Wait for the fixture's test API to be available. */
async function waitForFixture(page: import("@playwright/test").Page) {
  await page.waitForFunction(() => (window as TestWindow).__IDENTA_TEST__ !== undefined, {
    timeout: 10_000,
  });
}

interface TestApi {
  readonly Identa: unknown;
  readonly MockFaceEngine: unknown;
  readonly element: HTMLElement;
  setVerifier(engine: unknown): void;
  reset(): void;
  getState(): string;
  setMockEngine(
    kind: "matched" | "notMatched" | "noFace" | "engineError",
    code?: string,
  ): void;
}

interface TestWindow extends Window {
  __IDENTA_TEST__?: TestApi;
}

// ---------------------------------------------------------------------------
// 1. Component loads in real Chromium; 2. Renders correctly
// ---------------------------------------------------------------------------

test.describe("loads and renders", () => {
  test("the custom element is defined and registered", async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await waitForFixture(page);
    const defined = await page.evaluate(() =>
      Boolean(customElements.get("identa-verification")),
    );
    expect(defined).toBe(true);
  });

  test("renders the container region with the expected aria-label", async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await waitForFixture(page);
    const label = await page
      .locator("identa-verification")
      .evaluate((el) => {
        const region = el.shadowRoot?.querySelector('[role="region"]');
        return region?.getAttribute("aria-label") ?? null;
      });
    expect(label).toBe("Identity verification");
  });

  test("renders the document file input with the expected type and accept", async ({
    page,
  }) => {
    await page.goto(FIXTURE_URL);
    await waitForFixture(page);
    const attrs = await page
      .locator("identa-verification")
      .evaluate((el) => {
        const input = el.shadowRoot?.querySelector<HTMLInputElement>(
          'input[id="identa-file-document"]',
        );
        return input
          ? {
              type: input.getAttribute("type"),
              accept: input.getAttribute("accept"),
              id: input.id,
            }
          : null;
      });
    expect(attrs).toEqual({
      type: "file",
      accept: "image/*",
      id: "identa-file-document",
    });
  });
});

// ---------------------------------------------------------------------------
// 3–5. File inputs + decoding; 6. ready state; 7. MockFaceEngine injection
// ---------------------------------------------------------------------------

test.describe("file input flow with MockFaceEngine", () => {
  test("document upload via real file input advances state to selfie", async ({
    page,
  }) => {
    await page.goto(FIXTURE_URL);
    await waitForFixture(page);

    // Inject MockFaceEngine so the component has something to call
    // when both images are present.
    await page.evaluate(() => {
      const api = (window as TestWindow).__IDENTA_TEST__!;
      const Mock = api.MockFaceEngine as new () => unknown;
      api.setVerifier(new (Mock as never)());
    });

    const fileInput = page.locator(
      'identa-verification >> input[id="identa-file-document"]',
    );
    await fileInput.setInputFiles({
      name: "document.png",
      mimeType: "image/png",
      buffer: PNG_1x1_WHITE,
    });

    // After the document image is decoded, the selfie input should appear.
    await expect(
      page.locator('identa-verification >> input[id="identa-file-selfie"]'),
    ).toHaveCount(1, { timeout: 5_000 });
  });

  test("both images uploaded → verify button becomes enabled", async ({ page }) => {
    await page.goto(FIXTURE_URL);
    await waitForFixture(page);
    await page.evaluate(() => {
      const api = (window as TestWindow).__IDENTA_TEST__!;
      const Mock = api.MockFaceEngine as new () => unknown;
      api.setVerifier(new (Mock as never)());
    });

    await page
      .locator('identa-verification >> input[id="identa-file-document"]')
      .setInputFiles({
        name: "document.png",
        mimeType: "image/png",
        buffer: PNG_1x1_WHITE,
      });
    await page
      .locator('identa-verification >> input[id="identa-file-selfie"]')
      .setInputFiles({
        name: "selfie.png",
        mimeType: "image/png",
        buffer: PNG_1x1_WHITE,
      });

    // Wait for the Verify button to become enabled.
    await page.waitForFunction(
      () => {
        const api = (window as TestWindow).__IDENTA_TEST__;
        if (!api) return false;
        const buttons = Array.from(
          api.element.shadowRoot?.querySelectorAll<HTMLButtonElement>(
            "button",
          ) ?? [],
        );
        const verifyBtn = buttons.find((b) =>
          b.textContent?.toLowerCase().includes("verify"),
        );
        return verifyBtn !== undefined && verifyBtn.disabled === false;
      },
      { timeout: 5_000 },
    );

    const disabled = await page.evaluate(() => {
      const api = (window as TestWindow).__IDENTA_TEST__!;
      const buttons = Array.from(
        api.element.shadowRoot?.querySelectorAll<HTMLButtonElement>(
          "button",
        ) ?? [],
      );
      return buttons.find((b) =>
        b.textContent?.toLowerCase().includes("verify"),
      )?.disabled;
    });
    expect(disabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// 8. Verify flow outcomes
// ---------------------------------------------------------------------------

test.describe("verify flow", () => {
  /** Drive the component into the "ready" state and wait for the
   *  Verify button to be enabled. Returns the page. */
  async function setupReadyState(
    page: import("@playwright/test").Page,
    engineKind:
      | "matched"
      | "notMatched"
      | "noFace"
      | "engineError" = "matched",
  ) {
    await page.goto(FIXTURE_URL);
    await waitForFixture(page);
    // Set verifier + images, wait for the verify button to render.
    await page.waitForFunction(
      ({ kind }) => {
        const api = (window as TestWindow).__IDENTA_TEST__;
        if (!api) return false;
        api.setMockEngine(kind);
        const el = api.element as unknown as {
          setDocumentImage(i: unknown): void;
          setSelfieImage(i: unknown): void;
          updateComplete: Promise<void>;
        };
        el.setDocumentImage({ data: new Uint8Array(64), width: 4, height: 4 });
        el.setSelfieImage({ data: new Uint8Array(64), width: 4, height: 4 });
        return el.updateComplete.then(() => {
          const buttons = Array.from(
            api.element.shadowRoot?.querySelectorAll<HTMLButtonElement>(
              "button",
            ) ?? [],
          );
          const btn = buttons.find((b) =>
            b.textContent?.toLowerCase().includes("verify"),
          );
          return btn !== undefined && !btn.disabled;
        });
      },
      { kind: engineKind, timeout: 10_000 } as never,
    );
  }

  async function clickVerifyAndAwaitResult(
    page: import("@playwright/test").Page,
  ): Promise<{ status: string; reason?: string }> {
    return page.evaluate(async () => {
      const api = (window as TestWindow).__IDENTA_TEST__!;
      return await new Promise<{ status: string; reason?: string }>(
        (resolve) => {
          api.element.addEventListener(
            "identa:verify",
            (e) => resolve((e as CustomEvent).detail),
            { once: true },
          );
          const buttons = Array.from(
            api.element.shadowRoot?.querySelectorAll<HTMLButtonElement>(
              "button",
            ) ?? [],
          );
          const verifyBtn = buttons.find((b) =>
            b.textContent?.toLowerCase().includes("verify"),
          );
          verifyBtn?.click();
        },
      );
    });
  }

  test("matched via MockFaceEngine.matched()", async ({ page }) => {
    await setupReadyState(page, "matched");
    const result = await clickVerifyAndAwaitResult(page);
    expect(result.status).toBe("matched");
  });

  test("not_matched via MockFaceEngine.notMatched()", async ({ page }) => {
    await setupReadyState(page, "notMatched");
    const result = await clickVerifyAndAwaitResult(page);
    expect(result.status).toBe("not_matched");
  });

  test("unable_to_verify with FACE_NOT_DETECTED via MockFaceEngine.noFace()", async ({
    page,
  }) => {
    await setupReadyState(page, "noFace");
    const result = await clickVerifyAndAwaitResult(page);
    expect(result.status).toBe("unable_to_verify");
    expect(result.reason).toBe("FACE_NOT_DETECTED");
  });
});

// ---------------------------------------------------------------------------
// 9. Camera unavailable → upload fallback (deterministic via init script)
// ---------------------------------------------------------------------------

test.describe("camera capability detection", () => {
  test("upload-only fallback when navigator.mediaDevices is unavailable", async ({
    context,
    page,
  }) => {
    // Remove mediaDevices before any page script runs.
    await context.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        get: () => undefined,
      });
    });
    await page.goto(FIXTURE_URL);
    await waitForFixture(page);

    // Camera button must NOT be rendered.
    const hasCameraButton = await page
      .locator("identa-verification")
      .evaluate((el) => {
        const buttons = Array.from(
          el.shadowRoot?.querySelectorAll<HTMLButtonElement>("button") ?? [],
        );
        return buttons.some((b) =>
          b.textContent?.toLowerCase().includes("camera"),
        );
      });
    expect(hasCameraButton).toBe(false);

    // Upload input is still rendered.
    const hasUpload = await page
      .locator("identa-verification")
      .evaluate((el) => {
        const input = el.shadowRoot?.querySelector(
          'input[id="identa-file-document"]',
        );
        return input !== null;
      });
    expect(hasUpload).toBe(true);
  });

  test("camera button is rendered when mediaDevices + getUserMedia are available", async ({
    page,
  }) => {
    // happy-dom/jsdom environments don't expose getUserMedia by default; in a
    // real Chromium browser it is present.
    await page.goto(FIXTURE_URL);
    await waitForFixture(page);

    const supported = await page.evaluate(() =>
      Boolean(navigator.mediaDevices && navigator.mediaDevices.getUserMedia),
    );
    expect(supported).toBe(true);

    // Camera button should be rendered next to the file input.
    const hasCameraButton = await page
      .locator("identa-verification")
      .evaluate((el) => {
        const buttons = Array.from(
          el.shadowRoot?.querySelectorAll<HTMLButtonElement>("button") ?? [],
        );
        return buttons.some((b) =>
          b.textContent?.toLowerCase().includes("camera"),
        );
      });
    expect(hasCameraButton).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// 10. No external network request during local verification
// ---------------------------------------------------------------------------

test.describe("network and storage isolation", () => {
  test("verification does not make any external network request", async ({
    page,
  }) => {
    await page.goto(FIXTURE_URL);
    await waitForFixture(page);

    const externalRequests: string[] = [];
    page.on("request", (req) => {
      const url = new URL(req.url());
      // The fixture server is on localhost. Anything else is external.
      if (url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
        externalRequests.push(req.url());
      }
    });

    await page.evaluate(async () => {
      const api = (window as TestWindow).__IDENTA_TEST__!;
      api.setMockEngine("matched");
      const el = api.element as unknown as {
        setDocumentImage(i: unknown): void;
        setSelfieImage(i: unknown): void;
      };
      el.setDocumentImage({ data: new Uint8Array(64), width: 4, height: 4 });
      el.setSelfieImage({ data: new Uint8Array(64), width: 4, height: 4 });
      await (
        api.element as unknown as { updateComplete: Promise<void> }
      ).updateComplete;
      await new Promise<void>((resolve) => {
        api.element.addEventListener(
          "identa:verify",
          () => resolve(),
          { once: true },
        );
        const buttons = Array.from(
          api.element.shadowRoot?.querySelectorAll<HTMLButtonElement>(
            "button",
          ) ?? [],
        );
        const verifyBtn = buttons.find((b) =>
          b.textContent?.toLowerCase().includes("verify"),
        );
        verifyBtn?.click();
      });
    });

    // Allow any trailing microtasks to flush before snapshotting the
    // request log.
    await page.waitForTimeout(50);

    expect(externalRequests).toEqual([]);
  });

  test("no localStorage, sessionStorage, or IndexedDB data is written", async ({
    page,
  }) => {
    await page.goto(FIXTURE_URL);
    await waitForFixture(page);

    // Snapshot storage state before any user action.
    const before = await page.evaluate(() => ({
      local: Object.keys(localStorage),
      session: Object.keys(sessionStorage),
    }));

    await page.evaluate(async () => {
      const api = (window as TestWindow).__IDENTA_TEST__!;
      api.setMockEngine("matched");
      const el = api.element as unknown as {
        setDocumentImage(i: unknown): void;
        setSelfieImage(i: unknown): void;
      };
      el.setDocumentImage({ data: new Uint8Array(64), width: 4, height: 4 });
      el.setSelfieImage({ data: new Uint8Array(64), width: 4, height: 4 });
      await (
        api.element as unknown as { updateComplete: Promise<void> }
      ).updateComplete;
      await new Promise<void>((resolve) => {
        api.element.addEventListener(
          "identa:verify",
          () => resolve(),
          { once: true },
        );
        const buttons = Array.from(
          api.element.shadowRoot?.querySelectorAll<HTMLButtonElement>(
            "button",
          ) ?? [],
        );
        const verifyBtn = buttons.find((b) =>
          b.textContent?.toLowerCase().includes("verify"),
        );
        verifyBtn?.click();
      });
    });

    const after = await page.evaluate(async () => {
      const dbs =
        typeof indexedDB.databases === "function"
          ? (await indexedDB.databases()).map((d) => d.name)
          : [];
      return {
        local: Object.keys(localStorage),
        session: Object.keys(sessionStorage),
        indexedDB: dbs,
      };
    });

    expect(after.local).toEqual(before.local);
    expect(after.session).toEqual(before.session);
    expect(after.indexedDB).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// 11. Result UI: labelled "Similarity score", never "probability"
// ---------------------------------------------------------------------------

test.describe("result UI labels", () => {
  test("score is labelled 'Similarity score' (not probability)", async ({
    page,
  }) => {
    await page.goto(FIXTURE_URL);
    await waitForFixture(page);
    const text = await page.evaluate(async () => {
      const api = (window as TestWindow).__IDENTA_TEST__!;
      api.setMockEngine("matched");
      const el = api.element as unknown as {
        setDocumentImage(i: unknown): void;
        setSelfieImage(i: unknown): void;
      };
      el.setDocumentImage({ data: new Uint8Array(64), width: 4, height: 4 });
      el.setSelfieImage({ data: new Uint8Array(64), width: 4, height: 4 });
      await (
        api.element as unknown as { updateComplete: Promise<void> }
      ).updateComplete;
      await new Promise<void>((resolve) => {
        api.element.addEventListener(
          "identa:verify",
          () => resolve(),
          { once: true },
        );
        const buttons = Array.from(
          api.element.shadowRoot?.querySelectorAll<HTMLButtonElement>(
            "button",
          ) ?? [],
        );
        const verifyBtn = buttons.find((b) =>
          b.textContent?.toLowerCase().includes("verify"),
        );
        verifyBtn?.click();
      });
      return api.element.shadowRoot?.textContent ?? "";
    });
    expect(text).toContain("Similarity score");
    expect(text).not.toMatch(/probability/i);
  });
});

// ---------------------------------------------------------------------------
// 12. Plain HTML page usage — the fixture loads from a plain HTML file.
// ---------------------------------------------------------------------------

test.describe("plain HTML usage", () => {
  test("the fixture page is a plain HTML file served over HTTP", async ({
    page,
    request,
  }) => {
    const root = await request.get(FIXTURE_URL);
    expect(root.status()).toBe(200);
    expect(root.headers()["content-type"]).toContain("text/html");

    const body = await root.text();
    expect(body).toContain("<identa-verification>");
    expect(body).toContain("fixture.bundle.js");
  });
});

// ---------------------------------------------------------------------------
// Quiet console warnings during the run.
// ---------------------------------------------------------------------------

test.beforeEach(({ page }) => {
  page.on("console", (msg: ConsoleMessage) => {
    // Suppress Lit's "dev mode" notice in test output; everything else surfaces.
    if (msg.text().includes("Lit is in dev mode")) return;
  });
});
