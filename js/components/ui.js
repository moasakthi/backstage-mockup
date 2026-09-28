/** Shared widgets used by the lazy-loaded pages. */
import { el } from "../dom.js";
import { can } from "../rbac.js";
import { copyText } from "../format.js";
import { toast } from "./toast.js";

export function healthTone(health) {
  return { healthy: "ok", degraded: "bad", progressing: "info", undeployed: "muted", Synced: "ok", OutOfSync: "warn", Healthy: "ok", Degraded: "bad", Progressing: "info", Published: "ok" }[health] || "muted";
}

export function pill(text, tone = "muted") {
  return el("span", { class: `pill pill-${tone}` }, text || "—");
}

export function pageHeader(title, lede, actions = []) {
  return el("header", { class: "page-head" }, [
    el("div", { class: "stack" }, [
      el("h1", {}, title),
      lede ? el("p", { class: "lede" }, lede) : null,
    ]),
    el("div", { class: "cluster" }, actions),
  ]);
}

export function emptyState(title, body) {
  return el("div", { class: "empty stack" }, [el("strong", {}, title), body ? el("p", {}, body) : null]);
}

export function field(label, control) {
  return el("label", { class: "field" }, [el("span", {}, label), control]);
}

export function guardButton(label, module, action, className, onClick) {
  const allowed = can(module, action);
  return el("button", {
    type: "button",
    class: `btn ${className || ""} ${allowed ? "" : "is-blocked"}`.trim(),
    disabled: !allowed,
    title: allowed ? "" : "The role you are viewing cannot do this.",
    onClick: allowed ? onClick : null,
  }, label);
}

export function copyButton(value, label = "Copy") {
  return el("button", {
    type: "button",
    class: "btn btn-ghost btn-sm",
    onClick: async () => {
      const ok = await copyText(value);
      toast(ok ? "Copied" : "Copy is blocked in this browser", ok ? "ok" : "bad");
    },
  }, label);
}

export function stepper(labels, index) {
  return el("div", { class: "steps" }, labels.map((label, step) => el("span", {
    class: step === index ? "on" : step < index ? "done" : "",
  }, `${step + 1}. ${label}`)));
}

export function signalList(signals) {
  return el("div", {}, signals.map((signal) => el("div", { class: "check" }, [
    el("i", { class: `dot ${signal.ok ? "ok" : "bad"}` }),
    el("div", {}, [el("strong", {}, signal.label), el("div", { class: "hint" }, signal.detail)]),
  ])));
}
