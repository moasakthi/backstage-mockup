import { el } from "../dom.js";

export function toast(message, tone = "ok") {
  const root = document.getElementById("toaster");
  if (!root) return;
  const node = el("div", { class: `toast toast-${tone}`, role: "status" }, message);
  root.append(node);
  setTimeout(() => node.remove?.(), 3400);
}
