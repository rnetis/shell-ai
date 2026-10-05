import { useEffect, useRef, useState } from "react";
import { compose } from "@/shell/agent/compose";
import { MiniFrame } from "@/shell/runtime";
import { useShell } from "@/shell/store";
import type { AppSource, BuilderMode, Draft } from "@/shell/types";
import { fieldClass, primaryClass, quietClass } from "@/shell/ui";

const IDEAS = [
  "Habit tracker for morning pages",
  "Tip calculator for dinner",
  "Countdown to a trip in 45 days",
  "Two-player scoreboard",
  "Flashcards for river birds",
  "Grocery list",
];

export function Builder() {
  const draft = useShell((s) => s.draft);
  const mode = useShell((s) => s.builderMode);
  const setBuilderMode = useShell((s) => s.setBuilderMode);
  const setDraft = useShell((s) => s.setDraft);
  const minis = useShell((s) => s.minis);

  if (!draft) {
    return (
      <Lobby
        apps={Object.values(minis)}
        onEdit={(id) => useShell.getState().editMini(id)}
        onCreate={(prompt) => {
          const next: Draft = {
            appId: null,
            name: "Untitled",
            html: "",
            seed: "",
            pending: null,
            messages: [],
          };
          setDraft(next);
          void runPrompt(next, prompt, mode);
        }}
      />
    );
  }

  return <Studio draft={draft} mode={mode} setMode={setBuilderMode} />;
}

function Lobby({
  apps,
  onCreate,
  onEdit,
}: {
  apps: { id: string; name: string }[];
  onCreate: (prompt: string) => void;
  onEdit: (id: string) => void;
}) {
  const [text, setText] = useState("");
  return (
    <div className="h-full overflow-auto bg-surface p-4 text-fg sm:p-6">
      <p className="text-xs uppercase tracking-widest text-muted">Builder</p>
      <h2 className="mt-2 max-w-md font-display text-4xl text-balance">What should we build?</h2>
      <form
        className="mt-5 flex flex-col gap-2 sm:flex-row"
        onSubmit={(event) => {
          event.preventDefault();
          const prompt = text.trim();
          if (prompt) onCreate(prompt);
        }}
      >
        <input
          className={fieldClass}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="A quiet log for the books I finish"
          aria-label="Describe an app"
          maxLength={800}
        />
        <button type="submit" className={primaryClass} disabled={!text.trim()}>
          Build
        </button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        {IDEAS.map((idea) => (
          <button key={idea} type="button" className={quietClass} onClick={() => onCreate(idea)}>
            {idea}
          </button>
        ))}
      </div>
      {apps.length > 0 ? (
        <div className="mt-8">
          <h3 className="text-sm text-muted">On this device</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {apps.map((app) => (
              <li key={app.id}>
                <button
                  type="button"
                  className="flex h-12 w-full items-center rounded-xl border border-line bg-surface-2 px-3 text-left"
                  onClick={() => onEdit(app.id)}
                >
                  {app.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

async function runPrompt(draft: Draft, text: string, mode: BuilderMode) {
  const store = useShell.getState();
  store.setComposing(true);
  store.setDraft({
    ...draft,
    messages: [...draft.messages, { role: "user", text }],
  });
  try {
    const result = await compose({
      prompt: draft.seed ? `${draft.seed}. Update: ${text}` : text,
      mode,
      previousHtml: draft.html,
      keepName: draft.appId ? draft.name : undefined,
    });
    const summary = result.note ? `${result.summary} ${result.note}` : result.summary;
    const base = useShell.getState().draft ?? draft;
    const messages = [...base.messages, { role: "agent" as const, text: summary }];
    const seed = base.seed || text;
    if (mode === "ask" || !result.html) {
      store.setDraft({ ...base, name: result.name, seed, messages, pending: null });
      return;
    }
    if (mode === "edit") {
      store.setDraft({ ...base, name: result.name, seed, messages, pending: result.html });
      return;
    }
    commitHtml(base, result.html, result.name, result.source, messages, seed);
  } finally {
    useShell.getState().setComposing(false);
  }
}

function commitHtml(
  draft: Draft,
  html: string,
  name: string,
  source: AppSource,
  messages: Draft["messages"],
  seed: string,
) {
  const store = useShell.getState();
  if (draft.appId && store.minis[draft.appId]) {
    store.snapshot(draft.appId);
    store.updateMini(draft.appId, { html, name, source });
  }
  store.setDraft({
    appId: draft.appId,
    name,
    html,
    seed,
    pending: null,
    messages,
  });
}

function Studio({
  draft,
  mode,
  setMode,
}: {
  draft: Draft;
  mode: BuilderMode;
  setMode: (mode: BuilderMode) => void;
}) {
  const [text, setText] = useState("");
  const busy = useShell((s) => s.composing);
  const [tab, setTab] = useState<"chat" | "code" | "preview">("chat");
  const [wide, setWide] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const setDraft = useShell((s) => s.setDraft);
  const snaps = useShell((s) => s.snapshots.filter((snap) => snap.appId === draft.appId).length);
  const previewHtml = draft.pending || draft.html;
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = rootRef.current;
    if (!node) return;
    const observer = new ResizeObserver(() => setWide(node.clientWidth >= 760));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [draft.messages.length, busy]);

  async function send(prompt: string) {
    const next = prompt.trim();
    if (!next || busy) return;
    setText("");
    if (!wide) setTab("chat");
    await runPrompt(useShell.getState().draft ?? draft, next, mode);
    if (!wide && mode !== "ask") setTab("preview");
  }

  function pin() {
    const current = useShell.getState().draft;
    if (!current?.html) return;
    const store = useShell.getState();
    let id = current.appId;
    if (id && store.minis[id]) {
      store.snapshot(id);
      store.updateMini(id, { name: current.name, html: current.html, source: store.minis[id].source });
    } else {
      id = store.createMini({ name: current.name || "Untitled", html: current.html, source: "studio" });
      const previewBag = store.miniData.preview;
      if (previewBag) store.setMiniBag(id, previewBag);
    }
    store.setDraft({ ...current, appId: id });
    store.pushToast(`${current.name} is on the home screen`);
  }

  const chat = (
    <div className="flex h-full min-h-0 flex-col border-line bg-surface">
      <div className="min-h-0 flex-1 space-y-3 overflow-auto p-4">
        {draft.messages.length === 0 ? (
          <p className="text-sm text-muted">Describe a change, or leave the source alone and pin it.</p>
        ) : (
          draft.messages.map((message, index) => (
            <p
              key={`${message.role}-${index}`}
              className={`max-w-2xl text-sm text-pretty leading-relaxed ${
                message.role === "user" ? "ml-auto rounded-2xl bg-surface-2 px-3 py-2" : "text-fg"
              }`}
            >
              {message.text}
            </p>
          ))
        )}
        {busy ? <p className="text-sm text-muted">Writing…</p> : null}
        <div ref={endRef} />
      </div>
      <form
        className="flex gap-2 border-t border-line p-3"
        onSubmit={(event) => {
          event.preventDefault();
          void send(text);
        }}
      >
        <input
          className={fieldClass}
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder={mode === "ask" ? "Ask what it should do" : "Change the app"}
          aria-label="Message"
          maxLength={800}
          disabled={busy}
        />
        <button type="submit" className={primaryClass} disabled={busy || !text.trim()}>
          Send
        </button>
      </form>
    </div>
  );

  const code = (
    <div className="flex h-full min-h-0 flex-col bg-bg">
      <div className="flex h-11 items-center border-b border-line px-3 text-xs uppercase tracking-widest text-muted">
        index.html
      </div>
      <textarea
        value={draft.html}
        onChange={(event) => setDraft({ ...draft, html: event.target.value, pending: null })}
        spellCheck={false}
        aria-label="App source"
        className="min-h-0 flex-1 resize-none bg-transparent p-3 font-mono text-sm leading-relaxed text-fg outline-none"
      />
    </div>
  );

  const preview = (
    <div className="flex h-full min-h-0 flex-col bg-surface-2">
      {draft.pending ? (
        <div className="flex flex-wrap items-center gap-2 border-b border-line bg-surface px-3 py-2">
          <p className="mr-auto text-sm">Accept this version?</p>
          <button
            type="button"
            className={primaryClass}
            onClick={() =>
              commitHtml(
                draft,
                draft.pending || "",
                draft.name,
                "grok",
                draft.messages,
                draft.seed,
              )
            }
          >
            Accept
          </button>
          <button type="button" className={quietClass} onClick={() => setDraft({ ...draft, pending: null })}>
            Reject
          </button>
        </div>
      ) : null}
      <div className="min-h-0 flex-1">
        {previewHtml ? (
          <MiniFrame
            appId={draft.pending ? "preview" : (draft.appId ?? "preview")}
            html={previewHtml}
            title={draft.name || "Preview"}
          />
        ) : (
          <p className="p-4 text-sm text-muted">The preview appears after the first draft.</p>
        )}
      </div>
    </div>
  );

  return (
    <div ref={rootRef} className="flex h-full min-h-0 flex-col bg-surface text-fg">
      <div className="flex flex-wrap items-center gap-2 border-b border-line px-3 py-2">
        <input
          value={draft.name}
          onChange={(event) => setDraft({ ...draft, name: event.target.value.slice(0, 28) })}
          aria-label="App name"
          className="h-11 min-w-0 flex-1 bg-transparent font-display text-2xl outline-none"
        />
        <div className="flex rounded-xl bg-surface-2 p-1">
          {(["ask", "edit", "auto"] as const).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={mode === item}
              onClick={() => setMode(item)}
              className={`h-9 rounded-lg px-3 text-sm capitalize ${mode === item ? "bg-brass text-brass-ink" : "text-fg"}`}
            >
              {item}
            </button>
          ))}
        </div>
        <button type="button" className={quietClass} disabled={!draft.appId || snaps === 0} onClick={() => undo(draft)}>
          Undo
        </button>
        <button type="button" className={primaryClass} disabled={!draft.html} onClick={pin}>
          Pin
        </button>
        <button type="button" className={quietClass} onClick={() => setDraft(null)}>
          New
        </button>
      </div>
      {wide ? (
        <div className="grid min-h-0 flex-1 grid-cols-3">
          <div className="min-h-0 border-r border-line">{chat}</div>
          <div className="min-h-0 border-r border-line">{code}</div>
          <div className="min-h-0">{preview}</div>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <div className="flex gap-1 border-b border-line px-2 py-1">
            {(
              [
                ["chat", "Chat"],
                ["code", "Code"],
                ["preview", "Preview"],
              ] as const
            ).map(([id, label]) => (
              <button
                key={id}
                type="button"
                aria-pressed={tab === id}
                onClick={() => setTab(id)}
                className={`h-11 flex-1 rounded-xl text-sm ${tab === id ? "bg-brass text-brass-ink" : "text-fg"}`}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="min-h-0 flex-1">
            {tab === "chat" ? chat : tab === "code" ? code : preview}
          </div>
        </div>
      )}
    </div>
  );
}

function undo(draft: Draft) {
  if (!draft.appId) return;
  const html = useShell.getState().undoMini(draft.appId);
  if (!html) {
    useShell.getState().pushToast("Nothing to undo");
    return;
  }
  const app = useShell.getState().minis[draft.appId];
  useShell.getState().setDraft({
    ...draft,
    html,
    name: app?.name ?? draft.name,
    pending: null,
  });
}
