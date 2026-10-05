export type ThemeChoice = "dark" | "light" | "system";
export type Wallpaper = "harbor" | "orchard" | "paper" | "salt";
export type BuilderMode = "ask" | "edit" | "auto";
export type AppSource = "studio" | "grok" | "import";

export type MiniApp = {
  id: string;
  name: string;
  html: string;
  created: number;
  updated: number;
  source: AppSource;
};

export type Note = {
  id: string;
  title: string;
  body: string;
  updated: number;
};

export type Task = {
  id: string;
  text: string;
  done: boolean;
  created: number;
};

export type Snapshot = {
  id: string;
  appId: string;
  name: string;
  html: string;
  at: number;
};

export type ChatLine = {
  role: "user" | "agent";
  text: string;
};

export type Draft = {
  appId: string | null;
  name: string;
  html: string;
  seed: string;
  pending: string | null;
  messages: ChatLine[];
};

export type Win = {
  id: string;
  appId: string;
  x: number;
  y: number;
  w: number;
  h: number;
  z: number;
  minimized: boolean;
  maximized: boolean;
};

export type Toast = {
  id: string;
  text: string;
};

export type DialogState = {
  title: string;
  body: string;
  confirmLabel: string;
};

export type IconKey =
  | "builder"
  | "notes"
  | "tasks"
  | "calc"
  | "clock"
  | "files"
  | "settings"
  | "mini";
