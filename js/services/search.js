/** Global search across the catalog, tickets, documents, and people. */
import { getState } from "../store.js";

export function searchPortal(query, state = getState()) {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const results = [];
  const push = (item) => {
    if (results.length < 12) results.push(item);
  };
  for (const app of state.apps) {
    const blob = `${app.name} ${app.description} ${app.domain} ${app.tags.join(" ")} ${app.ownerName}`.toLowerCase();
    if (blob.includes(q)) push({ type: "Application", title: app.name, detail: `${app.domain} · ${app.health}`, hash: `#/applications/${app.slug}` });
    for (const ticket of app.tickets) {
      if (`${ticket.key} ${ticket.summary}`.toLowerCase().includes(q)) {
        push({ type: "Jira", title: `${ticket.key} ${ticket.summary}`, detail: app.name, hash: `#/applications/${app.slug}/issues` });
      }
    }
    for (const doc of app.documents) {
      if (`${doc.title} ${doc.body}`.toLowerCase().includes(q)) {
        push({ type: "Confluence", title: doc.title, detail: app.name, hash: `#/applications/${app.slug}/documents/${doc.id}` });
      }
    }
    for (const finding of app.findings) {
      if (finding.status === "open" && `${finding.rule} ${finding.message}`.toLowerCase().includes(q)) {
        push({ type: "CodeQL", title: finding.rule, detail: app.name, hash: `#/applications/${app.slug}/security` });
      }
    }
  }
  for (const user of state.users) {
    if (`${user.name} ${user.email}`.toLowerCase().includes(q)) {
      push({ type: "User", title: user.name, detail: user.email, hash: "#/access/users" });
    }
  }
  return results;
}
