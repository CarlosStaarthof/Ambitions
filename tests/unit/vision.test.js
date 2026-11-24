import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { VISION_TEXT_MAX, clampVisionText, normalizeVisionItem, normalizeVision } from "../../src/lib/vision.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

describe("clampVisionText", () => {
  // AC-3
  it("truncates past the limit and leaves a value at the limit alone", () => {
    expect(VISION_TEXT_MAX).toBe(280);
    expect(clampVisionText("x".repeat(281))).toHaveLength(280);
    expect(clampVisionText("x".repeat(280))).toBe("x".repeat(280));
    expect(clampVisionText("short line")).toBe("short line");
  });

  it("returns an empty string for non-strings", () => {
    expect(clampVisionText(null)).toBe("");
    expect(clampVisionText(undefined)).toBe("");
    expect(clampVisionText(42)).toBe("");
  });
});

describe("normalizeVisionItem", () => {
  // AC-4
  it("drops taskId and keeps every other field", () => {
    const item = { id: "v1", img: "data:image/jpeg;base64,AAAA", caption: "A home by the sea", done: true, createdAt: "2026-01-02T00:00:00.000Z", taskId: "t6" };
    const out = normalizeVisionItem(item);
    expect(out).toEqual({ id: "v1", img: "data:image/jpeg;base64,AAAA", caption: "A home by the sea", done: true, createdAt: "2026-01-02T00:00:00.000Z" });
    expect(out).not.toHaveProperty("taskId");
    expect(item.taskId).toBe("t6");
    expect(normalizeVisionItem(out)).toEqual(out);
  });

  it("clamps an over-long caption", () => {
    const out = normalizeVisionItem({ id: "v2", caption: "y".repeat(400) });
    expect(out.caption).toHaveLength(280);
  });

  it("passes non-objects through unchanged", () => {
    expect(normalizeVisionItem(null)).toBeNull();
    expect(normalizeVisionItem("x")).toBe("x");
  });
});

describe("normalizeVision", () => {
  // AC-5
  it("keeps every year, drops taskId, clamps captions and is idempotent", () => {
    const stored = {
      "2025": [{ id: "a", caption: "old", taskId: "t1" }],
      "2026": [{ id: "b", caption: "z".repeat(300) }],
    };
    const once = normalizeVision(stored);
    expect(Object.keys(once)).toEqual(["2025", "2026"]);
    expect(once["2025"][0]).toEqual({ id: "a", caption: "old" });
    expect(once["2026"][0].caption).toHaveLength(280);
    expect(normalizeVision(once)).toEqual(once);
  });

  it("preserves a non-array year value and tolerates malformed input", () => {
    const yearValue = { anything: true };
    expect(normalizeVision({ "2027": yearValue })["2027"]).toBe(yearValue);
    expect(normalizeVision(null)).toEqual({});
    expect(normalizeVision([])).toEqual({});
  });
});

describe("the Vision board screen", () => {
  const tab = read("../../src/components/VisionTab.jsx");
  const app = read("../../src/App.jsx");
  const store = read("../../src/lib/useStore.js");

  // AC-1
  it("no longer links a picture to an ambition task", () => {
    expect(tab).not.toMatch(/taskId/);
    expect(tab).not.toMatch(/Link2/);
    expect(tab).not.toMatch(/ambitionTasks|protectedIds/);
    expect(app).toMatch(/<VisionTab vision=\{store\.vision\} setVisionP=\{store\.setVisionP\} \/>/);
  });

  // AC-2
  it("uses a bounded textarea with a live counter", () => {
    expect(tab).toMatch(/maxLength=\{VISION_TEXT_MAX\}/);
    expect(tab).toMatch(/\/\{VISION_TEXT_MAX\}/);
  });

  // AC-6
  it("loads vision through normalizeVision without adding a storage key", () => {
    expect(store).toMatch(/setVision\(normalizeVision\(vis\.value\)\)/);
  });

  // AC-7
  it("keeps the title, puts the reached count beside it and Add image on the right", () => {
    expect(tab).toMatch(/What \{year\} looks like/);
    expect(tab).toMatch(/\{done\}\/\{items\.length\} reached/);
    expect(tab).toMatch(/Add image/);
  });

  // AC-8
  it("shows no image-size readout", () => {
    expect(tab).not.toMatch(/humanSize|dataUrlBytes/);
    expect(tab).not.toMatch(/\bKB\b|\bMB\b/);
  });

  // AC-9
  it("offers a This year jump only outside the current year", () => {
    expect(tab).toMatch(/const currentYear = new Date\(\)\.getFullYear\(\)/);
    expect(tab).toMatch(/year !== currentYear &&/);
    expect(tab).toMatch(/This year/);
    expect(tab).toMatch(/setYear\(currentYear\)/);
  });

  // AC-10
  it("adds new images with an empty caption and no task link", () => {
    expect(tab).toMatch(/caption: ""/);
  });
});
