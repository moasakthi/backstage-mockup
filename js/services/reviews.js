/** Pure catalog mutations so screens and the smoke test share one workflow. */
import { hoursAgo } from "../format.js";

export function reviewPull(app, number, decision, actorName) {
  const pull = app.pulls.find((item) => item.number === Number(number));
  if (!pull) return { ok: false, error: "Pull request was not found." };
  const now = new Date().toISOString();
  if (decision === "approve") {
    if (pull.status === "merged") return { ok: false, error: "This pull request is already merged." };
    pull.status = "approved";
    pull.reviews.push({ author: actorName, decision: "approved", at: now });
    return { ok: true, pull };
  }
  if (decision === "changes") {
    if (pull.status === "merged") return { ok: false, error: "This pull request is already merged." };
    pull.status = "changes_requested";
    pull.reviews.push({ author: actorName, decision: "changes requested", at: now });
    return { ok: true, pull };
  }
  if (decision === "merge") {
    if (pull.status !== "approved") return { ok: false, error: "Approve the pull request before merging." };
    pull.status = "merged";
    pull.mergedAt = now;
    app.commits.unshift({
      sha: Math.random().toString(16).slice(2, 9),
      message: `${pull.title} (#${pull.number})`,
      author: actorName,
      at: now,
      files: pull.files.map((file) => file.path),
    });
    app.updatedAt = now;
    return { ok: true, pull };
  }
  return { ok: false, error: "Unknown review action." };
}

const TICKET_FLOW = ["To Do", "In Progress", "In Review", "Done"];

export function moveTicket(app, key, status) {
  const ticket = app.tickets.find((item) => item.key === key);
  if (!ticket) return { ok: false, error: "Ticket was not found." };
  if (!TICKET_FLOW.includes(status)) return { ok: false, error: "That status is not used by the Jira workflow." };
  ticket.status = status;
  ticket.updatedAt = new Date().toISOString();
  return { ok: true, ticket };
}

export function dismissFinding(app, id) {
  const finding = app.findings.find((item) => item.id === id);
  if (!finding) return { ok: false, error: "Finding was not found." };
  finding.status = finding.status === "dismissed" ? "open" : "dismissed";
  return { ok: true, finding };
}

export function syncDeployment(app) {
  const deploy = app.deployments[0];
  if (!deploy) return { ok: false, error: "This application has no deployment target." };
  if (deploy.tool !== "Argo CD") {
    return { ok: false, error: "Argo CD does not deliver this service. GitHub Actions is the configured path." };
  }
  deploy.sync = "Synced";
  deploy.health = "Healthy";
  deploy.revision = deploy.revision;
  deploy.at = new Date().toISOString();
  deploy.history.unshift({
    revision: deploy.revision,
    sync: "Synced",
    health: "Healthy",
    at: deploy.at,
    note: "Sync requested from NH44",
  });
  if (app.health === "degraded" && !app.pipelines.some((run) => run.status === "failure")) app.health = "healthy";
  if (app.pipelines.every((run) => run.status === "success") && app.health !== "undeployed") {
    /* Keep a pipeline failure visible even after a sync. */
  }
  app.updatedAt = deploy.at;
  void hoursAgo;
  return { ok: true, deploy };
}

export function publishLambda(app) {
  const deploy = app.deployments[0];
  if (!deploy || deploy.tool !== "GitHub Actions") return { ok: false, error: "This service is not delivered as a Lambda alias." };
  const current = Number(String(deploy.revision).replace(/\D/g, "")) || 1;
  const next = `v${current + 1}`;
  deploy.revision = next;
  deploy.health = "Healthy";
  deploy.sync = "Published";
  deploy.at = new Date().toISOString();
  deploy.history.unshift({ revision: next, health: "Healthy", at: deploy.at, note: "Alias published from NH44" });
  app.health = "healthy";
  app.updatedAt = deploy.at;
  return { ok: true, deploy };
}
