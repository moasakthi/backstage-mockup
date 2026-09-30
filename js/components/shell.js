/** Application chrome: light sidebar, search, role preview, profile. */
import { el } from "../dom.js";
import { getState, commit } from "../store.js";
import { can, effectiveRole } from "../rbac.js";
import { requestRefresh } from "../bus.js";
import { searchPortal } from "../services/search.js";
import { toast } from "./toast.js";

const NAV = [
  { id: "dashboard", label: "Dashboard", href: "#/dashboard", perm: "dashboard" },
  { id: "applications", label: "Applications", href: "#/applications", perm: "applications" },
  { id: "scorecard", label: "Scorecard", href: "#/scorecard", perm: "applications" },
  { id: "templates", label: "Template onboarding", href: "#/templates", perm: "applications" },
  { id: "access", label: "Access", href: "#/access/users", perm: "access" },
  { id: "audit", label: "Audit trail", href: "#/audit", perm: "audit" },
  { id: "settings", label: "Settings", href: "#/settings", perm: "settings" },
];

function logout() {
  commit((state) => {
    state.session.status = "anonymous";
  }, { action: "Signed out", detail: "Microsoft Entra ID session closed", module: "access" });
  location.hash = "#/login";
}

export function mountShell(root, route) {
  const state = getState();
  const user = state.users.find((item) => item.id === state.session.userId);
  const role = effectiveRole(state);
  const sidebar = el("aside", { class: "sidebar", id: "sidebar" }, [
    el("div", { class: "brand" }, [
      el("span", { class: "brand-mark" }, [
        el("img", { src: "./NH44_logo.png", alt: "NH44 IDP", width: "40", height: "40", decoding: "async" }),
      ]),
      el("div", {}, [el("strong", {}, "NH44 - IDP"), el("span", {}, "Internal Developer Portal")]),
    ]),
    el("nav", { class: "nav", "aria-label": "Primary" }, NAV.filter((item) => can(item.perm, "read")).map((item) => {
      const active = route.name === item.id || (item.id === "applications" && route.name === "app") || (item.id === "access" && route.name === "access");
      return el("a", { href: item.href, class: active ? "active" : "", "aria-current": active ? "page" : null }, item.label);
    })),
    el("div", { class: "side-foot" }, [
      el("button", { type: "button", class: "btn btn-ghost", onClick: logout }, "Log out"),
    ]),
  ]);

  const results = el("div", { class: "search-results", hidden: true });
  const input = el("input", {
    type: "search",
    placeholder: "Search applications, Jira, Confluence, people",
    "aria-label": "Global search",
    onInput: () => {
      const found = searchPortal(input.value, getState());
      results.replaceChildren(...(found.length
        ? found.map((item) => el("a", { href: item.hash }, [
          el("strong", {}, item.title),
          el("div", { class: "hint" }, `${item.type} · ${item.detail}`),
        ]))
        : [el("div", { class: "hint", style: "padding:10px 12px" }, input.value.trim().length < 2 ? "Type at least 2 characters" : "No matches")]));
      results.hidden = false;
    },
  });

  const menu = el("div", { class: "menu", hidden: true }, [
    el("a", { href: "#/profile" }, "Profile settings"),
    el("button", { type: "button", onClick: logout }, "Log out"),
  ]);

  const header = el("header", { class: "header" }, [
    el("button", {
      type: "button",
      class: "btn btn-ghost btn-sm menu-toggle",
      onClick: () => {
        sidebar.classList.toggle("is-open");
        document.getElementById("scrim")?.classList.toggle("show");
      },
    }, "Menu"),
    el("div", { class: "search" }, [input, results]),
    el("div", { class: "header-actions" }, [
      el("label", { class: "cluster hint" }, [
        "View as",
        el("select", {
          "aria-label": "View as role",
          value: state.session.viewAsRoleId,
          onChange: (event) => {
            const next = event.target.value;
            const picked = getState().roles.find((item) => item.id === next);
            commit((current) => {
              current.session.viewAsRoleId = next;
            }, { action: "View as role", detail: picked?.name || next, module: "access" });
            toast(`Viewing as ${picked?.name || "role"}`);
            requestRefresh();
          },
        }, state.roles.map((item) => el("option", { value: item.id }, item.name))),
      ]),
      el("div", { class: "profile" }, [
        el("button", {
          type: "button",
          class: "avatar",
          "aria-label": "Open profile menu",
          onClick: () => { menu.hidden = !menu.hidden; },
        }, user.name.slice(0, 1)),
        menu,
      ]),
    ]),
  ]);

  const outlet = el("div", { id: "outlet", class: "stack" });
  const main = el("main", { class: "main" }, [
    role.id !== "role-platform-admin"
      ? el("div", { class: "banner" }, `Viewing as ${role.name}. Sign-in identity remains ${user.name}.`)
      : null,
    outlet,
  ]);
  const scrim = el("div", { class: "scrim", id: "scrim", onClick: () => { sidebar.classList.remove("is-open"); scrim.classList.remove("show"); } });
  root.replaceChildren(scrim, el("div", { class: "app-shell" }, [sidebar, header, main]));
  return outlet;
}

document.addEventListener("click", (event) => {
  if (!event.target.closest(".search")) document.querySelectorAll(".search-results").forEach((node) => { node.hidden = true; });
  if (!event.target.closest(".profile")) document.querySelectorAll(".profile .menu").forEach((node) => { node.hidden = true; });
});

document.addEventListener("keydown", (event) => {
  if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
    event.preventDefault();
    document.querySelector(".search input")?.focus();
  }
});
