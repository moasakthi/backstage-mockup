/** Last-resort UI when a screen throws. Offers a reload and a demo reset. */
import { resetDemo } from "./store.js";

let showing = false;

export function installErrorBoundary() {
  window.addEventListener("error", (event) => {
    if (event.error) showBoundary(event.error);
  });
  window.addEventListener("unhandledrejection", (event) => {
    showBoundary(event.reason instanceof Error ? event.reason : new Error(String(event.reason)));
  });
}

export function showBoundary(error) {
  if (showing) return;
  showing = true;
  const root = document.getElementById("app");
  if (!root) return;
  root.innerHTML = "";
  const box = document.createElement("div");
  box.className = "boundary";
  box.innerHTML = `
    <div class="card stack">
      <p class="kicker">Something broke in the mockup</p>
      <h1>This screen could not finish rendering.</h1>
      <p class="hint"></p>
      <div class="cluster">
        <button class="btn btn-primary" type="button" id="boundary-reload">Reload</button>
        <button class="btn" type="button" id="boundary-reset">Reset demo data</button>
      </div>
    </div>`;
  box.querySelector(".hint").textContent = error?.message || "Unknown error";
  box.querySelector("#boundary-reload").addEventListener("click", () => location.reload());
  box.querySelector("#boundary-reset").addEventListener("click", () => {
    resetDemo();
    location.hash = "#/login";
    location.reload();
  });
  root.append(box);
}
