import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { ownsFrame, frameOwner, registerFrame } from "./frame-registry.ts";

describe("frame registry", () => {
  it("only the registered window speaks for its app", () => {
    const frameA = {};
    const frameB = {};
    registerFrame(frameA, "mini_notes");
    registerFrame(frameB, "mini_budget");

    assert.equal(frameOwner(frameA), "mini_notes");
    assert.ok(ownsFrame(frameA, "mini_notes"));
    // The whole point: a frame cannot name a neighbour and reach its bag.
    assert.equal(ownsFrame(frameA, "mini_budget"), false);
    assert.equal(ownsFrame(frameB, "mini_notes"), false);
  });

  it("ignores callers that never registered", () => {
    assert.equal(frameOwner({}), null);
    assert.equal(frameOwner(null), null);
    assert.equal(frameOwner(undefined), null);
    assert.equal(frameOwner("shell-mini"), null);
    assert.equal(ownsFrame({}, "mini_notes"), false);
    // A registered frame still has to name a real app id.
    const frame = {};
    registerFrame(frame, "mini_notes");
    assert.equal(ownsFrame(frame, ""), false);
    assert.equal(ownsFrame(frame, undefined), false);
  });

  it("re-registers a window that now renders a different app", () => {
    const frame = {};
    registerFrame(frame, "preview");
    registerFrame(frame, "mini_reading");
    assert.ok(ownsFrame(frame, "mini_reading"));
    assert.equal(ownsFrame(frame, "preview"), false);
  });

  it("ignores the null frame an unmounted iframe hands its ref", () => {
    registerFrame(null, "mini_notes");
    assert.equal(frameOwner(null), null);
  });
});
