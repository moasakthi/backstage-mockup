/** Application catalog. Grid and list read the same records the 360 view uses. */
import { el } from "../dom.js";
import { commit, getState } from "../store.js";
import { can } from "../rbac.js";
import { requestRefresh } from "../bus.js";
import { pageHeader, pill, healthTone, emptyState } from "../components/ui.js";

let query = "";
let domain = "All";
let layout = "";

export function render(container) {
  const state = getState();
  if (!layout) layout = state.ui.appsLayout || "grid";
  const domains = ["All", ...new Set(state.apps.map((app) => app.domain))];
  const filtered = state.apps.filter((app) => {
    const blob = `${app.name} ${app.description} ${app.ownerName} ${app.stackLabel} ${app.tags.join(" ")}`.toLowerCase();
    const matchesQuery = !query || blob.includes(query.toLowerCase());
    const matchesDomain = domain === "All" || app.domain === domain;
    return matchesQuery && matchesDomain;
  }).sort((a, b) => Number(b.pilot) - Number(a.pilot) || a.name.localeCompare(b.name));

  const onboard = el("a", {
    class: `btn btn-primary ${can("applications", "create") ? "" : "is-blocked"}`,
    href: can("applications", "create") ? "#/onboard" : "#/applications",
    title: can("applications", "create") ? "" : "The role you are viewing cannot onboard.",
  }, "Onboard application");

  container.replaceChildren(
    pageHeader("Applications", "The catalog is the heart of NH44. Open any application for a 360 view, or onboard another.", [
      el("button", {
        type: "button",
        class: `chip ${layout === "grid" ? "on" : ""}`,
        onClick: () => setLayout("grid"),
      }, "Grid"),
      el("button", {
        type: "button",
        class: `chip ${layout === "list" ? "on" : ""}`,
        onClick: () => setLayout("list"),
      }, "List"),
      onboard,
    ]),
    el("div", { class: "filters" }, [
      el("input", {
        type: "search",
        placeholder: "Filter by name, owner, stack",
        value: query,
        "aria-label": "Filter applications",
        onInput: (event) => { query = event.target.value; render(container); },
        style: "min-width:240px",
      }),
      ...domains.map((item) => el("button", {
        type: "button",
        class: `chip ${domain === item ? "on" : ""}`,
        onClick: () => { domain = item; render(container); },
      }, item)),
    ]),
    filtered.length ? (layout === "grid" ? grid(filtered) : list(filtered)) : emptyState("No applications match", "Clear the filter or onboard a repository."),
  );
}

function setLayout(next) {
  layout = next;
  commit((state) => { state.ui.appsLayout = next; });
  requestRefresh();
}

function grid(apps) {
  return el("div", { class: "app-grid" }, apps.map((app) => el("a", { class: "card app-card", href: `#/applications/${app.slug}` }, [
    el("div", { class: "spread" }, [el("strong", {}, app.name), pill(app.health, healthTone(app.health))]),
    el("p", { class: "hint" }, app.description),
    el("div", { class: "cluster" }, [
      pill(app.domain, "muted"),
      app.pilot ? pill("Pilot", "info") : null,
      pill(app.target, "muted"),
    ]),
    el("span", { class: "hint" }, `${app.ownerName} · ${app.stackLabel}`),
  ])));
}

function list(apps) {
  return el("div", { class: "table-wrap" }, [
    el("table", {}, [
      el("thead", {}, el("tr", {}, ["Application", "Domain", "Owner", "Stack", "Health", "Delivery", "Open PR", "Findings"].map((label) => el("th", {}, label)))),
      el("tbody", {}, apps.map((app) => el("tr", { class: "click-row", onClick: () => { location.hash = `#/applications/${app.slug}`; } }, [
        el("td", {}, [app.name, app.pilot ? " · pilot" : ""]),
        el("td", {}, app.domain),
        el("td", {}, app.ownerName),
        el("td", {}, app.stackLabel),
        el("td", {}, pill(app.health, healthTone(app.health))),
        el("td", {}, app.deployments[0] ? `${app.deployments[0].tool} · ${app.deployments[0].sync}` : "Not deployed"),
        el("td", {}, String(app.pulls.filter((pull) => pull.status === "open" || pull.status === "approved").length)),
        el("td", {}, String(app.findings.filter((item) => item.status === "open").length)),
      ]))),
    ]),
  ]);
}
