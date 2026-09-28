/** Cross-application delivery: Argo CD for EKS, GitHub Actions for Lambda. */
import { el } from "../dom.js";
import { getState } from "../store.js";
import { changeApp } from "../services/catalog-actions.js";
import { publishLambda, syncDeployment } from "../services/reviews.js";
import { pageHeader, pill, healthTone, guardButton } from "../components/ui.js";
import { relTime } from "../format.js";
import { toast } from "../components/toast.js";

export function render(container) {
  const rows = getState().apps.map((app) => ({ app, deploy: app.deployments[0] }));
  container.replaceChildren(
    pageHeader("Deployments", "EKS services sync through Argo CD. Lambda services publish an alias through GitHub Actions."),
    el("div", { class: "table-wrap" }, el("table", {}, [
      el("thead", {}, el("tr", {}, ["Application", "Tool", "Revision", "Sync", "Health", "Updated", ""].map((label) => el("th", {}, label)))),
      el("tbody", {}, rows.map(({ app, deploy }) => el("tr", {}, [
        el("td", {}, el("a", { href: `#/applications/${app.slug}/deployments` }, app.name)),
        el("td", {}, deploy?.tool || "—"),
        el("td", { class: "mono" }, deploy?.revision || "—"),
        el("td", {}, deploy ? pill(deploy.sync, healthTone(deploy.sync)) : "Not deployed"),
        el("td", {}, deploy ? pill(deploy.health, healthTone(deploy.health)) : "—"),
        el("td", {}, deploy ? relTime(deploy.at) : "—"),
        el("td", {}, deploy ? guardButton(deploy.tool === "Argo CD" ? "Sync" : "Publish", "deployments", "update", "btn-sm", () => {
          const error = changeApp(app.slug, "deployments", "update", (record) => (deploy.tool === "Argo CD" ? syncDeployment(record) : publishLambda(record)), {
            action: deploy.tool === "Argo CD" ? "Argo CD sync" : "Lambda alias published",
            detail: app.name,
            module: "deployments",
          });
          toast(error || `${app.name} delivery updated.`, error ? "bad" : "ok");
        }) : "—"),
      ]))),
    ])),
  );
}
