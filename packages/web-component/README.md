# @identa/web-component

Framework-independent Web Component for Identa face verification.

```html
<script type="module" src="./node_modules/@identa/web-component/dist/index.js"></script>
<identa-verification></identa-verification>
```

The element encapsulates the full local verification flow:
upload or camera capture for both the document image and a selfie,
running an injected `FaceEngine` against the captured frames, and
surfacing the result through DOM events. All image processing happens
client-side. No images, embeddings, or identity data leave the browser.

## Why a Web Component

The `<identa-verification>` element is a standards-based Custom
Element. It runs natively in every modern browser, including mobile
browsers and WebViews. It works in plain HTML, React, Vue, Svelte,
Angular, Next.js, etc., without framework-specific wrapper packages.
Framework wrappers are deliberately not provided at this stage.

## Why Lit (under the hood)

Lit is used for the small amount of reactive plumbing (declarative
templates, automatic re-render on property change, lifecycle hooks).
The public API is plain Custom Elements; consumers do not interact
with Lit. AGENTS.md §5 specifies "Lit if a component framework is
needed"; the component is non-trivial enough to benefit from Lit's
ergonomics while remaining a standard Web Component on the wire.

## Privacy

The element **never**:

- uploads images to a server
- persists images to `localStorage`, `sessionStorage`, or `IndexedDB`
- logs image bytes or embeddings
- stores identity data of any kind

Object URLs are revoked immediately after the underlying image is
decoded into the core `ImageInput` format. Camera `MediaStream` tracks
are stopped on capture, on cancel, and on `disconnectedCallback`.

## Camera capability detection

The element detects camera support on `connectedCallback` via
`navigator.mediaDevices?.getUserMedia`. Three cases:

| Condition | UI |
|---|---|
| `navigator.mediaDevices.getUserMedia` available | "Use camera" button appears next to the upload input |
| API unavailable (older browsers, some WebViews) | Upload input only |
| User denies permission, or `getUserMedia` throws | "Use camera" button stays available; on click the element emits `identa:error` and falls back to upload |
| Stream acquired but capture fails | Identical to above |

The element never attempts to bypass native permissions. If the
browser refuses permission, the user can still upload a file.

## Public API

### Element tag

```html
<identa-verification
  disabled
  auto-verify
></identa-verification>
```

### Attributes / properties

| Name | Attribute | Type | Default | Description |
|---|---|---|---|---|
| `verifier` | — | `Identa \| null` | `null` | Inject a pre-bound verifier. Must be set before verification can run. |
| `disabled` | `disabled` | `boolean` | `false` | Disables file inputs and buttons. Reflected to attribute. |
| `autoVerify` | `auto-verify` | `boolean` | `false` | When both images are set, run verification immediately. |

### Methods

```ts
element.setDocumentImage(imageInput | null): void;
element.setSelfieImage(imageInput | null): void;
element.reset(): void;
```

`reset()` clears both images, stops any active camera stream, and
returns the element to its initial state.

### Events

All events are `CustomEvent`s, dispatched with `bubbles: true,
composed: true` so they cross the element's Shadow DOM boundary.

| Event | `detail` | Fires when |
|---|---|---|
| `identa:ready` | `{ ready: true }` | The element has mounted and camera capability detection has completed |
| `identa:change` | `{ state: UIState }` | The internal UI state changes (idle / document / selfie / ready / verifying / result / error) |
| `identa:verify` | `VerificationResult` | Verification completes (matched / not_matched / unable_to_verify) |
| `identa:error` | `{ message, code? }` | A recoverable error occurs (image decode, camera permission, verifier missing, etc.) |

`VerificationResult` and `VerificationErrorCode` are typed by
`@identa/core`. Importing the event detail types alongside the
component is the recommended pattern:

```ts
import {
  IdentaVerification,
  type IdentaVerifyEvent,
  type IdentaErrorEvent,
} from "@identa/web-component";

element.addEventListener("identa:verify", (e) => {
  const result = (e as IdentaVerifyEvent).detail;
  if (result.status === "matched") {
    // ...
  }
});
```

## How consumers provide a FaceEngine

The element does not import any concrete face model. Consumers
construct an `Identa` instance with their engine of choice and assign
it to the element's `verifier` property.

```ts
import { Identa } from "@identa/web-component";
// Production example:
import { MyProductionFaceEngine } from "./my-engine";

const engine = new MyProductionFaceEngine({ /* … */ });
const verifier = new Identa({ faceEngine: engine });

const element = document.querySelector("identa-verification");
element.verifier = verifier;
```

The `Identa` class is a thin pre-binder that holds the engine plus a
default threshold. Production engines must come with verified
license chains (see `docs/research/face-engine-evaluation.md`).

## Test injection (development only)

During development and integration testing, the element can be driven
with the deterministic `MockFaceEngine` shipped by `@identa/core/testing`.
`MockFaceEngine` is **not** re-exported from this package; it is
imported directly from `@identa/core/testing`. The element does not
expose any "mock mode" — its `verifier` property accepts the standard
`FaceEngine` interface, which `MockFaceEngine` implements.

```ts
import { Identa } from "@identa/web-component";
import { MockFaceEngine } from "@identa/core/testing";

const engine = MockFaceEngine.matched();
const verifier = new Identa({ faceEngine: engine });
element.verifier = verifier;
```

## Browser support

- Standards-based Custom Element + Shadow DOM. All current Chromium,
  Firefox, and Safari (desktop and mobile, including iOS Safari and
  Android WebView) are supported.
- File upload via `<input type="file" accept="image/*">`. No JavaScript
  polyfill required.
- Camera capture via `navigator.mediaDevices.getUserMedia`. Falls
  back to upload automatically when unavailable.
- Image decoding via `<img>` + 2D canvas. Always available in modern
  browsers.

## Build

The package produces ES modules under `dist/`. Consumers can either
import the entry point (`@identa/web-component`) or copy `dist/`
into their own bundler.

## What this package is NOT

- **Not a face model.** All inference is delegated to the engine
  injected via the `verifier` property.
- **Not a backend.** No server, no API, no remote service is
  involved. All processing is local.
- **Not a form component.** The element handles the verification
  flow only; it does not integrate with authentication, billing,
  merchant dashboards, or any other business workflow.
- **Not a framework wrapper.** Consumers do not need to install
  React, Vue, Angular, Svelte, or any other UI framework.
