/** Applies the Lane theme from saved state. */
import { commit, getState } from "./store.js";
import { requestRefresh } from "./bus.js";

export function applyTheme() {
  document.documentElement.dataset.theme = getState().theme === "light" ? "light" : "dark";
}

export function setTheme(theme) {
  const next = theme === "light" ? "light" : "dark";
  commit((state) => {
    state.theme = next;
  }, { action: "Theme changed", detail: next, module: "settings" });
  applyTheme();
  requestRefresh();
}

export function toggleTheme() {
  setTheme(getState().theme === "dark" ? "light" : "dark");
}
