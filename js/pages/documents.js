/** Confluence pages mirrored into the portal. */
import { el } from "../dom.js";
import { getState } from "../store.js";
import { pageHeader } from "../components/ui.js";
import { relTime } from "../format.js";

let query = "";

export function render(container) {
  const docs = getState().apps.flatMap((app) => app.documents.map((doc) => ({ app, doc })))
    .filter((row) => `${row.doc.title} ${row.app.name}`.toLowerCase().includes(query.toLowerCase()));
  container.replaceChildren(
    pageHeader("Documents", "Confluence space NH44, read inside the portal."),
    el("input", {
      type: "search",
      placeholder: "Search pages",
      value: query,
      "aria-label": "Search documents",
      onInput: (event) => { query = event.target.value; render(container); },
    }),
    el("div", { class: "stack mt" }, docs.map(({ app, doc }) => el("a", { class: "card stack", href: `#/applications/${app.slug}/documents/${doc.id}` }, [
      el("strong", {}, doc.title),
      el("span", { class: "hint" }, `${app.name} · ${doc.space} · ${doc.author} · ${relTime(doc.updatedAt)}`),
    ]))),
  );
}
