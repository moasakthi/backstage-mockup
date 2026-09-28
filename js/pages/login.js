/** Marketing story (three quarters) and Microsoft Entra ID sign-in (one quarter). */
import { el } from "../dom.js";
import { commit, getState } from "../store.js";
import { toggleTheme } from "../theme.js";

const SLIDES = [
  {
    kicker: "TKM · NH44",
    title: "One portal for the developer journey.",
    body: "NH44 IDP is the internal developer portal for TKM. Fourteen cloud applications, one Entra ID door, and the tools already connected: GitHub, Actions, Argo CD, AWS, Grafana, CodeQL, Jira, and Confluence.",
    facts: [["14", "Applications in the assessed portfolio"], ["1", "Pilot to prove the path — gpms"], ["0", "Tokens typed into this portal"]],
  },
  {
    kicker: "Golden path",
    title: "Onboard a service without leaving the catalog.",
    body: "Single existing repository, a new service from a template, a filled spreadsheet, or a multi-select from the GitHub organization. Assessment is rule-based. Integrations are autofetched from plugins TKM has already configured.",
    facts: [["Single", "Existing repo or new template"], ["Bulk", "Excel, CSV, or GitHub org"], ["EKS", "Primary golden path, Lambda where that is the target"]],
  },
  {
    kicker: "Stay inside NH44",
    title: "Review, ship, and watch from here.",
    body: "Read the repository, approve a pull request, inspect Actions logs, sync Argo CD, move a Jira ticket, read Confluence, and watch Grafana-style signals. The developer does not need a second tab.",
    facts: [["Code", "Read-only file explorer"], ["Delivery", "Actions and Argo CD"], ["Signals", "Grafana and OpenTelemetry"]],
  },
  {
    kicker: "Access and trail",
    title: "Roles at module level. A trail for every change.",
    body: "The first Entra ID sign-in provisions the Backstage user. Groups and roles grant create, read, update, and delete per area. The audit trail records who did what, including the role they were viewing as.",
    facts: [["CRUD", "Per module, not a single switch"], ["Groups", "Assign people, inherit a role"], ["Audit", "Sign-in through sync"]],
  },
];

let timer = 0;
let index = 0;

export function destroy() {
  clearInterval(timer);
}

export function render(container) {
  destroy();
  const slides = SLIDES.map((slide, slideIndex) => el("article", { class: `slide ${slideIndex === index ? "on" : ""}`, dataset: { slide: String(slideIndex) } }, [
    el("p", { class: "kicker" }, slide.kicker),
    el("h1", {}, slide.title),
    el("p", { class: "lede" }, slide.body),
    el("div", { class: "facts" }, slide.facts.map(([title, copy]) => el("div", {}, [el("strong", {}, title), el("p", { class: "hint" }, copy)]))),
  ]));
  const dots = SLIDES.map((_, dotIndex) => el("button", {
    type: "button",
    class: dotIndex === index ? "on" : "",
    "aria-label": `Show slide ${dotIndex + 1}`,
    onClick: () => show(dotIndex),
  }));
  const button = el("button", { type: "button", class: "btn btn-ms", onClick: () => signIn(button) }, [
    el("span", { class: "ms-squares", html: "<i></i><i></i><i></i><i></i>", "aria-hidden": "true" }),
    "Sign in with Microsoft",
  ]);

  function show(next) {
    index = next;
    slides.forEach((slide, slideIndex) => slide.classList.toggle("on", slideIndex === index));
    dots.forEach((dot, dotIndex) => dot.classList.toggle("on", dotIndex === index));
  }

  container.replaceChildren(el("div", { class: "login-screen" }, [
    el("section", { class: "slider", onMouseenter: () => clearInterval(timer), onMouseleave: arm }, [
      el("div", { class: "lane-art", "aria-hidden": "true" }),
      ...slides,
      el("div", { class: "dots" }, dots),
    ]),
    el("aside", { class: "login-pane" }, [
      el("div", { class: "spread" }, [
        el("div", {}, [el("p", { class: "kicker" }, "NH44 - IDP"), el("h2", {}, "TKM sign in")]),
        el("button", { type: "button", class: "btn btn-ghost btn-sm", onClick: () => { toggleTheme(); render(container); } }, getState().theme === "dark" ? "Light" : "Dark"),
      ]),
      el("p", { class: "hint" }, "TKM employees use Microsoft Entra ID. This portal does not keep a local password."),
      button,
      el("p", { class: "hint" }, `Tenant ${"tkm.onmicrosoft.com"}. Plugins are already configured. This mock keeps data in the browser.`),
    ]),
  ]));
  arm();
  container.addEventListener("keydown", onKey);
}

function arm() {
  clearInterval(timer);
  timer = setInterval(() => {
    index = (index + 1) % SLIDES.length;
    document.querySelectorAll(".slide").forEach((slide, slideIndex) => slide.classList.toggle("on", slideIndex === index));
    document.querySelectorAll(".dots button").forEach((dot, dotIndex) => dot.classList.toggle("on", dotIndex === index));
  }, 7000);
}

function onKey(event) {
  if (event.key === "ArrowRight") index = Math.min(SLIDES.length - 1, index + 1);
  if (event.key === "ArrowLeft") index = Math.max(0, index - 1);
  document.querySelectorAll(".slide").forEach((slide, slideIndex) => slide.classList.toggle("on", slideIndex === index));
  document.querySelectorAll(".dots button").forEach((dot, dotIndex) => dot.classList.toggle("on", dotIndex === index));
}

async function signIn(button) {
  button.disabled = true;
  button.lastChild.textContent = " Contacting Microsoft Entra ID…";
  await new Promise((resolve) => setTimeout(resolve, 700));
  const first = !getState().session.firstLoginComplete;
  commit((state) => {
    state.session.status = first ? "provisioning" : "active";
  }, { action: "Signed in", detail: "Microsoft Entra ID", module: "access" });
  location.hash = first ? "#/provision" : "#/dashboard";
}
