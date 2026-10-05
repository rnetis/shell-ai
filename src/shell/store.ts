import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { compileOffline } from "@/shell/agent/compile";
import { sanitizeShellState } from "@/shell/sanitize";
import { createShellStorage } from "@/shell/storage";
import type {
  BuilderMode,
  DialogState,
  Draft,
  MiniApp,
  Note,
  Snapshot,
  Task,
  ThemeChoice,
  Toast,
  Wallpaper,
  Win,
} from "@/shell/types";

export const SYSTEM_IDS = ["builder", "notes", "tasks", "calc", "clock", "files", "settings"] as const;

const SAMPLE_ID = "mini_reading";

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function sampleMini(): MiniApp {
  const built = compileOffline({
    prompt: "habit tracker for weekly reading",
    mode: "auto",
    keepName: "Reading week",
  });
  return {
    id: SAMPLE_ID,
    name: built.name,
    html: built.html ?? "",
    created: 0,
    updated: 0,
    source: "studio",
  };
}

// Writes are debounced and quota-safe: the desk is serialized on every state
// change, and a browser that refuses the write (full disk, blocked storage)
// must not take the running app down with it.
let storageWarned = false;
const storage = createShellStorage({
  onWriteError: () => {
    if (storageWarned) return;
    storageWarned = true;
    queueMicrotask(() => {
      useShell
        .getState()
        .pushToast("This device could not save — export a copy from Files.");
    });
  },
});

export type ShellState = {
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
  windows: Win[];
  z: number;
  phoneApp: string | null;
  spotlight: boolean;
  switcher: boolean;
  arrange: boolean;
  composing: boolean;
  toasts: Toast[];
  dialog: DialogState | null;
  setTheme: (theme: ThemeChoice) => void;
  setWallpaper: (wallpaper: Wallpaper) => void;
  setBuilderMode: (mode: BuilderMode) => void;
  setSpotlight: (open: boolean) => void;
  setSwitcher: (open: boolean) => void;
  setArrange: (on: boolean) => void;
  setComposing: (on: boolean) => void;
  setPhoneApp: (id: string | null) => void;
  nudge: (id: string, dir: -1 | 1) => void;
  toggleDock: (id: string) => void;
  openApp: (appId: string) => void;
  closeApp: (appId: string) => void;
  focusApp: (appId: string) => void;
  moveWindow: (id: string, x: number, y: number) => void;
  resizeWindow: (id: string, w: number, h: number) => void;
  toggleMin: (appId: string) => void;
  toggleMax: (appId: string) => void;
  pushToast: (text: string) => void;
  dismissToast: (id: string) => void;
  setMiniBag: (appId: string, bag: Record<string, string>) => void;
  createMini: (mini: Omit<MiniApp, "id" | "created" | "updated"> & { id?: string }) => string;
  updateMini: (id: string, patch: Partial<Pick<MiniApp, "name" | "html" | "source">>) => void;
  removeMini: (id: string) => void;
  snapshot: (id: string) => void;
  undoMini: (id: string) => string | null;
  setDraft: (draft: Draft | null) => void;
  editMini: (id: string) => void;
  addNote: () => string;
  updateNote: (id: string, patch: Partial<Pick<Note, "title" | "body">>) => void;
  removeNote: (id: string) => void;
  addTask: (text: string) => void;
  toggleTask: (id: string) => void;
  removeTask: (id: string) => void;
  clearDoneTasks: () => void;
  importPack: (raw: string) => number;
  dismissCoach: () => void;
  resetAll: () => void;
};

let dialogResolve: ((ok: boolean) => void) | null = null;

export function askConfirm(dialog: DialogState) {
  // A second prompt raised while one is open would otherwise orphan the first
  // promise: it could never settle, and its caller would await forever.
  if (dialogResolve) settleConfirm(false);
  useShell.setState({ dialog });
  return new Promise<boolean>((resolve) => {
    dialogResolve = resolve;
  });
}

export function settleConfirm(ok: boolean) {
  useShell.setState({ dialog: null });
  dialogResolve?.(ok);
  dialogResolve = null;
}

function freshPersistent() {
  const sample = sampleMini();
  return {
    theme: "dark" as ThemeChoice,
    wallpaper: "harbor" as Wallpaper,
    order: [...SYSTEM_IDS, sample.id],
    dock: ["builder", "notes", "tasks", "settings"],
    minis: { [sample.id]: sample },
    notes: [] as Note[],
    tasks: [] as Task[],
    snapshots: [] as Snapshot[],
    draft: null as Draft | null,
    coach: true,
    miniData: {} as Record<string, Record<string, string>>,
    builderMode: "auto" as BuilderMode,
  };
}

function placeWindow(appId: string, index: number): Pick<Win, "x" | "y" | "w" | "h" | "maximized"> {
  const desktop = typeof window !== "undefined" && window.matchMedia("(min-width: 840px)").matches;
  if (!desktop) return { x: 0, y: 0, w: 360, h: 640, maximized: true };
  const wide = appId === "builder" || appId === "files";
  const w = Math.min(wide ? 1080 : 480, window.innerWidth - 48);
  const h = Math.min(wide ? 700 : 580, window.innerHeight - 120);
  const shift = (index % 6) * 26;
  return {
    x: Math.max(16, Math.min(72 + shift, window.innerWidth - w - 16)),
    y: Math.max(56, Math.min(64 + shift, window.innerHeight - h - 24)),
    w,
    h,
    maximized: false,
  };
}

export const useShell = create<ShellState>()(
  persist(
    (set, get) => ({
      ...freshPersistent(),
      windows: [],
      z: 20,
      phoneApp: null,
      spotlight: false,
      switcher: false,
      arrange: false,
      composing: false,
      toasts: [],
      dialog: null,
      setTheme: (theme) => set({ theme }),
      setWallpaper: (wallpaper) => set({ wallpaper }),
      setBuilderMode: (builderMode) => set({ builderMode }),
      setSpotlight: (spotlight) => set({ spotlight, switcher: spotlight ? false : get().switcher }),
      setSwitcher: (switcher) => set({ switcher, spotlight: switcher ? false : get().spotlight }),
      setArrange: (arrange) => set({ arrange }),
      setComposing: (composing) => set({ composing }),
      setPhoneApp: (phoneApp) => set({ phoneApp }),
      nudge: (id, dir) =>
        set((s) => {
          const order = [...s.order];
          const index = order.indexOf(id);
          const next = index + dir;
          if (index < 0 || next < 0 || next >= order.length) return s;
          const swapped = order[next];
          if (!swapped) return s;
          order[next] = id;
          order[index] = swapped;
          return { order };
        }),
      toggleDock: (id) =>
        set((s) => ({
          dock: s.dock.includes(id) ? s.dock.filter((item) => item !== id) : [...s.dock, id].slice(0, 6),
        })),
      openApp: (appId) => {
        const state = get();
        const existing = state.windows.find((win) => win.appId === appId);
        const z = state.z + 1;
        if (existing) {
          set({
            z,
            phoneApp: appId,
            spotlight: false,
            switcher: false,
            windows: state.windows.map((win) =>
              win.appId === appId ? { ...win, minimized: false, z } : win,
            ),
          });
          return;
        }
        const geo = placeWindow(appId, state.windows.length);
        set({
          z,
          phoneApp: appId,
          spotlight: false,
          switcher: false,
          windows: [
            ...state.windows,
            { id: uid("win"), appId, z, minimized: false, ...geo },
          ],
        });
      },
      closeApp: (appId) =>
        set((s) => ({
          windows: s.windows.filter((win) => win.appId !== appId),
          phoneApp: s.phoneApp === appId ? null : s.phoneApp,
        })),
      focusApp: (appId) =>
        set((s) => {
          const z = s.z + 1;
          return {
            z,
            phoneApp: appId,
            switcher: false,
            windows: s.windows.map((win) =>
              win.appId === appId ? { ...win, minimized: false, z } : win,
            ),
          };
        }),
      moveWindow: (id, x, y) =>
        set((s) => ({
          windows: s.windows.map((win) => (win.id === id ? { ...win, x, y } : win)),
        })),
      resizeWindow: (id, w, h) =>
        set((s) => ({
          windows: s.windows.map((win) =>
            win.id === id ? { ...win, w: Math.max(320, w), h: Math.max(280, h) } : win,
          ),
        })),
      toggleMin: (appId) =>
        set((s) => ({
          windows: s.windows.map((win) =>
            win.appId === appId ? { ...win, minimized: !win.minimized } : win,
          ),
        })),
      toggleMax: (appId) =>
        set((s) => ({
          windows: s.windows.map((win) =>
            win.appId === appId ? { ...win, maximized: !win.maximized, minimized: false } : win,
          ),
        })),
      pushToast: (text) => {
        const id = uid("toast");
        set((s) => ({ toasts: [...s.toasts.slice(-3), { id, text }] }));
        if (typeof window !== "undefined") {
          window.setTimeout(() => get().dismissToast(id), 3200);
        }
      },
      dismissToast: (id) => set((s) => ({ toasts: s.toasts.filter((toast) => toast.id !== id) })),
      setMiniBag: (appId, bag) =>
        set((s) => ({ miniData: { ...s.miniData, [appId]: bag } })),
      createMini: (mini) => {
        const id = mini.id ?? uid("mini");
        const now = Date.now();
        const next: MiniApp = {
          id,
          name: mini.name,
          html: mini.html,
          source: mini.source,
          created: now,
          updated: now,
        };
        set((s) => ({
          minis: { ...s.minis, [id]: next },
          order: s.order.includes(id) ? s.order : [...s.order, id],
        }));
        return id;
      },
      updateMini: (id, patch) =>
        set((s) => {
          const current = s.minis[id];
          if (!current) return s;
          return {
            minis: {
              ...s.minis,
              [id]: { ...current, ...patch, updated: Date.now() },
            },
          };
        }),
      removeMini: (id) =>
        set((s) => {
          const minis = { ...s.minis };
          delete minis[id];
          const miniData = { ...s.miniData };
          delete miniData[id];
          return {
            minis,
            miniData,
            order: s.order.filter((item) => item !== id),
            dock: s.dock.filter((item) => item !== id),
            windows: s.windows.filter((win) => win.appId !== id),
            phoneApp: s.phoneApp === id ? null : s.phoneApp,
            snapshots: s.snapshots.filter((snap) => snap.appId !== id),
            draft: s.draft?.appId === id ? null : s.draft,
          };
        }),
      snapshot: (id) =>
        set((s) => {
          const app = s.minis[id];
          if (!app) return s;
          const snap: Snapshot = {
            id: uid("snap"),
            appId: id,
            name: app.name,
            html: app.html,
            at: Date.now(),
          };
          const own = s.snapshots.filter((item) => item.appId === id);
          const others = s.snapshots.filter((item) => item.appId !== id);
          return { snapshots: [...others, ...own, snap].slice(-40) };
        }),
      undoMini: (id) => {
        const snaps = get().snapshots.filter((snap) => snap.appId === id);
        const last = snaps[snaps.length - 1];
        if (!last) return null;
        set((s) => {
          const current = s.minis[id];
          if (!current) return { snapshots: s.snapshots.filter((snap) => snap.id !== last.id) };
          return {
            snapshots: s.snapshots.filter((snap) => snap.id !== last.id),
            minis: {
              ...s.minis,
              [id]: { ...current, name: last.name, html: last.html, updated: Date.now() },
            },
          };
        });
        return last.html;
      },
      setDraft: (draft) => set({ draft }),
      editMini: (id) => {
        const app = get().minis[id];
        if (!app) return;
        set({
          draft: {
            appId: id,
            name: app.name,
            html: app.html,
            seed: app.name,
            pending: null,
            messages: [{ role: "agent", text: "This is the saved app. Ask for a change, or edit the source." }],
          },
        });
        get().openApp("builder");
      },
      addNote: () => {
        const id = uid("note");
        const note: Note = { id, title: "", body: "", updated: Date.now() };
        set((s) => ({ notes: [note, ...s.notes] }));
        return id;
      },
      updateNote: (id, patch) =>
        set((s) => ({
          notes: s.notes.map((note) =>
            note.id === id ? { ...note, ...patch, updated: Date.now() } : note,
          ),
        })),
      removeNote: (id) => set((s) => ({ notes: s.notes.filter((note) => note.id !== id) })),
      addTask: (text) =>
        set((s) => ({
          tasks: [{ id: uid("task"), text, done: false, created: Date.now() }, ...s.tasks],
        })),
      toggleTask: (id) =>
        set((s) => ({
          tasks: s.tasks.map((task) => (task.id === id ? { ...task, done: !task.done } : task)),
        })),
      removeTask: (id) => set((s) => ({ tasks: s.tasks.filter((task) => task.id !== id) })),
      clearDoneTasks: () => set((s) => ({ tasks: s.tasks.filter((task) => !task.done) })),
      importPack: (raw) => {
        const data = JSON.parse(raw) as {
          shell?: number;
          apps?: { name?: string; html?: string }[];
          notes?: Note[];
          tasks?: Task[];
        };
        if (data.shell !== 1 || !Array.isArray(data.apps)) throw new Error("That file is not a Shell copy.");
        let count = 0;
        const minis = { ...get().minis };
        const order = [...get().order];
        for (const app of data.apps) {
          if (!app || typeof app.html !== "string" || typeof app.name !== "string") continue;
          if (app.html.length > 200_000) continue;
          const id = uid("mini");
          minis[id] = {
            id,
            name: app.name.slice(0, 28) || "Imported",
            html: app.html,
            source: "import",
            created: Date.now(),
            updated: Date.now(),
          };
          order.push(id);
          count += 1;
        }
        const notes = Array.isArray(data.notes)
          ? [
              ...data.notes
                .filter((note) => note && typeof note.body === "string")
                .map((note) => ({
                  id: uid("note"),
                  title: String(note.title ?? "").slice(0, 80),
                  body: String(note.body).slice(0, 20_000),
                  updated: Date.now(),
                })),
              ...get().notes,
            ]
          : get().notes;
        const tasks = Array.isArray(data.tasks)
          ? [
              ...data.tasks
                .filter((task) => task && typeof task.text === "string")
                .map((task) => ({
                  id: uid("task"),
                  text: String(task.text).slice(0, 140),
                  done: Boolean(task.done),
                  created: Date.now(),
                })),
              ...get().tasks,
            ]
          : get().tasks;
        set({ minis, order, notes, tasks });
        return count;
      },
      dismissCoach: () => set({ coach: false }),
      resetAll: () =>
        set({
          ...freshPersistent(),
          windows: [],
          phoneApp: null,
          toasts: [],
          spotlight: false,
          switcher: false,
          arrange: false,
        }),
    }),
    {
      name: "shell-os-v1",
      storage: createJSONStorage(() => storage),
      // Zustand calls `merge` even when storage was empty (with `undefined`),
      // and replaces the whole state with the result — so keep the live state
      // untouched there, and route anything else through the rehydration guard.
      merge: (persisted, current) =>
        persisted === undefined || persisted === null
          ? current
          : { ...current, ...sanitizeShellState(persisted, SYSTEM_IDS) },
      partialize: (state) => ({
        theme: state.theme,
        wallpaper: state.wallpaper,
        order: state.order,
        dock: state.dock,
        minis: state.minis,
        notes: state.notes,
        tasks: state.tasks,
        snapshots: state.snapshots,
        draft: state.draft,
        coach: state.coach,
        miniData: state.miniData,
        builderMode: state.builderMode,
      }),
    },
  ),
);

// A debounced write has to land before the tab goes away, or the last quarter
// second of typing is lost on close.
if (typeof window !== "undefined") {
  const flush = () => storage.flush();
  window.addEventListener("pagehide", flush);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") flush();
  });
}
