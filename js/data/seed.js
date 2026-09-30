/** Initial portal state. Reset demo data rebuilds this snapshot. */
import { hoursAgo } from "../format.js";
import { grants } from "../rbac.js";
import { ADMIN_ID, AUDITOR_ID, PEOPLE } from "../people.js";
import { env } from "../env.js";
import { buildCatalog } from "./generate.js";

const ALL = ["create", "read", "update", "delete"];

function user(person, roleIds, groupHintHours) {
  return {
    id: person.id,
    name: person.name,
    email: person.email,
    title: person.title,
    source: "Microsoft Entra ID",
    tenant: env.entraTenant,
    objectId: `entra-${person.id}`,
    roleIds,
    notifyEmail: true,
    notifyTeams: false,
    lastSeen: hoursAgo(Date.now(), groupHintHours),
  };
}

export function buildSeed(now = Date.now()) {
  const apps = buildCatalog(now);
  return {
    version: 1,
    session: {
      status: "anonymous",
      userId: ADMIN_ID,
      viewAsRoleId: "role-platform-admin",
      firstLoginComplete: false,
    },
    users: [
      user(PEOPLE.admin, ["role-platform-admin"], 1),
      user(PEOPLE.auditor, ["role-auditor"], 20),
      user(PEOPLE.pavithra, ["role-developer"], 3),
      user(PEOPLE.rathi, ["role-developer"], 8),
      user(PEOPLE.sreeprabha, ["role-developer"], 6),
      user(PEOPLE.rashi, ["role-developer"], 9),
    ],
    groups: [
      { id: "grp-platform", name: "platform-admins", description: "Operates the Internal Developer Portal.", memberIds: [ADMIN_ID], locked: true },
      { id: "grp-aidd", name: "aidd-engineering", description: "AIDD application owners.", memberIds: [PEOPLE.pavithra.id], locked: true },
      {
        id: "grp-connected",
        name: "connected-apps",
        description: "Connected applications portfolio.",
        memberIds: [PEOPLE.rathi.id, PEOPLE.sreeprabha.id, PEOPLE.rashi.id],
        locked: true,
      },
      { id: "grp-audit", name: "auditors", description: "Read-only compliance review.", memberIds: [AUDITOR_ID], locked: true },
    ],
    roles: [
      {
        id: "role-platform-admin",
        name: "Platform Admin",
        kind: "predefined",
        locked: true,
        description: "Full module CRUD for the portal.",
        groupId: "",
        permissions: grants(Object.fromEntries([
          "dashboard", "applications", "security", "quality", "deployments", "documents", "repos", "access", "audit", "settings",
        ].map((key) => [key, [...ALL]]))),
      },
      {
        id: "role-developer",
        name: "Developer",
        kind: "predefined",
        locked: true,
        description: "Builds and operates applications inside the portal. Cannot administer access.",
        groupId: "",
        permissions: grants({
          dashboard: ["read"],
          applications: ["create", "read", "update"],
          security: ["read", "update"],
          quality: ["read"],
          deployments: ["read", "update"],
          documents: ["read"],
          repos: ["read", "update"],
          settings: ["read"],
        }),
      },
      {
        id: "role-auditor",
        name: "Auditor",
        kind: "predefined",
        locked: true,
        description: "Reads the portal, including access and the audit trail. Cannot change records.",
        groupId: "",
        permissions: grants({
          dashboard: ["read"],
          applications: ["read"],
          security: ["read"],
          quality: ["read"],
          deployments: ["read"],
          documents: ["read"],
          repos: ["read"],
          access: ["read"],
          audit: ["read"],
          settings: ["read"],
        }),
      },
    ],
    apps,
    audit: [
      {
        id: "aud-seed-1",
        at: hoursAgo(now, 30),
        actorId: "system",
        viewAsRoleId: "",
        action: "Plugin check",
        module: "settings",
        detail: "GitHub, GitHub Actions, Argo CD, AWS, Grafana, OpenTelemetry, Prometheus, CodeQL, JFrog, Jira, Confluence, Microsoft Entra ID",
      },
      {
        id: "aud-seed-2",
        at: hoursAgo(now, 26),
        actorId: "system",
        viewAsRoleId: "",
        action: "Pilot onboarded",
        module: "applications",
        detail: "gpms",
      },
      {
        id: "aud-seed-3",
        at: hoursAgo(now, 12),
        actorId: ADMIN_ID,
        viewAsRoleId: "role-platform-admin",
        action: "Catalog synced",
        module: "repos",
        detail: `GitHub organization ${env.githubOrg}`,
      },
    ],
    settings: {
      assessmentMode: "rule-based",
      ollamaEndpoint: "http://127.0.0.1:11434",
      grafanaBaseUrl: env.grafanaBaseUrl || "",
      domains: ["AIDD", "Other", "Connected Apps"],
    },
    drafts: { onboard: null, template: null },
    ui: { appsLayout: "grid" },
  };
}
