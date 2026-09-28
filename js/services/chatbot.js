/** Rule-based assistant grounded in the current catalog. It does not call a model. */
import { getState } from "../store.js";
import { insightsFor, portfolioInsights } from "./insights.js";
import { can } from "../rbac.js";

const MODULES = [
  ["dashboard", "#/dashboard"],
  ["applications", "#/applications"],
  ["access", "#/access/users"],
  ["audit", "#/audit"],
  ["settings", "#/settings"],
  ["onboard", "#/onboard"],
];

function findApp(state, text) {
  return state.apps.find((app) => text.includes(app.slug) || text.includes(app.name.toLowerCase()));
}

export function answerQuestion(text, state = getState()) {
  const q = text.trim().toLowerCase();
  if (!q) return { text: "Ask about an application, a failing pipeline, CodeQL, or how to onboard." };
  const portfolio = portfolioInsights(state.apps);

  if (/help|what can you/.test(q)) {
    return {
      text: "I can summarize portfolio health, open an application, list failing pipelines, explain onboarding, and point at open pull requests. I stay inside this mock catalog.",
      actions: [
        { label: "Portfolio health", ask: "Summarize portfolio health" },
        { label: "Onboarding", ask: "How do I onboard an application?" },
      ],
    };
  }

  if (/how do i onboard|golden path|template/.test(q)) {
    return {
      text: "Open Applications and choose Onboard. Single existing runs a rule-based GitHub assessment and autofetches Actions, Argo CD, Grafana, Jira, Confluence, and CodeQL. Single new stamps a golden-path template into a catalog repository. Bulk accepts CSV or Excel, or a multi-select from the GitHub organization.",
      actions: can("applications", "create", state) ? [{ label: "Start onboarding", hash: "#/onboard" }] : [],
    };
  }

  if (/fail|broken|degraded|unhealthy/.test(q)) {
    const names = portfolio.failed.map((app) => app.name);
    const degraded = portfolio.degraded.map((app) => app.name);
    return {
      text: `Pipelines failing: ${names.join(", ") || "none"}. Degraded runtime: ${degraded.join(", ") || "none"}.`,
      actions: (portfolio.failed[0] ? [{ label: `Open ${portfolio.failed[0].name} CI`, hash: `#/applications/${portfolio.failed[0].slug}/cicd` }] : [])
        .concat(portfolio.degraded[0] ? [{ label: `Open ${portfolio.degraded[0].name}`, hash: `#/applications/${portfolio.degraded[0].slug}` }] : []),
    };
  }

  if (/codeql|finding|vulnerab|security/.test(q) && !findApp(state, q)) {
    return {
      text: `${portfolio.findings} open high CodeQL findings across the catalog.`,
      actions: [{ label: "Open in an application", hash: `#/applications/${(state.apps.find((app) => app.findings.some((item) => item.status === "open" && item.severity === "high")) || state.apps[0]).slug}/security` }],
    };
  }

  if (/who owns/.test(q)) {
    const app = findApp(state, q);
    if (!app) return { text: "Name the application after “who owns”." };
    return { text: `${app.name} is owned by ${app.ownerName} in ${app.domain}.`, actions: [{ label: "Overview", hash: `#/applications/${app.slug}` }] };
  }

  if (/pull request|approve/.test(q)) {
    const app = findApp(state, q);
    const pulls = (app ? [app] : state.apps).flatMap((item) => item.pulls.filter((pull) => pull.status === "open" || pull.status === "approved").map((pull) => ({ app: item, pull })));
    if (!pulls.length) return { text: "No open pull requests in the catalog." };
    const first = pulls[0];
    return {
      text: pulls.map(({ app: item, pull }) => `${item.name} #${pull.number} ${pull.title} (${pull.status})`).join(". "),
      actions: [{ label: `Review #${first.pull.number}`, hash: `#/applications/${first.app.slug}/code/pulls/${first.pull.number}` }],
    };
  }

  const app = findApp(state, q);
  if (app) {
    const notes = insightsFor(app).map((item) => item.title).join("; ");
    return {
      text: `${app.name}: ${app.health}, ${app.stackLabel}, ${app.target}. ${notes}`,
      actions: [
        { label: "Overview", hash: `#/applications/${app.slug}` },
        { label: "AI insights", hash: `#/applications/${app.slug}/insights` },
        { label: "Logs", hash: `#/applications/${app.slug}/monitoring` },
      ],
    };
  }

  const place = MODULES.find(([name]) => q.includes(name));
  if (place || /open |go to |show /.test(q)) {
    if (place) return { text: `Opening ${place[0]}.`, actions: [{ label: place[0], hash: place[1] }] };
  }

  if (/health|portfolio|summary|dashboard/.test(q)) {
    const total = state.apps.length;
    return {
      text: `${total} applications. ${state.apps.filter((item) => item.health === "healthy").length} healthy, ${portfolio.degraded.length} degraded, ${portfolio.findings} high findings, ${portfolio.failed.length} failing pipelines. gpms is the pilot.`,
      actions: [{ label: "Dashboard", hash: "#/dashboard" }, { label: "gpms", hash: "#/applications/gpms" }],
    };
  }

  return {
    text: "I can answer from the mock catalog only. Try “summarize portfolio health”, “open gpms”, “which pipelines are failing”, or “how do I onboard”.",
  };
}
