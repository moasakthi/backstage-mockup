/** Autofetched integration defaults. Plugins are already configured, so this never asks for tokens. */
import { env } from "../env.js";
import { deriveProjectKey } from "../format.js";

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

export function defaultIntegrations(spec, options = {}) {
  const target = spec.target || "EKS";
  const ciMissing = options.ciDetected === false;
  const cdTool = target === "Lambda" ? "GitHub Actions" : target === "None" ? "Not applicable" : "Argo CD";
  return {
    ci: {
      tool: "GitHub Actions",
      state: ciMissing ? "attach" : "detected",
      workflow: ".github/workflows/ci.yml",
    },
    cd: {
      tool: cdTool,
      project: env.argoProject,
      application: spec.slug || spec.name,
    },
    monitoring: {
      tool: "Grafana",
      companion: "OpenTelemetry",
      dashboard: `${spec.name} golden signals`,
      folder: env.grafanaFolder,
    },
    issues: {
      tool: "Jira",
      site: env.jiraSite,
      projectKey: spec.jira || deriveProjectKey(spec.name),
    },
    documents: {
      tool: "Confluence",
      space: env.confluenceSpace,
    },
    security: {
      tool: "CodeQL",
      suite: SUITE[spec.stackKind] || "javascript",
    },
    artifacts: {
      tool: "JFrog",
      image: target === "None" ? "" : `${env.jfrogHost}/nh44/${spec.slug || "app"}:main`,
    },
    cloud: {
      tool: "AWS",
      account: env.awsAccountAlias,
      services: spec.aws || [],
    },
  };
}
