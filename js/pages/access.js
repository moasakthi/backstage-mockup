/** Users from Entra ID, groups, and module-level roles. */
import { el } from "../dom.js";
import { commit, getState } from "../store.js";
import { requestRefresh } from "../bus.js";
import { ACTIONS, MODULES, can, grants, rolesForUser } from "../rbac.js";
import { env } from "../env.js";
import { uid } from "../format.js";
import { pageHeader, guardButton, field, pill } from "../components/ui.js";
import { toast } from "../components/toast.js";
import { confirmModal } from "../components/modal.js";

export function render(container, route) {
  const section = ["users", "groups", "roles"].includes(route.section) ? route.section : "users";
  container.replaceChildren(
    pageHeader("Access", "People arrive through Microsoft Entra ID. Groups and roles decide what each module allows."),
    el("nav", { class: "subtabs" }, [
      ["users", "Users"],
      ["groups", "Groups"],
      ["roles", "Roles"],
    ].map(([id, label]) => el("a", { href: `#/access/${id}`, class: section === id ? "active" : "" }, label))),
  );
  if (section === "groups") renderGroups(container);
  else if (section === "roles") renderRoles(container);
  else renderUsers(container);
}

function renderUsers(container) {
  const state = getState();
  const name = el("input", { placeholder: "Display name" });
  const email = el("input", { placeholder: "name@tkm.example", type: "email" });
  container.append(el("div", { class: "card stack" }, [
    el("h2", {}, "Simulate an Entra ID first sign-in"),
    el("p", { class: "hint" }, "The real portal provisions a user when they authenticate. This action records the same event."),
    el("div", { class: "grid-2" }, [field("Name", name), field("Email", email)]),
    guardButton("Provision user", "access", "create", "btn-primary", () => {
      if (!name.value.trim() || !email.value.includes("@")) {
        toast("Name and email are required.", "bad");
        return;
      }
      commit((current) => {
        current.users.push({
          id: uid("usr"),
          name: name.value.trim(),
          email: email.value.trim(),
          title: "Developer",
          source: "Microsoft Entra ID",
          tenant: env.entraTenant,
          objectId: uid("entra"),
          roleIds: ["role-developer"],
          notifyEmail: true,
          notifyTeams: false,
          lastSeen: new Date().toISOString(),
        });
      }, { action: "User provisioned", detail: `${name.value.trim()} first sign-in from Microsoft Entra ID`, module: "access" });
      toast("User provisioned from Entra ID.");
      requestRefresh();
    }),
  ]));
  container.append(el("div", { class: "table-wrap mt" }, el("table", {}, [
    el("thead", {}, el("tr", {}, ["Person", "Source", "Groups", "Direct role", "Inherited"].map((label) => el("th", {}, label)))),
    el("tbody", {}, state.users.map((user) => {
      const membership = rolesForUser(state, user.id);
      const groups = state.groups.filter((group) => group.memberIds.includes(user.id)).map((group) => group.name).join(", ");
      return el("tr", {}, [
        el("td", {}, [el("div", {}, user.name), el("div", { class: "hint" }, user.email)]),
        el("td", {}, user.source),
        el("td", {}, groups || "—"),
        el("td", {}, el("select", {
          "aria-label": `Role for ${user.name}`,
          value: user.roleIds[0] || "",
          disabled: !can("access", "update") || user.id === state.session.userId,
          onChange: (event) => assignRole(user, event.target.value),
        }, state.roles.filter((role) => role.kind !== "group").map((role) => el("option", { value: role.id }, role.name)))),
        el("td", {}, membership.inherited.map((role) => role.name).join(", ") || "—"),
      ]);
    })),
  ])));
}

function assignRole(user, roleId) {
  const role = getState().roles.find((item) => item.id === roleId);
  commit((state) => {
    const record = state.users.find((item) => item.id === user.id);
    record.roleIds = [roleId];
  }, { action: "Role assigned", detail: `${user.name} → ${role?.name || roleId}`, module: "access" });
  requestRefresh();
}

function renderGroups(container) {
  const state = getState();
  const name = el("input", { placeholder: "group-name" });
  const description = el("input", { placeholder: "What this group is for" });
  container.append(el("div", { class: "card stack" }, [
    el("h2", {}, "Create a group"),
    el("div", { class: "grid-2" }, [field("Name", name), field("Description", description)]),
    guardButton("Create group", "access", "create", "btn-primary", () => {
      if (!name.value.trim()) {
        toast("Group name is required.", "bad");
        return;
      }
      commit((current) => {
        current.groups.push({ id: uid("grp"), name: name.value.trim(), description: description.value.trim(), memberIds: [], locked: false });
      }, { action: "Group created", detail: name.value.trim(), module: "access" });
      toast("Group created.");
      requestRefresh();
    }),
  ]));
  container.append(el("div", { class: "stack mt" }, state.groups.map((group) => el("article", { class: "card stack" }, [
    el("div", { class: "spread" }, [
      el("h3", {}, group.name),
      group.locked ? pill("Predefined", "muted") : guardButton("Delete", "access", "delete", "btn-danger btn-sm", () => {
        confirmModal({
          title: `Delete ${group.name}`,
          body: "Members keep their direct roles. A group-defined role tied to this group is removed.",
          confirmLabel: "Delete group",
          danger: true,
          onConfirm: () => {
            commit((current) => {
              current.groups = current.groups.filter((item) => item.id !== group.id);
              current.roles = current.roles.filter((role) => role.groupId !== group.id);
            }, { action: "Group deleted", detail: group.name, module: "access" });
            requestRefresh();
          },
        });
      }),
    ]),
    el("p", { class: "hint" }, group.description),
    el("div", { class: "cluster" }, state.users.map((user) => el("label", { class: "cluster" }, [
      el("input", {
        type: "checkbox",
        checked: group.memberIds.includes(user.id),
        disabled: !can("access", "update"),
        onChange: (event) => toggleMember(group, user, event.target.checked),
      }),
      user.name,
    ]))),
  ]))));
}

function toggleMember(group, user, checked) {
  commit((state) => {
    const record = state.groups.find((item) => item.id === group.id);
    const members = new Set(record.memberIds);
    if (checked) members.add(user.id);
    else members.delete(user.id);
    record.memberIds = [...members];
  }, { action: "Group membership changed", detail: `${user.name} ${checked ? "joined" : "left"} ${group.name}`, module: "access" });
  requestRefresh();
}

function renderRoles(container) {
  const state = getState();
  const name = el("input", { placeholder: "Role name" });
  const description = el("input", { placeholder: "What this role is for" });
  const kind = el("select", {}, [el("option", { value: "user" }, "User-defined"), el("option", { value: "group" }, "Group-defined")]);
  const groupId = el("select", {}, state.groups.map((group) => el("option", { value: group.id }, group.name)));
  container.append(el("div", { class: "card stack" }, [
    el("h2", {}, "Create a role"),
    el("p", { class: "hint" }, "Predefined roles stay locked. User-defined roles are assigned directly. Group-defined roles apply to everyone in the group."),
    el("div", { class: "grid-2" }, [
      field("Name", name),
      field("Description", description),
      field("Kind", kind),
      field("Group", groupId),
    ]),
    guardButton("Create role", "access", "create", "btn-primary", () => {
      if (!name.value.trim()) {
        toast("Role name is required.", "bad");
        return;
      }
      const id = uid("role");
      commit((current) => {
        current.roles.push({
          id,
          name: name.value.trim(),
          description: description.value.trim(),
          kind: kind.value,
          locked: false,
          groupId: kind.value === "group" ? groupId.value : "",
          permissions: grants({
            dashboard: ["read"],
            applications: ["read"],
            documents: ["read"],
            repos: ["read"],
          }),
        });
      }, { action: "Role created", detail: name.value.trim(), module: "access" });
      toast("Role created. Set its module permissions below, then choose it in View as to preview it.");
      requestRefresh();
    }),
  ]));
  container.append(el("div", { class: "stack mt" }, state.roles.map((role) => el("article", { class: "card stack" }, [
    el("div", { class: "spread" }, [
      el("div", {}, [el("h3", {}, role.name), el("p", { class: "hint" }, `${role.kind} · ${role.description}`)]),
      el("div", { class: "cluster" }, [
        el("button", { type: "button", class: "btn btn-sm", onClick: () => preview(role) }, "Preview"),
        role.locked ? pill("Locked", "muted") : guardButton("Delete", "access", "delete", "btn-danger btn-sm", () => removeRole(role)),
      ]),
    ]),
    role.kind === "group" ? el("p", { class: "hint" }, `Applies to ${state.groups.find((group) => group.id === role.groupId)?.name || "a missing group"}.`) : null,
    el("div", { class: "table-wrap" }, el("table", { class: "matrix" }, [
      el("thead", {}, el("tr", {}, [el("th", {}, "Module"), ...ACTIONS.map((action) => el("th", {}, action))])),
      el("tbody", {}, MODULES.map(([key, label]) => el("tr", {}, [
        el("td", {}, label),
        ...ACTIONS.map((action) => el("td", {}, el("input", {
          type: "checkbox",
          "aria-label": `${role.name} ${label} ${action}`,
          checked: role.permissions[key]?.includes(action),
          disabled: role.locked || !can("access", "update"),
          onChange: (event) => togglePermission(role, key, action, event.target.checked),
        }))),
      ]))),
    ])),
  ]))));
}

function togglePermission(role, module, action, checked) {
  commit((state) => {
    const record = state.roles.find((item) => item.id === role.id);
    const list = new Set(record.permissions[module] || []);
    if (checked) list.add(action);
    else list.delete(action);
    record.permissions[module] = [...list];
  }, { action: "Role permissions changed", detail: `${role.name} ${module} ${action}`, module: "access" });
  requestRefresh();
}

function preview(role) {
  commit((state) => { state.session.viewAsRoleId = role.id; }, { action: "View as role", detail: role.name, module: "access" });
  toast(`Viewing as ${role.name}`);
  requestRefresh();
}

function removeRole(role) {
  confirmModal({
    title: `Delete ${role.name}`,
    body: "Users who had this direct role keep no replacement until you assign one.",
    confirmLabel: "Delete role",
    danger: true,
    onConfirm: () => {
      commit((state) => {
        state.roles = state.roles.filter((item) => item.id !== role.id);
        state.users.forEach((user) => { user.roleIds = user.roleIds.filter((id) => id !== role.id); });
        if (state.session.viewAsRoleId === role.id) state.session.viewAsRoleId = "role-platform-admin";
      }, { action: "Role deleted", detail: role.name, module: "access" });
      requestRefresh();
    },
  });
}
