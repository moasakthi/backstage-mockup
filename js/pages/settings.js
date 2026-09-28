/**
 * Portal settings. Credentials stay in Backstage app-config.yaml.
 * This screen only shows connection status and mock-local preferences.
 */
import { el } from "../dom.js";
import { commit, getState, resetDemo } from "../store.js";
import { can } from "../rbac.js";
import { setTheme } from "../theme.js";
import { env } from "../env.js";
import { pageHeader, field, guardButton } from "../components/ui.js";
import { confirmModal } from "../components/modal.js";
import { toast } from "../components/toast.js";

const PLUGINS = [
  ["Microsoft Entra ID", "Sign-in"],
  ["GitHub", `Catalog and source for ${env.githubOrg}`],
  ["GitHub Actions", "Continuous integration"],
  ["Argo CD", `Continuous delivery for EKS, project ${env.argoProject}`],
  ["AWS", "Read EKS, Lambda, and Kinesis"],
  ["Grafana", "Dashboards"],
  ["OpenTelemetry", "Traces and metrics pipeline"],
  ["Prometheus", "Scrapes the OpenTelemetry exporter"],
  ["CodeQL", "Code scanning"],
  ["JFrog", "Container artifacts"],
  ["Jira", env.jiraSite],
  ["Confluence", `Space ${env.confluenceSpace}`],
];

export function render(container) {
  const state = getState();
  const admin = can("settings", "update");
  container.replaceChildren(
    pageHeader("Settings", "Indigo Pulse is the NH44 theme. Dark is a deep indigo field. Light is a cool paper surface. The same accent marks actions in both."),
    el("section", { class: "card stack" }, [
      el("h2", {}, "Appearance"),
      el("div", { class: "cluster" }, [
        el("button", { type: "button", class: `chip ${state.theme === "dark" ? "on" : ""}`, onClick: () => setTheme("dark") }, "Dark"),
        el("button", { type: "button", class: `chip ${state.theme === "light" ? "on" : ""}`, onClick: () => setTheme("light") }, "Light"),
      ]),
    ]),
    el("section", { class: "card stack" }, [
      el("h2", {}, "Connected plugins"),
      el("p", { class: "hint" }, "Status is read-only. Tokens, PATs, and client secrets are held by TKM in app-config.yaml. This mockup does not collect them."),
      el("div", { class: "table-wrap" }, el("table", {}, [
        el("tbody", {}, PLUGINS.map(([name, detail]) => el("tr", {}, [
          el("td", {}, name),
          el("td", {}, detail),
          el("td", {}, "Connected"),
        ]))),
      ])),
    ]),
    el("section", { class: "card stack" }, [
      el("h2", {}, "Assessment"),
      el("p", { class: "hint" }, "Rule-based is the default. Ollama can be selected, and the test shows that this browser cannot reach it."),
      field("Mode", el("select", {
        value: state.settings.assessmentMode,
        disabled: !admin,
        onChange: (event) => save({ assessmentMode: event.target.value }, "Assessment mode", event.target.value),
      }, [el("option", { value: "rule-based" }, "Rule-based"), el("option", { value: "ollama" }, "Local Ollama")])),
      field("Ollama endpoint", el("input", {
        value: state.settings.ollamaEndpoint,
        disabled: !admin,
        onChange: (event) => save({ ollamaEndpoint: event.target.value }, "Ollama endpoint", event.target.value),
      })),
      guardButton("Test Ollama", "settings", "update", "", () => {
        commit((current) => { current.settings.ollamaStatus = "unreachable"; }, {
          action: "Ollama test",
          detail: "Not reachable. Assessment stays rule-based.",
          module: "settings",
        });
        toast("Ollama is not reachable from this mockup. Assessment stays rule-based.", "bad");
      }),
    ]),
    el("section", { class: "card stack" }, [
      el("h2", {}, "Grafana embed"),
      el("p", { class: "hint" }, "Leave this blank to use the in-portal panels. A base URL adds an iframe and is not a secret."),
      field("Base URL", el("input", {
        value: state.settings.grafanaBaseUrl,
        placeholder: "https://grafana.example",
        disabled: !admin,
        onChange: (event) => save({ grafanaBaseUrl: event.target.value.trim() }, "Grafana base URL", event.target.value.trim() || "cleared"),
      })),
    ]),
    el("section", { class: "card stack" }, [
      el("h2", {}, "Demo data"),
      el("p", { class: "hint" }, "Reset returns the 14 assessed applications, clears onboarded examples, and asks for Entra ID sign-in again."),
      guardButton("Reset demo data", "settings", "update", "btn-danger", () => {
        confirmModal({
          title: "Reset demo data",
          body: "The catalog returns to the solution-document portfolio. This browser's saved changes are removed.",
          confirmLabel: "Reset",
          danger: true,
          onConfirm: () => {
            resetDemo();
            location.hash = "#/login";
            location.reload();
          },
        });
      }),
    ]),
  );
}

function save(partial, action, detail) {
  commit((state) => { Object.assign(state.settings, partial); }, { action, detail, module: "settings" });
}
