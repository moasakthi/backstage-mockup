/**
 * Expands catalog rows into Application 360 records: code, pull requests,
 * pipelines, Argo or Lambda delivery, CodeQL, Jira, Confluence, logs, metrics.
 */
import { env } from "../env.js";
import { hashString, hoursAgo } from "../format.js";
import { PEOPLE } from "../people.js";
import { CATALOG } from "./catalog.js";
import { blueprint } from "./file-blueprints.js";
import { defaultIntegrations } from "../services/integrations.js";

const COMMIT_NOTES = [
  "Tighten health probe timeouts",
  "Refresh dependency lockfile",
  "Align catalog-info owner annotation",
  "Update OTel service name",
  "Fix flaky date assertion in CI",
  "Document the on-call handoff",
];

const TICKET_NOTES = [
  ["Lane timeout on peak shift", "High"],
  ["Add export for yesterday's audit sample", "Medium"],
  ["Clarify empty-state copy", "Low"],
  ["Dashboard tile repeats stale count", "Medium"],
];

function series(seed, scale, floor = 0) {
  const values = [];
  for (let i = 0; i < 24; i += 1) {
    const wave = Math.sin((i + (seed % 7)) / 3) * scale * 0.35;
    const noise = ((seed >> (i % 8)) & 7) * scale * 0.02;
    values.push(Math.max(floor, Math.round((scale + wave + noise) * 10) / 10));
  }
  return values;
}

function findingPreset(severity, stackKind, index) {
  const path = stackKind.startsWith("lambda")
    ? "src/handler.js"
    : stackKind === "frontend-angular"
      ? "client/src/app/app.component.ts"
      : stackKind === "java-react"
        ? "src/main/java/com/tkm/app/HealthController.java"
        : stackKind.startsWith("fastapi")
          ? "server/main.py"
          : "server/src/routes/items.js";
  const copy = {
    high: ["js/nosql-injection", "Request input is interpolated into a database query."],
    medium: ["js/log-injection", "A request field is written to logs without stripping line breaks."],
    low: ["js/unused-dependency", "A declared dependency is not referenced by application code."],
  }[severity];
  return {
    severity,
    rule: copy[0],
    message: copy[1],
    file: path,
    line: 8 + index * 3,
    tool: "CodeQL",
  };
}

function buildFindings(spec) {
  const counts = spec.findings || { high: 0, medium: 0, low: 0 };
  const items = [];
  for (const severity of ["high", "medium", "low"]) {
    for (let i = 0; i < (counts[severity] || 0); i += 1) {
      const preset = findingPreset(severity, spec.stackKind, items.length);
      items.push({
        id: `${spec.slug}-f-${items.length + 1}`,
        status: "open",
        ...preset,
      });
    }
  }
  if (spec.story === "gpms" && items[0]) {
    items[0] = {
      ...items[0],
      rule: "js/nosql-injection",
      file: "server/src/routes/items.js",
      line: 8,
      message: "The name filter is copied into a MongoDB $regex operator.",
    };
  }
  return items;
}

function buildCommits(spec, owner, ago) {
  return COMMIT_NOTES.map((message, index) => ({
    sha: hashString(`${spec.slug}-${index}`).toString(16).padStart(7, "0").slice(0, 7),
    message: `${message} (${spec.name})`,
    author: index % 2 === 0 ? owner.name : "NH44 Platform Admin",
    at: ago(18 + index * 26),
    files: index === 0 ? ["README.md", "catalog-info.yaml"] : ["server/src/routes/health.js"],
  }));
}

function buildPulls(spec, owner, ago) {
  const merged = {
    number: 40 + (hashString(spec.slug) % 50),
    title: `Harden ${spec.name} health check`,
    author: owner.name,
    branch: "chore/health-probe",
    base: spec.branch || "main",
    status: "merged",
    createdAt: ago(240),
    mergedAt: ago(200),
    body: "Makes the readiness probe match the platform standard and records the change in the catalog.",
    files: [{ path: "k8s/deployment.yaml", patch: " readinessProbe:\\n   httpGet:\\n     path: /health\\n+    timeoutSeconds: 2" }],
    reviews: [{ author: "NH44 Platform Admin", decision: "approved", at: ago(210) }],
  };
  if (!spec.openPull) return [merged];
  const open = {
    number: merged.number + 3,
    title: spec.story === "gpms" ? "Add gate-pass SLA badge on the dock board" : `Fix failing ${spec.name} checks`,
    author: owner.name,
    branch: spec.story === "gpms" ? "feature/sla-badge" : "fix/ci-assertions",
    base: spec.branch || "main",
    status: "open",
    createdAt: ago(6),
    body: spec.story === "gpms"
      ? "Shows wait time on each gate slot so the lane lead can see SLA risk without leaving the board."
      : "Updates assertions that drifted from the fixture data and keeps the workflow required.",
    files: spec.story === "gpms"
      ? [{ path: "client/src/pages/Schedule.jsx", patch: " {slot.gate}\\n+<SlaBadge minutes={slot.wait} />" }]
      : [{ path: "server/test/health.test.js", patch: "- assert.equal(status, 'up')\\n+ assert.equal(status, 'ok')" }],
    reviews: [],
  };
  return [open, merged];
}

function pipelineLog(spec) {
  const stamp = "2026-09-28T09:14:02Z";
  if (spec.pipeline === "failure") {
    return [
      `${stamp} INFO  checkout ${spec.slug}`,
      `${stamp} INFO  npm ci`,
      `${stamp} INFO  npm test`,
      `${stamp} ERROR AssertionError: expected status 'ok' to equal 'up'`,
      `${stamp} ERROR server/test/health.test.js:4`,
      `${stamp} ERROR MongoServerSelectionError: timed out selecting a server`,
      `${stamp} ERROR  Tests: ${spec.tests.failed} failed, ${spec.tests.passed} passed`,
      `${stamp} ERROR Process completed with exit code 1`,
    ].join("\n");
  }
  if (spec.pipeline === "running") {
    return [`${stamp} INFO  checkout ${spec.slug}`, `${stamp} INFO  npm ci`, `${stamp} INFO  npm test (running)`].join("\n");
  }
  return [
    `${stamp} INFO  checkout ${spec.slug}`,
    `${stamp} INFO  npm ci`,
    `${stamp} INFO  npm test`,
    `${stamp} INFO  Tests: ${spec.tests.passed} passed`,
    `${stamp} INFO  codeql analyze completed`,
    `${stamp} INFO  Process completed with exit code 0`,
  ].join("\n");
}

function buildPipelines(spec, ago) {
  const status = spec.pipeline;
  const head = {
    id: `${spec.slug}-run-current`,
    name: "ci",
    status,
    branch: spec.branch || "main",
    sha: hashString(`${spec.slug}-pipe`).toString(16).slice(0, 7),
    startedAt: ago(status === "running" ? 0.4 : 5),
    duration: status === "running" ? "4m 10s" : status === "failure" ? "6m 02s" : "4m 48s",
    log: pipelineLog(spec),
  };
  const previous = {
    id: `${spec.slug}-run-prev`,
    name: "ci",
    status: "success",
    branch: spec.branch || "main",
    sha: hashString(`${spec.slug}-prev`).toString(16).slice(0, 7),
    startedAt: ago(30),
    duration: "4m 12s",
    log: `${ago(30)} INFO previous main build passed\nexit code 0`,
  };
  return [head, previous];
}

function buildDeployments(spec, ago) {
  if (spec.target === "None") return [];
  if (spec.target === "Lambda") {
    return [
      {
        tool: "GitHub Actions",
        environment: "prod",
        name: spec.slug,
        alias: "live",
        revision: spec.deployHealth === "Progressing" ? "v18" : "v17",
        sync: "Published",
        health: spec.deployHealth,
        at: ago(spec.deployHealth === "Progressing" ? 1 : 20),
        history: [
          { revision: "v17", health: "Healthy", at: ago(20), note: "Alias live moved from v16" },
          { revision: "v16", health: "Healthy", at: ago(90), note: "Kinesis consumer timeout raised" },
        ],
      },
    ];
  }
  return [
    {
      tool: "Argo CD",
      environment: "prod",
      name: spec.slug,
      project: env.argoProject,
      revision: spec.sync === "OutOfSync" ? "a1c9e20" : "b7d44aa",
      sync: spec.sync,
      health: spec.deployHealth,
      at: ago(spec.deployHealth === "Progressing" ? 0.3 : 8),
      history: [
        {
          revision: "b7d44aa",
          sync: spec.sync,
          health: spec.deployHealth,
          at: ago(8),
          note: spec.sync === "OutOfSync" ? "Git has a replica change that the cluster has not applied" : "Automated sync",
        },
        { revision: "91ab332", sync: "Synced", health: "Healthy", at: ago(70), note: "Rolled the platform probe change" },
      ],
    },
  ];
}

function buildTickets(spec, owner, ago) {
  return TICKET_NOTES.map(([summary, priority], index) => ({
    key: `${spec.jira}-${120 + index}`,
    summary: `${summary} — ${spec.name}`,
    status: ["In Progress", "To Do", "In Review", "Done"][index],
    priority,
    assignee: owner.name,
    updatedAt: ago(5 + index * 11),
    description: `${summary} on ${spec.name}. Tracked in Jira project ${spec.jira} and mirrored here through the configured Jira plugin.`,
  }));
}

function buildDocs(spec, owner, ago) {
  const docs = [
    {
      id: "overview",
      title: `${spec.name} overview`,
      body: `${spec.summary}\n\nOwner: ${owner.name}. Domain: ${spec.domain}. Stack: ${spec.stackLabel}. Deployment target: ${spec.target}.\n\nAuthentication: ${spec.auth}. AWS: ${(spec.aws || []).join(", ") || "none recorded"}.`,
    },
    {
      id: "operations",
      title: `${spec.name} operations`,
      body: `CI is GitHub Actions on ${env.githubOrg}/${spec.slug}.\n\n${spec.target === "EKS" ? "Argo CD project nh44 syncs k8s/." : spec.target === "Lambda" ? "GitHub Actions publishes the Lambda alias. Argo CD is not the delivery tool for this service." : "No deployment target is recorded, so production monitoring is inactive."}\n\nGrafana folder: ${env.grafanaFolder}. Confluence space: ${env.confluenceSpace}.`,
    },
  ];
  if (spec.story === "gpms") {
    docs.push({
      id: "runbook",
      title: "gpms pilot runbook",
      body: "Pilot application for NH44 phase 1.\n\nWhen the dock board looks stale, check the runtime log for Mongo pool timeouts, then the Argo CD health of gpms, then the Grafana golden signals.\n\nCode lives on main. Approve the open SLA badge pull request from the Code tab. Do not leave the portal to review it.",
    });
  }
  return docs.map((doc, index) => ({
    ...doc,
    space: env.confluenceSpace,
    author: owner.name,
    updatedAt: ago(12 + index * 40),
  }));
}

function buildLogs(spec, ago) {
  const appLines = [
    `${ago(2)} INFO  ${spec.slug} started`,
    `${ago(2)} INFO  listening on 8080`,
    `${ago(1)} INFO  request GET /health 200 12ms`,
  ];
  if (spec.health === "degraded") {
    appLines.push(
      `${ago(0.8)} WARN  upstream latency above 800ms`,
      `${ago(0.5)} ERROR MongoServerSelectionError: timed out selecting a server`,
      `${ago(0.5)} ERROR request GET /api/items 500`,
      `${ago(0.4)} ERROR connection pool exhausted for ${spec.db}`,
    );
  } else if (spec.health === "progressing") {
    appLines.push(`${ago(0.2)} INFO  new revision warming, readiness not green yet`);
  }
  const streams = [
    {
      id: `${spec.slug}-runtime`,
      stream: "Runtime",
      environment: spec.target === "None" ? "ci" : "prod",
      at: ago(0.4),
      text: appLines.join("\n"),
    },
  ];
  if (spec.pipeline) {
    streams.push({
      id: `${spec.slug}-ci-log`,
      stream: "GitHub Actions",
      environment: "ci",
      at: ago(5),
      text: pipelineLog(spec),
    });
  }
  return streams;
}

export function buildApp(spec, now = Date.now()) {
  const owner = PEOPLE[spec.ownerKey] || PEOPLE.pavithra;
  const ago = (hours) => hoursAgo(now, hours);
  const files = spec.files || blueprint(spec);
  const seed = hashString(spec.slug);
  const metrics = spec.target === "None"
    ? null
    : spec.target === "Lambda"
      ? {
          kind: "lambda",
          invocations: series(seed, 120, 10),
          errors: series(seed >> 2, spec.health === "degraded" ? 8 : 1, 0),
          duration: series(seed >> 3, 240, 40),
          throttles: series(seed >> 4, spec.health === "progressing" ? 3 : 0, 0),
        }
      : {
          kind: "eks",
          requests: series(seed, 800, 50),
          errors: series(seed >> 2, spec.health === "degraded" ? 18 : 2, 0),
          latency: series(seed >> 3, spec.health === "degraded" ? 900 : 180, 40),
          cpu: series(seed >> 1, spec.health === "degraded" ? 78 : 42, 8),
        };

  return {
    id: spec.slug,
    slug: spec.slug,
    name: spec.name,
    description: spec.summary,
    tags: spec.tags || [spec.domain?.toLowerCase(), spec.stackKind].filter(Boolean),
    domain: spec.domain || "Other",
    ownerId: owner.id,
    ownerName: owner.name,
    repoUrl: spec.repoUrl || `https://github.com/${env.githubOrg}/${spec.slug}`,
    cloneUrl: `https://github.com/${env.githubOrg}/${spec.slug}.git`,
    branch: spec.branch || env.defaultBranch,
    stackKind: spec.stackKind,
    stackLabel: spec.stackLabel,
    database: spec.db || "—",
    target: spec.target || "EKS",
    aws: spec.aws || (spec.target === "Lambda" ? ["Lambda"] : spec.target === "None" ? [] : ["EKS"]),
    auth: spec.auth || "Microsoft Entra ID",
    pilot: Boolean(spec.pilot),
    health: spec.health || "healthy",
    source: spec.source || "catalog",
    onboardedAt: ago(spec.ageHours || 48),
    updatedAt: ago(spec.pipeline === "running" ? 0.4 : 5),
    integrations: spec.integrations || defaultIntegrations(spec),
    files,
    commits: buildCommits(spec, owner, ago),
    pulls: buildPulls(spec, owner, ago),
    pipelines: buildPipelines(spec, ago),
    tests: { name: spec.stackKind.startsWith("fastapi") ? "pytest" : spec.stackKind === "java-react" ? "maven verify" : "npm test", ...spec.tests },
    deployments: buildDeployments(spec, ago),
    findings: buildFindings(spec),
    tickets: buildTickets(spec, owner, ago),
    documents: buildDocs(spec, owner, ago),
    logs: buildLogs(spec, ago),
    metrics,
    quality: {
      coverage: spec.coverage ?? 80,
      bugs: spec.health === "degraded" ? 4 : 1,
      smells: Math.max(1, Math.round((100 - (spec.coverage ?? 80)) / 3)),
      duplications: (spec.coverage ?? 80) > 85 ? 1.1 : 3.2,
    },
  };
}

export function buildCatalog(now = Date.now()) {
  return CATALOG.map((spec) => buildApp(spec, now));
}
