import { el } from "../dom.js";

export function openModal({ title, body, actions }) {
  const root = document.getElementById("modal-root");
  const close = () => root.replaceChildren();
  const card = el("div", { class: "modal-card stack" }, [
    el("div", { class: "spread" }, [
      el("h2", {}, title),
      el("button", { type: "button", class: "btn btn-ghost btn-sm", onClick: close }, "Close"),
    ]),
    el("div", {}, Array.isArray(body) ? body : [body]),
    actions ? el("div", { class: "cluster modal-actions" }, actions(close)) : null,
  ]);
  const dialog = el("div", { class: "modal", role: "dialog", "aria-modal": "true" }, [card]);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) close();
  });
  root.replaceChildren(dialog);
  return close;
}

export function confirmModal({ title, body, confirmLabel, danger = false, onConfirm }) {
  openModal({
    title,
    body: el("p", {}, body),
    actions: (close) => [
      el("button", { type: "button", class: "btn btn-ghost", onClick: close }, "Cancel"),
      el("button", {
        type: "button",
        class: danger ? "btn btn-danger" : "btn btn-primary",
        onClick: () => {
          onConfirm();
          close();
        },
      }, confirmLabel),
    ],
  });
}
