import { createServerFn } from "@tanstack/react-start";

type Mode = "ask" | "edit" | "auto";

const SYSTEM = `You write mini apps for Shell, a pocket desk.
Follow the mode exactly.

MODE ask: reply in plain prose, under 120 words, with a concrete plan. Do not write HTML.

MODE edit or auto: reply with ONLY a complete HTML document. No markdown fences, no commentary.
Document rules:
- Start with <!DOCTYPE html>. Inline <style> and <script> only.
- No external network: no http or https URLs, no CDNs, no webfonts, no fetch.
- Include a viewport meta tag. It must work at 360px wide.
- Visual system: background #f3eee6, cards #fffaf3, text #1c1814, secondary #6f675c, accent #a86b2a, hairline #e4d9c8, 16px radius, system-ui and Georgia.
- Persist only through the async API already on the page:
  window.shell.storage.get(key) returns Promise<string|null>
  window.shell.storage.set(key, value) returns Promise
  window.shell.toast(message) shows a short notice
- Do not use localStorage, sessionStorage, cookies, document.cookie, window.parent, window.top, eval, or document.write.
- Build the specific app requested, with real controls and an empty state.
- Put a short human name in <title>, max 28 characters.`;

function asMode(value: unknown): Mode {
  return value === "ask" || value === "edit" || value === "auto" ? value : "auto";
}

export const agentStatus = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    void input;
    return {};
  })
  .handler(async () => {
    return { grok: Boolean(process.env.XAI_API_KEY) };
  });

export const composeWithGrok = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const raw = input as { prompt?: unknown; mode?: unknown; previous?: unknown };
    const prompt = String(raw.prompt ?? "").trim().slice(0, 1200);
    if (!prompt) throw new Error("Say what to build.");
    const previous = String(raw.previous ?? "").slice(0, 18000);
    return { prompt, mode: asMode(raw.mode), previous };
  })
  .handler(async ({ data }) => {
    const apiKey = process.env.XAI_API_KEY;
    if (!apiKey) return { ok: false as const, reason: "unavailable" as const, error: "Grok is off" };

    const user =
      data.mode === "ask"
        ? `MODE ask\n\n${data.prompt}`
        : data.previous
          ? `MODE ${data.mode}\n\nRequest: ${data.prompt}\n\nCurrent HTML:\n${data.previous}`
          : `MODE ${data.mode}\n\n${data.prompt}`;

    try {
      const res = await fetch("https://api.x.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        signal: AbortSignal.timeout(45000),
        body: JSON.stringify({
          model: "grok-4.5",
          temperature: 0.4,
          max_tokens: data.mode === "ask" ? 400 : 3500,
          messages: [
            { role: "system", content: SYSTEM },
            { role: "user", content: user },
          ],
        }),
      });
      if (!res.ok) {
        return { ok: false as const, reason: "error" as const, error: `Grok returned ${res.status}` };
      }
      const body = (await res.json()) as {
        choices?: { message?: { content?: string } }[];
      };
      const text = body.choices?.[0]?.message?.content?.trim() ?? "";
      if (!text) return { ok: false as const, reason: "error" as const, error: "Grok sent an empty reply" };
      return {
        ok: true as const,
        kind: data.mode === "ask" ? ("ask" as const) : ("app" as const),
        text,
      };
    } catch {
      return { ok: false as const, reason: "error" as const, error: "Grok could not be reached" };
    }
  });

export const importRemote = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    const url = String((input as { url?: unknown }).url ?? "").trim();
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error("That is not a link.");
    }
    if (parsed.protocol !== "https:") throw new Error("Only https links.");
    const host = parsed.hostname;
    if (
      host !== "raw.githubusercontent.com" &&
      host !== "gist.githubusercontent.com" &&
      host !== "github.com"
    ) {
      throw new Error("Paste a public GitHub file link.");
    }
    return { url: parsed.toString() };
  })
  .handler(async ({ data }) => {
    let target = data.url;
    const parsed = new URL(target);
    if (parsed.hostname === "github.com") {
      const match = parsed.pathname.match(/^\/([^/]+)\/([^/]+)\/blob\/([^/]+)\/(.+)$/);
      if (!match) throw new Error("Use a link to a file, not a repository.");
      target = `https://raw.githubusercontent.com/${match[1]}/${match[2]}/${match[3]}/${match[4]}`;
    }
    const res = await fetch(target, { redirect: "manual" });
    if (res.status >= 300 && res.status < 400) {
      throw new Error("That link redirects. Open the raw file and paste that.");
    }
    if (!res.ok) throw new Error(`Could not fetch that file (${res.status}).`);
    const text = await res.text();
    if (text.length > 200_000) throw new Error("That file is too large.");
    return { ok: true as const, text };
  });
