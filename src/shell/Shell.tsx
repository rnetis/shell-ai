import { AppWindow, House, Minus, Square, X } from "lucide-react";
import { useEffect, useState, type PointerEvent as ReactPointerEvent } from "react";
import { Builder } from "@/shell/apps/builder";
import { CalcApp, ClockApp, FilesApp, NotesApp, SettingsApp, TasksApp } from "@/shell/apps/system";
import { Coach, Dock, LaunchIcon, SearchButton, Wallpaper } from "@/shell/chrome";
import { describeApp } from "@/shell/icons";
import { MiniFrame } from "@/shell/runtime";
import { settleConfirm, useShell } from "@/shell/store";
import type { ThemeChoice, Win } from "@/shell/types";
import { fieldClass, iconBtnClass, primaryClass, quietClass } from "@/shell/ui";

function useDesktop() {
  const [desktop, setDesktop] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(min-width: 840px)");
    const apply = () => setDesktop(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);
  return desktop;
}

function useResolvedTheme(choice: ThemeChoice) {
  const [light, setLight] = useState(false);
  useEffect(() => {
    const query = window.matchMedia("(prefers-color-scheme: light)");
    const apply = () => setLight(query.matches);
    apply();
    query.addEventListener("change", apply);
    return () => query.removeEventListener("change", apply);
  }, []);
  if (choice === "system") return light ? "light" : "dark";
  return choice;
}

function useNow() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 1000);
    return () => window.clearInterval(id);
  }, []);
  return now;
}

function AppSurface({ id }: { id: string }) {
  const mini = useShell((s) => s.minis[id]);
  if (id === "builder") return <Builder />;
  if (id === "notes") return <NotesApp />;
  if (id === "tasks") return <TasksApp />;
  if (id === "calc") return <CalcApp />;
  if (id === "clock") return <ClockApp />;
  if (id === "files") return <FilesApp />;
  if (id === "settings") return <SettingsApp />;
  if (!mini) return <p className="p-4 text-sm text-muted">This app is gone.</p>;
  return <MiniFrame appId={id} html={mini.html} title={mini.name} />;
}

export function ShellApp() {
  const choice = useShell((s) => s.theme);
  const wallpaper = useShell((s) => s.wallpaper);
  const theme = useResolvedTheme(choice);
  const desktop = useDesktop();

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const meta = event.metaKey || event.ctrlKey;
      if (meta && event.key.toLowerCase() === "k") {
        event.preventDefault();
        useShell.getState().setSpotlight(true);
        return;
      }
      if (event.key !== "Escape") return;
      const state = useShell.getState();
      if (state.spotlight) state.setSpotlight(false);
      else if (state.switcher) state.setSwitcher(false);
      else if (state.dialog) settleConfirm(false);
      else if (!window.matchMedia("(min-width: 840px)").matches && state.phoneApp) state.setPhoneApp(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <div id="shell-root" data-theme={theme} data-paper={wallpaper} className="relative h-dvh overflow-hidden text-fg">
      <Wallpaper name={wallpaper} />
      <div className="relative z-10 h-full">{desktop ? <Desktop /> : <Phone />}</div>
      <Spotlight />
      <Switcher />
      <Toasts />
      <Confirm />
    </div>
  );
}

function Desktop() {
  const order = useShell((s) => s.order);
  const arrange = useShell((s) => s.arrange);
  const setArrange = useShell((s) => s.setArrange);
  const windows = useShell((s) => s.windows);
  const coach = useShell((s) => s.coach);
  const setSwitcher = useShell((s) => s.setSwitcher);
  const now = useNow();
  const minis = useShell((s) => s.minis);
  const focused = [...windows].sort((a, b) => b.z - a.z).find((win) => !win.minimized);
  const title = focused ? describeApp(focused.appId, minis).name : "Home";
  const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  return (
    <div className="relative h-full">
      <header className="absolute inset-x-0 top-0 z-30 flex h-12 items-center gap-2 border-b border-line bg-dock px-2 backdrop-blur-xl">
        <span className="px-2 font-display text-xl italic">Shell</span>
        <span className="truncate text-sm text-muted">{title}</span>
        <div className="ml-auto flex items-center">
          <SearchButton />
          <button type="button" className="h-11 px-3 text-sm text-fg" aria-pressed={arrange} onClick={() => setArrange(!arrange)}>
            {arrange ? "Done" : "Arrange"}
          </button>
          <button type="button" className={iconBtnClass} aria-label="Open apps" onClick={() => setSwitcher(true)}>
            <AppWindow className="size-5" />
          </button>
          <time className="px-3 text-sm tabular-nums">{time}</time>
        </div>
      </header>
      <div className="absolute inset-x-0 top-12 bottom-24 overflow-hidden px-3 py-4">
        <div className="flex h-full flex-col flex-wrap content-start gap-x-1 gap-y-4">
          {order.map((id) => (
            <LaunchIcon key={id} id={id} arrange={arrange} />
          ))}
        </div>
      </div>
      {windows.map((win) => (
        <Window key={win.id} win={win} />
      ))}
      <Dock />
      {coach ? <Coach className="absolute top-20 right-8 z-20" /> : null}
    </div>
  );
}

function Window({ win }: { win: Win }) {
  const minis = useShell((s) => s.minis);
  const focusApp = useShell((s) => s.focusApp);
  const closeApp = useShell((s) => s.closeApp);
  const toggleMin = useShell((s) => s.toggleMin);
  const toggleMax = useShell((s) => s.toggleMax);
  const moveWindow = useShell((s) => s.moveWindow);
  const resizeWindow = useShell((s) => s.resizeWindow);
  const editMini = useShell((s) => s.editMini);
  const meta = describeApp(win.appId, minis);
  if (win.minimized) return null;

  function drag(event: ReactPointerEvent<HTMLElement>) {
    if (win.maximized) return;
    if ((event.target as HTMLElement).closest("button")) return;
    const originX = event.clientX;
    const originY = event.clientY;
    const startX = win.x;
    const startY = win.y;
    function move(next: PointerEvent) {
      moveWindow(win.id, Math.max(8, startX + next.clientX - originX), Math.max(52, startY + next.clientY - originY));
    }
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  function resize(event: ReactPointerEvent<HTMLElement>) {
    event.stopPropagation();
    const originX = event.clientX;
    const originY = event.clientY;
    const startW = win.w;
    const startH = win.h;
    function move(next: PointerEvent) {
      resizeWindow(win.id, startW + next.clientX - originX, startH + next.clientY - originY);
    }
    function up() {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    }
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  const frame = win.maximized
    ? { left: 12, top: 56, right: 12, bottom: 96, width: "auto", height: "auto", zIndex: win.z }
    : { left: win.x, top: win.y, width: win.w, height: win.h, zIndex: win.z };

  return (
    <section
      className="absolute flex flex-col overflow-hidden rounded-shell border border-line bg-surface shadow-window"
      style={frame}
      onPointerDown={() => focusApp(win.appId)}
    >
      <header
        className="flex h-11 shrink-0 cursor-grab items-center gap-1 border-b border-line bg-surface px-1 active:cursor-grabbing"
        onPointerDown={drag}
        onDoubleClick={() => toggleMax(win.appId)}
      >
        <button type="button" className={iconBtnClass} aria-label={`Close ${meta.name}`} onClick={() => closeApp(win.appId)}>
          <X className="size-4" />
        </button>
        <button type="button" className={iconBtnClass} aria-label={`Minimize ${meta.name}`} onClick={() => toggleMin(win.appId)}>
          <Minus className="size-4" />
        </button>
        <h2 className="min-w-0 flex-1 truncate text-center font-display text-lg">{meta.name}</h2>
        {win.appId.startsWith("mini_") ? (
          <button type="button" className="h-11 px-3 text-sm text-brass" onClick={() => editMini(win.appId)}>
            Edit
          </button>
        ) : (
          <span className="w-11" />
        )}
        <button type="button" className={iconBtnClass} aria-label={`Resize ${meta.name}`} onClick={() => toggleMax(win.appId)}>
          <Square className="size-3.5" />
        </button>
      </header>
      <div className="min-h-0 flex-1">
        <AppSurface id={win.appId} />
      </div>
      {win.maximized ? null : (
        <button
          type="button"
          aria-label="Resize window"
          className="absolute bottom-0 right-0 size-6 cursor-nwse-resize"
          onPointerDown={resize}
        />
      )}
    </section>
  );
}

function Phone() {
  const phoneApp = useShell((s) => s.phoneApp);
  if (phoneApp) return <PhoneApp id={phoneApp} />;
  return <PhoneHome />;
}

function PhoneHome() {
  const order = useShell((s) => s.order);
  const arrange = useShell((s) => s.arrange);
  const setArrange = useShell((s) => s.setArrange);
  const coach = useShell((s) => s.coach);
  const now = useNow();
  const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  const date = now.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric" });

  return (
    <div className="relative flex h-full flex-col pt-[env(safe-area-inset-top)]">
      <header className="flex h-12 items-center justify-between px-2 text-paper-fg">
        <time className="px-2 text-sm tabular-nums">{time}</time>
        <div className="flex items-center">
          <button type="button" className="h-11 px-3 text-sm" aria-pressed={arrange} onClick={() => setArrange(!arrange)}>
            {arrange ? "Done" : "Arrange"}
          </button>
          <SearchButton />
        </div>
      </header>
      <div className="px-5 pt-1">
        <p className="font-display text-4xl text-paper-fg text-balance">{date}</p>
      </div>
      {coach ? (
        <div className="px-4 pt-4">
          <Coach />
        </div>
      ) : null}
      <div className="min-h-0 flex-1 overflow-auto px-2 pb-28 pt-6">
        <div className="grid grid-cols-4 justify-items-center gap-y-5">
          {order.map((id) => (
            <LaunchIcon key={id} id={id} arrange={arrange} />
          ))}
        </div>
      </div>
      <Dock />
    </div>
  );
}

function PhoneApp({ id }: { id: string }) {
  const minis = useShell((s) => s.minis);
  const setPhoneApp = useShell((s) => s.setPhoneApp);
  const setSwitcher = useShell((s) => s.setSwitcher);
  const editMini = useShell((s) => s.editMini);
  const meta = describeApp(id, minis);
  return (
    <section className="absolute inset-0 z-20 flex flex-col bg-surface pt-[env(safe-area-inset-top)]">
      <header className="flex h-12 shrink-0 items-center px-1">
        <button type="button" className={iconBtnClass} aria-label="Home" onClick={() => setPhoneApp(null)}>
          <House className="size-5" />
        </button>
        <h1 className="min-w-0 flex-1 truncate text-center font-display text-xl">{meta.name}</h1>
        {id.startsWith("mini_") ? (
          <button type="button" className="h-11 px-2 text-sm text-brass" onClick={() => editMini(id)}>
            Edit
          </button>
        ) : null}
        <button type="button" className={iconBtnClass} aria-label="Open apps" onClick={() => setSwitcher(true)}>
          <AppWindow className="size-5" />
        </button>
      </header>
      <div className="min-h-0 flex-1 pb-[env(safe-area-inset-bottom)]">
        <AppSurface id={id} />
      </div>
    </section>
  );
}

function Spotlight() {
  const open = useShell((s) => s.spotlight);
  const setSpotlight = useShell((s) => s.setSpotlight);
  const order = useShell((s) => s.order);
  const minis = useShell((s) => s.minis);
  const openApp = useShell((s) => s.openApp);
  const [query, setQuery] = useState("");
  const [index, setIndex] = useState(0);
  const results = order.filter((id) => describeApp(id, minis).name.toLowerCase().includes(query.trim().toLowerCase()));

  useEffect(() => {
    if (open) {
      setQuery("");
      setIndex(0);
    }
  }, [open]);

  if (!open) return null;
  const current = results[Math.min(index, Math.max(0, results.length - 1))];

  return (
    <div className="absolute inset-0 z-50 bg-bg/50 p-4" onClick={() => setSpotlight(false)}>
      <div
        className="mx-auto mt-16 w-full max-w-lg overflow-hidden rounded-shell border border-line bg-surface shadow-window sm:mt-24"
        onClick={(event) => event.stopPropagation()}
      >
        <input
          autoFocus
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setIndex(0);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIndex((value) => Math.min(results.length - 1, value + 1));
            } else if (event.key === "ArrowUp") {
              event.preventDefault();
              setIndex((value) => Math.max(0, value - 1));
            } else if (event.key === "Enter" && current) {
              openApp(current);
            }
          }}
          placeholder="Search apps"
          aria-label="Search apps"
          className={`${fieldClass} rounded-none border-0 border-b`}
        />
        <ul className="max-h-80 overflow-auto py-1">
          {results.length === 0 ? <li className="px-4 py-3 text-sm text-muted">No apps match.</li> : null}
          {results.map((id) => (
            <li key={id}>
              <button
                type="button"
                className={`flex h-12 w-full items-center px-4 text-left ${id === current ? "bg-surface-2" : ""}`}
                onClick={() => openApp(id)}
              >
                {describeApp(id, minis).name}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Switcher() {
  const open = useShell((s) => s.switcher);
  const setSwitcher = useShell((s) => s.setSwitcher);
  const windows = useShell((s) => s.windows);
  const minis = useShell((s) => s.minis);
  const focusApp = useShell((s) => s.focusApp);
  const closeApp = useShell((s) => s.closeApp);
  if (!open) return null;
  return (
    <div className="absolute inset-0 z-40 flex items-end justify-center bg-bg/55 p-4 sm:items-center" onClick={() => setSwitcher(false)}>
      <div
        className="w-full max-w-3xl rounded-shell border border-line bg-surface p-4 shadow-window"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="font-display text-2xl">Open</h2>
          <button type="button" className={quietClass} onClick={() => setSwitcher(false)}>
            Close
          </button>
        </div>
        {windows.length === 0 ? (
          <p className="text-sm text-muted">Nothing is open.</p>
        ) : (
          <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {windows.map((win) => (
              <li key={win.id} className="rounded-shell border border-line bg-surface-2 p-3">
                <button type="button" className="w-full text-left" onClick={() => focusApp(win.appId)}>
                  <span className="block truncate font-medium">{describeApp(win.appId, minis).name}</span>
                  <span className="text-xs text-muted">{win.minimized ? "Hidden" : "Open"}</span>
                </button>
                <button type="button" className="mt-2 h-11 text-sm text-muted" onClick={() => closeApp(win.appId)}>
                  Close
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function Toasts() {
  const toasts = useShell((s) => s.toasts);
  const dismiss = useShell((s) => s.dismissToast);
  if (toasts.length === 0) return null;
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-28 z-40 flex flex-col items-center gap-2 px-4">
      {toasts.map((toast) => (
        <button
          key={toast.id}
          type="button"
          className="pointer-events-auto max-w-sm rounded-full border border-line bg-surface px-4 py-2 text-sm text-fg shadow-window"
          onClick={() => dismiss(toast.id)}
        >
          {toast.text}
        </button>
      ))}
    </div>
  );
}

function Confirm() {
  const dialog = useShell((s) => s.dialog);
  if (!dialog) return null;
  return (
    <div className="absolute inset-0 z-50 grid place-items-center bg-bg/55 p-4">
      <div className="w-full max-w-sm rounded-shell border border-line bg-surface p-5 shadow-window" role="alertdialog" aria-labelledby="confirm-title">
        <h2 id="confirm-title" className="font-display text-3xl">
          {dialog.title}
        </h2>
        <p className="mt-2 text-sm text-pretty text-muted">{dialog.body}</p>
        <div className="mt-5 flex justify-end gap-2">
          <button type="button" className={quietClass} onClick={() => settleConfirm(false)}>
            Cancel
          </button>
          <button type="button" className={primaryClass} onClick={() => settleConfirm(true)}>
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
