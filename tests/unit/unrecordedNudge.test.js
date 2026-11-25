import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  NUDGE_GAP_OPTIONS, NUDGE_GAP_DEFAULT, normalizeUnrecorded, nudgeGapText,
  lastRecordedBlockEnd, unrecordedNudge
} from "../../src/lib/nudge.js";
import { notificationIdFor, filterQuietOccurrences } from "../../src/lib/reminders.js";
import { DEFAULT_SETTINGS } from "../../src/lib/useStore.js";
import { mergeSettings } from "../../src/lib/seed.js";
import { mondayOf, isoDate } from "../../src/lib/time.js";

const weekKeyOf = (d) => isoDate(mondayOf(d));

function paint(weeks, when, id = "t1") {
  const key = weekKeyOf(when);
  const day = (when.getDay() + 6) % 7;
  const slot = when.getHours() * 2 + (when.getMinutes() >= 30 ? 1 : 0);
  weeks[key] = weeks[key] || { cells: {} };
  weeks[key].cells[`${day}-${slot}`] = id;
  return weeks;
}

const at = (h, m = 0, day = 5, month = 0, year = 2026) => new Date(year, month, day, h, m, 0, 0);
const enabled = (gapMinutes = 60, extra = {}) => ({ enabled: true, gapMinutes, ...extra });
const quiet = { enabled: true, start: "23:00", end: "07:00" };

describe("the unrecorded setting", () => {
  // AC-1
  it("ships off with a one-hour gap and no nudge state", () => {
    expect(DEFAULT_SETTINGS.unrecorded).toEqual({
      enabled: false, gapMinutes: 60, lastNudgedGapStart: null, lastNudgedAt: null
    });
  });

  it("fills the defaults for settings stored before this feature", () => {
    const merged = mergeSettings(DEFAULT_SETTINGS, { ai: { enabled: true } });
    expect(merged.unrecorded).toEqual(DEFAULT_SETTINGS.unrecorded);
    expect(mergeSettings(DEFAULT_SETTINGS, merged)).toEqual(merged);
  });

  it("still reads and writes exactly the eight localForage keys", () => {
    const src = readFileSync(new URL("../../src/lib/useStore.js", import.meta.url), "utf8");
    const keys = new Set([...src.matchAll(/(?:loadKey|saveKey)\("([^"]+)"/g)].map((m) => m[1]));
    expect([...keys].sort()).toEqual(["categories", "questions", "reflections", "reminderWall", "settings", "tasks", "vision", "weeks"]);
  });
});

describe("normalizeUnrecorded", () => {
  // AC-2
  it("falls back to the defaults for nonsense", () => {
    for (const bad of [undefined, null, "nope", 42, []]) {
      expect(normalizeUnrecorded(bad)).toEqual(DEFAULT_SETTINGS.unrecorded);
    }
  });

  it("accepts exactly the three gaps and treats anything else as one hour", () => {
    expect(NUDGE_GAP_OPTIONS).toEqual([60, 90, 120]);
    expect(NUDGE_GAP_DEFAULT).toBe(60);
    for (const gap of [60, 90, 120]) expect(normalizeUnrecorded({ gapMinutes: gap }).gapMinutes).toBe(gap);
    expect(normalizeUnrecorded({ gapMinutes: 15 }).gapMinutes).toBe(60);
    expect(normalizeUnrecorded({ gapMinutes: "90" }).gapMinutes).toBe(90);
  });

  it("only treats true as enabled and is idempotent", () => {
    expect(normalizeUnrecorded({ enabled: "yes" }).enabled).toBe(false);
    const once = normalizeUnrecorded({ enabled: true, gapMinutes: 120, lastNudgedGapStart: "never", lastNudgedAt: "2026-01-05T10:00:00.000Z" });
    expect(normalizeUnrecorded(once)).toEqual(once);
  });
});

describe("the message text", () => {
  // AC-3
  it("adapts to the configured gap", () => {
    expect(nudgeGapText(60)).toBe("hour");
    expect(nudgeGapText(90)).toBe("1.5 hours");
    expect(nudgeGapText(120)).toBe("2 hours");
    expect(nudgeGapText(15)).toBe("hour");
  });
});

describe("the last recorded block", () => {
  // AC-4
  it("finds a block later the same day", () => {
    const weeks = paint({}, at(13, 0));
    expect(lastRecordedBlockEnd(at(14, 10), weeks)).toEqual(at(13, 30));
  });

  it("finds a block in the previous day", () => {
    const weeks = paint({}, at(23, 30, 5));
    expect(lastRecordedBlockEnd(at(0, 30, 6), weeks)).toEqual(at(0, 0, 6));
  });

  it("finds a block in the previous week (Sunday 23:30 seen from Monday)", () => {
    const weeks = paint({}, at(23, 30, 11));
    expect(lastRecordedBlockEnd(at(0, 30, 12), weeks)).toEqual(at(0, 0, 12));
  });

  // AC-5
  it("uses the block containing now when it is filled", () => {
    const weeks = paint({}, at(10, 0));
    expect(lastRecordedBlockEnd(at(10, 10), weeks)).toEqual(at(10, 30));
  });

  it("ignores cells painted in the future", () => {
    const weeks = paint({}, at(12, 0));
    expect(lastRecordedBlockEnd(at(10, 10), weeks)).toBeNull();
  });
});

describe("unrecordedNudge", () => {
  // AC-6
  it("does nothing while switched off", () => {
    expect(unrecordedNudge(at(12, 0), {}, { enabled: false })).toBeNull();
  });

  // AC-7
  it("schedules the nudge exactly one gap after the last recorded block", () => {
    const now = at(10, 10);
    const weeks = paint({}, at(9, 30));
    const n = unrecordedNudge(now, weeks, enabled(60));
    expect(n.alreadyMarked).toBe(false);
    expect(n.entry.at).toEqual(at(11, 0));
    expect(n.entry.body).toBe("You haven't recorded anything for the past hour");
    expect(n.entry.id).toBe(notificationIdFor("unrecorded", n.entry.at, n.gapKey));
  });

  it("fires straight away when the gap is already longer than the setting", () => {
    const now = at(11, 30);
    const weeks = paint({}, at(9, 30));
    const n = unrecordedNudge(now, weeks, enabled(60));
    expect(n.entry.at.getTime()).toBeGreaterThan(now.getTime());
    expect(n.entry.at.getTime()).toBeLessThanOrEqual(now.getTime() + 60 * 1000);
  });

  // AC-8
  it("fires once when nothing has ever been recorded", () => {
    const now = at(12, 0);
    const n = unrecordedNudge(now, {}, enabled(90));
    expect(n.gapKey).toBe("never");
    expect(n.entry.at.getTime()).toBeGreaterThan(now.getTime());
    expect(n.entry.at.getTime()).toBeLessThanOrEqual(now.getTime() + 60 * 1000);
    expect(n.entry.body).toBe("You haven't recorded anything for the past 1.5 hours");
  });

  // AC-9
  it("keeps the very same nudge while it is still in the future", () => {
    const now = at(10, 10);
    const weeks = paint({}, at(9, 30));
    const first = unrecordedNudge(now, weeks, enabled(60));
    const state = {
      enabled: true, gapMinutes: 60,
      lastNudgedGapStart: first.gapKey, lastNudgedAt: first.entry.at.toISOString()
    };
    const again = unrecordedNudge(now, weeks, state);
    expect(again.alreadyMarked).toBe(true);
    expect(again.entry.id).toBe(first.entry.id);
    expect(again.entry.at).toEqual(first.entry.at);
  });

  it("goes quiet for that gap once its scheduled time has passed", () => {
    const weeks = paint({}, at(9, 30));
    const state = {
      enabled: true, gapMinutes: 60,
      lastNudgedGapStart: at(10, 0).toISOString(), lastNudgedAt: at(10, 0).toISOString()
    };
    expect(unrecordedNudge(at(10, 10), weeks, state)).toBeNull();
  });

  // AC-10
  it("starts a new nudge when a later block is recorded", () => {
    const weeks = paint({}, at(9, 30));
    const first = unrecordedNudge(at(10, 10), weeks, enabled(60));
    paint(weeks, at(10, 30));
    const next = unrecordedNudge(at(11, 10), weeks, { ...enabled(60), lastNudgedGapStart: first.gapKey, lastNudgedAt: first.entry.at.toISOString() });
    expect(next).not.toBeNull();
    expect(next.entry.id).not.toBe(first.entry.id);
    expect(next.entry.at).toEqual(at(12, 0));
  });
});

describe("quiet hours and the plan", () => {
  // AC-11
  it("is dropped inside the window and kept outside it", () => {
    const late = paint({}, at(21, 30));
    const n = unrecordedNudge(at(22, 0), late, enabled(60));
    expect(n.entry.at).toEqual(at(23, 0));
    expect(filterQuietOccurrences([n.entry], quiet)).toEqual([]);
    const daytime = paint({}, at(9, 30));
    const outside = unrecordedNudge(at(12, 0), daytime, enabled(60));
    expect(filterQuietOccurrences([outside.entry], quiet)).toEqual([outside.entry]);
  });
});

describe("what this feature did not change", () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

  // AC-12
  it("wires the nudge into the App plan before quiet-hours filtering", () => {
    const src = read("../../src/App.jsx");
    expect(src).toMatch(/unrecordedNudge\(now, weeks, settings\.unrecorded\)/);
    expect(src).toMatch(/filterQuietOccurrences\(nudge \? \[\.\.\.planned, nudge\.entry\] : planned/);
    expect(src).toMatch(/lastNudgedGapStart: nudge\.gapKey/);
  });

  // AC-13
  it("keeps the pure module free of React, DOM, Capacitor and storage", () => {
    const src = read("../../src/lib/nudge.js");
    expect(src).not.toMatch(/react|@capacitor|localforage|from "\.\/storage"/i);
    expect([...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1]).sort()).toEqual(["./reminders", "./seed"]);
  });

  it("leaves the export at version 7 without settings", () => {
    const src = read("../../src/components/DataTab.jsx");
    const payload = src.split("\n").find((l) => l.includes("const payload ="));
    expect(payload).toMatch(/version:\s*7\b/);
    expect(payload).not.toMatch(/\bsettings\b/);
  });
});
