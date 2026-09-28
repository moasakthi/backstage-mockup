/** Profile fields that Entra ID owns stay read-only. */
import { el } from "../dom.js";
import { commit, getState } from "../store.js";
import { requestRefresh } from "../bus.js";
import { env } from "../env.js";
import { pageHeader, field } from "../components/ui.js";
import { toast } from "../components/toast.js";

export function render(container) {
  const state = getState();
  const user = state.users.find((item) => item.id === state.session.userId);
  const title = el("input", { value: user.title });
  const emailNotes = el("input", { type: "checkbox", checked: user.notifyEmail });
  const teams = el("input", { type: "checkbox", checked: user.notifyTeams });
  container.replaceChildren(
    pageHeader("Profile", "This is the Entra ID account provisioned into Backstage."),
    el("section", { class: "card stack" }, [
      el("dl", { class: "kv" }, [
        el("dt", {}, "Name"), el("dd", {}, user.name),
        el("dt", {}, "Email"), el("dd", {}, user.email),
        el("dt", {}, "Tenant"), el("dd", {}, env.entraTenant),
        el("dt", {}, "Object id"), el("dd", { class: "mono" }, user.objectId),
        el("dt", {}, "Source"), el("dd", {}, user.source),
      ]),
      field("Title", title),
      el("label", { class: "cluster" }, [emailNotes, "Email me when a pipeline I own fails"]),
      el("label", { class: "cluster" }, [teams, "Post the same notice to Teams"]),
      el("button", {
        type: "button",
        class: "btn btn-primary",
        onClick: () => {
          commit((current) => {
            const record = current.users.find((item) => item.id === current.session.userId);
            record.title = title.value.trim() || record.title;
            record.notifyEmail = emailNotes.checked;
            record.notifyTeams = teams.checked;
          }, { action: "Profile updated", detail: user.name, module: "settings" });
          toast("Profile saved.");
          requestRefresh();
        },
      }, "Save profile"),
    ]),
  );
}
