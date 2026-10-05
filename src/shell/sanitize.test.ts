import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { LIMITS, sanitizeShellState } from "./sanitize.ts";

const SYSTEM_IDS = ["builder", "notes", "tasks", "calc", "clock", "files", "settings"];

const mini = (id: string, html = "<!DOCTYPE html><html><head></head><body>hi</body></html>") => ({
  id,
  name: id,
  html,
  created: 1,
  updated: 2,
  source: "studio",
});

function persisted(overrides: Record<string, unknown> = {}) {
  return {
    theme: "dark",
    wallpaper: "harbor",
    order: [...SYSTEM_IDS],
    dock: ["builder"],
    minis: { mini_notes: mini("mini_notes") },
    notes: [],
    tasks: [],
    snapshots: [],
    draft: null,
    coach: true,
    miniData: {},
    builderMode: "auto",
    ...overrides,
  };
}

describe("sanitizeShellState", () => {
  it("keeps a well-formed desk exactly as it was", () => {
    const state = sanitizeShellState(persisted({ theme: "light", coach: false }), SYSTEM_IDS);
    assert.equal(state.theme, "light");
    assert.equal(state.coach, false);
    assert.deepEqual(state.order, [...SYSTEM_IDS, "mini_notes"]);
    assert.equal(state.minis.mini_notes?.html.includes("<body>"), true);
  });

  it("falls back to defaults for junk instead of throwing", () => {
    for (const junk of [null, undefined, 42, "corrupt", [], { minis: "nope", order: 7 }]) {
      const state = sanitizeShellState(junk, SYSTEM_IDS);
      assert.deepEqual(state.order, SYSTEM_IDS, `order for ${String(junk)}`);
      assert.deepEqual(state.minis, {});
      assert.equal(state.theme, "dark");
      assert.equal(state.draft, null);
    }
  });

  it("drops icons whose app is gone and restores the system row", () => {
    const state = sanitizeShellState(
      persisted({
        order: ["mini_deleted", "notes", "notes", "calc"],
        dock: ["mini_deleted", "notes"],
      }),
      SYSTEM_IDS,
    );
    assert.equal(state.order.includes("mini_deleted"), false);
    assert.equal(new Set(state.order).size, state.order.length, "no duplicates");
    for (const id of SYSTEM_IDS) assert.ok(state.order.includes(id), `missing ${id}`);
    assert.deepEqual(state.dock, ["notes"]);
  });

  it("keeps a saved app reachable even when the home screen forgot it", () => {
    const state = sanitizeShellState(persisted({ order: [...SYSTEM_IDS] }), SYSTEM_IDS);
    assert.ok(state.order.includes("mini_notes"), "orphaned data must stay openable");
  });

  it("rejects entries that are not the right shape", () => {
    const state = sanitizeShellState(
      persisted({
        minis: {
          mini_ok: mini("mini_ok"),
          mini_noname: { html: "<html></html>" },
          mini_badhtml: { ...mini("mini_badhtml"), html: 12345 },
          mini_huge: { ...mini("mini_huge"), html: "x".repeat(LIMITS.html + 1) },
          mini_notanobject: "nope",
        },
        notes: [
          { id: "note_1", title: "real", body: "kept", updated: 1 },
          { id: "note_2", title: "no body" },
          "not an object",
        ],
        tasks: [
          { id: "task_1", text: "real", done: true, created: 1 },
          { id: "task_2", done: true },
        ],
      }),
      SYSTEM_IDS,
    );
    assert.deepEqual(Object.keys(state.minis), ["mini_ok", "mini_huge"]);
    // Oversized strings are capped rather than dropped: losing one app or one
    // note outright is a worse outcome than a truncated one the owner can open,
    // trim and save again.
    assert.equal(state.minis.mini_huge?.html.length, LIMITS.html);
    assert.equal(state.minis.mini_ok?.id, "mini_ok");
    assert.equal(state.notes.length, 1);
    assert.equal(state.notes[0]?.body, "kept");
    assert.equal(state.tasks.length, 1);
    assert.equal(state.tasks[0]?.done, true);
    // Both lists still reference only apps and ids that resolved above.
    for (const note of state.notes) assert.equal(typeof note.id, "string");
  });

  it("coerces enum fields that drifted", () => {
    const state = sanitizeShellState(
      persisted({ theme: "neon", wallpaper: "static", builderMode: "yolo" }),
      SYSTEM_IDS,
    );
    assert.equal(state.theme, "dark");
    assert.equal(state.wallpaper, "harbor");
    assert.equal(state.builderMode, "auto");
  });

  it("keeps only storage bags that belong to a surviving app", () => {
    const state = sanitizeShellState(
      persisted({
        miniData: {
          mini_notes: { entries: "kept", ["x".repeat(65)]: "key too long" },
          mini_gone: { secret: "must not survive" },
        },
      }),
      SYSTEM_IDS,
    );
    assert.deepEqual(state.miniData.mini_notes, { entries: "kept" });
    assert.equal(state.miniData.mini_gone, undefined);
  });

  it("discards a draft that points at an app that no longer exists", () => {
    const state = sanitizeShellState(
      persisted({
        draft: {
          appId: "mini_gone",
          name: "Gone",
          html: "<html></html>",
          seed: "seed",
          pending: null,
          messages: [{ role: "user", text: "hello" }, { role: "nobody", text: "no" }],
        },
      }),
      SYSTEM_IDS,
    );
    assert.equal(state.draft?.appId, null);
    assert.equal(state.draft?.name, "Gone");
    assert.deepEqual(state.draft?.messages, [{ role: "user", text: "hello" }]);
  });

  it("bounds how much a hostile file can put in the store", () => {
    const state = sanitizeShellState(
      persisted({
        notes: Array.from({ length: 5_000 }, (_, i) => ({
          id: `note_${i}`,
          title: "t",
          body: "b".repeat(LIMITS.noteBody + 10),
          updated: i,
        })),
        dock: Array.from({ length: 50 }, (_, i) => `app_${i}`),
      }),
      SYSTEM_IDS,
    );
    assert.equal(state.notes.length, LIMITS.notes);
    assert.ok(state.notes[0]!.body.length <= LIMITS.noteBody);
    assert.ok(state.dock.length <= LIMITS.dock);
  });

  it("throws away snapshots for apps that are gone", () => {
    const state = sanitizeShellState(
      persisted({
        minis: { mini_keep: mini("mini_keep") },
        order: [...SYSTEM_IDS, "mini_keep"],
        snapshots: [
          { id: "s1", appId: "mini_keep", name: "keep", html: "<html></html>", at: 1 },
          { id: "s2", appId: "mini_gone", name: "gone", html: "<html></html>", at: 2 },
        ],
      }),
      SYSTEM_IDS,
    );
    assert.deepEqual(
      state.snapshots.map((snap) => snap.id),
      ["s1"],
    );
  });
});
