import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

// The week note gesture lives in a component, so these are source contracts in the
// same style as notes.test.js. The feel is verified on device; the decision rules —
// "a brush never blocks the hold" and "the release tap after a hold never paints" —
// are pinned here.
const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const week = read("../../src/components/WeekTab.jsx");
const settings = read("../../src/components/SettingsTab.jsx");

const cellDown = () => {
  const start = week.indexOf("function handleCellPointerDown");
  return week.slice(start, week.indexOf("function handleCellPointerMove"));
};

const clickLine = () => week.split("\n").find((l) => l.includes("onClick={() => {") && l.includes("applyBrush(d, s)"));

describe("long-press note gesture (spec 015)", () => {
  // AC-1
  it("starts the hold even when a brush or the eraser is selected", () => {
    expect(cellDown()).toMatch(/if \(noteDlg\) return;/);
    expect(cellDown()).not.toMatch(/brush\s*!=\s*null/);
    expect(week).not.toMatch(/if \(brush != null \|\| noteDlg\) return;/);
    expect(cellDown()).toMatch(/setTimeout\(/);
  });

  // AC-1
  it("uses the same clamped hold time as the settings row", () => {
    expect(week).toMatch(/clampLongPressMs\(settings && settings\.longPressMs\)/);
  });

  // AC-2
  it("marks the release tap when the hold fires, before opening the note", () => {
    const body = cellDown();
    const fire = body.slice(body.indexOf("setTimeout("));
    expect(fire).toMatch(/suppressTapRef\.current = true/);
    expect(fire.indexOf("suppressTapRef.current = true")).toBeLessThan(fire.indexOf("openNoteAt(index)"));
  });

  // AC-3
  it("swallows the tap that ends a hold and lets the next tap paint again", () => {
    const line = clickLine();
    expect(line).toMatch(/suppressTapRef/);
    expect(line).toMatch(/applyBrush\(d, s\)/);
    expect(line.indexOf("suppressTapRef")).toBeLessThan(line.indexOf("applyBrush"));
    expect(line).toMatch(/suppressTapRef\.current = false/);
  });

  // AC-4
  it("a fresh tap still paints or erases", () => {
    const line = clickLine();
    expect(line).toMatch(/applyBrush\(d, s\)/);
  });

  // AC-5
  it("never paints a touch or pen through the mouse-compatibility path", () => {
    const down = week.split("\n").find((l) => l.includes("onMouseDown={() =>"));
    expect(down).toMatch(/pointerIsTouchRef\.current/);
    expect(down).toMatch(/suppressTapRef\.current/);
    expect(cellDown()).toMatch(/pointerIsTouchRef\.current = e\.pointerType === "touch"/);
  });

  // AC-7
  it("keeps the scroll rules from the earlier owner ruling", () => {
    expect(week).not.toMatch(/touchAction:\s*"none"/);
    expect(week).toMatch(/touchAction:\s*scrollLocked\s*\?\s*"none"\s*:\s*"pan-y"/);
    expect(week).toMatch(/HOLD_CANCEL_PX/);
    expect(week).toMatch(/Math\.hypot/);
  });

  // AC-8
  it("updates the settings copy to the new rule", () => {
    expect(settings).not.toMatch(/only when no brush is selected/i);
    expect(settings).toMatch(/even with a brush selected/i);
    expect(settings).toMatch(/short tap still paints/i);
  });

  // AC-9
  it("changes no week data shape or storage path", () => {
    expect(week).not.toMatch(/localforage|saveKey|loadKey/);
    expect(week).toMatch(/notes: next/);
  });
});
