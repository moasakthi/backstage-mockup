/** Insights are derived from the live application record so they stay true after a review or sync. */

export function insightsFor(app) {
  const items = [];
  const openFindings = app.findings.filter((item) => item.status === "open");
  const high = openFindings.filter((item) => item.severity === "high" || item.severity === "critical");
  if (app.pilot) {
    items.push({
      tone: "info",
      title: "Pilot application",
      body: "gpms is the phase 1 pilot. Use it to prove repository review, CodeQL, Argo CD, Jira, Confluence, and Grafana inside NH44.",
    });
  }
  if (high.length) {
    items.push({
      tone: "bad",
      title: `${high.length} high CodeQL finding${high.length === 1 ? "" : "s"}`,
      body: high.map((item) => `${item.rule} in ${item.file}`).join(". ") + ".",
    });
  } else if (!openFindings.length) {
    items.push({ tone: "ok", title: "CodeQL is clear", body: "No open findings on the default branch." });
  }
  if (app.quality.coverage < 75) {
    items.push({
      tone: "warn",
      title: "Coverage is thin",
      body: `Line coverage is ${app.quality.coverage}%. The platform bar used by this portal is 75%.`,
    });
  }
  const failed = app.pipelines.find((run) => run.status === "failure");
  if (failed) {
    items.push({
      tone: "bad",
      title: "Latest pipeline failed",
      body: `${failed.name} on ${failed.branch} (${failed.sha}). Open CI/CD to read the log and run an analysis.`,
    });
  }
  const running = app.pipelines.find((run) => run.status === "running");
  if (running) {
    items.push({ tone: "info", title: "Pipeline in progress", body: `${running.name} has been running for ${running.duration}.` });
  }
  const deploy = app.deployments[0];
  if (!deploy) {
    items.push({ tone: "warn", title: "No deployment target", body: "The assessment did not record a runtime. Monitoring stays empty until one exists." });
  } else if (deploy.sync === "OutOfSync") {
    items.push({ tone: "warn", title: "Argo CD is out of sync", body: `${deploy.name} in ${deploy.project} has git changes the cluster has not applied.` });
  } else if (deploy.health === "Degraded") {
    items.push({ tone: "bad", title: "Deployment health is degraded", body: `${deploy.tool} reports ${deploy.name} as degraded in ${deploy.environment}.` });
  } else if (deploy.health === "Progressing") {
    items.push({ tone: "info", title: "Rollout in progress", body: `${deploy.tool} revision ${deploy.revision} is still progressing.` });
  }
  const openPr = app.pulls.find((pr) => pr.status === "open" || pr.status === "approved");
  if (openPr) {
    items.push({
      tone: "info",
      title: `Pull request #${openPr.number} needs a review`,
      body: openPr.title,
    });
  }
  if (app.tests.failed > 0) {
    items.push({
      tone: "bad",
      title: "Test run has failures",
      body: `${app.tests.failed} failed, ${app.tests.passed} passed in ${app.tests.name}.`,
    });
  }
  return items;
}

export function portfolioInsights(apps) {
  const degraded = apps.filter((app) => app.health === "degraded");
  const findings = apps.reduce((sum, app) => sum + app.findings.filter((item) => item.status === "open" && (item.severity === "high" || item.severity === "critical")).length, 0);
  const failed = apps.filter((app) => app.pipelines.some((run) => run.status === "failure"));
  return { degraded, findings, failed };
}
