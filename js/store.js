/** Portal state. Mutations go through commit so the audit trail and localStorage stay together. */
import { buildSeed } from "./data/seed.js";

const KEY = "nh44-idp-v1";

const memory = new Map();
const storage = globalThis.localStorage || {
  getItem: (key) => (memory.has(key) ? memory.get(key) : null),
  setItem: (key, value) => memory.set(key, value),
  removeItem: (key) => memory.delete(key),
};

let state = null;

function persist() {
  try {
    storage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* The mock keeps working in memory if the browser rejects the write. */
  }
}

function ensureShape(parsed) {
  parsed.settings = parsed.settings || {};
  if (!Array.isArray(parsed.settings.domains) || parsed.settings.domains.length === 0) {
    parsed.settings.domains = ["AIDD", "Other", "Connected Apps"];
  }
  parsed.drafts = parsed.drafts || { onboard: null };
  if (!Object.prototype.hasOwnProperty.call(parsed.drafts, "template")) parsed.drafts.template = null;
  return parsed;
}

export function initStore() {
  const raw = storage.getItem(KEY);
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.version === 1 && Array.isArray(parsed.apps)) {
        state = ensureShape(parsed);
        persist();
        return state;
      }
    } catch {
      /* Rebuild when the saved snapshot cannot be read. */
    }
  }
  state = buildSeed();
  persist();
  return state;
}

export function getState() {
  if (!state) initStore();
  return state;
}

export function commit(mutator, audit) {
  const current = getState();
  mutator(current);
  if (audit) {
    current.audit.unshift({
      id: `aud-${Date.now().toString(36)}-${current.audit.length}`,
      at: new Date().toISOString(),
      actorId: current.session.userId,
      viewAsRoleId: current.session.viewAsRoleId,
      module: audit.module || "",
      action: audit.action,
      detail: audit.detail || "",
    });
    current.audit = current.audit.slice(0, 400);
  }
  persist();
  return current;
}

export function resetDemo() {
  state = buildSeed();
  persist();
  return state;
}
