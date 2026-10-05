/**
 * Rehydration guard for the persisted Shell state.
 *
 * The desk lives in localStorage, so this code will outlive the shape it
 * wrote: an older build, a hand-edited entry, a restore from a foreign file,
 * or a truncated write can all hand the store something that is not the shape
 * it expects. Zustand's default `merge` spreads whatever came back over the
 * live state, so one bad `order` array or `minis` entry would strand icons on
 * the home screen or crash every consumer that reads `mini.html`.
 *
 * Everything that crosses the storage boundary goes through here first:
 * unknown keys are dropped, wrong types fall back to defaults, and references
 * that no longer resolve (an icon for an app that is gone) are removed.
 */

import type {
  BuilderMode,
  ChatLine,
  Draft,
  MiniApp,
  Note,
  Snapshot,
  Task,
  ThemeChoice,
  Wallpaper,
} from "@/shell/types";

export const LIMITS = {
  minis: 200,
  html: 400_000,
  name: 40,
  notes: 400,
  noteBody: 100_000,
  tasks: 1_000,
  taskText: 500,
  snapshots: 40,
  messages: 200,
  messageText: 4_000,
  dock: 6,
  bagKeys: 500,
  bagValue: 100_000,
} as const;

const THEMES: readonly ThemeChoice[] = ["dark", "light", "system"];
const WALLPAPERS: readonly Wallpaper[] = ["harbor", "orchard", "paper", "salt"];
const MODES: readonly BuilderMode[] = ["ask", "edit", "auto"];
const SOURCES = ["studio", "grok", "import"] as const;

/** Every key the store persists — no more, no less. */
export type PersistedShellState = {
  theme: ThemeChoice;
  wallpaper: Wallpaper;
  order: string[];
  dock: string[];
  minis: Record<string, MiniApp>;
  notes: Note[];
  tasks: Task[];
  snapshots: Snapshot[];
  draft: Draft | null;
  coach: boolean;
  miniData: Record<string, Record<string, string>>;
  builderMode: BuilderMode;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** A string capped to `max`; anything that is not a string is rejected. */
function str(value: unknown, max: number): string | null {
  if (typeof value !== "string") return null;
  return value.length > max ? value.slice(0, max) : value;
}

function int(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function isId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 64;
}

function dedupe(ids: string[]): string[] {
  return [...new Set(ids)];
}

function sanitizeMinis(value: unknown): Record<string, MiniApp> {
  const minis: Record<string, MiniApp> = {};
  if (!isRecord(value)) return minis;
  for (const [id, entry] of Object.entries(value).slice(0, LIMITS.minis)) {
    if (!isId(id) || !isRecord(entry)) continue;
    const html = str(entry.html, LIMITS.html);
    const name = str(entry.name, LIMITS.name);
    if (html === null || name === null) continue;
    minis[id] = {
      id,
      name: name.trim() || "App",
      html,
      created: int(entry.created, 0),
      updated: int(entry.updated, 0),
      source: (SOURCES as readonly string[]).includes(String(entry.source))
        ? (entry.source as MiniApp["source"])
        : "studio",
    };
  }
  return minis;
}

/**
 * The home screen, repaired: only ids that still resolve survive, every system
 * app is present, and every saved mini-app is reachable — data that exists but
 * cannot be opened is worse than data that was never imported.
 */
function sanitizeOrder(value: unknown, systemIds: readonly string[], minis: Record<string, MiniApp>): string[] {
  const listed = Array.isArray(value) ? value.filter(isId) : [];
  const keep = (id: string) => id in minis || systemIds.includes(id);
  const order = dedupe(listed.filter(keep));
  for (const id of systemIds) if (!order.includes(id)) order.push(id);
  for (const id of Object.keys(minis)) if (!order.includes(id)) order.push(id);
  return order;
}

function sanitizeDock(value: unknown, order: string[]): string[] {
  if (!Array.isArray(value)) return [];
  return dedupe(value.filter(isId).filter((id) => order.includes(id))).slice(0, LIMITS.dock);
}

function sanitizeNotes(value: unknown): Note[] {
  if (!Array.isArray(value)) return [];
  const notes: Note[] = [];
  for (const entry of value.slice(0, LIMITS.notes)) {
    if (!isRecord(entry)) continue;
    const body = str(entry.body, LIMITS.noteBody);
    if (body === null) continue;
    notes.push({
      id: isId(entry.id) ? entry.id : `note_${notes.length}`,
      title: str(entry.title, LIMITS.name) ?? "",
      body,
      updated: int(entry.updated, 0),
    });
  }
  return notes;
}

function sanitizeTasks(value: unknown): Task[] {
  if (!Array.isArray(value)) return [];
  const tasks: Task[] = [];
  for (const entry of value.slice(0, LIMITS.tasks)) {
    if (!isRecord(entry)) continue;
    const text = str(entry.text, LIMITS.taskText);
    if (text === null) continue;
    tasks.push({
      id: isId(entry.id) ? entry.id : `task_${tasks.length}`,
      text,
      done: entry.done === true,
      created: int(entry.created, 0),
    });
  }
  return tasks;
}

function sanitizeSnapshots(value: unknown, minis: Record<string, MiniApp>): Snapshot[] {
  if (!Array.isArray(value)) return [];
  const snaps: Snapshot[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || !isId(entry.appId) || !(entry.appId in minis)) continue;
    const html = str(entry.html, LIMITS.html);
    if (html === null) continue;
    snaps.push({
      id: isId(entry.id) ? entry.id : `snap_${snaps.length}`,
      appId: entry.appId,
      name: str(entry.name, LIMITS.name) ?? "App",
      html,
      at: int(entry.at, 0),
    });
  }
  return snaps.slice(-LIMITS.snapshots);
}

function sanitizeMiniData(value: unknown, minis: Record<string, MiniApp>): Record<string, Record<string, string>> {
  const data: Record<string, Record<string, string>> = {};
  if (!isRecord(value)) return data;
  for (const appId of Object.keys(minis)) {
    const bag = value[appId];
    if (!isRecord(bag)) continue;
    const clean: Record<string, string> = {};
    for (const [key, entry] of Object.entries(bag).slice(0, LIMITS.bagKeys)) {
      const stored = str(entry, LIMITS.bagValue);
      if (!isId(key) || stored === null) continue;
      clean[key] = stored;
    }
    if (Object.keys(clean).length > 0) data[appId] = clean;
  }
  return data;
}

function sanitizeMessages(value: unknown): ChatLine[] {
  if (!Array.isArray(value)) return [];
  const lines: ChatLine[] = [];
  for (const entry of value.slice(0, LIMITS.messages)) {
    if (!isRecord(entry)) continue;
    if (entry.role !== "user" && entry.role !== "agent") continue;
    const text = str(entry.text, LIMITS.messageText);
    if (text === null) continue;
    lines.push({ role: entry.role, text });
  }
  return lines;
}

function sanitizeDraft(value: unknown, minis: Record<string, MiniApp>): Draft | null {
  if (!isRecord(value)) return null;
  const html = str(value.html, LIMITS.html);
  if (html === null) return null;
  const appId = isId(value.appId) && value.appId in minis ? value.appId : null;
  const pending = str(value.pending, LIMITS.html);
  return {
    appId,
    name: str(value.name, LIMITS.name) ?? "Untitled",
    html,
    seed: str(value.seed, 2_000) ?? "",
    pending,
    messages: sanitizeMessages(value.messages),
  };
}

/**
 * A full, valid persisted state — always. Anything unreadable falls back to
 * the same defaults a first run would produce, so a corrupt entry degrades to
 * an empty desk instead of a broken one.
 */
export function sanitizeShellState(input: unknown, systemIds: readonly string[]): PersistedShellState {
  const source = isRecord(input) ? input : {};
  const minis = sanitizeMinis(source.minis);
  const order = sanitizeOrder(source.order, systemIds, minis);
  return {
    theme: THEMES.includes(source.theme as ThemeChoice) ? (source.theme as ThemeChoice) : "dark",
    wallpaper: WALLPAPERS.includes(source.wallpaper as Wallpaper)
      ? (source.wallpaper as Wallpaper)
      : "harbor",
    builderMode: MODES.includes(source.builderMode as BuilderMode)
      ? (source.builderMode as BuilderMode)
      : "auto",
    coach: source.coach !== false,
    minis,
    order,
    dock: sanitizeDock(source.dock, order),
    notes: sanitizeNotes(source.notes),
    tasks: sanitizeTasks(source.tasks),
    snapshots: sanitizeSnapshots(source.snapshots, minis),
    draft: sanitizeDraft(source.draft, minis),
    miniData: sanitizeMiniData(source.miniData, minis),
  };
}
