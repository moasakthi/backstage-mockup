/** Assessment scores derived from catalog signals already stored on each application. */

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function openFindings(app) {
  return (app.findings || []).filter((item) => item.status === "open");
}

export function scoreTone(score) {
  if (score >= 80) return "ok";
  if (score >= 60) return "warn";
  return "bad";
}

export function scoreApplication(app) {
  const findings = openFindings(app);
  const high = findings.filter((item) => item.severity === "high" || item.severity === "critical").length;
  const medium = findings.filter((item) => item.severity === "medium").length;
  const low = findings.filter((item) => item.severity === "low").length;
  const security = clamp(100 - high * 18 - medium * 8 - low * 3);

  const coverage = app.quality?.coverage ?? 0;
  const bugs = app.quality?.bugs ?? 0;
  const smells = app.quality?.smells ?? 0;
  const codeQuality = clamp(coverage - bugs * 4 - Math.min(smells, 12));

  const tests = app.tests || { passed: 0, failed: 0, skipped: 0 };
  const total = tests.passed + tests.failed + tests.skipped;
  const testScore = total ? clamp((tests.passed / total) * 100) : 0;

  const failedPipeline = (app.pipelines || []).some((run) => run.status === "failure");
  const runningPipeline = (app.pipelines || []).some((run) => run.status === "running");
  let delivery = 88;
  if (failedPipeline || app.health === "degraded") delivery = 42;
  else if (runningPipeline || app.health === "progressing") delivery = 68;
  else if (app.health === "undeployed" || app.target === "None") delivery = 55;

  const documentation = clamp(35 + (app.documents || []).length * 22);
  const reliability = { healthy: 94, progressing: 70, degraded: 38, undeployed: 30 }[app.health] ?? 60;
  const overall = clamp(security * 0.28 + codeQuality * 0.24 + testScore * 0.16 + delivery * 0.16 + documentation * 0.08 + reliability * 0.08);

  return { security, codeQuality, tests: testScore, delivery, documentation, reliability, overall };
}
