/**
 * Onboarding wizard.
 * Single existing: assess a GitHub repo and autofetch configured plugins.
 * Single new: stamp a golden-path template into the catalog.
 * Bulk file: CSV or Excel. Bulk org: multi-select from the configured GitHub org.
 * This mock records the catalog entry. It does not call GitHub to create remotes.
 */
import { el } from "../dom.js";
import { env } from "../env.js";
import { getState } from "../store.js";
import { requestRefresh } from "../bus.js";
import { PEOPLE } from "../people.js";
import { CATALOG, EXTRA_REPOS } from "../data/catalog.js";
import { TEMPLATES } from "../data/templates.js";
import { buildApp } from "../data/generate.js";
import { blueprint, withStandardCi } from "../data/file-blueprints.js";
import { deriveProjectKey, downloadText, slugify } from "../format.js";
import { assessRepo } from "../services/assessment.js";
import { defaultIntegrations } from "../services/integrations.js";
import { BULK_SAMPLE, parseCsv, recordsToApps, sheetToRecords, toCsv } from "../services/bulk.js";
import { addApps, saveDraft } from "../services/catalog-actions.js";
import { emptyState, field, pageHeader, pill, stepper } from "../components/ui.js";
import { toast } from "../components/toast.js";

const DOMAINS = ["AIDD", "Other", "Connected Apps"];

function fresh() {
  return {
    path: "",
    step: 0,
    existing: {
      name: "",
      description: "",
      tags: "",
      repoUrl: "",
      branch: env.defaultBranch,
      domain: "AIDD",
      ownerKey: "pavithra",
      assessment: null,
      integrations: null,
      fallback: false,
    },
    neu: { templateId: "mern", name: "", description: "", tags: "", repoName: "", repoLocked: false, domain: "AIDD", ownerKey: "admin" },
    bulkFile: { fileName: "", records: [], errors: [], apps: [] },
    bulkOrg: { fetched: false, selected: [] },
  };
}

function model() {
  if (!getState().drafts.onboard) saveDraft(fresh());
  return getState().drafts.onboard;
}

function patch(recipe) {
  const next = structuredClone(model());
  recipe(next);
  saveDraft(next);
  requestRefresh();
}

function input(value, onValue, attrs = {}) {
  return el("input", {
    ...attrs,
    value: value || "",
    onInput: (event) => onValue(event.target.value),
  });
}

function remember(recipe) {
  const next = structuredClone(model());
  recipe(next);
  saveDraft(next);
}

export function render(container) {
  const draft = model();
  const body = el("div", { class: draft.path ? "stack wizard" : "stack" });
  container.replaceChildren(
    pageHeader("Onboard an application", "Provide the application details. GitHub, Actions, Argo CD, Grafana, Jira, Confluence, CodeQL, and AWS are already connected."),
    body,
  );
  if (!draft.path) choose(body);
  else if (draft.path === "existing") existing(body, draft);
  else if (draft.path === "new") created(body, draft);
  else if (draft.path === "bulk-file") bulkFile(body, draft);
  else bulkOrg(body, draft);
}

function choose(container) {
  const card = (path, kicker, title, copy) => el("button", {
    type: "button",
    class: "card path-card",
    onClick: () => patch((draft) => { draft.path = path; draft.step = 0; }),
  }, [el("span", { class: "kicker" }, kicker), el("strong", {}, title), el("span", { class: "hint" }, copy)]);
  container.append(
    el("div", { class: "path-grid" }, [
      card("existing", "Single", "Existing repository", "Assess a GitHub repository already in the configured organization."),
      card("new", "Single", "New service", "Start from a golden-path template with CI, CodeQL, Terraform, Argo CD, and OpenTelemetry."),
      card("bulk-file", "Bulk", "Template file", "Download CSV or Excel, fill it, and upload."),
      card("bulk-org", "Bulk", "GitHub organization", "Fetch tkm-digital and choose the repositories to bring in."),
    ]),
    getState().drafts.onboard?.path ? null : el("p", { class: "hint" }, "NH44 records new entries in this browser catalog. It does not create repositories on GitHub."),
  );
}

function backToPaths() {
  patch((draft) => {
    draft.path = "";
    draft.step = 0;
  });
}

function existing(container, draft) {
  const labels = ["Repository", "Assessment", "Integrations", "Review"];
  container.append(stepper(labels, draft.step), el("button", { type: "button", class: "btn btn-ghost btn-sm", onClick: backToPaths }, "All onboarding paths"));
  if (draft.step === 0) repoStep(container, draft);
  else if (draft.step === 1) assessStep(container, draft);
  else if (draft.step === 2) integrationStep(container, draft);
  else reviewExisting(container, draft);
}

function repoStep(container, draft) {
  const data = draft.existing;
  container.append(el("div", { class: "card stack" }, [
    field("Application name", input(data.name, (value) => remember((next) => { next.existing.name = value; }), { placeholder: "Filled from the repository name after analysis" })),
    field("Description", el("textarea", { rows: "3", value: data.description, onInput: (event) => remember((next) => { next.existing.description = event.target.value; }) })),
    field("Tags", input(data.tags, (value) => remember((next) => { next.existing.tags = value; }), { placeholder: "eks; aidd" })),
    field("Repository URL", input(data.repoUrl, (value) => remember((next) => { next.existing.repoUrl = value; }), { placeholder: `https://github.com/${env.githubOrg}/your-service` })),
    field("Branch", input(data.branch, (value) => remember((next) => { next.existing.branch = value; }))),
    field("Domain", el("select", { value: data.domain, onChange: (event) => remember((next) => { next.existing.domain = event.target.value; }) }, DOMAINS.map((domain) => el("option", { value: domain }, domain)))),
    field("Owner", ownerSelect(data.ownerKey, (value) => remember((next) => { next.existing.ownerKey = value; }))),
    el("div", { class: "cluster" }, [
      el("button", { type: "button", class: "btn btn-primary", onClick: () => analyse(model()) }, "Analyse"),
    ]),
    el("p", { class: "hint" }, "Analyse reads repository metadata through the configured GitHub plugin. The default assessment is rule-based."),
  ]));
}

async function analyse(draft) {
  const repoUrl = draft.existing.repoUrl.trim();
  const result = assessRepo({ repoUrl, branch: draft.existing.branch || "main" });
  if (!result.ok) {
    toast(result.error, "bad");
    return;
  }
  if (result.alreadyOnboarded) {
    toast("That repository is already in the catalog.", "bad");
    return;
  }
  const settings = getState().settings;
  const { files, ...rest } = result;
    void files;
    patch((next) => {
    next.existing.assessment = rest;
    next.existing.name = next.existing.name || result.repo;
    next.existing.description = next.existing.description || `${result.repo} onboarded from GitHub.`;
    next.existing.fallback = settings.assessmentMode === "ollama";
    next.existing.integrations = defaultIntegrations({
      name: next.existing.name || result.repo,
      slug: result.repo,
      stackKind: result.stackKind,
      target: result.target,
      aws: result.target === "Lambda" ? ["Lambda"] : result.target === "None" ? [] : ["EKS"],
    }, { ciDetected: result.signals.find((signal) => signal.label === "CI workflow")?.ok });
    next.step = 1;
  });
  if (settings.assessmentMode === "ollama") {
    toast("Ollama is not reachable from this mockup. The rule-based assessment ran instead.", "bad");
  }
}

function assessStep(container, draft) {
  const assessment = draft.existing.assessment;
  if (!assessment) {
    container.append(emptyState("No assessment yet", "Go back and analyse a repository."));
    return;
  }
  container.append(el("div", { class: "card stack" }, [
    draft.existing.fallback ? el("div", { class: "banner" }, `Ollama at ${getState().settings.ollamaEndpoint} did not respond. This result is rule-based.`) : el("p", { class: "hint" }, "Assessment mode: rule-based."),
    el("div", { class: "cluster" }, [pill(assessment.stackLabel, "info"), pill(assessment.target, "muted"), pill(assessment.branch, "muted")]),
    el("h3", {}, "Signals"),
    ...assessment.signals.map((signal) => el("div", { class: "check" }, [
      el("i", { class: `dot ${signal.ok ? "ok" : "bad"}` }),
      el("div", {}, [el("strong", {}, signal.label), el("div", { class: "hint" }, signal.detail)]),
    ])),
    el("h3", {}, "Folders"),
    el("p", { class: "mono" }, assessment.folders.join("  ·  ")),
    el("h3", {}, "Recommendations"),
    el("ul", {}, assessment.recommendations.map((item) => el("li", {}, item))),
    navButtons(0, () => patch((next) => { next.step = 2; })),
  ]));
}

function integrationStep(container, draft) {
  const item = draft.existing.integrations;
  const target = draft.existing.assessment.target;
  container.append(el("div", { class: "card stack" }, [
    el("p", { class: "hint" }, "These connections are autofetched. NH44 does not ask for tokens."),
    row("CI", `${item.ci.tool} · ${item.ci.state === "attach" ? "standard workflow will be added" : "workflow detected"}`),
    row("CD", target === "Lambda" ? "GitHub Actions to Lambda. Argo CD is not used for this target." : target === "None" ? "No deployment target, so Argo CD is not attached." : `${item.cd.tool} project ${item.cd.project}`),
    row("Monitoring", `${item.monitoring.tool} and ${item.monitoring.companion}`),
    row("Issues", item.issues.tool),
    row("Documents", `${item.documents.tool} space ${item.documents.space}`),
    row("Security", `${item.security.tool} (${item.security.suite})`),
    field("Jira project key", input(item.issues.projectKey, (value) => remember((next) => { next.existing.integrations.issues.projectKey = value.toUpperCase(); }))),
    field("Grafana dashboard", input(item.monitoring.dashboard, (value) => remember((next) => { next.existing.integrations.monitoring.dashboard = value; }))),
    navButtons(1, () => patch((next) => { next.step = 3; })),
  ]));
}

function reviewExisting(container, draft) {
  const data = draft.existing;
  container.append(el("div", { class: "card stack" }, [
    el("h2", {}, data.name || data.assessment.repo),
    el("p", {}, data.description),
    el("p", { class: "mono" }, data.repoUrl),
    el("p", { class: "hint" }, "Onboard writes the application into the NH44 catalog, including a code snapshot, pipeline, tickets, and documents. The GitHub repository itself is not created or modified."),
    el("div", { class: "cluster" }, [
      el("button", { type: "button", class: "btn btn-ghost", onClick: () => patch((next) => { next.step = 2; }) }, "Back"),
      el("button", { type: "button", class: "btn btn-primary", onClick: () => finishExisting(model()) }, "Onboard application"),
    ]),
  ]));
}

function finishExisting(draft) {
  const data = draft.existing;
  const name = data.name.trim();
  const slug = slugify(name);
  if (!name || !slug) {
    toast("Application name is required.", "bad");
    return;
  }
  if (getState().apps.some((app) => app.slug === slug)) {
    toast("An application with that id is already in the catalog.", "bad");
    return;
  }
  const ciMissing = data.integrations.ci.state === "attach";
  const fileSpec = {
    slug,
    name,
    summary: data.description,
    stackKind: data.assessment.stackKind,
    stackLabel: data.assessment.stackLabel,
    target: data.assessment.target,
    branch: data.branch || "main",
    omitCi: ciMissing,
    tags: data.tags.split(/[;,]/).map((tag) => tag.trim()).filter(Boolean),
  };
  let files = blueprint(fileSpec);
  if (ciMissing) files = withStandardCi(files, fileSpec);
  const app = buildApp({
    ...fileSpec,
    db: data.assessment.database,
    aws: data.assessment.target === "Lambda" ? ["Lambda", "S3"] : data.assessment.target === "None" ? [] : ["WAF", "ALB", "Route 53", "ACM"],
    auth: "Microsoft Entra ID",
    domain: data.domain,
    ownerKey: data.ownerKey,
    health: data.assessment.target === "None" ? "undeployed" : "healthy",
    coverage: 72,
    sync: "Synced",
    deployHealth: data.assessment.target === "None" ? "—" : "Healthy",
    pipeline: "success",
    jira: data.integrations.issues.projectKey || deriveProjectKey(name),
    findings: { high: 0, medium: 0, low: 1 },
    tests: { passed: 8, failed: 0, skipped: 0 },
    ageHours: 0.1,
    openPull: false,
    source: "existing",
    repoUrl: data.repoUrl.trim(),
    files,
    integrations: data.integrations,
  });
  addApps([app], name);
  toast(`${name} is in the catalog.`);
  location.hash = `#/applications/${slug}`;
}

function created(container, draft) {
  const labels = ["Template", "Service", "What will be created"];
  container.append(stepper(labels, draft.step), el("button", { type: "button", class: "btn btn-ghost btn-sm", onClick: backToPaths }, "All onboarding paths"));
  if (draft.step === 0) templateStep(container, draft);
  else if (draft.step === 1) serviceStep(container, draft);
  else previewStep(container, draft);
}

function templateStep(container, draft) {
  container.append(el("div", { class: "stack" }, TEMPLATES.map((template) => el("button", {
    type: "button",
    class: `card path-card ${draft.neu.templateId === template.id ? "on" : ""}`,
    onClick: () => patch((next) => { next.neu.templateId = template.id; next.step = 1; }),
  }, [
    el("strong", {}, template.name),
    el("span", { class: "hint" }, template.summary),
  ]))));
}

function serviceStep(container, draft) {
  const data = draft.neu;
  container.append(el("div", { class: "card stack" }, [
    field("Application name", input(data.name, (value) => remember((next) => {
      next.neu.name = value;
      if (!next.neu.repoLocked) next.neu.repoName = slugify(value);
    }))),
    field("Repository name", input(data.repoName, (value) => remember((next) => {
      next.neu.repoLocked = true;
      next.neu.repoName = slugify(value);
    }), { placeholder: "created under tkm-digital" })),
    field("Description", el("textarea", { rows: "3", value: data.description, onInput: (event) => remember((next) => { next.neu.description = event.target.value; }) })),
    field("Tags", input(data.tags, (value) => remember((next) => { next.neu.tags = value; }))),
    field("Domain", el("select", { value: data.domain, onChange: (event) => remember((next) => { next.neu.domain = event.target.value; }) }, DOMAINS.map((domain) => el("option", { value: domain }, domain)))),
    field("Owner", ownerSelect(data.ownerKey, (value) => remember((next) => { next.neu.ownerKey = value; }))),
    navButtons(0, () => {
      if (!model().neu.name.trim() || !model().neu.repoName) {
        toast("Name and repository are required.", "bad");
        return;
      }
      patch((next) => { next.step = 2; });
    }),
  ]));
}

function previewStep(container, draft) {
  const template = TEMPLATES.find((item) => item.id === draft.neu.templateId);
  container.append(el("div", { class: "card stack" }, [
    el("h2", {}, template.name),
    el("p", {}, "The catalog entry will include:"),
    el("ul", {}, template.includes.map((item) => el("li", {}, item))),
    el("p", { class: "mono" }, `https://github.com/${env.githubOrg}/${draft.neu.repoName}`),
    el("p", { class: "hint" }, "NH44 will show this repository as created in the catalog, with boilerplate, workflows, Terraform, and Argo CD. It will not call GitHub."),
    el("div", { class: "cluster" }, [
      el("button", { type: "button", class: "btn btn-ghost", onClick: () => patch((next) => { next.step = 1; }) }, "Back"),
      el("button", { type: "button", class: "btn btn-primary", onClick: () => finishTemplate(model(), template) }, "Create service"),
    ]),
  ]));
}

function finishTemplate(draft, template) {
  const name = draft.neu.name.trim();
  const slug = slugify(draft.neu.repoName || name);
  if (getState().apps.some((app) => app.slug === slug)) {
    toast("That repository name is already in the catalog.", "bad");
    return;
  }
  const app = buildApp({
    slug,
    name,
    summary: draft.neu.description || template.summary,
    tags: draft.neu.tags.split(/[;,]/).map((tag) => tag.trim()).filter(Boolean).concat(["template", template.id]),
    domain: draft.neu.domain,
    ownerKey: draft.neu.ownerKey,
    stackKind: template.stackKind,
    stackLabel: template.stackLabel,
    db: template.stackKind.startsWith("fastapi") || template.stackKind === "java-react" ? "PostgreSQL" : "MongoDB",
    target: "EKS",
    aws: ["EKS", "ALB", "Route 53", "ACM"],
    auth: "Microsoft Entra ID",
    health: "progressing",
    coverage: 40,
    sync: "Synced",
    deployHealth: "Progressing",
    pipeline: "running",
    jira: deriveProjectKey(name),
    findings: { high: 0, medium: 0, low: 0 },
    tests: { passed: 1, failed: 0, skipped: 0 },
    ageHours: 0.05,
    openPull: false,
    source: "template",
    branch: "main",
  });
  addApps([app], `${name} from ${template.name}`);
  toast(`${name} was created in the catalog.`);
  location.hash = `#/applications/${slug}`;
}

function bulkFile(container, draft) {
  container.append(stepper(["Template", "Review", "Confirm"], Math.min(draft.step, 2)), el("button", { type: "button", class: "btn btn-ghost btn-sm", onClick: backToPaths }, "All onboarding paths"));
  if (draft.step === 0) {
    container.append(el("div", { class: "card stack" }, [
      el("p", {}, "Download the template, fill one row per application, and upload CSV or Excel. The sample rows are real enough to import unchanged."),
      el("div", { class: "cluster" }, [
        el("button", { type: "button", class: "btn", onClick: () => downloadText("nh44-onboarding-template.csv", toCsv(BULK_SAMPLE), "text/csv") }, "Download CSV"),
        el("button", { type: "button", class: "btn", onClick: downloadWorkbook }, "Download Excel"),
      ]),
      field("Upload filled template", el("input", { type: "file", accept: ".csv,.xlsx,.xls", onChange: (event) => readUpload(event.target.files[0]) })),
    ]));
    return;
  }
  const file = draft.bulkFile;
  container.append(el("div", { class: "card stack" }, [
    el("p", {}, `${file.fileName}: ${file.apps.length} ready, ${file.errors.length} skipped.`),
    file.errors.length ? el("ul", {}, file.errors.map((error) => el("li", {}, `Row ${error.line}: ${error.message}`))) : null,
    file.apps.length ? el("div", { class: "table-wrap" }, el("table", {}, [
      el("thead", {}, el("tr", {}, ["Name", "Repository", "Stack"].map((label) => el("th", {}, label)))),
      el("tbody", {}, file.apps.map((app) => el("tr", {}, [el("td", {}, app.name), el("td", { class: "mono" }, app.repoUrl), el("td", {}, app.stackLabel)]))),
    ])) : emptyState("Nothing to import", "Fix the file and upload it again."),
    el("div", { class: "cluster" }, [
      el("button", { type: "button", class: "btn btn-ghost", onClick: () => patch((next) => { next.step = 0; }) }, "Back"),
      el("button", {
        type: "button",
        class: "btn btn-primary",
        disabled: !file.apps.length,
        onClick: () => {
          const apps = model().bulkFile.apps;
          addApps(apps, apps.map((app) => app.name).join(", "));
          toast(`Onboarded ${apps.length} applications.`);
          location.hash = "#/applications";
        },
      }, "Onboard ready rows"),
    ]),
  ]));
}

async function readUpload(file) {
  if (!file) return;
  try {
    let records = [];
    if (/\.csv$/i.test(file.name)) records = parseCsv(await file.text());
    else if (globalThis.XLSX) {
      const book = globalThis.XLSX.read(await file.arrayBuffer(), { type: "array" });
      const sheet = book.Sheets[book.SheetNames[0]];
      records = sheetToRecords(globalThis.XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }));
    } else {
      toast("Excel support did not load. Save the sheet as CSV and upload that.", "bad");
      return;
    }
    const { apps, errors } = recordsToApps(records, getState().apps);
    patch((draft) => {
      draft.bulkFile = { fileName: file.name, records, errors, apps };
      draft.step = 1;
    });
  } catch (error) {
    toast(error.message || "The file could not be read.", "bad");
  }
}

function downloadWorkbook() {
  if (!globalThis.XLSX) {
    toast("Excel support did not load. Download the CSV, which Excel can open.", "bad");
    return;
  }
  const book = globalThis.XLSX.utils.book_new();
  const sheet = globalThis.XLSX.utils.json_to_sheet(BULK_SAMPLE, { header: ["application_name", "description", "tags", "repo_url", "branch", "owner", "domain", "stack"] });
  const help = globalThis.XLSX.utils.aoa_to_sheet([
    ["Column", "Required", "Notes"],
    ["application_name", "yes", "Unique in the NH44 catalog"],
    ["repo_url", "yes", `https://github.com/${env.githubOrg}/<repo>`],
    ["branch", "no", "Defaults to main"],
    ["owner", "no", "Pavithra S, Rathi, Sreeprabha, Rashi, NH44 Platform Admin"],
    ["domain", "no", "AIDD, Other, or Connected Apps"],
    ["stack", "no", "MERN, MEAN, FastAPI, Java, Next.js"],
    ["tags", "no", "Semicolon separated"],
  ]);
  globalThis.XLSX.utils.book_append_sheet(book, sheet, "Applications");
  globalThis.XLSX.utils.book_append_sheet(book, help, "Instructions");
  globalThis.XLSX.writeFile(book, "nh44-onboarding-template.xlsx");
}

function bulkOrg(container, draft) {
  container.append(stepper(["Fetch", "Select", "Confirm"], draft.step), el("button", { type: "button", class: "btn btn-ghost btn-sm", onClick: backToPaths }, "All onboarding paths"));
  const repos = orgInventory();
  if (!draft.bulkOrg.fetched) {
    container.append(el("div", { class: "card stack" }, [
      el("p", {}, `The GitHub plugin is configured for ${env.githubOrg}. Fetch lists repositories the token can see. Repositories already in the catalog cannot be selected again.`),
      el("button", {
        type: "button",
        class: "btn btn-primary",
        onClick: async (event) => {
          event.target.disabled = true;
          event.target.textContent = "Fetching from GitHub…";
          await new Promise((resolve) => setTimeout(resolve, 700));
          patch((next) => { next.bulkOrg.fetched = true; next.step = 1; });
        },
      }, "Fetch repositories"),
    ]));
    return;
  }
  if (draft.step === 1) {
    container.append(el("div", { class: "stack" }, repos.map((repo) => el("label", { class: "card spread" }, [
      el("span", {}, [
        el("strong", {}, repo.slug),
        el("span", { class: "hint" }, ` ${repo.description}`),
      ]),
      repo.onboarded
        ? pill("In catalog", "muted")
        : el("input", {
          type: "checkbox",
          checked: draft.bulkOrg.selected.includes(repo.slug),
          onChange: (event) => remember((next) => {
            const selected = new Set(next.bulkOrg.selected);
            if (event.target.checked) selected.add(repo.slug);
            else selected.delete(repo.slug);
            next.bulkOrg.selected = [...selected];
          }),
        }),
    ]))), el("div", { class: "cluster" }, [
      el("button", {
        type: "button",
        class: "btn btn-primary",
        onClick: () => {
          if (!model().bulkOrg.selected.length) {
            toast("Select at least one repository.", "bad");
            return;
          }
          patch((next) => { next.step = 2; });
        },
      }, "Review selection"),
    ]));
    return;
  }
  const chosen = repos.filter((repo) => draft.bulkOrg.selected.includes(repo.slug));
  container.append(el("div", { class: "card stack" }, [
    el("p", {}, `${chosen.length} repositories will be onboarded with autofetched Actions, CodeQL, and the delivery path that matches the stack.`),
    el("ul", {}, chosen.map((repo) => el("li", {}, `${repo.slug} · ${repo.stackLabel}${repo.ci === false ? " · CI will be attached" : ""}`))),
    el("div", { class: "cluster" }, [
      el("button", { type: "button", class: "btn btn-ghost", onClick: () => patch((next) => { next.step = 1; }) }, "Back"),
      el("button", { type: "button", class: "btn btn-primary", onClick: () => finishOrg(chosen) }, "Onboard selection"),
    ]),
  ]));
}

function finishOrg(chosen) {
  const apps = chosen.map((repo) => {
    const spec = {
      slug: repo.slug,
      name: repo.slug,
      summary: repo.description,
      stackKind: repo.stackKind,
      stackLabel: repo.stackLabel,
      domain: repo.domain,
      ownerKey: repo.ownerKey,
      target: repo.stackKind.startsWith("lambda") ? "Lambda" : "EKS",
      db: repo.stackKind.startsWith("lambda") ? "DynamoDB" : repo.stackKind.startsWith("fastapi") ? "PostgreSQL" : repo.stackKind === "java-react" ? "PostgreSQL" : "MongoDB",
      aws: repo.stackKind.startsWith("lambda") ? ["Lambda", "S3"] : ["EKS", "ALB"],
      auth: "Microsoft Entra ID",
      health: "healthy",
      coverage: 76,
      sync: "Synced",
      deployHealth: "Healthy",
      pipeline: "success",
      jira: deriveProjectKey(repo.slug),
      findings: { high: 0, medium: 0, low: 1 },
      tests: { passed: 10, failed: 0, skipped: 0 },
      ageHours: 0.2,
      openPull: false,
      source: "bulk-org",
      tags: ["github-org"],
      branch: "main",
      omitCi: repo.ci === false,
    };
    let files = blueprint(spec);
    if (spec.omitCi) files = withStandardCi(files, spec);
    return buildApp({ ...spec, files, omitCi: false });
  });
  addApps(apps, apps.map((app) => app.name).join(", "));
  toast(`Onboarded ${apps.length} repositories from ${env.githubOrg}.`);
  location.hash = "#/applications";
}

function orgInventory() {
  const onboarded = new Set(getState().apps.map((app) => app.slug));
  return [
    ...EXTRA_REPOS.map((repo) => ({ ...repo, description: repo.description, onboarded: onboarded.has(repo.slug) })),
    ...CATALOG.map((repo) => ({
      slug: repo.slug,
      description: repo.summary,
      stackKind: repo.stackKind,
      stackLabel: repo.stackLabel,
      ci: true,
      domain: repo.domain,
      ownerKey: repo.ownerKey,
      onboarded: onboarded.has(repo.slug),
    })),
  ];
}

function ownerSelect(value, onValue) {
  return el("select", { value, onChange: (event) => onValue(event.target.value) }, Object.entries(PEOPLE).map(([key, person]) => el("option", { value: key }, person.name)));
}

function navButtons(back, forward) {
  return el("div", { class: "cluster" }, [
    el("button", { type: "button", class: "btn btn-ghost", onClick: () => patch((draft) => { draft.step = back; }) }, "Back"),
    el("button", { type: "button", class: "btn btn-primary", onClick: forward }, "Continue"),
  ]);
}

function row(label, value) {
  return el("div", { class: "spread" }, [el("strong", {}, label), el("span", { class: "hint" }, value), pill("Autofetched", "ok")]);
}
