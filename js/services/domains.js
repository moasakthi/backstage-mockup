/** Catalog domains used when an application is onboarded. */
import { commit, getState } from "../store.js";

export const DEFAULT_DOMAINS = ["AIDD", "Other", "Connected Apps"];

export function listDomains(state = getState()) {
  const stored = state.settings?.domains;
  if (!Array.isArray(stored)) return [...DEFAULT_DOMAINS];
  const names = stored.map((item) => String(item).trim()).filter(Boolean);
  return names.length ? names : [...DEFAULT_DOMAINS];
}

export function addDomain(name) {
  const value = name.trim();
  if (!value) return "Enter a domain name.";
  if (listDomains().some((item) => item.toLowerCase() === value.toLowerCase())) return "That domain is already in the list.";
  commit((state) => {
    state.settings.domains = [...listDomains(state), value];
  }, { action: "Domain added", detail: value, module: "settings" });
  return "";
}

export function removeDomain(name) {
  const domains = listDomains();
  if (domains.length <= 1) return "Keep at least one domain.";
  commit((state) => {
    state.settings.domains = listDomains(state).filter((item) => item !== name);
  }, { action: "Domain removed", detail: name, module: "settings" });
  return "";
}
