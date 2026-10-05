import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { BootMark } from "@/shell/chrome";
import { ShellApp } from "@/shell/Shell";
import { useShell } from "@/shell/store";

export const Route = createFileRoute("/")({ component: Home });

function Home() {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let alive = true;
    const finish = () => {
      if (alive) setReady(true);
    };
    if (useShell.persist.hasHydrated()) finish();
    const unsub = useShell.persist.onFinishHydration(finish);
    return () => {
      alive = false;
      unsub();
    };
  }, []);

  if (!ready) return <BootMark />;
  return <ShellApp />;
}
