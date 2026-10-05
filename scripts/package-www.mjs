#!/usr/bin/env node
/**
 * Snapshot the built Shell into www/ for Capacitor.
 * Expects `npm run preview` already serving http://127.0.0.1:8081/.
 */
import { cpSync, existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const www = join(root, "www");
const preview = process.env.SHELL_PREVIEW_URL || "http://127.0.0.1:8081/";

const response = await fetch(preview);
if (!response.ok) {
  console.error(`[package-www] preview returned ${response.status} from ${preview}`);
  process.exit(1);
}
let html = await response.text();
html = html.replaceAll("http://127.0.0.1:8081", "").replaceAll("http://localhost:8081", "");
if (!html.includes("<html")) {
  console.error("[package-www] preview did not return an HTML document");
  process.exit(1);
}

mkdirSync(www, { recursive: true });
for (const dir of [".vercel/output/static", ".output/public", "dist/client", "public"]) {
  const abs = join(root, dir);
  if (!existsSync(abs)) continue;
  cpSync(abs, www, { recursive: true, force: true });
}
writeFileSync(join(www, "index.html"), html);
console.log(`[package-www] wrote ${www}`);
