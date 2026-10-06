import { ArrowRight, ChevronLeft, ChevronRight, Search, Sparkles, X } from "lucide-react";
import { describeApp, ICONS } from "@/shell/icons";
import { useShell } from "@/shell/store";

export function BootMark() {
  return (
    <main className="grid h-dvh place-items-center bg-bg text-fg">
      <div className="text-center">
        <p className="text-5xl font-semibold tracking-tight">Shell</p>
        <p className="mt-2 text-sm text-muted">Talk to build. Tap to run.</p>
      </div>
    </main>
  );
}

export function Wallpaper({ name }: { name: string }) {
  return (
    <>
      <div className="wallpaper" data-paper={name} />
      <div className="paper-grain" />
    </>
  );
}

export function LaunchIcon({
  id,
  labeled = true,
  arrange = false,
  dock = false,
}: {
  id: string;
  labeled?: boolean;
  arrange?: boolean;
  dock?: boolean;
}) {
  const minis = useShell((s) => s.minis);
  const openApp = useShell((s) => s.openApp);
  const nudge = useShell((s) => s.nudge);
  const running = useShell((s) => s.windows.some((win) => win.appId === id && !win.minimized));
  const meta = describeApp(id, minis);
  const Icon = ICONS[meta.icon];
  const tile =
    meta.tile === "accent" ? "bg-accent text-accent-fg" : "bg-surface text-fg border border-line";

  return (
    <div className={`flex flex-col items-center ${dock ? "w-12" : "w-20"}`}>
      <button
        type="button"
        className="flex flex-col items-center gap-1.5"
        aria-label={`Open ${meta.name}`}
        onClick={() => {
          if (!arrange) openApp(id);
        }}
      >
        <span className={`relative grid place-items-center rounded-[1rem] shadow-sm ${dock ? "size-12" : "size-14"} ${tile}`}>
          <Icon className={dock ? "size-5" : "size-6"} strokeWidth={1.75} />
          {dock && running ? (
            <span className="absolute -bottom-2 size-1 rounded-full bg-accent" />
          ) : null}
        </span>
        {labeled ? (
          <span className="max-w-20 truncate text-center text-xs text-paper-fg">{meta.name}</span>
        ) : null}
      </button>
      {arrange ? (
        <div className="mt-1 flex">
          <button
            type="button"
            className="grid size-11 place-items-center text-paper-fg"
            aria-label={`Move ${meta.name} earlier`}
            onClick={() => nudge(id, -1)}
          >
            <ChevronLeft className="size-4" />
          </button>
          <button
            type="button"
            className="grid size-11 place-items-center text-paper-fg"
            aria-label={`Move ${meta.name} later`}
            onClick={() => nudge(id, 1)}
          >
            <ChevronRight className="size-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}

export function Dock() {
  const dock = useShell((s) => s.dock);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex justify-center px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="pointer-events-auto flex items-end gap-3 rounded-2xl border border-line bg-dock px-3 py-2 shadow-window backdrop-blur-xl">
        {dock.map((id) => (
          <LaunchIcon key={id} id={id} labeled={false} dock />
        ))}
      </div>
    </div>
  );
}

export function Coach({ className = "" }: { className?: string }) {
  const dismiss = useShell((s) => s.dismissCoach);
  const openApp = useShell((s) => s.openApp);
  return (
    <aside className={`shell-welcome-card-inner ${className}`}>
      <div className="welcome-copy">
        <p className="welcome-kicker"><Sparkles className="size-3.5" /> A DESK THAT GROWS WITH YOU</p>
        <h2>Make a little app for a thing you do every day.</h2>
        <p>Describe it in a sentence. Shell builds it, and keeps it right here on your desk.</p>
        <div className="welcome-actions">
          <button type="button" className="welcome-primary" onClick={() => { dismiss(); openApp("builder"); }}>
            Create an app <ArrowRight className="size-4" />
          </button>
          <button type="button" className="welcome-dismiss" onClick={dismiss} aria-label="Dismiss welcome">
            <X className="size-4" />
          </button>
        </div>
      </div>
      <div className="welcome-art" aria-hidden="true">
        <span className="welcome-orbit welcome-orbit-one" />
        <span className="welcome-orbit welcome-orbit-two" />
        <span className="welcome-glass"><Sparkles className="size-8" /></span>
        <span className="welcome-star welcome-star-one">✳</span>
        <span className="welcome-star welcome-star-two">✦</span>
      </div>
    </aside>
  );
}

export function SearchButton() {
  const setSpotlight = useShell((s) => s.setSpotlight);
  return (
    <button type="button" className="grid size-11 place-items-center text-current" aria-label="Search" onClick={() => setSpotlight(true)}>
      <Search className="size-5" />
    </button>
  );
}
