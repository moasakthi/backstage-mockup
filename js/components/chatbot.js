/** Portal assistant anchored at the bottom-right of the signed-in shell. */
import { el } from "../dom.js";
import { answerQuestion } from "../services/chatbot.js";

const messages = [{
  role: "bot",
  text: "Ask about the catalog. Try gpms, failing pipelines, or how onboarding works.",
  actions: [
    { label: "Portfolio health", ask: "Summarize portfolio health" },
    { label: "Open gpms", ask: "open gpms" },
  ],
}];
let open = false;
let built = false;

function draw() {
  const root = document.getElementById("chat-root");
  if (!root) return;
  const log = el("div", { class: "chat-log" }, messages.map((message) => el("div", { class: "stack" }, [
    el("div", { class: `bubble ${message.role}` }, message.text),
    message.actions?.length ? el("div", { class: "cluster" }, message.actions.map((action) => el("button", {
      type: "button",
      class: "btn btn-sm",
      onClick: () => {
        if (action.hash) location.hash = action.hash;
        if (action.ask) submit(action.ask);
      },
    }, action.label))) : null,
  ])));
  const input = el("input", { type: "text", placeholder: "Ask NH44", "aria-label": "Message the assistant" });
  const panel = el("section", {
    class: open ? "chat-panel is-open" : "chat-panel",
    hidden: !open,
    "aria-label": "NH44 assistant",
  }, [
    el("div", { class: "spread chat-head" }, [
      el("strong", {}, "NH44 assistant"),
      el("button", {
        type: "button",
        class: "btn btn-ghost btn-sm",
        onClick: (event) => {
          event.preventDefault();
          event.stopPropagation();
          open = false;
          draw();
        },
      }, "Close"),
    ]),
    log,
    el("form", { class: "chat-form", onSubmit: (event) => { event.preventDefault(); submit(input.value); } }, [
      input,
      el("button", { class: "btn btn-primary", type: "submit" }, "Send"),
    ]),
  ]);
  const launcher = el("button", {
    type: "button",
    class: "chat-launcher",
    "aria-label": open ? "Close the NH44 assistant" : "Open the NH44 assistant",
    "aria-expanded": open ? "true" : "false",
    onClick: (event) => {
      event.preventDefault();
      event.stopPropagation();
      open = !open;
      draw();
    },
  }, "AI");
  root.replaceChildren(panel, launcher);
  if (open) {
    log.scrollTop = log.scrollHeight;
    input.focus();
  }
}

function submit(text) {
  const value = text.trim();
  if (!value) return;
  messages.push({ role: "user", text: value });
  messages.push({ role: "bot", ...answerQuestion(value) });
  open = true;
  draw();
}

export function mountChat() {
  const root = document.getElementById("chat-root");
  if (!root) return;
  root.hidden = false;
  if (!built) {
    built = true;
    draw();
  }
}

export function hideChat() {
  const root = document.getElementById("chat-root");
  if (root) root.hidden = true;
}
