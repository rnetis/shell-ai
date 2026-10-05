/**
 * Which frame is entitled to speak for which app.
 *
 * Mini-apps live in srcdoc iframes, so every one of them has the same origin
 * (`"null"`) and `postMessage` gives the parent nothing to check: an app id
 * inside a message is a claim, not an identity. Without a register, the first
 * malicious or merely curious mini-app could name a neighbour and read or
 * overwrite that app's storage bag through the bridge.
 *
 * The window that actually renders an app registers here on mount, and a
 * message is honored only when it comes from that exact window. A frame that
 * never registered — or one speaking for an app it does not own — is ignored.
 *
 * Deliberately dependency-free and DOM-free: the mapping is the security
 * decision, and it is unit-testable without a browser.
 */

const owners = new WeakMap<object, string>();

/** Record that `win` is the frame rendering `appId`. */
export function registerFrame(win: object | null | undefined, appId: string): void {
  if (win && typeof win === "object") owners.set(win, appId);
}

/** The app `source` is registered for, or null when it is not registered. */
export function frameOwner(source: unknown): string | null {
  if (typeof source !== "object" || source === null) return null;
  return owners.get(source) ?? null;
}

/** True only for the frame that renders `appId`. */
export function ownsFrame(source: unknown, appId: unknown): boolean {
  return typeof appId === "string" && appId.length > 0 && frameOwner(source) === appId;
}
