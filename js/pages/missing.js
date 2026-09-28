import { el } from "../dom.js";
import { pageHeader, emptyState } from "../components/ui.js";

export function render(container, route) {
  container.append(pageHeader(route.name === "denied" ? "Outside this role" : "Page not found", route.name === "denied"
    ? "The role you are viewing cannot open this area. Switch View as, or pick another item in the sidebar."
    : "That address is not part of NH44 IDP."));
  container.append(emptyState("Nothing to show here", "Applications, security, and the rest of the portal are still available from the sidebar."));
}
