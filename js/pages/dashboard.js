/** Portfolio home. Every number is counted from the catalog, so onboarding changes it. */
import { el } from "../dom.js";
import { getState } from "../store.js";
import { pageHeader, pill, healthTone } from "../components/ui.js";
import { relTime } from "../format.js";
import { portfolioInsights } from "../services/insights.js";
import { can } from "../rbac.js";

export function render(container) {
  const state = getState();
  const apps = state.apps;
  const insights = portfolioInsights(apps);
  const openFindings = apps.reduce((sum, app) => sum + app.findings.filter((item) => item.status === "open").length, 0);
  const coverage = Math.round(apps.reduce((sum, app) => sum + app.quality.coverage, 0) / apps.length);
  const synced = apps.filter((app) => app.deployments[0]?.sync === "Synced" || app.deployments[0]?.sync === "Published").length;
  const hour = new Date().getHours();
  const hello = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const user = state.users.find((item) => item.id === state.session.userId);
  const pilot = apps.find((app) => app.pilot);

  const card = (kicker, value, detail) => el("article", { class: "card stat" }, [
    el("span", { class: "kicker" }, kicker),
    el("strong", {}, value),
    el("span", { class: "hint" }, detail),
  ]);

  container.replaceChildren(
    pageHeader("Dashboard", `${hello}. ${user.name} — the catalog currently holds ${apps.length} applications.`),
    el("div", { class: "grid-3" }, [
      el("a", { class: "card stat", href: "#/applications" }, [
        el("span", { class: "kicker" }, "Applications"),
        el("strong", {}, String(apps.length)),
        el("span", { class: "hint" }, `${apps.filter((app) => app.health === "healthy").length} healthy`),
      ]),
      card("Security", String(openFindings), `${insights.findings} high CodeQL · open an application`),
      card("Code quality", `${coverage}%`, "Average line coverage · open an application"),
      card("Deployments", String(synced), "Synced or published · open an application"),
      card("Documents", String(apps.reduce((sum, app) => sum + app.documents.length, 0)), "Confluence pages · open an application"),
      card("Repositories", String(apps.length), "GitHub repos · open an application"),
    ]),
    el("div", { class: "grid-2 mt" }, [
      el("section", { class: "card stack" }, [
        el("div", { class: "spread" }, [el("h2", {}, "Pilot"), el("a", { href: `#/applications/${pilot.slug}` }, "Open gpms")]),
        el("p", {}, pilot.description),
        el("div", { class: "cluster" }, [
          pill(pilot.health, healthTone(pilot.health)),
          pill(pilot.stackLabel, "muted"),
          pill(`${pilot.pulls.filter((pull) => pull.status === "open").length} open PR`, "info"),
        ]),
      ]),
      el("section", { class: "card stack" }, [
        el("h2", {}, "Needs attention"),
        insights.degraded.length || insights.failed.length
          ? el("div", {}, [...insights.failed, ...insights.degraded].filter((app, index, list) => list.findIndex((item) => item.slug === app.slug) === index).map((app) => el("div", { class: "spread" }, [
            el("a", { href: `#/applications/${app.slug}` }, app.name),
            pill(app.health, healthTone(app.health)),
          ])))
          : el("p", { class: "hint" }, "No degraded applications."),
      ]),
    ]),
    el("section", { class: "card stack mt" }, [
      el("div", { class: "spread" }, [el("h2", {}, "Recent activity"), can("audit", "read") ? el("a", { href: "#/audit" }, "Audit trail") : null]),
      el("div", { class: "table-wrap" }, [
        el("table", {}, [
          el("thead", {}, el("tr", {}, ["When", "Action", "Detail"].map((label) => el("th", {}, label)))),
          el("tbody", {}, state.audit.slice(0, 6).map((event) => el("tr", {}, [
            el("td", {}, relTime(event.at)),
            el("td", {}, event.action),
            el("td", {}, event.detail || "—"),
          ]))),
        ]),
      ]),
    ]),
  );
}
