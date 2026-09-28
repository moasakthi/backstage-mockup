/** Application 360 shell: one record, nine areas, all inside the portal. */
import { el } from "../dom.js";
import { getState } from "../store.js";
import { pageHeader, pill, healthTone, emptyState } from "../components/ui.js";
import {
  renderCicd,
  renderCode,
  renderDeployments,
  renderDocuments,
  renderInsights,
  renderIssues,
  renderMonitoring,
  renderOverview,
  renderSecurity,
} from "../features/app-views.js";

const TABS = [
  ["overview", "Overview"],
  ["code", "Code"],
  ["cicd", "CI/CD"],
  ["deployments", "Deployments"],
  ["security", "Security"],
  ["issues", "Issues"],
  ["documents", "Documents"],
  ["monitoring", "Monitoring"],
  ["insights", "AI insights"],
];

const PANELS = {
  overview: renderOverview,
  code: renderCode,
  cicd: renderCicd,
  deployments: renderDeployments,
  security: renderSecurity,
  issues: renderIssues,
  documents: renderDocuments,
  monitoring: renderMonitoring,
  insights: renderInsights,
};

export function render(container, route) {
  const app = getState().apps.find((item) => item.slug === route.slug);
  if (!app) {
    container.append(pageHeader("Application", "That record is not in the catalog."));
    container.append(emptyState("Not onboarded", "Return to Applications or onboard the repository."));
    return;
  }
  const tab = PANELS[route.tab] ? route.tab : "overview";
  const panel = el("div");
  container.replaceChildren(
    pageHeader(app.name, app.description, [
      pill(app.health, healthTone(app.health)),
      app.pilot ? pill("Pilot", "info") : null,
      el("a", { class: "btn btn-ghost", href: "#/applications" }, "All applications"),
    ]),
    el("nav", { class: "tabs", "aria-label": "Application sections" }, TABS.map(([id, label]) => el("a", {
      href: `#/applications/${app.slug}/${id}`,
      class: tab === id ? "active" : "",
    }, label))),
    panel,
  );
  PANELS[tab](panel, app, route);
}
