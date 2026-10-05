import { ChevronLeft, Trash2 } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { agentStatus, importRemote } from "@/shell/agent/server";
import { askConfirm, useShell } from "@/shell/store";
import type { ThemeChoice, Wallpaper } from "@/shell/types";
import { fieldClass, iconBtnClass, primaryClass, quietClass } from "@/shell/ui";

function Pane({ children }: { children: ReactNode }) {
  return <div className="h-full overflow-auto bg-surface text-fg">{children}</div>;
}

export function NotesApp() {
  const notes = useShell((s) => s.notes);
  const addNote = useShell((s) => s.addNote);
  const updateNote = useShell((s) => s.updateNote);
  const removeNote = useShell((s) => s.removeNote);
  const [active, setActive] = useState<string | null>(null);
  const note = notes.find((item) => item.id === active) ?? null;

  if (note) {
    return (
      <Pane>
        <div className="flex items-center px-1">
          <button type="button" className={iconBtnClass} aria-label="All notes" onClick={() => setActive(null)}>
            <ChevronLeft className="size-5" />
          </button>
          <button
            type="button"
            className={`${iconBtnClass} ml-auto`}
            aria-label="Delete note"
            onClick={() => {
              removeNote(note.id);
              setActive(null);
            }}
          >
            <Trash2 className="size-4" />
          </button>
        </div>
        <input
          value={note.title}
          onChange={(event) => updateNote(note.id, { title: event.target.value })}
          placeholder="Title"
          aria-label="Title"
          className="w-full bg-transparent px-4 font-display text-4xl text-fg outline-none placeholder:text-muted"
        />
        <textarea
          value={note.body}
          onChange={(event) => updateNote(note.id, { body: event.target.value })}
          placeholder="Write"
          aria-label="Note"
          className="mt-2 min-h-96 w-full resize-none bg-transparent px-4 pb-8 text-base leading-relaxed text-fg outline-none placeholder:text-muted"
        />
      </Pane>
    );
  }

  return (
    <Pane>
      <div className="flex items-center justify-between p-4">
        <h2 className="font-display text-4xl">Notes</h2>
        <button
          type="button"
          className={primaryClass}
          onClick={() => {
            const id = addNote();
            setActive(id);
          }}
        >
          New
        </button>
      </div>
      {notes.length === 0 ? (
        <p className="px-4 text-sm text-muted">Nothing written yet.</p>
      ) : (
        <ul className="flex flex-col gap-2 px-4 pb-6">
          {notes.map((item) => (
            <li key={item.id}>
              <button
                type="button"
                onClick={() => setActive(item.id)}
                className="w-full rounded-shell border border-line bg-surface-2 px-4 py-3 text-left"
              >
                <span className="block truncate font-medium">{item.title || "Untitled"}</span>
                <span className="mt-1 block truncate text-sm text-muted">{item.body || "Empty note"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Pane>
  );
}

export function TasksApp() {
  const tasks = useShell((s) => s.tasks);
  const addTask = useShell((s) => s.addTask);
  const toggleTask = useShell((s) => s.toggleTask);
  const removeTask = useShell((s) => s.removeTask);
  const clearDoneTasks = useShell((s) => s.clearDoneTasks);
  const [text, setText] = useState("");
  const open = tasks.filter((task) => !task.done);
  const done = tasks.filter((task) => task.done);

  return (
    <Pane>
      <div className="p-4">
        <h2 className="font-display text-4xl">Tasks</h2>
        <form
          className="mt-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            const next = text.trim();
            if (!next) return;
            addTask(next);
            setText("");
          }}
        >
          <input
            className={fieldClass}
            value={text}
            onChange={(event) => setText(event.target.value)}
            placeholder="Add a task"
            aria-label="New task"
            maxLength={140}
          />
          <button type="submit" className={primaryClass}>
            Add
          </button>
        </form>
        {tasks.length === 0 ? <p className="mt-6 text-sm text-muted">Nothing waiting.</p> : null}
        <ul className="mt-4 flex flex-col gap-2">
          {[...open, ...done].map((task) => (
            <li key={task.id} className="flex items-center gap-2 rounded-shell border border-line bg-surface-2 px-2">
              <button
                type="button"
                className="grid size-11 place-items-center"
                aria-pressed={task.done}
                aria-label={task.done ? `Mark not done: ${task.text}` : `Mark done: ${task.text}`}
                onClick={() => toggleTask(task.id)}
              >
                <span className={`size-4 rounded-full border ${task.done ? "border-brass bg-brass" : "border-muted"}`} />
              </button>
              <span className={`min-w-0 flex-1 truncate text-sm ${task.done ? "text-muted line-through" : ""}`}>
                {task.text}
              </span>
              <button type="button" className={iconBtnClass} aria-label={`Remove ${task.text}`} onClick={() => removeTask(task.id)}>
                <Trash2 className="size-4" />
              </button>
            </li>
          ))}
        </ul>
        {done.length > 0 ? (
          <button type="button" className="mt-4 h-11 text-sm text-muted" onClick={clearDoneTasks}>
            Clear finished
          </button>
        ) : null}
      </div>
    </Pane>
  );
}

function formatNum(value: number) {
  if (!Number.isFinite(value)) return "Error";
  const rounded = Math.round(value * 1e10) / 1e10;
  const text = String(rounded);
  return text.length > 12 ? rounded.toExponential(5) : text;
}

export function CalcApp() {
  const [display, setDisplay] = useState("0");
  const [stored, setStored] = useState<number | null>(null);
  const [op, setOp] = useState<string | null>(null);
  const [fresh, setFresh] = useState(true);

  function apply(nextOp: string | null) {
    const current = Number(display);
    if (stored === null || !op) {
      setStored(current);
    } else if (!fresh) {
      const result =
        op === "+"
          ? stored + current
          : op === "−"
            ? stored - current
            : op === "×"
              ? stored * current
              : current === 0
                ? Number.NaN
                : stored / current;
      setStored(result);
      setDisplay(formatNum(result));
    }
    setOp(nextOp);
    setFresh(true);
  }

  function onKey(key: string) {
    if (key >= "0" && key <= "9") {
      setDisplay((cur) => {
        if (fresh || cur === "0" || cur === "Error") return key;
        if (cur.replace("-", "").replace(".", "").length >= 12) return cur;
        return cur + key;
      });
      setFresh(false);
      return;
    }
    if (key === ".") {
      setDisplay((cur) => {
        if (fresh || cur === "Error") return "0.";
        if (cur.includes(".")) return cur;
        return `${cur}.`;
      });
      setFresh(false);
      return;
    }
    if (key === "C") {
      setDisplay("0");
      setStored(null);
      setOp(null);
      setFresh(true);
      return;
    }
    if (key === "±") {
      setDisplay((cur) => (cur === "0" || cur === "Error" ? cur : cur.startsWith("-") ? cur.slice(1) : `-${cur}`));
      return;
    }
    if (key === "%") {
      const n = Number(display);
      setDisplay(formatNum(n / 100));
      setFresh(true);
      return;
    }
    if (key === "=") {
      apply(null);
      setStored(null);
      return;
    }
    apply(key);
  }

  const keys = ["C", "±", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "0", ".", "="];

  return (
    <Pane>
      <div className="flex h-full flex-col p-4">
        <p className="truncate text-right font-display text-5xl tabular-nums" aria-live="polite">
          {display}
        </p>
        <div className="mt-4 grid flex-1 grid-cols-4 gap-2">
          {keys.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onKey(key)}
              className={`h-14 rounded-xl text-lg ${
                key === "=" || key === "÷" || key === "×" || key === "−" || key === "+"
                  ? "bg-brass text-brass-ink"
                  : "bg-surface-2 text-fg"
              } ${key === "0" ? "col-span-2" : ""}`}
            >
              {key}
            </button>
          ))}
        </div>
      </div>
    </Pane>
  );
}

function beep() {
  try {
    const ctx = new AudioContext();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.frequency.value = 660;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.18);
    osc.onended = () => void ctx.close();
  } catch {
    /* autoplay may block; the toast still lands */
  }
}

export function ClockApp() {
  const [now, setNow] = useState(() => new Date());
  const [tab, setTab] = useState<"time" | "stop" | "timer">("time");
  const [elapsed, setElapsed] = useState(0);
  const [running, setRunning] = useState(false);
  const [left, setLeft] = useState(5 * 60);
  const [timing, setTiming] = useState(false);
  const pushToast = useShell((s) => s.pushToast);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = window.setInterval(() => setElapsed((value) => value + 1), 1000);
    return () => window.clearInterval(id);
  }, [running]);

  useEffect(() => {
    if (!timing) return;
    const id = window.setInterval(() => {
      setLeft((value) => {
        if (value <= 1) {
          setTiming(false);
          pushToast("Timer finished");
          beep();
          return 0;
        }
        return value - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timing, pushToast]);

  const clock = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
  const date = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  function fmt(total: number) {
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  return (
    <Pane>
      <div className="flex gap-2 p-4">
        {(
          [
            ["time", "Time"],
            ["stop", "Stopwatch"],
            ["timer", "Timer"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={tab === id}
            onClick={() => setTab(id)}
            className={`h-11 rounded-xl px-3 text-sm ${tab === id ? "bg-brass text-brass-ink" : "bg-surface-2 text-fg"}`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "time" ? (
        <div className="px-4 pb-8">
          <p className="font-display text-6xl tabular-nums">{clock}</p>
          <p className="mt-2 text-muted">{date}</p>
        </div>
      ) : null}
      {tab === "stop" ? (
        <div className="px-4 pb-8">
          <p className="font-display text-6xl tabular-nums">{fmt(elapsed)}</p>
          <div className="mt-4 flex gap-2">
            <button type="button" className={primaryClass} onClick={() => setRunning((value) => !value)}>
              {running ? "Pause" : "Start"}
            </button>
            <button
              type="button"
              className={quietClass}
              onClick={() => {
                setRunning(false);
                setElapsed(0);
              }}
            >
              Reset
            </button>
          </div>
        </div>
      ) : null}
      {tab === "timer" ? (
        <div className="px-4 pb-8">
          <p className="font-display text-6xl tabular-nums">{fmt(left)}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {[1, 5, 15, 25].map((mins) => (
              <button
                key={mins}
                type="button"
                className={quietClass}
                onClick={() => {
                  setTiming(false);
                  setLeft(mins * 60);
                }}
              >
                {mins} min
              </button>
            ))}
          </div>
          <button type="button" className={`${primaryClass} mt-4`} onClick={() => left > 0 && setTiming((value) => !value)}>
            {timing ? "Pause" : "Start"}
          </button>
        </div>
      ) : null}
    </Pane>
  );
}

function download(filename: string, text: string) {
  const blob = new Blob([text], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function packShell() {
  const state = useShell.getState();
  return JSON.stringify(
    {
      shell: 1,
      apps: Object.values(state.minis).map((app) => ({ name: app.name, html: app.html })),
      notes: state.notes,
      tasks: state.tasks,
    },
    null,
    2,
  );
}

export function FilesApp() {
  const minis = useShell((s) => s.minis);
  const openApp = useShell((s) => s.openApp);
  const editMini = useShell((s) => s.editMini);
  const removeMini = useShell((s) => s.removeMini);
  const toggleDock = useShell((s) => s.toggleDock);
  const dock = useShell((s) => s.dock);
  const importPack = useShell((s) => s.importPack);
  const pushToast = useShell((s) => s.pushToast);
  const [url, setUrl] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const list = Object.values(minis).sort((a, b) => b.updated - a.updated);

  async function pull() {
    setBusy(true);
    setError("");
    try {
      const result = await importRemote({ data: { url } });
      const text = result.text.trim();
      if (text.startsWith("{")) {
        const count = importPack(text);
        pushToast(count === 1 ? "Brought in 1 app" : `Brought in ${count} apps`);
        setUrl("");
      } else if (/<html|<!doctype/i.test(text)) {
        const title = text.match(/<title>([^<]*)<\/title>/i)?.[1]?.trim() || "Imported";
        useShell.getState().createMini({ name: title.slice(0, 28), html: text, source: "import" });
        pushToast("Imported onto the home screen");
        setUrl("");
      } else {
        setError("That file is neither an app nor a Shell copy.");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Pane>
      <div className="p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-4xl">Files</h2>
          <button type="button" className={quietClass} onClick={() => download("shell-copy.json", packShell())}>
            Export
          </button>
        </div>
        <form
          className="mt-4 flex flex-col gap-2 sm:flex-row"
          onSubmit={(event) => {
            event.preventDefault();
            if (!busy && url.trim()) void pull();
          }}
        >
          <input
            className={fieldClass}
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="Public GitHub file link"
            aria-label="GitHub file link"
          />
          <button type="submit" className={primaryClass} disabled={busy || !url.trim()}>
            Import
          </button>
        </form>
        {error ? <p className="mt-2 text-sm text-muted">{error}</p> : null}
        <ul className="mt-5 flex flex-col gap-2">
          {list.map((app) => (
            <li key={app.id} className="rounded-shell border border-line bg-surface-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate font-medium">{app.name}</p>
                  <p className="text-xs uppercase tracking-wide text-muted">{app.source}</p>
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-2">
                <button type="button" className={quietClass} onClick={() => openApp(app.id)}>
                  Open
                </button>
                <button type="button" className={quietClass} onClick={() => editMini(app.id)}>
                  Edit
                </button>
                <button type="button" className={quietClass} onClick={() => toggleDock(app.id)}>
                  {dock.includes(app.id) ? "Undock" : "Dock"}
                </button>
                <button
                  type="button"
                  className={quietClass}
                  onClick={() => {
                    void (async () => {
                      const ok = await askConfirm({
                        title: `Remove ${app.name}?`,
                        body: "The home screen icon and its saved data go with it.",
                        confirmLabel: "Remove",
                      });
                      if (ok) removeMini(app.id);
                    })();
                  }}
                >
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Pane>
  );
}

const PAPERS: { id: Wallpaper; label: string }[] = [
  { id: "harbor", label: "Harbor" },
  { id: "orchard", label: "Orchard" },
  { id: "paper", label: "Paper" },
  { id: "salt", label: "Salt" },
];

export function SettingsApp() {
  const theme = useShell((s) => s.theme);
  const wallpaper = useShell((s) => s.wallpaper);
  const setTheme = useShell((s) => s.setTheme);
  const setWallpaper = useShell((s) => s.setWallpaper);
  const importPack = useShell((s) => s.importPack);
  const pushToast = useShell((s) => s.pushToast);
  const resetAll = useShell((s) => s.resetAll);
  const [grok, setGrok] = useState<boolean | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let alive = true;
    void agentStatus({ data: {} })
      .then((result) => {
        if (alive) setGrok(result.grok);
      })
      .catch(() => {
        if (alive) setGrok(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Pane>
      <div className="mx-auto max-w-xl p-4 pb-10">
        <h2 className="font-display text-4xl">Settings</h2>
        <p className="mt-2 text-sm text-pretty text-muted">
          Shell is a home screen for tools you describe. Builder writes them. You can still edit every line.
        </p>
        <p className="mt-4 text-sm">
          {grok === null ? "Checking the writer…" : grok ? "Grok is connected for Builder." : "Studio is writing apps on this device."}
        </p>

        <h3 className="mt-8 text-sm font-medium uppercase tracking-wide text-muted">Theme</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          {(
            [
              ["dark", "Dark"],
              ["light", "Light"],
              ["system", "System"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              aria-pressed={theme === id}
              className={theme === id ? primaryClass : quietClass}
              onClick={() => setTheme(id as ThemeChoice)}
            >
              {label}
            </button>
          ))}
        </div>

        <h3 className="mt-8 text-sm font-medium uppercase tracking-wide text-muted">Wallpaper</h3>
        <div className="mt-2 grid grid-cols-2 gap-3">
          {PAPERS.map((paper) => (
            <button
              key={paper.id}
              type="button"
              aria-pressed={wallpaper === paper.id}
              onClick={() => setWallpaper(paper.id)}
              className={`overflow-hidden rounded-shell border text-left ${wallpaper === paper.id ? "border-brass" : "border-line"}`}
            >
              <span className="relative block h-16">
                <span className="wallpaper" data-paper={paper.id} />
              </span>
              <span className="block bg-surface px-3 py-2 text-sm">{paper.label}</span>
            </button>
          ))}
        </div>

        <h3 className="mt-8 text-sm font-medium uppercase tracking-wide text-muted">Copy</h3>
        <div className="mt-2 flex flex-wrap gap-2">
          <button type="button" className={quietClass} onClick={() => download("shell-copy.json", packShell())}>
            Save a copy
          </button>
          <label className={`${quietClass} cursor-pointer`}>
            Restore
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                event.target.value = "";
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                  try {
                    const count = importPack(String(reader.result ?? ""));
                    setError("");
                    pushToast(count === 1 ? "Restored 1 app" : `Restored ${count} apps`);
                  } catch (err) {
                    setError(err instanceof Error ? err.message : "Could not restore that file");
                  }
                };
                reader.readAsText(file);
              }}
            />
          </label>
        </div>
        {error ? <p className="mt-2 text-sm text-muted">{error}</p> : null}

        <button
          type="button"
          className={`${quietClass} mt-8`}
          onClick={() => {
            void (async () => {
              const ok = await askConfirm({
                title: "Erase this Shell?",
                body: "Apps, notes, and tasks on this device are removed. This cannot be undone.",
                confirmLabel: "Erase",
              });
              if (ok) resetAll();
            })();
          }}
        >
          Erase this device
        </button>
      </div>
    </Pane>
  );
}
