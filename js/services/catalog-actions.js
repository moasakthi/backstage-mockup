/** Writes catalog changes and refreshes the screen that called them. */
import { commit, getState } from "../store.js";
import { requestRefresh } from "../bus.js";
import { can } from "../rbac.js";

export function currentActor() {
  const state = getState();
  return state.users.find((user) => user.id === state.session.userId);
}

export function changeApp(slug, module, action, recipe, audit) {
  if (!can(module, action)) return "The role you are viewing cannot do this.";
  let error = "";
  commit((state) => {
    const app = state.apps.find((item) => item.slug === slug);
    if (!app) {
      error = "Application was not found.";
      return;
    }
    const result = recipe(app, state);
    if (result && result.ok === false) error = result.error;
  }, error ? null : audit);
  if (!error) requestRefresh();
  return error;
}

export function addApps(apps, detail) {
  commit((state) => {
    state.apps = [...apps, ...state.apps];
    state.drafts.onboard = null;
  }, { action: "Applications onboarded", detail, module: "applications" });
  requestRefresh();
}

export function saveDraft(draft) {
  commit((state) => {
    state.drafts.onboard = draft;
  });
}
