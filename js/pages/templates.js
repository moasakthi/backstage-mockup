/**
 * Template onboarding. Same golden-path flow as "New service" on the application wizard,
 * kept on its own draft so an in-progress application onboarding is left alone.
 */
import { el } from "../dom.js";
import { env } from "../env.js";
import { commit, getState } from "../store.js";
import { requestRefresh } from "../bus.js";
import { PEOPLE } from "../people.js";
import { TEMPLATES } from "../data/templates.js";
import { buildApp } from "../data/generate.js";
import { deriveProjectKey, slugify } from "../format.js";
import { addApps } from "../services/catalog-actions.js";
import { listDomains } from "../services/domains.js";
import { field, pageHeader, stepper } from "../components/ui.js";
import { toast } from "../components/toast.js";
import { can } from "../rbac.js";

function fresh() {
  const domains = listDomains();
  return {
    step: 0,
    templateId: "mern",
    name: "",
    description: "",
    tags: "",
    repoName: "",
    repoLocked: false,
    domain: domains[0] || "AIDD",
    ownerKey: "admin",
  };
}

function model() {
  const draft = getState().drafts.template;
  if (!draft) {
    commit((state) => { state.drafts.template = fresh(); });
  }
  return getState().drafts.template;
}

function patch(recipe) {
  const next = structuredClone(model());
  recipe(next);
  commit((state) => { state.drafts.template = next; });
  requestRefresh();
}

function remember(recipe) {
  const next = structuredClone(model());
  recipe(next);
  commit((state) => { state.drafts.template = next; });
}

export function render(container) {
  const draft = model();
  const body = el("div", { class: "stack wizard" });
  container.replaceChildren(
    pageHeader("Template onboarding", "Start a new service from a golden-path template. CI, CodeQL, Terraform, Argo CD, and OpenTelemetry are included."),
    body,
  );
  body.append(stepper(["Template", "Service", "What will be created"], draft.step));
  if (draft.step === 0) templateStep(body, draft);
  else if (draft.step === 1) serviceStep(body, draft);
  else previewStep(body, draft);
}

function templateStep(container, draft) {
  container.append(el("div", { class: "stack" }, TEMPLATES.map((template) => el("button", {
    type: "button",
    class: `card path-card ${draft.templateId === template.id ? "on" : ""}`,
    onClick: () => patch((next) => { next.templateId = template.id; next.step = 1; }),
  }, [
    el("strong", {}, template.name),
    el("span", { class: "hint" }, template.summary),
  ]))));
}

function serviceStep(container, draft) {
  const domains = listDomains();
  const selected = domains.includes(draft.domain) ? draft.domain : domains[0];
  container.append(el("div", { class: "card stack" }, [
    field("Application name", el("input", {
      value: draft.name,
      onInput: (event) => remember((next) => {
        next.name = event.target.value;
        if (!next.repoLocked) next.repoName = slugify(event.target.value);
      }),
    })),
    field("Repository name", el("input", {
      value: draft.repoName,
      placeholder: "repository-name",
      onInput: (event) => remember((next) => {
        next.repoLocked = true;
        next.repoName = slugify(event.target.value);
      }),
    })),
    field("Description", el("textarea", {
      rows: "3",
      value: draft.description,
      onInput: (event) => remember((next) => { next.description = event.target.value; }),
    })),
    field("Tags", el("input", {
      value: draft.tags,
      placeholder: "eks; api",
      onInput: (event) => remember((next) => { next.tags = event.target.value; }),
    })),
    field("Domain", el("select", {
      value: selected,
      onChange: (event) => remember((next) => { next.domain = event.target.value; }),
    }, domains.map((domain) => el("option", { value: domain }, domain)))),
    field("Owner", el("select", {
      value: draft.ownerKey,
      onChange: (event) => remember((next) => { next.ownerKey = event.target.value; }),
    }, Object.entries(PEOPLE).map(([key, person]) => el("option", { value: key }, person.name)))),
    el("div", { class: "cluster" }, [
      el("button", { type: "button", class: "btn btn-ghost", onClick: () => patch((next) => { next.step = 0; }) }, "Back"),
      el("button", { type: "button", class: "btn btn-primary", onClick: () => {
        const current = model();
        if (!current.name.trim() || !current.repoName) {
          toast("Name and repository are required.", "bad");
          return;
        }
        patch((next) => { next.step = 2; });
      } }, "Continue"),
    ]),
  ]));
}

function previewStep(container, draft) {
  const template = TEMPLATES.find((item) => item.id === draft.templateId) || TEMPLATES[0];
  const allowed = can("applications", "create");
  container.append(el("div", { class: "card stack" }, [
    el("h2", {}, template.name),
    el("p", {}, "The catalog entry will include:"),
    el("ul", {}, template.includes.map((item) => el("li", {}, item))),
    el("p", { class: "mono" }, `https://github.com/${env.githubOrg}/${draft.repoName}`),
    el("p", { class: "hint" }, "The portal records this service in the catalog with boilerplate, workflows, Terraform, and Argo CD. It does not call GitHub."),
    el("div", { class: "cluster" }, [
      el("button", { type: "button", class: "btn btn-ghost", onClick: () => patch((next) => { next.step = 1; }) }, "Back"),
      el("button", {
        type: "button",
        class: `btn btn-primary ${allowed ? "" : "is-blocked"}`.trim(),
        disabled: !allowed,
        title: allowed ? "" : "The role you are viewing cannot create an application.",
        onClick: allowed ? () => finish(model(), template) : null,
      }, "Create service"),
    ]),
  ]));
}

function finish(draft, template) {
  const name = draft.name.trim();
  const slug = slugify(draft.repoName || name);
  if (getState().apps.some((app) => app.slug === slug)) {
    toast("That repository name is already in the catalog.", "bad");
    return;
  }
  const app = buildApp({
    slug,
    name,
    summary: draft.description || template.summary,
    tags: draft.tags.split(/[;,]/).map((tag) => tag.trim()).filter(Boolean).concat(["template", template.id]),
    domain: draft.domain,
    ownerKey: draft.ownerKey,
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
  commit((state) => { state.drafts.template = null; });
  toast(`${name} was created in the catalog.`);
  location.hash = `#/applications/${slug}`;
}
