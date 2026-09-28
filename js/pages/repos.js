/** GitHub repositories currently in the catalog. */
import { el } from "../dom.js";
import { getState } from "../store.js";
import { env } from "../env.js";
import { pageHeader, pill } from "../components/ui.js";
import { relTime } from "../format.js";

export function render(container) {
  const apps = getState().apps;
  container.replaceChildren(
    pageHeader("Repositories", `Organization ${env.githubOrg}. Open a repository to read code or review a pull request.`),
    el("div", { class: "table-wrap" }, el("table", {}, [
      el("thead", {}, el("tr", {}, ["Repository", "Branch", "Last update", "Open PRs", "CI"].map((label) => el("th", {}, label)))),
      el("tbody", {}, apps.map((app) => el("tr", { class: "click-row", onClick: () => { location.hash = `#/applications/${app.slug}/code`; } }, [
        el("td", {}, [el("div", {}, app.name), el("div", { class: "mono hint" }, app.repoUrl)]),
        el("td", {}, app.branch),
        el("td", {}, relTime(app.updatedAt)),
        el("td", {}, String(app.pulls.filter((pull) => pull.status === "open" || pull.status === "approved").length)),
        el("td", {}, pill(app.pipelines[0]?.status || "—", app.pipelines[0]?.status === "success" ? "ok" : app.pipelines[0]?.status === "failure" ? "bad" : "info")),
      ]))),
    ])),
  );
}
