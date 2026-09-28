/** Bulk onboarding from CSV or Excel. Parsing stays free of DOM. */
import { env } from "../env.js";
import { deriveProjectKey, slugify } from "../format.js";
import { PEOPLE } from "../people.js";
import { buildApp } from "../data/generate.js";
import { blueprint, withStandardCi } from "../data/file-blueprints.js";
import { assessRepo } from "./assessment.js";

export const BULK_COLUMNS = ["application_name", "description", "tags", "repo_url", "branch", "owner", "domain", "stack"];

export const BULK_SAMPLE = [
  {
    application_name: "paint-shop-andon",
    description: "Andon board for the paint shop.",
    tags: "paint;andon;aidd",
    repo_url: `https://github.com/${env.githubOrg}/paint-shop-andon`,
    branch: "main",
    owner: "Pavithra S",
    domain: "AIDD",
    stack: "MERN",
  },
  {
    application_name: "torque-traceability",
    description: "Torque traceability for fastened joints.",
    tags: "quality;trace",
    repo_url: `https://github.com/${env.githubOrg}/torque-traceability`,
    branch: "main",
    owner: "Rathi",
    domain: "Connected Apps",
    stack: "FastAPI",
  },
];

const HEADER_MAP = {
  application_name: "application_name",
  name: "application_name",
  app_name: "application_name",
  description: "description",
  tags: "tags",
  repo_url: "repo_url",
  repository: "repo_url",
  github_url: "repo_url",
  branch: "branch",
  owner: "owner",
  domain: "domain",
  stack: "stack",
};

function stackKindFromCell(value, slug) {
  const text = String(value || "").toLowerCase();
  if (/fastapi/.test(text) && /angular/.test(text)) return "fastapi-angular";
  if (/fastapi|python/.test(text)) return "fastapi-react";
  if (/spring|java/.test(text)) return "java-react";
  if (/next/.test(text)) return "next";
  if (/mean|angular/.test(text)) return "mean";
  if (/lambda/.test(text)) return "lambda-node";
  if (/mern|react/.test(text)) return "mern";
  if (/batch|legacy/.test(slug)) return "lambda-node";
  return "";
}

export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  const source = String(text || "").replace(/^\uFEFF/, "");
  for (let i = 0; i < source.length; i += 1) {
    const char = source[i];
    if (quoted && char === '"' && source[i + 1] === '"') {
      cell += '"';
      i += 1;
    } else if (char === '"') quoted = !quoted;
    else if (char === "," && !quoted) {
      row.push(cell);
      cell = "";
    } else if ((char === "\n" || char === "\r") && !quoted) {
      if (char === "\r" && source[i + 1] === "\n") i += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  const filled = rows.filter((item) => item.some((value) => String(value).trim()));
  if (!filled.length) return [];
  const headers = filled[0].map((header) => HEADER_MAP[header.trim().toLowerCase().replace(/\s+/g, "_")] || "");
  return filled.slice(1).map((values) => {
    const record = {};
    headers.forEach((header, index) => {
      if (header) record[header] = String(values[index] || "").trim();
    });
    return record;
  });
}

export function sheetToRecords(matrix) {
  if (!matrix?.length) return [];
  const [headerRow, ...body] = matrix;
  const headers = headerRow.map((header) => HEADER_MAP[String(header || "").trim().toLowerCase().replace(/\s+/g, "_")] || "");
  return body
    .filter((values) => values.some((value) => String(value || "").trim()))
    .map((values) => {
      const record = {};
      headers.forEach((header, index) => {
        if (header) record[header] = String(values[index] ?? "").trim();
      });
      return record;
    });
}

export function recordsToApps(records, existingApps) {
  const errors = [];
  const apps = [];
  const seen = new Set(existingApps.map((app) => app.repoUrl.replace(/\.git$/, "").toLowerCase()));
  records.forEach((record, index) => {
    const line = index + 2;
    const name = record.application_name;
    const repoUrl = record.repo_url;
    if (!name) {
      errors.push({ line, message: "application_name is required." });
      return;
    }
    if (!repoUrl) {
      errors.push({ line, message: "repo_url is required." });
      return;
    }
    const key = repoUrl.replace(/\.git$/, "").toLowerCase();
    if (seen.has(key)) {
      errors.push({ line, message: `${repoUrl} is already in the catalog or repeated in this file.` });
      return;
    }
    const assessment = assessRepo({ repoUrl, branch: record.branch || "main" });
    if (!assessment.ok) {
      errors.push({ line, message: assessment.error });
      return;
    }
    const owner = Object.values(PEOPLE).find((person) => person.name.toLowerCase() === String(record.owner || "").toLowerCase()) || PEOPLE.pavithra;
    const slug = slugify(name);
    if (existingApps.some((app) => app.slug === slug) || apps.some((app) => app.slug === slug)) {
      errors.push({ line, message: `${name} collides with an existing application id.` });
      return;
    }
    const stackKind = stackKindFromCell(record.stack, assessment.repo) || assessment.stackKind;
    const target = stackKind.startsWith("lambda") ? "Lambda" : stackKind === "frontend-angular" ? "None" : "EKS";
    const ciMissing = !assessment.signals.find((signal) => signal.label === "CI workflow")?.ok;
    const fileSpec = {
      slug,
      name,
      summary: record.description || assessment.stackLabel,
      stackKind,
      stackLabel: record.stack || assessment.stackLabel,
      target,
      branch: record.branch || "main",
      omitCi: ciMissing,
    };
    let files = blueprint(fileSpec);
    if (ciMissing) files = withStandardCi(files, fileSpec);
    const domain = ["AIDD", "Other", "Connected Apps"].includes(record.domain) ? record.domain : assessment.domain || "Other";
    const app = buildApp({
      slug,
      name,
      summary: record.description || assessment.stackLabel,
      tags: String(record.tags || "").split(/[;,]/).map((tag) => tag.trim()).filter(Boolean),
      domain,
      ownerKey: Object.entries(PEOPLE).find(([, person]) => person.id === owner.id)?.[0] || "pavithra",
      stackKind,
      stackLabel: record.stack || assessment.stackLabel,
      db: target === "Lambda" ? "DynamoDB" : target === "None" ? "—" : "MongoDB",
      target,
      aws: target === "Lambda" ? ["Lambda", "S3"] : target === "None" ? [] : ["EKS", "ALB"],
      auth: "Microsoft Entra ID",
      health: "healthy",
      coverage: 78,
      sync: "Synced",
      deployHealth: "Healthy",
      pipeline: "success",
      jira: deriveProjectKey(name),
      findings: { high: 0, medium: 0, low: 1 },
      tests: { passed: 12, failed: 0, skipped: 0 },
      ageHours: 0.2,
      openPull: false,
      source: "bulk-file",
      repoUrl,
      branch: record.branch || "main",
      files,
    });
    seen.add(key);
    apps.push(app);
  });
  return { apps, errors };
}

export function toCsv(rows) {
  const lines = [BULK_COLUMNS.join(",")];
  for (const row of rows) {
    lines.push(BULK_COLUMNS.map((column) => {
      const value = String(row[column] ?? "");
      return /[",\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
    }).join(","));
  }
  return `\uFEFF${lines.join("\n")}\n`;
}
