/**
 * Rule-based assessment. It reads repository metadata the way the GitHub
 * plugin would, then scores the tree. Ollama is not called from the browser.
 */
import { env } from "../env.js";
import { CATALOG, EXTRA_REPOS } from "../data/catalog.js";
import { blueprint, summarizeTree } from "../data/file-blueprints.js";
import { getState } from "../store.js";

const SUITE = {
  mean: "javascript",
  mern: "javascript",
  "lambda-node": "javascript",
  "lambda-angular": "javascript",
  "frontend-angular": "javascript",
  next: "javascript",
  "java-react": "java",
  "fastapi-react": "python",
  "fastapi-angular": "python",
};

export function suiteFor(stackKind) {
  return SUITE[stackKind] || "javascript";
}

export function parseGithubRepo(repoUrl) {
  const match = String(repoUrl || "").trim().match(/^https:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?\/?$/i);
  if (!match) return null;
  return { org: match[1], name: match[2] };
}

function inferKind(slug) {
  const known = CATALOG.find((item) => item.slug === slug) || EXTRA_REPOS.find((item) => item.slug === slug);
  if (known) return known;
  if (/python|fastapi|django/.test(slug)) return { stackKind: "fastapi-react", stackLabel: "Python, FastAPI, React", ci: true };
  if (/java|spring/.test(slug)) return { stackKind: "java-react", stackLabel: "Java, Spring Boot, React", ci: true };
  if (/next/.test(slug)) return { stackKind: "next", stackLabel: "Next.js, React", ci: true };
  if (/angular|mean/.test(slug)) return { stackKind: "mean", stackLabel: "MEAN, MongoDB", ci: true };
  if (/-ui$|frontend/.test(slug)) return { stackKind: "frontend-angular", stackLabel: "Angular UI", ci: true, target: "None" };
  if (/batch|legacy|job/.test(slug)) return { stackKind: "lambda-node", stackLabel: "Node.js", ci: false, target: "Lambda" };
  return { stackKind: "mern", stackLabel: "MERN, MongoDB", ci: true };
}

export function assessRepo({ repoUrl, branch = env.defaultBranch }) {
  const parsed = parseGithubRepo(repoUrl);
  if (!parsed) {
    return {
      ok: false,
      error: "Only GitHub repositories can be assessed. GitHub is the configured source provider.",
    };
  }
  if (parsed.org !== env.githubOrg) {
    return {
      ok: false,
      error: `The GitHub plugin is configured for ${env.githubOrg}. ${parsed.org} is outside that organization, so NH44 cannot read it.`,
    };
  }

  const hint = inferKind(parsed.name);
  const stackKind = hint.stackKind;
  const already = getState().apps.some((app) => app.slug === parsed.name || app.repoUrl.replace(/\.git$/, "") === repoUrl.replace(/\.git$/, ""));
  const previewSpec = {
    slug: parsed.name,
    name: hint.name || parsed.name,
    summary: hint.summary || hint.description || `${parsed.name} assessed from GitHub metadata.`,
    stackKind,
    stackLabel: hint.stackLabel,
    db: hint.db || (stackKind.startsWith("lambda") ? "DynamoDB" : stackKind.startsWith("frontend") ? "—" : "MongoDB"),
    target: hint.target || (stackKind.startsWith("lambda") ? "Lambda" : stackKind === "frontend-angular" ? "None" : "EKS"),
    domain: hint.domain || "Other",
    ownerKey: hint.ownerKey || "pavithra",
    jira: hint.jira,
    branch,
    omitCi: hint.ci === false,
  };
  const files = blueprint(previewSpec);
  const tree = summarizeTree(files);
  const recommendations = [];
  if (!tree.hasCi) recommendations.push("Attach the standard GitHub Actions workflow. CI was not detected.");
  if (!tree.hasCodeql) recommendations.push("Add the CodeQL workflow. The CodeQL plugin is already configured.");
  if (previewSpec.target === "EKS" && !tree.hasArgo) recommendations.push("Add an Argo CD application manifest.");
  if (previewSpec.target === "Lambda") recommendations.push("Delivery stays on GitHub Actions. Argo CD is for the EKS services.");
  if (previewSpec.target === "None") recommendations.push("No deployment target was detected. Monitoring stays inactive until a target exists.");
  if (!tree.hasTests) recommendations.push("Add a smoke test so the pipeline can gate merges.");
  if (!recommendations.length) recommendations.push("Repository matches the NH44 golden path. Confirm the autofetched integrations and onboard.");

  return {
    ok: true,
    mode: "rule-based",
    alreadyOnboarded: already,
    org: parsed.org,
    repo: parsed.name,
    branch,
    stackKind,
    stackLabel: previewSpec.stackLabel,
    target: previewSpec.target,
    database: previewSpec.db,
    domain: previewSpec.domain,
    ownerKey: previewSpec.ownerKey,
    folders: tree.folders,
    signals: [
      { label: "Tech stack", ok: true, detail: previewSpec.stackLabel },
      { label: "Default branch", ok: branch === "main", detail: branch },
      { label: "CI workflow", ok: tree.hasCi, detail: tree.hasCi ? ".github/workflows/ci.yml" : "Not found" },
      { label: "CodeQL", ok: tree.hasCodeql, detail: tree.hasCodeql ? "Default suite configured" : "Workflow missing" },
      { label: "CD", ok: previewSpec.target === "None" ? false : tree.hasArgo || previewSpec.target === "Lambda", detail: previewSpec.target === "Lambda" ? "GitHub Actions to Lambda" : previewSpec.target === "None" ? "No deployment target" : tree.hasArgo ? "Argo CD manifest present" : "Argo CD manifest missing" },
      { label: "Folder structure", ok: tree.folders.length > 1, detail: tree.folders.join(", ") },
      { label: "Dockerfile", ok: tree.hasDocker || previewSpec.target !== "EKS", detail: tree.hasDocker ? "Present" : "Not required for this target" },
      { label: "Terraform", ok: tree.hasTerraform, detail: tree.hasTerraform ? "terraform/main.tf" : "Not found" },
      { label: "Tests", ok: tree.hasTests, detail: tree.hasTests ? "Test files detected" : "No test files" },
      { label: "OpenTelemetry", ok: tree.hasOtel || previewSpec.target === "None", detail: tree.hasOtel ? "Collector values present" : "Not detected" },
    ],
    recommendations,
    files,
  };
}
