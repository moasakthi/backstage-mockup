/** First Entra ID sign-in creates the Backstage user. Later sign-ins skip this step. */
import { el } from "../dom.js";
import { commit, getState } from "../store.js";
import { env } from "../env.js";

export function render(container) {
  const state = getState();
  const user = state.users.find((item) => item.id === state.session.userId);
  const groups = state.groups.filter((group) => group.memberIds.includes(user.id)).map((group) => group.name);
  const roles = state.roles.filter((role) => user.roleIds.includes(role.id)).map((role) => role.name);
  container.replaceChildren(el("div", { class: "boundary" }, [
    el("div", { class: "card stack", style: "width:min(560px,100%)" }, [
      el("img", { class: "brand-logo", src: "./NH44_logo.png", alt: "NH44 IDP", width: "72", height: "72", decoding: "async" }),
      el("p", { class: "kicker" }, "NH44 - IDP"),
      el("h1", {}, "Your Backstage user is ready."),
      el("p", { class: "lede" }, "Microsoft Entra ID authenticated this session. NH44 provisions the catalog user from that profile. There is no separate password."),
      el("dl", { class: "kv" }, [
        el("dt", {}, "Name"), el("dd", {}, user.name),
        el("dt", {}, "Email"), el("dd", {}, user.email),
        el("dt", {}, "Tenant"), el("dd", {}, env.entraTenant),
        el("dt", {}, "Object id"), el("dd", { class: "mono" }, user.objectId),
        el("dt", {}, "Groups"), el("dd", {}, groups.join(", ") || "None"),
        el("dt", {}, "Role"), el("dd", {}, roles.join(", ") || "None"),
      ]),
      el("button", {
        type: "button",
        class: "btn btn-primary",
        onClick: () => {
          commit((current) => {
            current.session.status = "active";
            current.session.firstLoginComplete = true;
            const record = current.users.find((item) => item.id === current.session.userId);
            record.lastSeen = new Date().toISOString();
          }, { action: "User provisioned", detail: "First sign-in from Microsoft Entra ID", module: "access" });
          location.hash = "#/dashboard";
        },
      }, "Continue to NH44 IDP"),
    ]),
  ]));
}
