/**
 * Typed CustomEvent names and detail types for the
 * `<identa-verification>` element.
 *
 * Consumers subscribe via standard `addEventListener('identa:*', ...)`.
 * The `detail` payload is strongly typed via the `*Event` aliases here.
 *
 * All events are dispatched with `bubbles: true, composed: true` so they
 * cross the element's Shadow DOM boundary.
 */

import type { VerificationResult } from "@identa/core";

import type { ErrorPayload, UIState } from "./state.js";

export const EVENT_READY = "identa:ready";
export const EVENT_CHANGE = "identa:change";
export const EVENT_VERIFY = "identa:verify";
export const EVENT_ERROR = "identa:error";

export interface IdentaReadyDetail {
  readonly ready: true;
}

export interface IdentaChangeDetail {
  readonly state: UIState;
}

export type IdentaVerifyDetail = VerificationResult;

export type IdentaErrorDetail = ErrorPayload;

export type IdentaReadyEvent = CustomEvent<IdentaReadyDetail>;
export type IdentaChangeEvent = CustomEvent<IdentaChangeDetail>;
export type IdentaVerifyEvent = CustomEvent<IdentaVerifyDetail>;
export type IdentaErrorEvent = CustomEvent<IdentaErrorDetail>;

export type IdentaEventName =
  | typeof EVENT_READY
  | typeof EVENT_CHANGE
  | typeof EVENT_VERIFY
  | typeof EVENT_ERROR;
