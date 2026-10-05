#!/usr/bin/env node
/**
 * End-to-end check of the flow the product exists for, against a running dev
 * server:
 *
 *   describe an app -> build -> it renders -> its data survives a reload
 *
 * This is the part the render smoke cannot see: it drives the sandboxed preview
 * iframe (which the parent page is not allowed to reach into), so it also
 * proves the `shell.storage` bridge, the frame-ownership guard, pinning and the
 * rehydration path.
 *
 *   node scripts/product-qa.mjs [url]
 *
 * Needs Chrome: Playwright's bundled Chromium if downloaded (`npx playwright
 * install chromium`), otherwise the system Chrome is used.
 */
import { chromium } from "playwright";

const url = process.argv[2] || "http://127.0.0.1:8080/";
const launchOptions = { headless: true, args: ["--no-sandbox", "--disable-dev-shm-usage"] };

const results = [];
function record(ok, message, extra = {}) {
  results.push({ ok, message, ...extra });
  console.log(JSON.stringify({ ok, message, ...extra }));
}

async function launch() {
  try {
    return await chromium.launch(launchOptions);
  } catch {
    return await chromium.launch({ ...launchOptions, channel: "chrome" });
  }
}

/** The generated app only attaches its handlers after its state round trip. */
async function waitForAppReady(frame) {
  await frame.waitForFunction(
    () => {
      const form = document.querySelector("form");
      return !form || typeof form.onsubmit === "function";
    },
    null,
    { timeout: 15_000 },
  );
}

function fail(message, extra) {
  record(false, message, extra);
  console.error(JSON.stringify({ ok: false, results }, null, 2));
  process.exit(1);
}

const errors = [];
const browser = await launch();
try {
  const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
  page.on("console", (msg) => msg.type() === "error" && errors.push(msg.text()));
  page.on("pageerror", (err) => errors.push(String(err?.message || err)));

  await page.goto(url, { waitUntil: "domcontentloaded" });
  await page.waitForSelector("#shell-root", { timeout: 20_000 });

  // --- describe -> build ----------------------------------------------------
  await page.getByRole("button", { name: "Open Builder" }).first().click();
  const lobby = page.getByRole("textbox", { name: "Describe an app" });
  await lobby.fill("A reading log for books");
  await lobby.press("Enter");
  await page.getByRole("button", { name: "Preview", pressed: true }).waitFor({ timeout: 20_000 });
  record(true, "a first build lands on the preview, not an empty chat");

  const preview = page.frameLocator("iframe").first();
  await preview.locator("form").first().waitFor({ timeout: 20_000 });
  await waitForAppReady(page.frames().find((f) => f !== page.mainFrame()));
  record(true, "the generated app finished loading its state");

  // --- the bridge, through the sandbox -------------------------------------
  await preview.locator("input").first().fill("Dune");
  await preview.getByRole("button", { name: "Add", exact: true }).first().click();
  await page.waitForTimeout(700);

  const frameBody = await preview.locator("body").innerText();
  const beforePin = JSON.parse((await page.evaluate(() => localStorage.getItem("shell-os-v1"))) || "{}");
  const previewBag = beforePin?.state?.miniData?.preview;
  if (!frameBody.includes("Dune")) {
    fail("the preview app never recorded the entry it was given", {
      errors,
      frameBody: frameBody.slice(0, 300),
    });
  }
  if (!previewBag || !JSON.stringify(previewBag).includes("Dune")) {
    fail("the preview's storage bag never reached the shell", { errors, previewBag });
  }
  record(true, "shell.storage writes through the sandbox", { keys: Object.keys(previewBag) });

  // --- pin ------------------------------------------------------------------
  await page.getByRole("button", { name: "Pin" }).click();
  await page.waitForTimeout(500);
  const afterPin = JSON.parse((await page.evaluate(() => localStorage.getItem("shell-os-v1"))) || "{}");
  const pinnedId = Object.keys(afterPin?.state?.minis || {})
    .filter((id) => !["mini_reading"].includes(id))
    .pop();
  if (!pinnedId) fail("pinning did not create an app");
  const pinnedBag = afterPin?.state?.miniData?.[pinnedId];
  if (!pinnedBag || !JSON.stringify(pinnedBag).includes("Dune")) {
    fail("the preview's data did not travel to the pinned app", { pinnedId, pinnedBag });
  }
  const pinnedName = afterPin.state.minis[pinnedId].name;
  record(true, "pinning keeps the app and its data", { pinnedId, pinnedName });

  // --- reload: does the desk come back? ------------------------------------
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForSelector("#shell-root", { timeout: 20_000 });
  const reloaded = JSON.parse((await page.evaluate(() => localStorage.getItem("shell-os-v1"))) || "{}");
  if (!reloaded?.state?.minis?.[pinnedId]) fail("the pinned app did not survive the reload");
  record(true, "the desk survives a reload", {
    minis: Object.keys(reloaded.state.minis).length,
    order: reloaded.state.order.length,
  });

  await page.getByRole("button", { name: `Open ${pinnedName}` }).first().click();
  const reopened = page.frameLocator("iframe").first();
  await reopened.locator("form").first().waitFor({ timeout: 20_000 });
  await waitForAppReady(page.frames().find((f) => f !== page.mainFrame()));
  const text = await reopened.locator("body").innerText();
  if (!text.includes("Dune")) fail("the reopened app came back empty", { text: text.slice(0, 200) });
  record(true, "the reopened app restores what it saved");

  if (errors.length > 0) fail("console errors during the run", { errors });
  record(true, "no console errors");
} catch (error) {
  fail(String(error?.message || error), { errors });
} finally {
  await browser?.close();
}
