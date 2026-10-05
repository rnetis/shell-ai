import { compileOffline, type CompileMode } from "@/shell/agent/compile";
import { composeWithGrok } from "@/shell/agent/server";

export type ComposeOutcome = {
  source: "grok" | "studio";
  name: string;
  summary: string;
  html: string | null;
  note?: string;
};

function extractHtml(text: string) {
  const fenced = text.match(/```(?:html)?\s*([\s\S]*?)```/i);
  const body = fenced?.[1]?.trim() || text.trim();
  const doc =
    body.match(/<!DOCTYPE html[\s\S]*<\/html>/i)?.[0] ||
    body.match(/<html[\s\S]*<\/html>/i)?.[0];
  if (!doc) return null;
  if (/<script[^>]+src=/i.test(doc)) return null;
  if (/\bfetch\s*\(|localStorage|document\.cookie|window\.parent|window\.top/.test(doc)) return null;
  return doc;
}

function titleFrom(html: string) {
  const match = html.match(/<title>([^<]+)<\/title>/i);
  const title = match?.[1]?.replace(/\s+/g, " ").trim();
  if (!title) return "";
  return title.length > 28 ? title.slice(0, 27).trimEnd() + "…" : title;
}

export async function compose(input: {
  prompt: string;
  mode: CompileMode;
  previousHtml?: string;
  keepName?: string;
}): Promise<ComposeOutcome> {
  const local = () => {
    const out = compileOffline({
      prompt: input.prompt,
      mode: input.mode,
      keepName: input.keepName,
    });
    return { source: "studio" as const, name: out.name, summary: out.summary, html: out.html };
  };

  try {
    const remote = await composeWithGrok({
      data: {
        prompt: input.prompt,
        mode: input.mode,
        previous: input.previousHtml ?? "",
      },
    });
    if (!remote.ok) {
      const fallback = local();
      return remote.reason === "unavailable" ? fallback : { ...fallback, note: remote.error };
    }
    if (remote.kind === "ask") {
      const named = compileOffline({ prompt: input.prompt, mode: "ask", keepName: input.keepName });
      return { source: "grok", name: named.name, summary: remote.text, html: null };
    }
    const html = extractHtml(remote.text);
    if (!html) {
      return { ...local(), note: "Grok's draft was rejected, so Studio wrote this one." };
    }
    const name = input.keepName?.trim() || titleFrom(html) || local().name;
    return { source: "grok", name, summary: "Built with Grok. Pin it when it looks right.", html };
  } catch {
    return { ...local(), note: "Studio wrote this on device." };
  }
}
