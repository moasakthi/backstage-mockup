/**
 * Module-level CRUD. The signed-in Entra user is the platform admin.
 * "View as" previews another role without changing that identity.
 * State is injected so this module does not import the store.
 */
let readState = () => {
  throw new Error("RBAC is not bound to the store yet.");
};

export function bindState(getter) {
  readState = getter;
}

export const MODULES = [
  ["dashboard", "Dashboard"],
  ["applications", "Applications"],
  ["security", "Security"],
  ["quality", "Code Quality"],
  ["deployments", "Deployments"],
  ["documents", "Documents"],
  ["repos", "Repositories"],
  ["access", "Access management"],
  ["audit", "Audit trail"],
  ["settings", "Settings"],
];

export const ACTIONS = ["create", "read", "update", "delete"];

export function emptyGrants() {
  return Object.fromEntries(MODULES.map(([key]) => [key, []]));
}

export function grants(partial) {
  return { ...emptyGrants(), ...partial };
}

export function effectiveRole(state = readState()) {
  return state.roles.find((role) => role.id === state.session.viewAsRoleId) || state.roles[0];
}

export function can(module, action, state = readState()) {
  const role = effectiveRole(state);
  return Boolean(role?.permissions?.[module]?.includes(action));
}

export function rolesForUser(state, userId) {
  const user = state.users.find((item) => item.id === userId);
  if (!user) return { direct: [], inherited: [] };
  const direct = state.roles.filter((role) => user.roleIds.includes(role.id));
  const groupIds = state.groups.filter((group) => group.memberIds.includes(userId)).map((group) => group.id);
  const inherited = state.roles.filter((role) => role.kind === "group" && groupIds.includes(role.groupId));
  return { direct, inherited };
}
