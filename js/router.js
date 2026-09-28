/** Hash router. Pages load on demand. */
import { bus } from "./bus.js";
import { getState } from "./store.js";
import { can } from "./rbac.js";
import { toast } from "./components/toast.js";
import { showBoundary } from "./errors.js";
import { mountChat, hideChat } from "./components/chatbot.js";

const loaders = {
  login: () => import("./pages/login.js"),
  provision: () => import("./pages/provision.js"),
  dashboard: () => import("./pages/dashboard.js"),
  applications: () => import("./pages/applications.js"),
  app: () => import("./pages/app360.js"),
  onboard: () => import("./pages/onboard.js"),
  security: () => import("./pages/security.js"),
  quality: () => import("./pages/quality.js"),
  deployments: () => import("./pages/deployments.js"),
  documents: () => import("./pages/documents.js"),
  repos: () => import("./pages/repos.js"),
  access: () => import("./pages/access.js"),
  audit: () => import("./pages/audit.js"),
  settings: () => import("./pages/settings.js"),
  profile: () => import("./pages/profile.js"),
  missing: () => import("./pages/missing.js"),
  denied: () => import("./pages/missing.js"),
};

let running = false;
let again = false;
let cleanup = () => {};

export function parseLocation() {
  const raw = (location.hash || "#/login").slice(1);
  const [pathPart, queryPart] = raw.split("?");
  const path = pathPart.startsWith("/") ? pathPart : `/${pathPart}`;
  const parts = path.split("/").filter(Boolean);
  const query = Object.fromEntries(new URLSearchParams(queryPart || ""));
  const [a, b, c, d, e] = parts;
  let route = { name: "missing", title: "Not found · NH44 IDP", query, parts };
  if (!parts.length || a === "login") route = { name: "login", public: true, title: "Sign in · NH44 IDP", query };
  else if (a === "provision") route = { name: "provision", title: "Join NH44 IDP", query };
  else if (a === "dashboard") route = { name: "dashboard", perm: ["dashboard", "read"], title: "Dashboard · NH44 IDP", query };
  else if (a === "applications" && !b) route = { name: "applications", perm: ["applications", "read"], title: "Applications · NH44 IDP", query };
  else if (a === "applications") route = { name: "app", perm: ["applications", "read"], title: `${b} · NH44 IDP`, slug: b, tab: c || "overview", extra: d || "", more: e || "", query };
  else if (a === "onboard") route = { name: "onboard", perm: ["applications", "create"], title: "Onboard · NH44 IDP", query };
  else if (["security", "quality", "deployments", "documents", "repos"].includes(a)) route = { name: "retired", title: "Applications · NH44 IDP", query };
  else if (a === "access") route = { name: "access", perm: ["access", "read"], title: "Access · NH44 IDP", section: b || "users", query };
  else if (a === "audit") route = { name: "audit", perm: ["audit", "read"], title: "Audit · NH44 IDP", query };
  else if (a === "settings") route = { name: "settings", perm: ["settings", "read"], title: "Settings · NH44 IDP", query };
  else if (a === "profile") route = { name: "profile", perm: ["settings", "read"], title: "Profile · NH44 IDP", query };
  return route;
}

async function renderRoute() {
  cleanup();
  cleanup = () => {};
  const state = getState();
  let route = parseLocation();
  const session = state.session.status;
  if (route.name === "retired") {
    location.hash = "#/applications";
    return;
  }
  if (route.name === "login") {
    if (session === "active") { location.hash = "#/dashboard"; return; }
    if (session === "provisioning") { location.hash = "#/provision"; return; }
  } else if (session === "anonymous") {
    location.hash = "#/login";
    return;
  } else if (session === "provisioning" && route.name !== "provision") {
    location.hash = "#/provision";
    return;
  } else if (session === "active" && route.name === "provision") {
    location.hash = "#/dashboard";
    return;
  }
  if (route.perm && !can(route.perm[0], route.perm[1], state)) {
    toast("That area is outside the role you are viewing.");
    route = { ...route, name: "denied", title: "Restricted · NH44 IDP" };
  }
  document.title = route.title;
  const root = document.getElementById("app");
  const mod = await loaders[route.name]();
  if (typeof mod.destroy === "function") cleanup = () => mod.destroy();
  try {
    if (route.public || route.name === "provision") {
      hideChat();
      root.replaceChildren();
      await mod.render(root, route);
      return;
    }
    const { mountShell } = await import("./components/shell.js");
    const outlet = mountShell(root, route);
    await mod.render(outlet, route);
    mountChat();
  } catch (error) {
    showBoundary(error);
  }
}

function schedule() {
  if (running) {
    again = true;
    return;
  }
  running = true;
  renderRoute().finally(() => {
    running = false;
    if (again) {
      again = false;
      schedule();
    }
  });
}

export function startRouter() {
  bus.addEventListener("refresh", schedule);
  window.addEventListener("hashchange", schedule);
  if (!location.hash) location.hash = "#/login";
  else schedule();
}
