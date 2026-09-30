/** Boots the mockup: error boundary, saved state, router. */
import { installErrorBoundary } from "./errors.js";
import { bindState } from "./rbac.js";
import { getState, initStore } from "./store.js";
import { startRouter } from "./router.js";

installErrorBoundary();
bindState(getState);
initStore();
startRouter();
