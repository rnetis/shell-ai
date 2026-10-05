import {
  AppWindow,
  Calculator,
  Clock3,
  DraftingCompass,
  FolderClosed,
  NotebookPen,
  SlidersHorizontal,
  SquareCheckBig,
  type LucideIcon,
} from "lucide-react";
import type { IconKey, MiniApp } from "@/shell/types";

export const ICONS: Record<IconKey, LucideIcon> = {
  builder: DraftingCompass,
  notes: NotebookPen,
  tasks: SquareCheckBig,
  calc: Calculator,
  clock: Clock3,
  files: FolderClosed,
  settings: SlidersHorizontal,
  mini: AppWindow,
};

const SYSTEM: Record<string, { name: string; icon: IconKey; tile: "brass" | "surface" }> = {
  builder: { name: "Builder", icon: "builder", tile: "brass" },
  notes: { name: "Notes", icon: "notes", tile: "surface" },
  tasks: { name: "Tasks", icon: "tasks", tile: "brass" },
  calc: { name: "Calc", icon: "calc", tile: "surface" },
  clock: { name: "Clock", icon: "clock", tile: "brass" },
  files: { name: "Files", icon: "files", tile: "surface" },
  settings: { name: "Settings", icon: "settings", tile: "surface" },
};

export function describeApp(id: string, minis: Record<string, MiniApp>) {
  const known = SYSTEM[id];
  if (known) return known;
  const brass = id.charCodeAt(id.length - 1) % 2 === 0;
  return {
    name: minis[id]?.name ?? "App",
    icon: "mini" as const,
    tile: brass ? ("brass" as const) : ("surface" as const),
  };
}
