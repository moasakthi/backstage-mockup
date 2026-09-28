/** Rule-based log reading used by pipeline logs and runtime logs. */

export function analyseLog(text, appName = "application") {
  const lines = String(text || "").split("\n").filter(Boolean);
  const errors = lines.filter((line) => /\berror\b|exception|fatal/i.test(line));
  const warnings = lines.filter((line) => /\bwarn\b/i.test(line));
  const counts = new Map();
  for (const line of errors) {
    const key = line.replace(/^\S+\s+/, "").slice(0, 140);
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  const top = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  let suggestion = `${appName} log has no error lines in this window.`;
  if (/mongoserverselection|pool exhausted/i.test(text)) {
    suggestion = "MongoDB stopped accepting selections from the connection pool. Check Atlas or in-cluster Mongo reachability, pool size, and whether a deploy coincided with the spike.";
  } else if (/assertionerror|tests?: .*failed/i.test(text)) {
    suggestion = "The pipeline failed in tests. Open the failing assertion, then rerun CI from the pull request once the fixture matches the expected status.";
  } else if (/timed out|timeout/i.test(text)) {
    suggestion = "Timeouts dominate this window. Compare latency on the Grafana board with the downstream the log names.";
  } else if (errors.length) {
    suggestion = "Start with the repeated error line. If it began after the latest revision, compare that deploy in the delivery history.";
  }
  return {
    summary: errors.length
      ? `${errors.length} error line${errors.length === 1 ? "" : "s"} and ${warnings.length} warning${warnings.length === 1 ? "" : "s"} in ${lines.length} lines.`
      : `${lines.length} lines, no errors matched.`,
    errorCount: errors.length,
    warnCount: warnings.length,
    top,
    suggestion,
  };
}
