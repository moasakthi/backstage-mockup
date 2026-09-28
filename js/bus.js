/** Decouples shell actions from the router so those modules do not import each other. */
export const bus = new EventTarget();

export function requestRefresh() {
  bus.dispatchEvent(new CustomEvent("refresh"));
}
