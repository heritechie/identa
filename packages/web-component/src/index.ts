/**
 * Public surface of `@identa/web-component`.
 *
 * Consumers:
 *   - import `<identa-verification>` from this package; the custom
 *     element is registered as a side-effect of this module.
 *   - construct an `Identa` instance with a `FaceEngine` and assign it
 *     to the element's `verifier` property.
 *   - listen for `identa:ready`, `identa:change`, `identa:verify`, and
 *     `identa:error` events on the element.
 */

export { IdentaVerification } from "./component.js";
export { Identa, type IdentaOptions } from "./idena.js";
export {
  EVENT_READY,
  EVENT_CHANGE,
  EVENT_VERIFY,
  EVENT_ERROR,
  type IdentaEventName,
  type IdentaReadyEvent,
  type IdentaChangeEvent,
  type IdentaVerifyEvent,
  type IdentaErrorEvent,
  type IdentaReadyDetail,
  type IdentaChangeDetail,
  type IdentaVerifyDetail,
  type IdentaErrorDetail,
} from "./events.js";
export type { UIState, ErrorPayload } from "./state.js";
export {
  detectCameraSupport,
  requestCamera,
  stopStream,
  type CameraSupport,
  type CameraSupportReason,
  type CameraRequest,
} from "./camera.js";
export { decodeFile, captureFromVideo } from "./decode.js";
