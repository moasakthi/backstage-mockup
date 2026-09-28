/** Data-flow checks that do not need a browser. */
import assert from "node:assert/strict";
import { resetDemo, getState } from "../js/store.js";
import { bindState, can } from "../js/rbac.js";
import { assessRepo } from "../js/services/assessment.js";
import { BULK_SAMPLE, parseCsv, recordsToApps, toCsv } from "../js/services/bulk.js";
import { reviewPull } from "../js/services/reviews.js";
import { insightsFor } from "../js/services/insights.js";
import { analyseLog } from "../js/services/logs.js";
import { buildApp } from "../js/data/generate.js";

bindState(getState);
resetDemo();
const state = getState();

assert.equal(state.apps.length, 14);
assert.equal(new Set(state.apps.map((app) => app.slug)).size, 14);
const gpms = state.apps.find((app) => app.slug === "gpms");
assert.equal(gpms.pilot, true);
assert.ok(gpms.pulls.some((pull) => pull.status === "open"));
assert.ok(gpms.files.some((file) => file.path === "client/src/pages/Schedule.jsx"));
assert.equal(state.apps.find((app) => app.slug === "near-you-ui").metrics, null);
assert.ok(state.apps.every((app) => app.files.length > 3 && app.commits.length && app.tickets.length && app.documents.length));

const developer = { ...state, session: { ...state.session, viewAsRoleId: "role-developer" } };
assert.equal(can("access", "read", developer), false);
assert.equal(can("applications", "create", developer), true);
assert.equal(can("repos", "update", developer), true);
const auditor = { ...state, session: { ...state.session, viewAsRoleId: "role-auditor" } };
assert.equal(can("audit", "read", auditor), true);
assert.equal(can("applications", "update", auditor), false);

const parsed = parseCsv(toCsv(BULK_SAMPLE));
assert.equal(parsed.length, 2);
const imported = recordsToApps(parsed, state.apps);
assert.equal(imported.errors.length, 0, JSON.stringify(imported.errors));
assert.equal(imported.apps.length, 2);
assert.equal(imported.apps[1].stackKind, "fastapi-react");

assert.equal(assessRepo({ repoUrl: "https://gitlab.com/acme/app" }).ok, false);
assert.equal(assessRepo({ repoUrl: "https://github.com/other-org/app" }).ok, false);
assert.equal(assessRepo({ repoUrl: "https://github.com/tkm-digital/gpms" }).alreadyOnboarded, true);
const fresh = assessRepo({ repoUrl: "https://github.com/tkm-digital/legacy-batch-reports" });
assert.equal(fresh.ok, true);
assert.equal(fresh.signals.find((signal) => signal.label === "CI workflow").ok, false);

const open = gpms.pulls.find((pull) => pull.status === "open");
assert.equal(reviewPull(gpms, open.number, "merge", "Tester").ok, false);
assert.equal(reviewPull(gpms, open.number, "approve", "Tester").ok, true);
assert.equal(reviewPull(gpms, open.number, "merge", "Tester").ok, true);
assert.equal(gpms.pulls.find((pull) => pull.number === open.number).status, "merged");

assert.ok(insightsFor(gpms).length >= 1);
const analysed = analyseLog("ERROR MongoServerSelectionError: timed out selecting a server\nERROR pool exhausted", "gpms");
assert.match(analysed.suggestion, /MongoDB/);

const created = buildApp({
  slug: "sample-next",
  name: "sample-next",
  summary: "Sample",
  stackKind: "next",
  stackLabel: "Next.js",
  target: "EKS",
  domain: "Other",
  ownerKey: "pavithra",
  health: "healthy",
  coverage: 80,
  sync: "Synced",
  deployHealth: "Healthy",
  pipeline: "success",
  jira: "NEXT",
  findings: { high: 0, medium: 0, low: 0 },
  tests: { passed: 1, failed: 0, skipped: 0 },
  openPull: false,
}, Date.now());
assert.ok(created.files.some((file) => file.path.endsWith("argocd-application.yaml")));
assert.ok(created.files.some((file) => file.path.endsWith(".tf")));

console.log("smoke ok", state.apps.length, "applications");
