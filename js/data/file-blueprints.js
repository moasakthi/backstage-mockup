/**
 * Source snapshots for every stack the portal can onboard.
 * Content is representative boilerplate, interpolated with the service name.
 */
import { env } from "../env.js";

function file(path, language, content) {
  return { path, language, content: content.replace(/\n$/, "") + "\n" };
}

function catalogInfo(spec) {
  const tags = (spec.tags || [spec.domain, spec.stackKind]).filter(Boolean).map((tag) => String(tag).toLowerCase());
  return file(
    "catalog-info.yaml",
    "yaml",
    `apiVersion: backstage.io/v1alpha1
kind: Component
metadata:
  name: ${spec.slug}
  description: ${spec.summary || spec.name}
  tags: [${tags.join(", ")}]
  annotations:
    github.com/project-slug: ${env.githubOrg}/${spec.slug}
    backstage.io/kubernetes-label-selector: app=${spec.slug}
spec:
  type: ${spec.target === "None" ? "website" : "service"}
  lifecycle: production
  owner: group:nh44
  system: nh44
`,
  );
}

function readme(spec, extra = "") {
  return file(
    "README.md",
    "md",
    `# ${spec.name}

${spec.summary || "Service onboarded through NH44 IDP."}

- Stack: ${spec.stackLabel || spec.stackKind}
- Deployment: ${spec.target || "EKS"}
- Branch: ${spec.branch || env.defaultBranch}

${extra}
This repository is provisioned from the NH44 golden path.
`,
  );
}

function packageJson(spec, scripts) {
  return file(
    "package.json",
    "json",
    JSON.stringify(
      {
        name: spec.slug,
        private: true,
        version: "1.4.0",
        scripts,
      },
      null,
      2,
    ),
  );
}

function ciNode(spec) {
  return file(
    ".github/workflows/ci.yml",
    "yaml",
    `name: ci
on:
  push:
    branches: [main]
  pull_request:
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci
      - run: npm test
      - run: npm run build --if-present
`,
  );
}

function ciPython(spec) {
  return file(
    ".github/workflows/ci.yml",
    "yaml",
    `name: ci
on:
  push:
    branches: [main]
  pull_request:
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: "3.12"
      - run: pip install -r server/requirements.txt
      - run: pytest server
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci && npm test
        working-directory: client
`,
  );
}

function ciJava(spec) {
  return file(
    ".github/workflows/ci.yml",
    "yaml",
    `name: ci
on:
  push:
    branches: [main]
  pull_request:
jobs:
  verify:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-java@v4
        with:
          distribution: temurin
          java-version: 21
      - run: mvn -B verify
      - uses: actions/setup-node@v4
        with:
          node-version: 20
      - run: npm ci && npm test
        working-directory: client
`,
  );
}

function codeql(language) {
  return file(
    ".github/workflows/codeql.yml",
    "yaml",
    `name: codeql
on:
  push:
    branches: [main]
  pull_request:
  schedule:
    - cron: "0 2 * * 1"
jobs:
  analyze:
    runs-on: ubuntu-latest
    permissions:
      security-events: write
    steps:
      - uses: actions/checkout@v4
      - uses: github/codeql-action/init@v3
        with:
          languages: ${language}
      - uses: github/codeql-action/analyze@v3
`,
  );
}

function argo(spec) {
  return file(
    "deploy/argocd-application.yaml",
    "yaml",
    `apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: ${spec.slug}
  namespace: argocd
spec:
  project: ${env.argoProject}
  source:
    repoURL: https://github.com/${env.githubOrg}/${spec.slug}.git
    targetRevision: ${spec.branch || env.defaultBranch}
    path: k8s
  destination:
    server: https://kubernetes.default.svc
    namespace: ${spec.slug}
  syncPolicy:
    automated:
      prune: true
      selfHeal: true
`,
  );
}

function k8s(spec) {
  return file(
    "k8s/deployment.yaml",
    "yaml",
    `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${spec.slug}
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ${spec.slug}
  template:
    metadata:
      labels:
        app: ${spec.slug}
    spec:
      containers:
        - name: app
          image: ${env.jfrogHost}/nh44/${spec.slug}:main
          ports:
            - containerPort: 8080
          readinessProbe:
            httpGet:
              path: /health
              port: 8080
`,
  );
}

function terraformEks(spec) {
  return file(
    "terraform/main.tf",
    "tf",
    `terraform {
  required_version = ">= 1.6.0"
}

variable "cluster_name" {
  type    = string
  default = "nh44-eks"
}

# Namespace and baseline tags for ${spec.slug}.
# The EKS cluster itself is managed by the platform team.
resource "kubernetes_namespace" "app" {
  metadata {
    name = "${spec.slug}"
    labels = {
      system = "nh44"
      app    = "${spec.slug}"
    }
  }
}
`,
  );
}

function terraformLambda(spec) {
  return file(
    "terraform/main.tf",
    "tf",
    `variable "function_name" {
  type    = string
  default = "${spec.slug}"
}

# Lambda, log group, and alias. The AWS plugin in NH44 is read-only.
resource "aws_lambda_function" "app" {
  function_name = var.function_name
  role          = aws_iam_role.lambda.arn
  runtime       = "nodejs20.x"
  handler       = "src/handler.main"
  filename      = "build/function.zip"
}

resource "aws_iam_role" "lambda" {
  name = "${spec.slug}-lambda"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Principal = { Service = "lambda.amazonaws.com" }
      Action = "sts:AssumeRole"
    }]
  })
}
`,
  );
}

function otel(spec) {
  return file(
    "monitoring/otel-values.yaml",
    "yaml",
    `mode: deployment
presets:
  kubernetesAttributes:
    enabled: true
config:
  receivers:
    otlp:
      protocols:
        http:
          endpoint: 0.0.0.0:4318
  processors:
    resource:
      attributes:
        - key: service.name
          value: ${spec.slug}
          action: upsert
  exporters:
    prometheus:
      endpoint: 0.0.0.0:8889
  service:
    pipelines:
      metrics:
        receivers: [otlp]
        processors: [resource]
        exporters: [prometheus]
`,
  );
}

function dockerfileNode() {
  return file(
    "Dockerfile",
    "docker",
    `FROM node:20-alpine AS build
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build --if-present

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app /app
EXPOSE 8080
CMD ["node", "server/src/app.js"]
`,
  );
}

function expressApp(spec) {
  return file(
    "server/src/app.js",
    "js",
    `import express from "express";
import { health } from "./routes/health.js";
import { listItems } from "./routes/items.js";

const app = express();
app.use(express.json());
app.get("/health", health);
app.get("/api/items", listItems);

const port = process.env.PORT || 8080;
app.listen(port, () => {
  console.log("${spec.slug} listening on " + port);
});

export default app;
`,
  );
}

function healthRoute() {
  return file(
    "server/src/routes/health.js",
    "js",
    `export function health(_req, res) {
  res.json({ status: "ok", service: process.env.SERVICE_NAME || "nh44" });
}
`,
  );
}

function itemsRoute(spec) {
  return file(
    "server/src/routes/items.js",
    "js",
    `// Catalog route for ${spec.slug}. The name filter is flagged by CodeQL
// when it is copied straight into a query operator.
export async function listItems(req, res) {
  const name = req.query.name || "";
  const items = await req.app.locals.db
    .collection("items")
    .find({ name: { $regex: name } })
    .limit(50)
    .toArray();
  res.json({ items });
}
`,
  );
}

function nodeTest() {
  return file(
    "server/test/health.test.js",
    "js",
    `import test from "node:test";
import assert from "node:assert/strict";

test("health payload", () => {
  assert.equal({ status: "ok" }.status, "ok");
});
`,
  );
}

function angularClient(spec) {
  return [
    file(
      "client/src/app/app.module.ts",
      "ts",
      `import { NgModule } from "@angular/core";
import { BrowserModule } from "@angular/platform-browser";
import { AppComponent } from "./app.component";

@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule],
  bootstrap: [AppComponent],
})
export class AppModule {}
`,
    ),
    file(
      "client/src/app/app.component.ts",
      "ts",
      `import { Component } from "@angular/core";

@Component({
  selector: "app-root",
  templateUrl: "./app.component.html",
})
export class AppComponent {
  title = "${spec.name}";
}
`,
    ),
    file(
      "client/src/app/app.component.html",
      "html",
      `<main>
  <h1>{{ title }}</h1>
  <p>Served from the NH44 catalog.</p>
</main>
`,
    ),
  ];
}

function reactClient(spec) {
  return [
    file(
      "client/src/main.jsx",
      "jsx",
      `import { createRoot } from "react-dom/client";
import { App } from "./App";

createRoot(document.getElementById("root")).render(<App />);
`,
    ),
    file(
      "client/src/App.jsx",
      "jsx",
      `export function App() {
  return (
    <main>
      <h1>${spec.name}</h1>
      <p>Service surface, rendered inside the product UI.</p>
    </main>
  );
}
`,
    ),
  ];
}

function eksPlatform(spec, ciFile, codeqlLang) {
  return [
    ciFile,
    codeql(codeqlLang),
    argo(spec),
    k8s(spec),
    terraformEks(spec),
    otel(spec),
    dockerfileNode(),
  ];
}

function lambdaDeploy(spec) {
  return file(
    ".github/workflows/deploy.yml",
    "yaml",
    `name: deploy
on:
  push:
    branches: [main]
jobs:
  lambda:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: npm ci && npm test && npm run package
      - name: Publish Lambda alias
        run: echo "Publish ${spec.slug} live alias through the configured AWS role"
`,
  );
}

const BUILDERS = {
  mean(spec) {
    return [
      readme(spec),
      catalogInfo(spec),
      packageJson(spec, { start: "node server/src/app.js", test: "node --test", build: "npm run build --prefix client" }),
      expressApp(spec),
      healthRoute(),
      itemsRoute(spec),
      nodeTest(),
      ...angularClient(spec),
      ...eksPlatform(spec, ciNode(spec), "javascript"),
    ];
  },
  mern(spec) {
    return [
      readme(spec),
      catalogInfo(spec),
      packageJson(spec, { start: "node server/src/app.js", test: "node --test", build: "vite build client" }),
      expressApp(spec),
      healthRoute(),
      itemsRoute(spec),
      nodeTest(),
      ...reactClient(spec),
      ...eksPlatform(spec, ciNode(spec), "javascript"),
    ];
  },
  "lambda-node"(spec) {
    return [
      readme(spec, "Deployed with GitHub Actions to AWS Lambda. Argo CD is not used."),
      catalogInfo(spec),
      packageJson(spec, { test: "node --test", package: "zip -r build/function.zip src" }),
      file(
        "src/handler.js",
        "js",
        `export async function main(event) {
  const id = event.pathParameters?.id || "";
  return {
    statusCode: 200,
    body: JSON.stringify({ id, service: "${spec.slug}" }),
  };
}
`,
      ),
      file(
        "src/health.js",
        "js",
        `export function health() {
  return { status: "ok" };
}
`,
      ),
      nodeTest(),
      ciNode(spec),
      lambdaDeploy(spec),
      codeql("javascript"),
      terraformLambda(spec),
      file(
        "monitoring/otel-lambda.yaml",
        "yaml",
        `tracing:
  mode: Active
environment:
  OTEL_SERVICE_NAME: ${spec.slug}
  OTEL_EXPORTER_OTLP_ENDPOINT: http://otel-collector.nh44.svc:4318
`,
      ),
      file(
        "deploy/README.md",
        "md",
        `# Delivery

${spec.slug} ships through GitHub Actions to Lambda.
Argo CD applies only to EKS services in this portal.
`,
      ),
    ];
  },
  "lambda-angular"(spec) {
    return [
      readme(spec, "API on Lambda. Angular assets published to S3."),
      catalogInfo(spec),
      packageJson(spec, { test: "node --test", package: "zip -r build/function.zip src" }),
      file(
        "src/handler.js",
        "js",
        `export async function main(event) {
  return { statusCode: 200, body: JSON.stringify({ service: "${spec.slug}", ok: true }) };
}
`,
      ),
      ...angularClient(spec),
      ciNode(spec),
      lambdaDeploy(spec),
      codeql("javascript"),
      terraformLambda(spec),
      file(
        "deploy/README.md",
        "md",
        `# Delivery

Lambda alias updates come from GitHub Actions. The Angular client is synced to S3.
`,
      ),
    ];
  },
  "frontend-angular"(spec) {
    return [
      readme(spec, "UI only. The solution assessment has no deployment target for this repository."),
      catalogInfo(spec),
      packageJson(spec, { start: "ng serve", test: "ng test --watch=false", build: "ng build" }),
      ...angularClient(spec),
      ciNode(spec),
      codeql("javascript"),
      file(
        "deploy/README.md",
        "md",
        `# Deployment

No deployment target is recorded for ${spec.slug}.
CI still runs so the UI can be reviewed inside NH44.
`,
      ),
    ];
  },
  next(spec) {
    return [
      readme(spec),
      catalogInfo(spec),
      packageJson(spec, { dev: "next dev", build: "next build", start: "next start", test: "node --test" }),
      file(
        "app/layout.jsx",
        "jsx",
        `export const metadata = { title: "${spec.name}" };

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
`,
      ),
      file(
        "app/page.jsx",
        "jsx",
        `export default function Page() {
  return (
    <main>
      <h1>${spec.name}</h1>
      <p>Next.js service from the NH44 template.</p>
    </main>
  );
}
`,
      ),
      nodeTest(),
      ...eksPlatform(spec, ciNode(spec), "javascript"),
    ];
  },
  "java-react"(spec) {
    return [
      readme(spec),
      catalogInfo(spec),
      file(
        "pom.xml",
        "xml",
        `<project>
  <modelVersion>4.0.0</modelVersion>
  <groupId>com.tkm.nh44</groupId>
  <artifactId>${spec.slug}</artifactId>
  <version>1.0.0</version>
  <parent>
    <groupId>org.springframework.boot</groupId>
    <artifactId>spring-boot-starter-parent</artifactId>
    <version>3.3.4</version>
  </parent>
</project>
`,
      ),
      file(
        "src/main/java/com/tkm/app/Application.java",
        "java",
        `package com.tkm.app;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

@SpringBootApplication
public class Application {
  public static void main(String[] args) {
    SpringApplication.run(Application.class, args);
  }
}
`,
      ),
      file(
        "src/main/java/com/tkm/app/HealthController.java",
        "java",
        `package com.tkm.app;

import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;
import java.util.Map;

@RestController
public class HealthController {
  @GetMapping("/health")
  public Map<String, String> health() {
    return Map.of("status", "ok", "service", "${spec.slug}");
  }
}
`,
      ),
      ...reactClient(spec),
      ...eksPlatform(spec, ciJava(spec), "java"),
    ];
  },
  "fastapi-react"(spec) {
    return pythonStack(spec, reactClient(spec));
  },
  "fastapi-angular"(spec) {
    return pythonStack(spec, angularClient(spec));
  },
};

function pythonStack(spec, clientFiles) {
  return [
    readme(spec),
    catalogInfo(spec),
    file(
      "server/requirements.txt",
      "text",
      `fastapi==0.115.0
uvicorn==0.30.6
pytest==8.3.3
`,
    ),
    file(
      "server/main.py",
      "py",
      `from fastapi import FastAPI

app = FastAPI(title="${spec.name}")

@app.get("/health")
def health():
    return {"status": "ok", "service": "${spec.slug}"}
`,
    ),
    file(
      "server/test_health.py",
      "py",
      `from main import health

def test_health():
    assert health()["status"] == "ok"
`,
    ),
    ...clientFiles,
    ...eksPlatform(spec, ciPython(spec), "python"),
  ];
}

export function blueprint(spec) {
  const build = BUILDERS[spec.stackKind] || BUILDERS.mern;
  let files = build(spec);
  if (spec.omitCi) {
    files = files.filter((item) => !item.path.endsWith("/ci.yml") && !item.path.endsWith("/codeql.yml"));
  }
  if (spec.story === "gpms") {
    files = files.concat(gpmsStoryFiles(spec));
  }
  return files;
}

function gpmsStoryFiles(spec) {
  return [
    file(
      "server/src/routes/gatepass.js",
      "js",
      `export async function createPass(req, res) {
  const pass = {
    vehicle: req.body.vehicle,
    purpose: req.body.purpose,
    validHours: Number(req.body.validHours || 8),
  };
  const saved = await req.app.locals.db.collection("passes").insertOne(pass);
  res.status(201).json({ id: saved.insertedId });
}
`,
    ),
    file(
      "client/src/pages/Schedule.jsx",
      "jsx",
      `import { SlaBadge } from "../components/SlaBadge";

export function Schedule({ slots }) {
  return (
    <ul>
      {slots.map((slot) => (
        <li key={slot.id}>
          {slot.gate} <SlaBadge minutes={slot.wait} />
        </li>
      ))}
    </ul>
  );
}
`,
    ),
    file(
      "docs/runbook.md",
      "md",
      `# gpms runbook

## Gate lane degraded

1. Confirm the Argo CD application \`gpms\` is Synced and Healthy.
2. Open runtime logs in NH44 and look for Mongo pool timeouts.
3. Grafana dashboard: NH44 / gpms golden signals.
4. Jira project: GPMS.

The pilot runs on EKS behind WAF, ALB, Route 53, and ACM.
`,
    ),
  ];
}

export function summarizeTree(files) {
  const folders = [...new Set(files.map((item) => item.path.split("/").slice(0, -1).filter(Boolean)[0] || "(root)"))];
  const has = (needle) => files.some((item) => item.path.includes(needle));
  return {
    folders,
    hasCi: has(".github/workflows/ci.yml"),
    hasCodeql: has("codeql.yml"),
    hasArgo: has("argocd-application.yaml"),
    hasTerraform: files.some((item) => item.path.endsWith(".tf")),
    hasDocker: files.some((item) => item.path.endsWith("Dockerfile")),
    hasTests: files.some((item) => /test|spec/i.test(item.path)),
    hasOtel: has("otel"),
  };
}

export function withStandardCi(files, spec) {
  const next = files.filter((item) => !item.path.endsWith("/ci.yml") && !item.path.endsWith("/codeql.yml"));
  const header = "# Added by NH44 onboarding\\n";
  const ci = spec.stackKind?.startsWith("fastapi") ? ciPython(spec) : spec.stackKind === "java-react" ? ciJava(spec) : ciNode(spec);
  ci.content = `# Added by NH44 onboarding\n${ci.content}`;
  const scan = codeql(spec.stackKind?.startsWith("fastapi") ? "python" : spec.stackKind === "java-react" ? "java" : "javascript");
  scan.content = `# Added by NH44 onboarding\n${scan.content}`;
  void header;
  return [...next, ci, scan];
}
