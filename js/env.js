/**
 * Public configuration for the NH44 IDP mockup.
 * Plugin credentials stay out of the browser. In the real deployment, the
 * Internal Developer Portal holds tokens and API keys in Backstage app-config.yaml. Optional runtime
 * overrides can be supplied as window.NH44_ENV before this module loads.
 * Never put secrets in NH44_ENV.
 */
const defaults = {
  portalName: "NH44 IDP",
  organization: "Internal Developer Portal",
  projectName: "NH44",
  githubOrg: "tkm-digital",
  entraTenant: "tkm.onmicrosoft.com",
  defaultBranch: "main",
  jiraSite: "tkm.atlassian.net",
  confluenceSpace: "NH44",
  grafanaFolder: "NH44",
  argoProject: "nh44",
  awsAccountAlias: "tkm-nonprod",
  jfrogHost: "tkm-docker.jfrog.io",
  /** Empty means the in-portal Grafana view is used. A URL enables an iframe. */
  grafanaBaseUrl: "",
};

export const env = { ...defaults, ...(globalThis.NH44_ENV || {}) };
