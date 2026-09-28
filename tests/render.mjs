/** Renders every screen against a small DOM to catch crashes before the browser. */
import { resetDemo, getState, commit } from "../js/store.js";
import { bindState } from "../js/rbac.js";

class FakeNode {
  constructor(tag = "div") {
    this.tagName = tag.toUpperCase();
    this.children = [];
    this.attrs = {};
    this.className = "";
    this.listeners = {};
    this.hidden = false;
    this.style = {};
    this.dataset = {};
    this._value = "";
    this.checked = false;
  }
  setAttribute(key, value) { this.attrs[key] = value; }
  getAttribute(key) { return this.attrs[key]; }
  addEventListener(type, fn) { (this.listeners[type] ||= []).push(fn); }
  append(...nodes) { this.children.push(...nodes); }
  replaceChildren(...nodes) { this.children = nodes.flat().filter(Boolean); }
  get textContent() {
    return (this.children || []).map((child) => child.textContent || "").join("");
  }
  get classList() {
    const node = this;
    return {
      toggle(name, force) {
        const parts = new Set(node.className.split(/\s+/).filter(Boolean));
        const on = force ?? !parts.has(name);
        if (on) parts.add(name);
        else parts.delete(name);
        node.className = [...parts].join(" ");
      },
      add(name) { this.toggle(name, true); },
      remove(name) { this.toggle(name, false); },
    };
  }
  set value(value) { this._value = value; }
  get value() { return this._value; }
  set innerHTML(value) { this.html = value; }
  click() {
    for (const fn of this.listeners.click || []) fn({ target: this, preventDefault() {}, currentTarget: this });
  }
  remove() {}
}

function makeDocument() {
  const nodes = new Map();
  const document = {
    documentElement: { dataset: {} },
    addEventListener() {},
    createElement: (tag) => new FakeNode(tag),
    createTextNode: (text) => ({ textContent: String(text) }),
    getElementById(id) { return nodes.get(id) || null; },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    body: new FakeNode("body"),
  };
  for (const id of ["app", "toaster", "modal-root", "chat-root", "outlet"]) {
    const node = new FakeNode("div");
    node.id = id;
    nodes.set(id, node);
  }
  document.body.append(...nodes.values());
  return document;
}

function walk(node, visit) {
  if (!node || typeof node !== "object") return;
  visit(node);
  for (const child of node.children || []) walk(child, visit);
}

function clickText(root, text) {
  let found = null;
  walk(root, (node) => {
    const label = (node.children || []).map((child) => child.textContent || "").join("");
    if (!found && label.includes(text) && node.listeners?.click) found = node;
  });
  if (!found) throw new Error(`No clickable "${text}"`);
  found.click();
}

globalThis.document = makeDocument();
globalThis.Node = FakeNode;
globalThis.window = globalThis;
bindState(getState);
resetDemo();

const pages = {
  login: await import("../js/pages/login.js"),
  provision: await import("../js/pages/provision.js"),
  dashboard: await import("../js/pages/dashboard.js"),
  applications: await import("../js/pages/applications.js"),
  app: await import("../js/pages/app360.js"),
  onboard: await import("../js/pages/onboard.js"),
  security: await import("../js/pages/security.js"),
  quality: await import("../js/pages/quality.js"),
  deployments: await import("../js/pages/deployments.js"),
  documents: await import("../js/pages/documents.js"),
  repos: await import("../js/pages/repos.js"),
  access: await import("../js/pages/access.js"),
  audit: await import("../js/pages/audit.js"),
  settings: await import("../js/pages/settings.js"),
  profile: await import("../js/pages/profile.js"),
};

const host = new FakeNode("div");
pages.login.render(host);
pages.login.destroy();
commit((state) => { state.session.status = "provisioning"; });
pages.provision.render(new FakeNode("div"));
commit((state) => {
  state.session.status = "active";
  state.session.firstLoginComplete = true;
});
pages.dashboard.render(new FakeNode("div"));
pages.applications.render(new FakeNode("div"));
for (const tab of ["overview", "code", "cicd", "deployments", "security", "issues", "documents", "monitoring", "insights"]) {
  pages.app.render(new FakeNode("div"), { slug: "gpms", tab, extra: tab === "documents" ? "runbook" : "", more: "", query: {} });
}
const openPull = getState().apps.find((app) => app.slug === "gpms").pulls.find((pull) => pull.status === "open");
const review = new FakeNode("div");
pages.app.render(review, { slug: "gpms", tab: "code", extra: "pulls", more: String(openPull.number), query: {} });
clickText(review, "Approve");
const updated = getState().apps.find((app) => app.slug === "gpms").pulls.find((pull) => pull.number === openPull.number);
if (updated.status !== "approved") throw new Error(`Expected approved, got ${updated.status}`);
for (const slug of getState().apps.map((app) => app.slug)) {
  pages.app.render(new FakeNode("div"), { slug, tab: "overview", extra: "", more: "", query: {} });
  pages.app.render(new FakeNode("div"), { slug, tab: "code", extra: "", more: "", query: { file: getState().apps.find((app) => app.slug === slug).files[0].path } });
  pages.app.render(new FakeNode("div"), { slug, tab: "monitoring", extra: "", more: "", query: {} });
}
const onboardHost = new FakeNode("div");
pages.onboard.render(onboardHost);
clickText(onboardHost, "Existing repository");
pages.onboard.render(onboardHost);
if (!getState().drafts.onboard.path) throw new Error("Onboarding path was not saved");
pages.security.render(new FakeNode("div"));
pages.quality.render(new FakeNode("div"));
pages.deployments.render(new FakeNode("div"));
pages.documents.render(new FakeNode("div"));
pages.repos.render(new FakeNode("div"));
for (const section of ["users", "groups", "roles"]) pages.access.render(new FakeNode("div"), { section });
pages.audit.render(new FakeNode("div"));
pages.settings.render(new FakeNode("div"));
pages.profile.render(new FakeNode("div"));
const { mountShell } = await import("../js/components/shell.js");
const outlet = mountShell(document.getElementById("app"), { name: "dashboard" });
pages.dashboard.render(outlet);
const { answerQuestion } = await import("../js/services/chatbot.js");
for (const prompt of ["Summarize portfolio health", "open gpms", "which pipelines are failing", "how do I onboard", "who owns datahub"]) {
  const reply = answerQuestion(prompt);
  if (!reply.text) throw new Error(`Empty answer for ${prompt}`);
}
console.log("render ok", getState().apps.length);
