/** Cross-application quality snapshot. */
import { el } from "../dom.js";
import { getState } from "../store.js";
import { pageHeader } from "../components/ui.js";

export function render(container) {
  const apps = [...getState().apps].sort((a, b) => a.quality.coverage - b.quality.coverage);
  container.replaceChildren(
    pageHeader("Code quality", "Coverage, smells, and the latest test run. Open an application to read the code and the pipeline."),
    el("div", { class: "table-wrap" }, el("table", {}, [
      el("thead", {}, el("tr", {}, ["Application", "Coverage", "Bugs", "Smells", "Duplication", "Tests"].map((label) => el("th", {}, label)))),
      el("tbody", {}, apps.map((app) => el("tr", { class: "click-row", onClick: () => { location.hash = `#/applications/${app.slug}/cicd`; } }, [
        el("td", {}, app.name),
        el("td", {}, `${app.quality.coverage}%`),
        el("td", {}, String(app.quality.bugs)),
        el("td", {}, String(app.quality.smells)),
        el("td", {}, `${app.quality.duplications}%`),
        el("td", {}, `${app.tests.passed} passed / ${app.tests.failed} failed`),
      ]))),
    ])),
  );
}
