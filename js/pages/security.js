/** Cross-application CodeQL queue. */
import { el } from "../dom.js";
import { getState } from "../store.js";
import { changeApp } from "../services/catalog-actions.js";
import { dismissFinding } from "../services/reviews.js";
import { pageHeader, pill, guardButton, emptyState } from "../components/ui.js";
import { toast } from "../components/toast.js";

let severity = "all";

export function render(container) {
  const rows = getState().apps.flatMap((app) => app.findings.map((finding) => ({ app, finding })))
    .filter((row) => severity === "all" || row.finding.severity === severity);
  container.replaceChildren(
    pageHeader("Security", "CodeQL findings from the configured scans. Dismissing a finding updates the application record."),
    el("div", { class: "filters" }, ["all", "high", "medium", "low"].map((item) => el("button", {
      type: "button",
      class: `chip ${severity === item ? "on" : ""}`,
      onClick: () => { severity = item; render(container); },
    }, item))),
    rows.length ? el("div", { class: "table-wrap" }, el("table", {}, [
      el("thead", {}, el("tr", {}, ["Application", "Severity", "Rule", "Status", ""].map((label) => el("th", {}, label)))),
      el("tbody", {}, rows.map(({ app, finding }) => el("tr", {}, [
        el("td", {}, el("a", { href: `#/applications/${app.slug}/security` }, app.name)),
        el("td", {}, pill(finding.severity, finding.severity === "high" ? "bad" : finding.severity === "medium" ? "warn" : "muted")),
        el("td", {}, finding.rule),
        el("td", {}, finding.status),
        el("td", {}, guardButton(finding.status === "open" ? "Dismiss" : "Reopen", "security", "update", "btn-sm", () => {
          const error = changeApp(app.slug, "security", "update", (record) => dismissFinding(record, finding.id), {
            action: finding.status === "open" ? "Finding dismissed" : "Finding reopened",
            detail: `${app.name} ${finding.rule}`,
            module: "security",
          });
          if (error) toast(error, "bad");
        })),
      ]))),
    ])) : emptyState("No findings in this filter", "The open CodeQL queue is clear for this severity."),
  );
}
