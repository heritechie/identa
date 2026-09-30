/**
 * Internal UI state machine for the `<identa-verification>` element.
 *
 * States are advanced by user actions and verification outcomes. The
 * component never persists state outside the element.
 */

import type { VerificationErrorCode } from "@identa/core";

export type UIState =
  | "idle"
  | "document"
  | "selfie"
  | "ready"
  | "verifying"
  | "result"
  | "error";

export interface ErrorPayload {
  readonly message: string;
  readonly code?: VerificationErrorCode;
}
