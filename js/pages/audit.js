/** End-to-end activity for the signed-in portal. */
import { el } from "../dom.js";
import { getState } from "../store.js";
import { clock, downloadText } from "../format.js";
import { pageHeader, emptyState } from "../components/ui.js";

let query = "";

export function render(container) {
  const state = getState();
  const rows = state.audit.filter((event) => {
    const actor = state.users.find((user) => user.id === event.actorId)?.name || "System";
    const role = state.roles.find((item) => item.id === event.viewAsRoleId)?.name || "";
    return `${actor} ${role} ${event.action} ${event.detail} ${event.module}`.toLowerCase().includes(query.toLowerCase());
  });
  container.replaceChildren(
    pageHeader("Audit trail", "Sign-in, onboarding, reviews, access changes, and log access.", [
      el("button", {
        type: "button",
        class: "btn",
        onClick: () => downloadText("nh44-audit.csv", toCsv(rows, state), "text/csv"),
      }, "Download CSV"),
    ]),
    el("input", {
      type: "search",
      placeholder: "Filter by person, action, or detail",
      value: query,
      "aria-label": "Filter audit",
      onInput: (event) => { query = event.target.value; render(container); },
    }),
    rows.length ? el("div", { class: "table-wrap mt" }, el("table", {}, [
      el("thead", {}, el("tr", {}, ["When", "Person", "Viewing as", "Module", "Action", "Detail"].map((label) => el("th", {}, label)))),
      el("tbody", {}, rows.map((event) => el("tr", {}, [
        el("td", {}, clock(event.at)),
        el("td", {}, state.users.find((user) => user.id === event.actorId)?.name || "System"),
        el("td", {}, state.roles.find((role) => role.id === event.viewAsRoleId)?.name || "—"),
        el("td", {}, event.module || "—"),
        el("td", {}, event.action),
        el("td", {}, event.detail || "—"),
      ]))),
    ])) : emptyState("No matching activity", "Try a shorter filter."),
  );
}

function toCsv(rows, state) {
  const lines = ["when,person,viewing_as,module,action,detail"];
  for (const event of rows) {
    const cells = [
      event.at,
      state.users.find((user) => user.id === event.actorId)?.name || "System",
      state.roles.find((role) => role.id === event.viewAsRoleId)?.name || "",
      event.module,
      event.action,
      event.detail,
    ].map((value) => `"${String(value || "").replace(/"/g, '""')}"`);
    lines.push(cells.join(","));
  }
  return lines.join("\n");
}
