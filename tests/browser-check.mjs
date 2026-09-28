/** Drives the mockup in headless Chrome through the main developer path. */
import { spawn } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const profile = await mkdtemp(join(tmpdir(), "nh44-chrome-"));
const chrome = spawn("/Applications/Google Chrome.app/Contents/MacOS/Google Chrome", [
  "--headless=new",
  "--disable-gpu",
  "--no-first-run",
  "--disable-extensions",
  "--remote-debugging-port=9333",
  `--user-data-dir=${profile}`,
  "about:blank",
], { stdio: "ignore" });

try {
  const target = await waitForTarget();
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => {
    ws.addEventListener("open", resolve);
    ws.addEventListener("error", reject);
  });
  let seq = 0;
  const pending = new Map();
  ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
    }
  });
  const send = (method, params = {}) => new Promise((resolve) => {
    const id = ++seq;
    pending.set(id, resolve);
    ws.send(JSON.stringify({ id, method, params }));
  });
  await send("Runtime.enable");
  await send("Page.enable");
  await send("Page.navigate", { url: "http://127.0.0.1:5173/#/login" });
  await pause(900);

  const run = async (expression) => {
    const reply = await send("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
    if (reply.result?.exceptionDetails) {
      throw new Error(reply.result.exceptionDetails.exception?.description || reply.result.exceptionDetails.text);
    }
    return reply.result?.result?.value;
  };

  const steps = [];
  const expect = async (label, expression) => {
    const value = await run(expression);
    if (!value) {
      const text = await run(`document.body.innerText.slice(0, 800)`);
      throw new Error(`${label} failed\n${text}`);
    }
    steps.push(label);
  };

  await expect("marketing", `document.querySelector("h1")?.textContent.includes("developer journey")`);
  await run(`document.querySelector(".btn-ms").click()`);
  await pause(900);
  await expect("provision", `document.body.textContent.includes("Backstage user is ready")`);
  await run(`[...document.querySelectorAll("button")].find((button) => button.textContent.includes("Continue")).click()`);
  await pause(400);
  await expect("dashboard", `document.querySelector("h1")?.textContent === "Dashboard"`);
  await expect("sidebar", `["Dashboard","Applications","Access","Audit trail","Settings"].every((label) => [...document.querySelectorAll(".nav a")].some((link) => link.textContent === label)) && document.querySelectorAll(".nav a").length === 5`);
  await expect("no underline", `getComputedStyle(document.querySelector(".nav a")).textDecorationLine === "none"`);
  await expect("indigo", `getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() === "#7c6cff"`);
  await run(`document.querySelector(".chat-launcher").click()`);
  await pause(200);
  await expect("chat open", `document.querySelector(".chat-panel").classList.contains("is-open")`);
  await run(`[...document.querySelectorAll(".chat-panel button")].find((button) => button.textContent === "Close").click()`);
  await pause(200);
  await expect("chat closed", `!document.querySelector(".chat-panel").classList.contains("is-open") && document.querySelector(".chat-panel").hidden`);
  await run(`document.querySelector('a[href="#/applications/gpms"]').click()`);
  await pause(300);
  await expect("gpms", `document.querySelector("h1")?.textContent === "gpms"`);
  await run(`location.hash = "#/applications/gpms/code"`);
  await pause(300);
  await expect("folder tree", `document.querySelectorAll(".tree-dir").length > 0 && document.querySelectorAll(".tree-file").length > 0`);
  await run(`location.hash = "#/applications/gpms/code/pulls"`);
  await pause(300);
  const number = await run(`document.body.textContent.match(/#(\\d+) Add gate-pass/)?.[1] || ""`);
  await run(`location.hash = "#/applications/gpms/code/pulls/${number}"`);
  await pause(200);
  await run(`[...document.querySelectorAll("button")].find((button) => button.textContent === "Approve")?.click()`);
  await pause(300);
  await expect("approved", `document.body.textContent.includes("approved")`);
  await run(`location.hash = "#/onboard"`);
  await pause(300);
  await run(`[...document.querySelectorAll("button")].find((button) => button.textContent.includes("Existing repository")).click()`);
  await pause(200);
  await run(`
    const fields = [...document.querySelectorAll("#outlet input")];
    const set = (index, value) => {
      fields[index].value = value;
      fields[index].dispatchEvent(new Event("input", { bubbles: true }));
    };
    set(0, "paint-shop-andon");
    set(2, "https://github.com/tkm-digital/paint-shop-andon");
    [...document.querySelectorAll("button")].find((button) => button.textContent === "Analyse").click();
  `);
  await pause(400);
  await expect("assessment", `document.body.textContent.includes("Tech stack")`);
  await run(`[...document.querySelectorAll("button")].find((button) => button.textContent === "Continue").click()`);
  await pause(200);
  await run(`[...document.querySelectorAll("button")].find((button) => button.textContent === "Continue").click()`);
  await pause(200);
  await run(`[...document.querySelectorAll("button")].find((button) => button.textContent === "Onboard application").click()`);
  await pause(400);
  await expect("onboarded app", `location.hash.includes("paint-shop-andon") && document.querySelector("h1")?.textContent === "paint-shop-andon"`);
  await run(`document.querySelector('[aria-label="Toggle color theme"]').click()`);
  await pause(200);
  await expect("light theme", `document.documentElement.dataset.theme === "light" && getComputedStyle(document.documentElement).getPropertyValue("--accent").trim() === "#4f46e5"`);
  console.log(steps.join("\n"));
  ws.close();
} finally {
  chrome.kill();
  await rm(profile, { recursive: true, force: true });
}

async function waitForTarget() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const list = await fetch("http://127.0.0.1:9333/json/list").then((response) => response.json());
      const page = list.find((item) => item.type === "page");
      if (page) return page;
    } catch {
      /* Chrome is still starting. */
    }
    await pause(200);
  }
  throw new Error("Chrome did not open a debugging port");
}

function pause(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
