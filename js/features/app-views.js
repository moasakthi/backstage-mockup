/**
 * Application 360 panels. Code is view-only. Reviews, tickets, sync, and logs
 * update the same catalog record the rest of the portal reads.
 */
import { el } from "../dom.js";
import { commit, getState } from "../store.js";
import { requestRefresh } from "../bus.js";
import { can } from "../rbac.js";
import { clock, downloadText, relTime } from "../format.js";
import { highlight } from "../highlight.js";
import { buildTree } from "../services/files.js";
import { analyseLog } from "../services/logs.js";
import { insightsFor } from "../services/insights.js";
import { changeApp, currentActor } from "../services/catalog-actions.js";
import { dismissFinding, moveTicket, publishLambda, reviewPull, syncDeployment } from "../services/reviews.js";
import { copyButton, emptyState, guardButton, healthTone, pill } from "../components/ui.js";
import { toast } from "../components/toast.js";
import { env } from "../env.js";

const analyses = new Map();
let range = 24;

function prose(text) {
  return el("div", { class: "stack" }, String(text).split(/\n\n/).map((part) => el("p", {}, part)));
}

function auditOnly(action, detail) {
  commit(() => {}, { action, detail, module: "applications" });
}

export function renderOverview(container, app) {
  const deploy = app.deployments[0];
  container.replaceChildren(el("div", { class: "grid-2" }, [
    el("section", { class: "card stack" }, [
      el("h2", {}, "About"),
      el("p", {}, app.description),
      el("div", { class: "cluster" }, app.tags.map((tag) => pill(tag, "muted"))),
      el("dl", { class: "kv" }, [
        el("dt", {}, "Owner"), el("dd", {}, app.ownerName),
        el("dt", {}, "Domain"), el("dd", {}, app.domain),
        el("dt", {}, "Stack"), el("dd", {}, app.stackLabel),
        el("dt", {}, "Data"), el("dd", {}, app.database),
        el("dt", {}, "Auth"), el("dd", {}, app.auth),
        el("dt", {}, "AWS"), el("dd", {}, app.aws.join(", ") || "None recorded"),
        el("dt", {}, "Source"), el("dd", {}, app.source),
      ]),
    ]),
    el("section", { class: "card stack" }, [
      el("h2", {}, "Clone"),
      el("p", { class: "mono" }, `git clone ${app.cloneUrl}`),
      el("div", { class: "cluster" }, [
        copyButton(`git clone ${app.cloneUrl}`, "Copy clone command"),
        copyButton(app.repoUrl, "Copy repo URL"),
      ]),
      el("p", { class: "hint" }, `Branch ${app.branch}. Open the Code tab to read files, commits, and pull requests.`),
      el("h3", {}, "Integrations"),
      el("div", { class: "cluster" }, [
        pill(app.integrations.ci.tool, "ok"),
        pill(app.integrations.cd.tool, "ok"),
        pill(app.integrations.monitoring.tool, "ok"),
        pill(app.integrations.issues.tool, "ok"),
        pill(app.integrations.documents.tool, "ok"),
        pill(app.integrations.security.tool, "ok"),
        pill("JFrog", app.integrations.artifacts.image ? "ok" : "muted"),
      ]),
      el("p", { class: "hint" }, app.integrations.artifacts.image || "No image is published for this repository."),
      el("p", { class: "hint" }, deploy ? `${deploy.tool} · ${deploy.sync} · ${deploy.health}` : "No deployment target."),
      el("p", { class: "hint" }, `Coverage ${app.quality.coverage}% · smells ${app.quality.smells} · bugs ${app.quality.bugs}`),
    ]),
  ]));
}

export function renderCode(container, app, route) {
  const mode = route.extra === "commits" || route.extra === "pulls" ? route.extra : "files";
  const sub = el("div", { class: "subtabs" }, [
    ["files", "Files"],
    ["commits", "Commits"],
    ["pulls", "Pull requests"],
  ].map(([id, label]) => el("a", {
    href: `#/applications/${app.slug}/code/${id === "files" ? "" : id}`,
    class: mode === id ? "active" : "",
  }, `${label}${id === "pulls" ? ` (${app.pulls.filter((pull) => pull.status !== "merged").length})` : ""}`)));
  const body = el("div");
  container.replaceChildren(sub, body);
  if (mode === "commits") renderCommits(body, app);
  else if (mode === "pulls") renderPulls(body, app, route);
  else renderFiles(body, app, route);
}

function renderFiles(container, app, route) {
  const tree = buildTree(app.files);
  const selected = route.query.file || app.files[0]?.path;
  const file = app.files.find((item) => item.path === selected) || app.files[0];
  if (!file) {
    container.append(emptyState("No files", "This repository snapshot is empty."));
    return;
  }
  const lines = file.content.split("\n");
  container.append(el("div", { class: "code-layout" }, [
    el("div", { class: "tree", "aria-label": "Repository files" }, renderBranch(tree, 0, file.path, app.slug)),
    el("div", { class: "code-view" }, [
      el("div", { class: "code-bar" }, [
        el("span", { class: "mono" }, file.path),
        el("span", { class: "hint" }, "View only"),
      ]),
      el("div", {}, lines.map((line, index) => el("div", { class: "code-line" }, [
        el("span", { class: "ln" }, String(index + 1)),
        el("code", { html: highlight(line || " ", file.language) }),
      ]))),
    ]),
  ]));
}

function branchHas(node, selected) {
  return node.files.some((file) => file.path === selected) || node.dirs.some((dir) => branchHas(dir, selected));
}

function renderBranch(node, depth, selected, slug) {
  const folders = node.dirs.map((dir) => {
    const open = branchHas(dir, selected);
    const children = el("div", { class: open ? "tree-children" : "tree-children is-collapsed" });
    children.append(renderBranch(dir, depth + 1, selected, slug));
    const row = el("button", {
      type: "button",
      class: "tree-row tree-dir",
      style: `--depth:${depth}`,
      "aria-expanded": open ? "true" : "false",
      onClick: () => {
        const collapsed = children.classList.toggle("is-collapsed");
        row.setAttribute("aria-expanded", collapsed ? "false" : "true");
        row.querySelector(".tree-glyph").textContent = collapsed ? "▸" : "▾";
      },
    }, [
      el("span", { class: "tree-glyph", "aria-hidden": "true" }, open ? "▾" : "▸"),
      dir.name,
    ]);
    return el("div", {}, [row, children]);
  });
  const files = node.files.map((file) => el("a", {
    href: `#/applications/${slug}/code?file=${encodeURIComponent(file.path)}`,
    class: file.path === selected ? "tree-row tree-file on" : "tree-row tree-file",
    style: `--depth:${depth}`,
  }, [
    el("span", { class: "tree-glyph", "aria-hidden": "true" }, "·"),
    file.path.split("/").pop(),
  ]));
  return el("div", {}, [...folders, ...files]);
}

function renderCommits(container, app) {
  container.append(el("div", { class: "stack" }, app.commits.map((commitItem) => el("article", { class: "card stack" }, [
    el("div", { class: "spread" }, [
      el("strong", {}, commitItem.message),
      el("span", { class: "mono" }, commitItem.sha),
    ]),
    el("p", { class: "hint" }, `${commitItem.author} · ${relTime(commitItem.at)}`),
    el("p", { class: "mono" }, commitItem.files.join(", ")),
  ]))));
}

function renderPulls(container, app, route) {
  const selected = app.pulls.find((pull) => String(pull.number) === route.more);
  if (!selected) {
    container.append(el("div", { class: "stack" }, app.pulls.map((pull) => el("a", { class: "card stack", href: `#/applications/${app.slug}/code/pulls/${pull.number}` }, [
      el("div", { class: "spread" }, [el("strong", {}, `#${pull.number} ${pull.title}`), pill(pull.status, healthTone(pull.status === "merged" ? "healthy" : pull.status === "changes_requested" ? "degraded" : "progressing"))]),
      el("span", { class: "hint" }, `${pull.author} · ${pull.branch} → ${pull.base} · ${relTime(pull.createdAt)}`),
    ]))));
    return;
  }
  const act = (decision) => {
    const error = changeApp(app.slug, "repos", "update", (record) => reviewPull(record, selected.number, decision, currentActor().name), {
      action: decision === "merge" ? "Pull request merged" : decision === "approve" ? "Pull request approved" : "Changes requested",
      detail: `${app.name} #${selected.number}`,
      module: "repos",
    });
    toast(error || `Pull request #${selected.number} updated`, error ? "bad" : "ok");
  };
  container.append(el("article", { class: "card stack" }, [
    el("a", { href: `#/applications/${app.slug}/code/pulls` }, "All pull requests"),
    el("div", { class: "spread" }, [el("h2", {}, `#${selected.number} ${selected.title}`), pill(selected.status, "info")]),
    el("p", { class: "hint" }, `${selected.author} wants to merge ${selected.branch} into ${selected.base}`),
    el("p", {}, selected.body),
    ...selected.files.map((file) => el("pre", { class: "patch" }, `${file.path}\n${file.patch}`)),
    el("div", {}, selected.reviews.length
      ? selected.reviews.map((review) => el("p", { class: "hint" }, `${review.author} ${review.decision} · ${relTime(review.at)}`))
      : el("p", { class: "hint" }, "No reviews yet.")),
    el("div", { class: "cluster" }, [
      guardButton("Approve", "repos", "update", "btn-primary", () => act("approve")),
      guardButton("Request changes", "repos", "update", "", () => act("changes")),
      guardButton("Merge", "repos", "update", "", () => act("merge")),
    ]),
    el("p", { class: "hint" }, "Merge stays disabled in spirit until the request is approved. The portal enforces that order."),
  ]));
}

export function renderCicd(container, app) {
  container.replaceChildren(el("div", { class: "stack" }, [
    el("h2", {}, "GitHub Actions"),
    ...app.pipelines.map((run) => el("article", { class: "card stack" }, [
      el("div", { class: "spread" }, [
        el("strong", {}, `${run.name} · ${run.sha}`),
        pill(run.status, healthTone(run.status === "success" ? "healthy" : run.status === "failure" ? "degraded" : "progressing")),
      ]),
      el("p", { class: "hint" }, `${run.branch} · ${relTime(run.startedAt)} · ${run.duration}`),
      el("pre", { class: "patch" }, run.log),
      logActions(app, { id: run.id, stream: `actions-${run.name}`, text: run.log }),
    ])),
    el("h2", {}, "Test runs"),
    el("div", { class: "table-wrap" }, el("table", {}, [
      el("thead", {}, el("tr", {}, ["Suite", "Passed", "Failed", "Skipped"].map((label) => el("th", {}, label)))),
      el("tbody", {}, el("tr", {}, [
        el("td", {}, app.tests.name),
        el("td", {}, String(app.tests.passed)),
        el("td", {}, String(app.tests.failed)),
        el("td", {}, String(app.tests.skipped)),
      ])),
    ])),
    el("button", {
      type: "button",
      class: "btn btn-sm",
      onClick: () => downloadText(`${app.slug}-tests.txt`, `${app.tests.name}\npassed ${app.tests.passed}\nfailed ${app.tests.failed}\nskipped ${app.tests.skipped}\n`),
    }, "Download test report"),
  ]));
}

function logActions(app, log) {
  const analysis = analyses.get(log.id);
  return el("div", { class: "stack" }, [
    el("div", { class: "cluster" }, [
      el("button", {
        type: "button",
        class: "btn btn-sm",
        onClick: () => {
          downloadText(`${app.slug}-${log.stream}.log`, log.text);
          auditOnly("Log downloaded", `${app.name} · ${log.stream}`);
          toast("Log downloaded");
        },
      }, "Download log"),
      el("button", {
        type: "button",
        class: "btn btn-sm",
        onClick: () => {
          analyses.set(log.id, analyseLog(log.text, app.name));
          auditOnly("Log analysed", `${app.name} · ${log.stream}`);
          requestRefresh();
        },
      }, "AI analyse"),
    ]),
    analysis ? el("div", { class: "card stack" }, [
      el("strong", {}, "Rule-based analysis"),
      el("p", {}, analysis.summary),
      el("p", {}, analysis.suggestion),
      analysis.top.length ? el("ul", {}, analysis.top.map(([line, count]) => el("li", { class: "mono" }, `${count}× ${line}`))) : null,
    ]) : null,
  ]);
}

export function renderDeployments(container, app) {
  const deploy = app.deployments[0];
  if (!deploy) {
    container.append(emptyState("No deployment target", "The assessment did not record EKS or Lambda for this repository. CI can still run."));
    return;
  }
  const sync = () => {
    const error = changeApp(app.slug, "deployments", "update", (record) => syncDeployment(record), {
      action: "Argo CD sync",
      detail: app.name,
      module: "deployments",
    });
    toast(error || "Argo CD reports Synced.", error ? "bad" : "ok");
  };
  const publish = () => {
    const error = changeApp(app.slug, "deployments", "update", (record) => publishLambda(record), {
      action: "Lambda alias published",
      detail: app.name,
      module: "deployments",
    });
    toast(error || "Lambda alias published from NH44.", error ? "bad" : "ok");
  };
  container.replaceChildren(el("div", { class: "stack" }, [
    el("div", { class: "card stack" }, [
      el("div", { class: "spread" }, [el("h2", {}, deploy.tool), pill(deploy.health, healthTone(deploy.health))]),
      el("dl", { class: "kv" }, [
        el("dt", {}, "Name"), el("dd", {}, deploy.name),
        el("dt", {}, "Environment"), el("dd", {}, deploy.environment),
        el("dt", {}, "Revision"), el("dd", { class: "mono" }, deploy.revision),
        el("dt", {}, "Sync"), el("dd", {}, deploy.sync),
        el("dt", {}, "Updated"), el("dd", {}, clock(deploy.at)),
      ]),
      deploy.tool === "Argo CD"
        ? guardButton("Sync", "deployments", "update", "btn-primary", sync)
        : guardButton("Publish alias", "deployments", "update", "btn-primary", publish),
      deploy.tool !== "Argo CD" ? el("p", { class: "hint" }, "Argo CD delivers EKS services. This application uses GitHub Actions.") : null,
    ]),
    el("h3", {}, "History"),
    el("div", { class: "stack" }, deploy.history.map((item) => el("div", { class: "spread card" }, [
      el("span", { class: "mono" }, item.revision),
      el("span", {}, item.note),
      el("span", { class: "hint" }, relTime(item.at)),
    ]))),
  ]));
}

export function renderSecurity(container, app) {
  const open = app.findings.filter((item) => item.status === "open");
  container.replaceChildren(el("div", { class: "stack" }, [
    el("p", { class: "hint" }, `CodeQL suite ${app.integrations.security.suite}. ${open.length} open of ${app.findings.length}.`),
    app.findings.length ? el("div", { class: "table-wrap" }, el("table", {}, [
      el("thead", {}, el("tr", {}, ["Severity", "Rule", "Location", "Status", ""].map((label) => el("th", {}, label)))),
      el("tbody", {}, app.findings.map((finding) => el("tr", {}, [
        el("td", {}, pill(finding.severity, finding.severity === "high" ? "bad" : finding.severity === "medium" ? "warn" : "muted")),
        el("td", {}, [el("div", {}, finding.rule), el("div", { class: "hint" }, finding.message)]),
        el("td", {}, el("a", { class: "mono", href: `#/applications/${app.slug}/code?file=${encodeURIComponent(finding.file)}` }, `${finding.file}:${finding.line}`)),
        el("td", {}, finding.status),
        el("td", {}, guardButton(finding.status === "open" ? "Dismiss" : "Reopen", "security", "update", "btn-sm", () => {
          const error = changeApp(app.slug, "security", "update", (record) => dismissFinding(record, finding.id), {
            action: finding.status === "open" ? "Finding dismissed" : "Finding reopened",
            detail: `${app.name} ${finding.rule}`,
            module: "security",
          });
          if (error) toast(error, "bad");
        })),
      ]))),
    ])) : emptyState("No CodeQL findings", "The default branch scan is clear."),
  ]));
}

export function renderIssues(container, app) {
  const statuses = ["To Do", "In Progress", "In Review", "Done"];
  container.replaceChildren(el("div", { class: "stack" }, [
    el("p", { class: "hint" }, `Jira ${app.integrations.issues.projectKey} on ${app.integrations.issues.site}. Status changes are written here and audited.`),
    ...app.tickets.map((ticket) => el("article", { class: "card stack" }, [
      el("div", { class: "spread" }, [
        el("strong", {}, `${ticket.key} ${ticket.summary}`),
        pill(ticket.priority, ticket.priority === "High" ? "bad" : "muted"),
      ]),
      el("p", {}, ticket.description),
      el("div", { class: "cluster" }, [
        el("span", { class: "hint" }, `${ticket.assignee} · ${relTime(ticket.updatedAt)}`),
        el("select", {
          "aria-label": `Status for ${ticket.key}`,
          value: ticket.status,
          disabled: !can("applications", "update"),
          onChange: (event) => {
            const status = event.target.value;
            const error = changeApp(app.slug, "applications", "update", (record) => moveTicket(record, ticket.key, status), {
              action: "Jira status changed",
              detail: `${ticket.key} → ${status}`,
              module: "applications",
            });
            if (error) toast(error, "bad");
          },
        }, statuses.map((status) => el("option", { value: status }, status))),
      ]),
    ])),
  ]));
}

export function renderDocuments(container, app, route) {
  const current = app.documents.find((doc) => doc.id === route.extra) || null;
  if (current) {
    container.replaceChildren(el("article", { class: "card stack" }, [
      el("a", { href: `#/applications/${app.slug}/documents` }, "All documents"),
      el("p", { class: "kicker" }, current.space),
      el("h2", {}, current.title),
      el("p", { class: "hint" }, `${current.author} · ${relTime(current.updatedAt)}`),
      prose(current.body),
    ]));
    return;
  }
  container.replaceChildren(el("div", { class: "stack" }, app.documents.map((doc) => el("a", { class: "card stack", href: `#/applications/${app.slug}/documents/${doc.id}` }, [
    el("strong", {}, doc.title),
    el("span", { class: "hint" }, `${doc.space} · ${doc.author} · ${relTime(doc.updatedAt)}`),
  ]))));
}

export function renderMonitoring(container, app) {
  const base = getState().settings.grafanaBaseUrl;
  if (!app.metrics) {
    container.append(emptyState("Monitoring is inactive", "This repository has no deployment target, so Grafana and OpenTelemetry have nothing to scrape yet."));
    return;
  }
  const panels = app.metrics.kind === "lambda"
    ? [["Invocations", app.metrics.invocations], ["Errors", app.metrics.errors], ["Duration (ms)", app.metrics.duration], ["Throttles", app.metrics.throttles]]
    : [["Requests", app.metrics.requests], ["Errors", app.metrics.errors], ["p95 latency (ms)", app.metrics.latency], ["CPU %", app.metrics.cpu]];
  container.replaceChildren(el("div", { class: "stack" }, [
    el("div", { class: "spread" }, [
      el("div", {}, [
        el("h2", {}, "Grafana"),
        el("p", { class: "hint" }, `${app.integrations.monitoring.folder} / ${app.integrations.monitoring.dashboard}. Prometheus scrapes the OpenTelemetry exporter.`),
      ]),
      el("div", { class: "cluster" }, [
        ...[24, 6, 1].map((hours) => el("button", { type: "button", class: `chip ${range === hours ? "on" : ""}`, onClick: () => { range = hours; requestRefresh(); } }, `${hours}h`)),
        el("button", {
          type: "button",
          class: "btn btn-sm",
          onClick: () => openGrafana(app, base),
        }, "Open Grafana (SSO)"),
      ]),
    ]),
    el("div", { class: "grafana" }, [
      el("header", {}, "NH44 · embedded view"),
      el("div", { class: "grid-2" }, panels.map(([label, values]) => el("div", { class: "card stack" }, [
        el("span", { class: "hint" }, label),
        spark(values.slice(-range)),
        el("strong", {}, String(values[values.length - 1])),
      ]))),
    ]),
    base ? el("iframe", { class: "grafana-live", title: `${app.name} Grafana`, src: `${base.replace(/\/$/, "")}/d/${app.slug}?kiosk` }) : el("p", { class: "hint" }, "No Grafana base URL is set. The panels above are the in-portal view. Add a base URL in Settings to embed an iframe."),
    el("h2", {}, "Runtime logs"),
    ...app.logs.map((log) => el("article", { class: "card stack" }, [
      el("div", { class: "spread" }, [el("strong", {}, log.stream), el("span", { class: "hint" }, log.environment)]),
      el("pre", { class: "patch" }, log.text),
      logActions(app, log),
    ])),
  ]));
}

function openGrafana(app, base) {
  import("../components/modal.js").then(({ openModal: show }) => {
    show({
      title: "Grafana SSO",
      body: el("div", { class: "stack" }, [
        el("p", {}, "The configured Grafana session opens inside NH44. You are not sent to another product tab."),
        el("p", { class: "hint" }, base ? `Embedding ${base}` : "Settings has no Grafana base URL, so this is the in-portal board."),
        el("p", { class: "mono" }, `${env.grafanaFolder} / ${app.integrations.monitoring.dashboard}`),
      ]),
    });
  });
}

function spark(values) {
  const nums = values.map(Number);
  const max = Math.max(...nums, 1);
  const min = Math.min(...nums, 0);
  const width = 320;
  const height = 72;
  const points = nums.map((value, index) => {
    const x = (index / Math.max(nums.length - 1, 1)) * width;
    const y = height - 6 - ((value - min) / (max - min || 1)) * (height - 12);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(" ");
  return el("svg", { class: "spark", viewBox: `0 0 ${width} ${height}`, html: `<polyline fill="none" stroke="currentColor" stroke-width="2" points="${points}" />` });
}

export function renderInsights(container, app) {
  const items = insightsFor(app);
  container.replaceChildren(el("div", { class: "stack" }, [
    el("p", { class: "hint" }, "Insights are rule-based and recomputed from the live record. They change when you dismiss a finding, merge a pull request, or sync a deploy."),
    ...items.map((item) => el("article", { class: "card stack" }, [
      pill(item.tone === "bad" ? "Attention" : item.tone === "warn" ? "Watch" : item.tone === "ok" ? "Clear" : "Note", healthTone(item.tone === "bad" ? "degraded" : item.tone === "warn" ? "OutOfSync" : item.tone === "ok" ? "healthy" : "progressing")),
      el("h2", {}, item.title),
      el("p", {}, item.body),
    ])),
    el("button", {
      type: "button",
      class: "btn",
      onClick: () => {
        const panel = document.querySelector(".chat-panel");
        const launcher = document.querySelector(".chat-launcher");
        if (launcher && panel?.hidden) launcher.click();
        const input = document.querySelector(".chat-panel input");
        if (input) {
          input.value = `Summarize ${app.slug}`;
          input.form?.requestSubmit();
        }
      },
    }, "Ask the assistant about this application"),
  ]));
}
