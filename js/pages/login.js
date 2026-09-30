/** Marketing story (three quarters) and Microsoft Entra ID sign-in (one quarter). */
import { el } from "../dom.js";
import { commit, getState } from "../store.js";
import { env } from "../env.js";
import { openModal } from "../components/modal.js";

const SLIDES = [
  {
    kicker: "Internal Developer Portal",
    title: "One portal for the developer journey.",
    body: "NH44 IDP is the Internal Developer Portal. Fourteen cloud applications, one Entra ID door, and the tools already connected: GitHub, Actions, Argo CD, AWS, Grafana, CodeQL, Jira, and Confluence.",
    facts: [["14", "Applications in the assessed portfolio"], ["1", "Pilot to prove the path — gpms"], ["0", "Tokens typed into this portal"]],
  },
  {
    kicker: "Golden path",
    title: "Onboard a service without leaving the catalog.",
    body: "Single existing repository, a new service from a template, a filled spreadsheet, or a multi-select from the GitHub organization. Assessment is rule-based. Integrations are autofetched from plugins the Internal Developer Portal has already configured.",
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
    el("div", { class: "facts" }, slide.facts.map(([title, copy]) => el("div", { class: "fact" }, [
      el("strong", {}, title),
      el("p", { class: "hint" }, copy),
    ]))),
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
      el("div", { class: "login-atmosphere", "aria-hidden": "true" }, [
        el("div", { class: "login-grid" }),
        el("div", { class: "lane-art" }),
      ]),
      el("header", { class: "login-hero-brand" }, [
        el("p", { class: "login-brand-name" }, "NH44"),
        el("p", { class: "login-brand-tag" }, "Internal Developer Portal"),
      ]),
      el("div", { class: "slide-stage" }, slides),
      el("div", { class: "dots" }, dots),
    ]),
    el("aside", { class: "login-pane" }, [
      el("div", { class: "login-pane-inner" }, [
        el("div", { class: "login-brand" }, [
          el("img", { class: "brand-logo", src: "./NH44_logo.png", alt: "", width: "72", height: "72", decoding: "async" }),
          el("p", { class: "login-brand-name" }, "NH44"),
          el("h2", {}, "Sign In"),
        ]),
        el("p", { class: "login-pane-copy" }, "Sign in with Microsoft Entra ID. This portal does not keep a local password."),
        button,
        el("p", { class: "hint login-pane-meta" }, "Plugins are already configured. This mock keeps data in the browser."),
        el("footer", { class: "login-legal" }, [
          el("div", { class: "login-legal-links" }, [
            legalLink("Terms & Conditions", "Terms & Conditions", TERMS),
            legalLink("Privacy Policy", "Privacy Policy", PRIVACY),
          ]),
          el("p", { class: "login-copy" }, `© ${new Date().getFullYear()} ${env.portalName}. Internal Developer Portal. All rights reserved.`),
        ]),
      ]),
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

const TERMS = [
  "This portal is for authorized users of the Internal Developer Portal.",
  "Catalog data, assessments, and audit events in this mock stay in your browser.",
  "Do not enter production tokens, passwords, or personal data that is not already part of the demo.",
  "Access follows the role you are signed in as. Viewing as another role does not change your identity.",
];

const PRIVACY = [
  "Sign-in is represented as Microsoft Entra ID. This mock does not send credentials to Microsoft.",
  "The portal stores the demo catalog, drafts, and settings in local storage on this device.",
  "Resetting demo data removes that local copy.",
  "The assistant answers from the catalog already loaded in the portal.",
];

function legalLink(label, title, paragraphs) {
  return el("button", {
    type: "button",
    class: "login-legal-link",
    onClick: () => openModal({
      title,
      body: el("div", { class: "stack" }, paragraphs.map((text) => el("p", {}, text))),
    }),
  }, label);
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
