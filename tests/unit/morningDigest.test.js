import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  normalizeDigest, digestItems, plannedMorningDigest,
  DIGEST_DEFAULT_TIME, DIGEST_TITLE
} from "../../src/lib/morningDigest.js";
import { filterQuietOccurrences } from "../../src/lib/reminders.js";
import { mergeSettings } from "../../src/lib/seed.js";
import { DEFAULT_SETTINGS } from "../../src/lib/useStore.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const clone = (v) => JSON.parse(JSON.stringify(v));
const AT = "2026-11-18T10:00:00.000Z";
const ITEM = (id, extra = {}) => ({
  id, categoryId: "home", text: `to-do ${id}`, createdAt: AT, updatedAt: AT, ...extra
});
const at = (h, m = 0, day = 18, month = 10, year = 2026) => new Date(year, month, day, h, m, 0, 0);
const quiet = { enabled: true, start: "23:00", end: "07:00" };

describe("the morning digest default", () => {
  // AC-1
  it("ships off at 08:00, appears for old settings, and adds no store key", () => {
    expect(DEFAULT_SETTINGS.digest).toEqual({ enabled: false, time: "08:00" });
    expect(DIGEST_DEFAULT_TIME).toBe("08:00");

    const merged = mergeSettings(DEFAULT_SETTINGS, { ai: { enabled: false, provider: "none" } });
    expect(merged.digest).toEqual({ enabled: false, time: "08:00" });
    const kept = mergeSettings(DEFAULT_SETTINGS, { digest: { enabled: true, time: "06:45" } });
    expect(kept.digest).toEqual({ enabled: true, time: "06:45" });

    const store = read("../../src/lib/useStore.js");
    const keys = new Set([...store.matchAll(/(?:loadKey|saveKey)\("([^"]+)"/g)].map((m) => m[1]));
    expect([...keys].sort()).toEqual(["categories", "questions", "reflections", "reminderWall", "settings", "tasks", "vision", "weeks"]);
  });
});

describe("normalizeDigest", () => {
  // AC-2
  it("falls back to off at 08:00 for missing or nonsense input", () => {
    for (const bad of [undefined, null, "nonsense", 42, []]) {
      expect(normalizeDigest(bad)).toEqual({ enabled: false, time: "08:00" });
    }
  });

  // AC-2
  it("keeps a valid clock, pads, clamps, and enables only on true", () => {
    expect(normalizeDigest({ enabled: true, time: "7:05" })).toEqual({ enabled: true, time: "07:05" });
    expect(normalizeDigest({ enabled: true, time: "25:00" })).toEqual({ enabled: true, time: "23:00" });
    expect(normalizeDigest({ enabled: true, time: "nope" })).toEqual({ enabled: true, time: "08:00" });
    expect(normalizeDigest({ enabled: "yes", time: "09:00" }).enabled).toBe(false);
    expect(normalizeDigest({ time: "09:00" }).enabled).toBe(false);
  });

  // AC-2
  it("is idempotent", () => {
    const once = normalizeDigest({ enabled: true, time: "6:15" });
    expect(normalizeDigest(once)).toEqual(once);
  });
});

describe("digestItems", () => {
  // AC-3
  it("lists open items with no start time, including end-only ones", () => {
    const items = [
      ITEM("a", { text: "  call dentist  " }),
      ITEM("b", { endTime: "17:00", text: "end only" }),
      ITEM("c", { startTime: "09:00", text: "timed" }),
      ITEM("d", { doneAt: AT, text: "done" }),
      ITEM("e", { text: "   " })
    ];
    expect(digestItems(items)).toEqual([{ id: "a", text: "call dentist" }, { id: "b", text: "end only" }]);
    expect(digestItems([])).toEqual([]);
    expect(digestItems(null)).toEqual([]);
  });

  // AC-3
  it("does not mutate its input", () => {
    const items = [ITEM("a", { text: "  keep  " })];
    const before = clone(items);
    digestItems(items);
    expect(items).toEqual(before);
  });
});

describe("plannedMorningDigest", () => {
  const items = [ITEM("a", { text: "call dentist" }), ITEM("b", { text: "buy milk" })];

  // AC-4
  it("returns nothing while disabled or when no item qualifies", () => {
    expect(plannedMorningDigest(items, { enabled: false, time: "08:00" }, at(7))).toEqual([]);
    expect(plannedMorningDigest(items, undefined, at(7))).toEqual([]);
    expect(plannedMorningDigest([], { enabled: true, time: "08:00" }, at(7))).toEqual([]);
    expect(plannedMorningDigest([ITEM("a", { startTime: "09:00" })], { enabled: true, time: "08:00" }, at(7))).toEqual([]);
  });

  // AC-5
  it("plans one digest today while the time is ahead, otherwise tomorrow", () => {
    const plan = plannedMorningDigest(items, { enabled: true, time: "08:00" }, at(7));
    expect(plan).toHaveLength(1);
    expect(plan[0].sourceId).toBe("digest");
    expect(plan[0].title).toBe(DIGEST_TITLE);
    expect(plan[0].at).toEqual(at(8));
    expect(plan[0].body.split("\n")).toEqual(["• call dentist", "• buy milk"]);

    expect(plannedMorningDigest(items, { enabled: true, time: "08:00" }, at(8))[0].at).toEqual(at(8, 0, 19));
    expect(plannedMorningDigest(items, { enabled: true, time: "08:00" }, at(9))[0].at).toEqual(at(8, 0, 19));
  });

  // AC-5 — local wall-clock parts, so the hour survives a DST transition.
  it("keeps the configured hour on both sides of a spring-forward day", () => {
    const before = plannedMorningDigest(items, { enabled: true, time: "08:00" }, new Date(2026, 2, 7, 7, 0, 0, 0))[0].at;
    const after = plannedMorningDigest(items, { enabled: true, time: "08:00" }, new Date(2026, 2, 9, 7, 0, 0, 0))[0].at;
    expect(before.getHours()).toBe(8);
    expect(after.getHours()).toBe(8);
  });

  // AC-6
  it("keeps a stable id for an unchanged list and changes it with the day or content", () => {
    const today = plannedMorningDigest(items, { enabled: true, time: "08:00" }, at(7))[0];
    const again = plannedMorningDigest(items, { enabled: true, time: "08:00" }, at(7, 30))[0];
    const tomorrow = plannedMorningDigest(items, { enabled: true, time: "08:00" }, at(9))[0];
    expect(again.id).toBe(today.id);
    expect(tomorrow.id).not.toBe(today.id);

    const edited = plannedMorningDigest([items[0], { ...items[1], text: "buy oat milk" }], { enabled: true, time: "08:00" }, at(7))[0];
    expect(edited.id).not.toBe(today.id);
    const added = plannedMorningDigest([...items, ITEM("c", { text: "third" })], { enabled: true, time: "08:00" }, at(7))[0];
    expect(added.id).not.toBe(today.id);
    const removed = plannedMorningDigest([items[0]], { enabled: true, time: "08:00" }, at(7))[0];
    expect(removed.id).not.toBe(today.id);
    const retimed = plannedMorningDigest([items[0], { ...items[1], startTime: "09:00" }], { enabled: true, time: "08:00" }, at(7))[0];
    expect(retimed.id).not.toBe(today.id);

    for (const p of [today, tomorrow, edited, added, removed, retimed]) {
      expect(Number.isInteger(p.id)).toBe(true);
      expect(p.id).toBeGreaterThan(0);
      expect(p.id).toBeLessThanOrEqual(2147483647);
    }
  });

  // AC-7
  it("is dropped inside quiet hours and kept outside", () => {
    const late = plannedMorningDigest(items, { enabled: true, time: "23:30" }, at(22));
    expect(filterQuietOccurrences(late, quiet)).toEqual([]);
    const morning = plannedMorningDigest(items, { enabled: true, time: "08:00" }, at(7));
    expect(filterQuietOccurrences(morning, quiet)).toEqual(morning);
  });

  // AC-7
  it("adds the digest to the App plan before the quiet filter", () => {
    const src = read("../../src/App.jsx");
    expect(src).toMatch(/plannedMorningDigest\(reminderWall && reminderWall\.items, settings\.digest, now\)/);
    expect(src).toMatch(/filterQuietOccurrences\(nudge \? \[\.\.\.planned, nudge\.entry\] : planned, settings\.quietHours\)/);
    expect(src).toMatch(/\[loading, storageError, settings, reflections, questions, reminderWall, weeks\]/);
  });
});

describe("the Settings row and purity", () => {
  // AC-8
  it("exposes a digest toggle and time input wired to settings", () => {
    const src = read("../../src/components/SettingsTab.jsx");
    expect(src).toMatch(/Morning digest/);
    expect(src).toMatch(/normalizeDigest/);
    expect(src).toMatch(/toggleDigest/);
    expect(src).toMatch(/setDigest\(\{ time: e\.target\.value \}\)/);
    expect(src).toMatch(/checked=\{digest\.enabled\}/);
    expect(src).toMatch(/value=\{digest\.time\}/);
    expect(src).toMatch(/requestNotifyPermission\(\)/);
  });

  // AC-9
  it("keeps the planner free of React, DOM, Capacitor and storage", () => {
    const src = read("../../src/lib/morningDigest.js");
    expect(src).not.toMatch(/react|@capacitor|localforage|callAI|from "\.\/storage"/i);
    expect([...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1]).sort()).toEqual(["./reminders", "./time", "./todoTimes"]);
  });

  // AC-10
  it("leaves the export at version 7 and adds no permission or exact alarm", () => {
    const payload = read("../../src/components/DataTab.jsx").split("\n").find((l) => l.includes("const payload ="));
    expect(payload).toMatch(/version:\s*7\b/);
    expect(payload).not.toMatch(/\bsettings\b/);

    const manifest = read("../../android/app/src/main/AndroidManifest.xml");
    expect(manifest).not.toMatch(/START_ALARM|WAKE_LOCK|FOREGROUND_SERVICE/);
    expect(manifest.match(/SCHEDULE_EXACT_ALARM[^\n]*tools:node="remove"/)).toBeTruthy();
  });
});
