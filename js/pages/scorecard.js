/** Portfolio scorecard. Scores are calculated from each application's stored signals. */
import { el } from "../dom.js";
import { getState } from "../store.js";
import { pageHeader, pill } from "../components/ui.js";
import { scoreApplication, scoreTone } from "../services/scorecard.js";

const COLUMNS = [
  ["overall", "Overall"],
  ["security", "Security"],
  ["codeQuality", "Code quality"],
  ["tests", "Tests"],
  ["delivery", "Delivery"],
  ["documentation", "Documentation"],
  ["reliability", "Reliability"],
];

export function render(container) {
  const rows = getState().apps
    .map((app) => ({ app, scores: scoreApplication(app) }))
    .sort((left, right) => left.scores.overall - right.scores.overall || left.app.name.localeCompare(right.app.name));

  container.replaceChildren(
    pageHeader("Scorecard", "Assessment scores for every application. Security, code quality, tests, delivery, documentation, and reliability are scored from the catalog."),
    rows.length
      ? el("div", { class: "table-wrap" }, el("table", { class: "score-table" }, [
        el("thead", {}, el("tr", {}, [
          el("th", {}, "Application"),
          el("th", {}, "Domain"),
          ...COLUMNS.map(([, label]) => el("th", {}, label)),
        ])),
        el("tbody", {}, rows.map(({ app, scores }) => el("tr", {
          class: "click-row",
          onClick: () => { location.hash = `#/applications/${app.slug}`; },
        }, [
          el("td", {}, el("a", { href: `#/applications/${app.slug}` }, app.name)),
          el("td", {}, app.domain),
          ...COLUMNS.map(([key]) => el("td", {}, scoreMark(scores[key]))),
        ]))),
      ]))
      : el("div", { class: "empty" }, "No applications are in the catalog yet."),
  );
}

function scoreMark(score) {
  return el("span", { class: "score-mark" }, [
    pill(String(score), scoreTone(score)),
  ]);
}
