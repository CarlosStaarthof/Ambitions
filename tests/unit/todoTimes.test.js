import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { normalizeOptionalClock } from "../../src/lib/time.js";
import {
  normalizeReminderWall, addReminder, editReminder, hasTodoTime, todoTimeLabel
} from "../../src/lib/reminderWall.js";
import { nextStartAt, plannedTodoAlerts, TODO_ALERT_TITLE } from "../../src/lib/todoTimes.js";
import { filterQuietOccurrences } from "../../src/lib/reminders.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const clone = (v) => JSON.parse(JSON.stringify(v));
const AT = "2026-11-18T10:00:00.000Z";
const CAT = { id: "home", name: "Home", color: "#123456" };
const wallOf = (items = [], categories = [CAT]) => ({ categories, items });
const ITEM = (id, extra = {}) => ({
  id, categoryId: "home", text: `to-do ${id}`, createdAt: AT, updatedAt: AT, ...extra
});
const at = (h, m = 0, day = 18, month = 10, year = 2026) => new Date(year, month, day, h, m, 0, 0);
const quiet = { enabled: true, start: "23:00", end: "07:00" };

describe("normalizeOptionalClock", () => {
  // AC-1
  it("keeps a valid clock, zero-pads it, and returns null for anything else", () => {
    expect(normalizeOptionalClock("7:05")).toBe("07:05");
    expect(normalizeOptionalClock("23:59")).toBe("23:59");
    expect(normalizeOptionalClock("00:00")).toBe("00:00");
    for (const bad of ["", null, undefined, "25:00", "12:60", "nope", 42, [], {}]) {
      expect(normalizeOptionalClock(bad)).toBeNull();
    }
  });

  // AC-1
  it("is idempotent and time.js still imports only ./seed", () => {
    const once = normalizeOptionalClock("07:05");
    expect(normalizeOptionalClock(once)).toBe(once);
    const src = read("../../src/lib/time.js");
    expect([...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1])).toEqual(["./seed"]);
  });
});

describe("the wall's optional times", () => {
  // AC-2
  it("keeps valid times, drops invalid ones without dropping the item, and is idempotent", () => {
    const input = wallOf([
      ITEM("a", { startTime: "7:05", endTime: "25:00" }),
      ITEM("b"),
      ITEM("c", { startTime: "not-a-time", endTime: "17:30" })
    ]);
    const before = clone(input);
    const once = normalizeReminderWall(input);
    expect(once.items.find((i) => i.id === "a")).toMatchObject({ startTime: "07:05" });
    expect("endTime" in once.items.find((i) => i.id === "a")).toBe(false);
    expect("startTime" in once.items.find((i) => i.id === "b")).toBe(false);
    expect("endTime" in once.items.find((i) => i.id === "b")).toBe(false);
    expect(once.items.find((i) => i.id === "c")).toMatchObject({ endTime: "17:30" });
    expect("startTime" in once.items.find((i) => i.id === "c")).toBe(false);
    expect(normalizeReminderWall(once)).toEqual(once);
    expect(input).toEqual(before);
  });

  // AC-3
  it("addReminder stores valid times, omits invalid ones, and keeps its errors", () => {
    const empty = wallOf([]);
    const before = clone(empty);
    const timed = addReminder(empty, { id: "a", categoryId: "home", text: " run ", at: AT, startTime: "9:00", endTime: "10:30" });
    expect(timed.error).toBeUndefined();
    expect(timed.wall.items[0]).toEqual({ id: "a", categoryId: "home", text: "run", createdAt: AT, updatedAt: AT, startTime: "09:00", endTime: "10:30" });

    const untimed = addReminder(empty, { id: "b", categoryId: "home", text: "tea", at: AT, startTime: "", endTime: "99:99" });
    expect(untimed.wall.items[0]).toEqual({ id: "b", categoryId: "home", text: "tea", createdAt: AT, updatedAt: AT });

    expect(addReminder(empty, { id: "c", categoryId: "home", text: " ", at: AT }).error).toBe("text-empty");
    expect(addReminder(empty, { id: "d", categoryId: "gone", text: "x", at: AT }).error).toBe("category-missing");
    expect(empty).toEqual(before);
  });

  // AC-4
  it("editReminder sets, changes and clears either time without losing the rest", () => {
    const wall = wallOf([ITEM("a", { startTime: "09:00", endTime: "10:00", doneAt: null })]);
    delete wall.items[0].doneAt;

    const set = editReminder(wall, "a", { categoryId: "home", text: "to-do a", at: "2026-11-18T11:00:00.000Z", startTime: "13:00", endTime: "14:15" });
    expect(set.error).toBeUndefined();
    expect(set.wall.items[0]).toMatchObject({ startTime: "13:00", endTime: "14:15", createdAt: AT, id: "a" });

    const cleared = editReminder(set.wall, "a", { categoryId: "home", text: "to-do a", at: "2026-11-18T12:00:00.000Z", startTime: "", endTime: "" });
    expect("startTime" in cleared.wall.items[0]).toBe(false);
    expect("endTime" in cleared.wall.items[0]).toBe(false);
    expect(cleared.wall.items[0]).toMatchObject({ id: "a", createdAt: AT, updatedAt: "2026-11-18T12:00:00.000Z" });

    const archived = wallOf([ITEM("d", { doneAt: AT, startTime: "09:00" })]);
    expect(editReminder(archived, "d", { categoryId: "home", text: "x", at: AT }).error).toBe("reminder-archived");
    const changedArchived = editReminder(archived, "d", { categoryId: "home", text: "x", at: AT, startTime: "10:00" });
    expect(changedArchived.wall.items[0].startTime).toBe("09:00");
  });

  // AC-5
  it("labels the visible range and reports whether a to-do has any time", () => {
    expect(hasTodoTime(ITEM("a", { startTime: "09:00" }))).toBe(true);
    expect(hasTodoTime(ITEM("b", { endTime: "17:00" }))).toBe(true);
    expect(hasTodoTime(ITEM("c"))).toBe(false);
    expect(hasTodoTime({ startTime: "25:00" })).toBe(false);
    expect(todoTimeLabel(ITEM("a", { startTime: "09:00", endTime: "10:00" }))).toBe("09:00–10:00");
    expect(todoTimeLabel(ITEM("b", { startTime: "09:00" }))).toBe("from 09:00");
    expect(todoTimeLabel(ITEM("c", { endTime: "17:00" }))).toBe("until 17:00");
    expect(todoTimeLabel(ITEM("d"))).toBe("");
  });
});

describe("the next start occurrence", () => {
  // AC-6
  it("uses today while the time is ahead and tomorrow once it has passed", () => {
    expect(nextStartAt("09:00", at(8, 0))).toEqual(at(9, 0));
    expect(nextStartAt("09:00", at(9, 0))).toEqual(at(9, 0, 19));
    expect(nextStartAt("09:00", at(9, 1))).toEqual(at(9, 0, 19));
    expect(nextStartAt("23:30", at(23, 45))).toEqual(at(23, 30, 19));
  });

  // AC-6
  it("returns null for an invalid time or an invalid from", () => {
    for (const bad of ["", null, undefined, "24:00", "07:60", "nope"]) {
      expect(nextStartAt(bad, at(8, 0))).toBeNull();
    }
    expect(nextStartAt("09:00", "not a date")).toBeNull();
  });

  // AC-6 — local wall-clock parts, not an epoch offset, so the hour survives DST.
  it("keeps the local hour on both sides of a spring-forward day", () => {
    const before = nextStartAt("09:00", new Date(2026, 2, 7, 8, 0, 0, 0));
    const after = nextStartAt("09:00", new Date(2026, 2, 9, 8, 0, 0, 0));
    expect(before.getHours()).toBe(9);
    expect(before.getMinutes()).toBe(0);
    expect(after.getHours()).toBe(9);
    expect(after.getMinutes()).toBe(0);
  });
});

describe("plannedTodoAlerts", () => {
  // AC-7
  it("plans one alert per open timed item and ignores done or untimed items", () => {
    const items = [
      ITEM("a", { startTime: "09:00", text: "  call dentist  " }),
      ITEM("b", { startTime: "09:00", text: "email" }),
      ITEM("c"),
      ITEM("d", { startTime: "10:00", doneAt: AT }),
      ITEM("e", { startTime: "25:00" })
    ];
    const plan = plannedTodoAlerts(items, at(8, 0));
    expect(plan.map((p) => p.sourceId)).toEqual(["todo", "todo"]);
    expect(plan.map((p) => p.at)).toEqual([at(9, 0), at(9, 0)]);
    expect(plan.find((p) => p.body === "call dentist")).toBeTruthy();
    expect(plan.every((p) => p.title === TODO_ALERT_TITLE)).toBe(true);
    expect(plannedTodoAlerts([], at(8, 0))).toEqual([]);
  });

  // AC-8
  it("uses a stable id per item, day and start time, different between items and days", () => {
    const items = [ITEM("a", { startTime: "09:00" }), ITEM("b", { startTime: "09:00" })];
    const today = plannedTodoAlerts(items, at(8, 0));
    const again = plannedTodoAlerts(items, at(8, 30));
    const tomorrow = plannedTodoAlerts(items, at(10, 0));
    const entryA = today.find((p) => p.body === "to-do a");
    const entryB = today.find((p) => p.body === "to-do b");
    const tomorrowA = tomorrow.find((p) => p.body === "to-do a");

    expect(today.map((p) => p.id).sort()).toEqual(again.map((p) => p.id).sort());
    expect(entryA.id).not.toBe(entryB.id);
    expect(tomorrowA.id).not.toBe(entryA.id);

    // A same-day time change must yield a new id, or diffSchedule would keep the old
    // pending alarm; a text edit must too, so the delivered body is refreshed.
    const later = plannedTodoAlerts([ITEM("a", { startTime: "10:00" })], at(8, 0)).find((p) => p.body === "to-do a");
    expect(later.id).not.toBe(entryA.id);
    const edited = plannedTodoAlerts([ITEM("a", { startTime: "09:00", text: "new text", updatedAt: "2026-11-18T08:30:00.000Z" })], at(8, 0))[0];
    expect(edited.id).not.toBe(entryA.id);

    for (const p of [...today, ...tomorrow, later, edited]) {
      expect(Number.isInteger(p.id)).toBe(true);
      expect(p.id).toBeGreaterThan(0);
      expect(p.id).toBeLessThanOrEqual(2147483647);
    }
  });

  // AC-9
  it("carries the to-do text and is dropped by quiet hours inside the window", () => {
    const late = plannedTodoAlerts([ITEM("a", { startTime: "23:30", text: " wind down " })], at(22, 0));
    expect(late[0]).toMatchObject({ title: "To-do starts now", body: "wind down" });
    expect(filterQuietOccurrences(late, quiet)).toEqual([]);

    const day = plannedTodoAlerts([ITEM("b", { startTime: "09:00", text: "work" })], at(8, 0));
    expect(filterQuietOccurrences(day, quiet)).toEqual(day);
  });
});

describe("wiring and the export", () => {
  // AC-10
  it("adds the todo alerts to the App plan before the quiet filter", () => {
    const src = read("../../src/App.jsx");
    expect(src).toMatch(/plannedTodoAlerts\(reminderWall && reminderWall\.items, now\)/);
    expect(src).toMatch(/filterQuietOccurrences\(nudge \? \[\.\.\.planned, nudge\.entry\] : planned, settings\.quietHours\)/);
    expect(src).toMatch(/\[loading, storageError, settings, reflections, questions, reminderWall, weeks\]/);
  });

  // AC-10 — the planner is pure and depends only on the two pure modules.
  it("keeps the planner free of React, DOM, Capacitor and storage", () => {
    const src = read("../../src/lib/todoTimes.js");
    expect(src).not.toMatch(/react|@capacitor|localforage|from "\.\/storage"/i);
    expect([...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1]).sort()).toEqual(["./reminders", "./time"]);
  });

  // AC-11
  it("offers both time inputs in the form and edit card, and asks permission at intent", () => {
    const src = read("../../src/components/ReminderWallTab.jsx");
    expect((src.match(/type="time"/g) || []).length).toBe(4);
    expect(src).toMatch(/startTime: newStart, endTime: newEnd/);
    expect(src).toMatch(/startTime: editStart, endTime: editEnd/);
    expect(src).toMatch(/requestNotifyPermission\(\)/);
    expect(src).toMatch(/todoTimeLabel\(it\)/);

    const chart = read("../../src/components/TodoChartTab.jsx");
    expect(chart).toMatch(/todoTimeLabel\(it\)/);
  });

  // AC-12
  it("exports version 7 while older files still import and untimed items stay untimed", () => {
    const payload = read("../../src/components/DataTab.jsx").split("\n").find((l) => l.includes("const payload ="));
    expect(payload).toMatch(/version:\s*7\b/);
    expect(payload).toMatch(/\breminderWall\b/);

    for (const old of [4, 5, 6]) {
      const file = { version: old, tasks: [], weeks: {}, reminderWall: wallOf([ITEM("old")]) };
      const imported = normalizeReminderWall(file.reminderWall);
      expect("startTime" in imported.items[0]).toBe(false);
      expect("endTime" in imported.items[0]).toBe(false);
    }
  });

  // AC-13
  it("adds no store key, permission, exact alarm or AI surface", () => {
    const store = read("../../src/lib/useStore.js");
    const keys = new Set([...store.matchAll(/(?:loadKey|saveKey)\("([^"]+)"/g)].map((m) => m[1]));
    expect([...keys].sort()).toEqual(["categories", "questions", "reflections", "reminderWall", "settings", "tasks", "vision", "weeks"]);

    for (const p of ["../../src/lib/todoTimes.js", "../../src/lib/reminderWall.js", "../../src/components/ReminderWallTab.jsx", "../../src/components/TodoChartTab.jsx"]) {
      expect(read(p)).not.toMatch(/callAI|apiKey|providerKey|SCHEDULE_EXACT_ALARM|USE_EXACT_ALARM/);
    }
    const manifest = read("../../android/app/src/main/AndroidManifest.xml");
    expect(manifest).not.toMatch(/START_ALARM|WAKE_LOCK|FOREGROUND_SERVICE/);
  });
});
