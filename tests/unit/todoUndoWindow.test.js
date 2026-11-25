import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  UNDO_WINDOW_MS, canUndoReminder, reopenReminder, markDone, activeReminders,
  archivedReminders, normalizeReminderWall
} from "../../src/lib/reminderWall.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const clone = (v) => JSON.parse(JSON.stringify(v));
const DONE_AT = "2026-11-20T12:00:00.000Z";
const DONE_MS = Date.parse(DONE_AT);
const plus = (ms) => new Date(DONE_MS + ms).toISOString();
const HOUR = 60 * 60 * 1000;
const CAT = (id = "home") => ({ id, name: "Home", color: "#123456" });
const ITEM = (extra = {}) => ({ id: "r1", categoryId: "home", text: "buy milk", createdAt: "2026-11-01T09:00:00.000Z", updatedAt: "2026-11-01T09:00:00.000Z", ...extra });
const wallOf = (items = [], categories = [CAT()]) => ({ categories, items });

describe("UNDO_WINDOW_MS", () => {
  // AC-1
  it("exports the fixed 24-hour window in milliseconds", () => {
    expect(UNDO_WINDOW_MS).toBe(86400000);
    expect(UNDO_WINDOW_MS).toBe(24 * 60 * 60 * 1000);
  });
});

describe("canUndoReminder", () => {
  // AC-2
  it("is true an hour after done, false at exactly 24 h and one millisecond later", () => {
    const item = ITEM({ doneAt: DONE_AT });
    expect(canUndoReminder(item, plus(HOUR))).toBe(true);
    expect(canUndoReminder(item, plus(UNDO_WINDOW_MS - 1))).toBe(true);
    expect(canUndoReminder(item, plus(UNDO_WINDOW_MS))).toBe(false);
    expect(canUndoReminder(item, plus(UNDO_WINDOW_MS + 1))).toBe(false);
  });

  // AC-2
  it("is false for an open item with no doneAt", () => {
    expect(canUndoReminder(ITEM(), plus(HOUR))).toBe(false);
    expect(canUndoReminder({ id: "r1", categoryId: "home", text: "open" }, plus(HOUR))).toBe(false);
  });

  // AC-3
  it("returns false without throwing for missing, malformed, non-object and unparseable inputs", () => {
    const now = plus(HOUR);
    const cases = [
      [undefined, now],
      [null, now],
      ["r1", now],
      [42, now],
      [[ITEM({ doneAt: DONE_AT })], now],
      [{}, now],
      [{ doneAt: "not a date" }, now],
      [{ doneAt: "" }, now],
      [{ doneAt: null }, now],
      [ITEM({ doneAt: DONE_AT }), "not a date"],
      [ITEM({ doneAt: DONE_AT }), undefined],
      [ITEM({ doneAt: DONE_AT }), null],
      [ITEM({ doneAt: DONE_AT }), 12345]
    ];
    for (const [item, when] of cases) {
      expect(() => canUndoReminder(item, when)).not.toThrow();
      expect(canUndoReminder(item, when)).toBe(false);
    }
  });

  // AC-3
  it("never mutates the item it inspects", () => {
    const item = ITEM({ doneAt: DONE_AT });
    const before = clone(item);
    canUndoReminder(item, plus(HOUR));
    expect(item).toEqual(before);
  });

  // AC-4
  it("accepts a Date and an ISO string for the same instant and gives the same answer", () => {
    const item = ITEM({ doneAt: DONE_AT });
    const inside = new Date(DONE_MS + HOUR);
    expect(canUndoReminder(item, inside)).toBe(true);
    expect(canUndoReminder(item, inside.toISOString())).toBe(true);

    const boundary = new Date(DONE_MS + UNDO_WINDOW_MS);
    expect(canUndoReminder(item, boundary)).toBe(false);
    expect(canUndoReminder(item, boundary.toISOString())).toBe(false);
  });
});

describe("reopenReminder", () => {
  // AC-5
  it("removes doneAt, stamps updatedAt and leaves every other field and item alone", () => {
    const other = { id: "r2", categoryId: "home", text: "keep me", createdAt: "2026-11-02T09:00:00.000Z" };
    const before = wallOf([ITEM({ doneAt: DONE_AT, updatedAt: DONE_AT }), other]);
    const snapshot = clone(before);
    const now = plus(HOUR);

    const { wall, error } = reopenReminder(before, "r1", now);
    expect(error).toBeUndefined();

    const reopened = wall.items.find((it) => it.id === "r1");
    expect("doneAt" in reopened).toBe(false);
    expect(reopened.updatedAt).toBe(now);
    expect(typeof reopened.updatedAt).toBe("string");
    expect(reopened.id).toBe("r1");
    expect(reopened.categoryId).toBe("home");
    expect(reopened.text).toBe("buy milk");
    expect(reopened.createdAt).toBe("2026-11-01T09:00:00.000Z");
    expect(wall.items.find((it) => it.id === "r2")).toEqual(other);
    expect(wall.categories).toEqual(before.categories);

    // The input wall and its item are untouched, and the result is its own wall.
    expect(before).toEqual(snapshot);
    expect(wall).not.toBe(before);
    expect(reopened).not.toBe(before.items[0]);

    // It is back on the Open side, not the archive.
    expect(activeReminders(wall.items).map((it) => it.id)).toContain("r1");
    expect(archivedReminders(wall.items).map((it) => it.id)).not.toContain("r1");
  });

  // AC-6
  it("returns undo-expired at the boundary and keeps the item archived", () => {
    const item = ITEM({ doneAt: DONE_AT, updatedAt: DONE_AT });
    const before = wallOf([item]);
    const snapshot = clone(before);

    const atBoundary = reopenReminder(before, "r1", plus(UNDO_WINDOW_MS));
    expect(atBoundary.error).toBe("undo-expired");
    expect(atBoundary.wall).toEqual(before);
    expect(before).toEqual(snapshot);
    expect(atBoundary.wall.items[0].doneAt).toBe(DONE_AT);
    expect(archivedReminders(atBoundary.wall.items).map((it) => it.id)).toEqual(["r1"]);

    const past = reopenReminder(before, "r1", plus(UNDO_WINDOW_MS + 1));
    expect(past.error).toBe("undo-expired");
    expect(past.wall).toEqual(before);
  });

  // AC-6 — a doneAt that is present but unparseable is treated as expired.
  it("returns undo-expired for an unparseable doneAt", () => {
    const before = wallOf([ITEM({ doneAt: "not a date" })]);
    const r = reopenReminder(before, "r1", plus(HOUR));
    expect(r.error).toBe("undo-expired");
    expect(r.wall).toEqual(before);
  });

  // AC-7
  it("returns not-archived for an open item and reminder-not-found for an absent id", () => {
    const open = wallOf([ITEM()]);
    const openSnapshot = clone(open);
    const notArchived = reopenReminder(open, "r1", plus(HOUR));
    expect(notArchived.error).toBe("not-archived");
    expect(notArchived.wall).toEqual(open);
    expect(open).toEqual(openSnapshot);

    const done = wallOf([ITEM({ doneAt: DONE_AT })]);
    const doneSnapshot = clone(done);
    const missing = reopenReminder(done, "nope", plus(HOUR));
    expect(missing.error).toBe("reminder-not-found");
    expect(missing.wall).toEqual(done);
    expect(done).toEqual(doneSnapshot);
  });

  // AC-8
  it("restarts the window when a reopened item is marked done again", () => {
    const firstDone = "2026-11-18T10:00:00.000Z";
    const reopenedAt = "2026-11-19T09:00:00.000Z";
    const secondDone = "2026-11-20T10:00:00.000Z";

    const first = markDone(wallOf([ITEM()]), "r1", firstDone);
    expect(first.error).toBeUndefined();

    const reopened = reopenReminder(first.wall, "r1", reopenedAt);
    expect(reopened.error).toBeUndefined();
    expect(activeReminders(reopened.wall.items).map((it) => it.id)).toEqual(["r1"]);
    expect("doneAt" in reopened.wall.items[0]).toBe(false);

    const second = markDone(reopened.wall, "r1", secondDone);
    expect(second.error).toBeUndefined();
    const item = second.wall.items[0];
    expect(item.doneAt).toBe(secondDone);

    // More than a day after the FIRST tick, but inside the fresh window.
    const later = new Date(Date.parse(secondDone) + HOUR).toISOString();
    expect(Date.parse(later) - Date.parse(firstDone)).toBeGreaterThan(UNDO_WINDOW_MS);
    expect(Date.parse(later) - Date.parse(secondDone)).toBeLessThan(UNDO_WINDOW_MS);
    expect(canUndoReminder(item, later)).toBe(true);
    expect(canUndoReminder(item, new Date(Date.parse(secondDone) + UNDO_WINDOW_MS))).toBe(false);
  });

  // AC-9
  it("is not-archived when called a second time on its own output", () => {
    const first = reopenReminder(wallOf([ITEM({ doneAt: DONE_AT })]), "r1", plus(HOUR));
    expect(first.error).toBeUndefined();

    const second = reopenReminder(first.wall, "r1", plus(HOUR));
    expect(second.error).toBe("not-archived");
    expect(second.wall).toEqual(first.wall);
  });
});

describe("Done view and App wiring (source-read)", () => {
  // AC-10
  it("imports the undo helpers, guards on canUndoReminder and persists through setReminderWallP", () => {
    const chart = read("../../src/components/TodoChartTab.jsx");
    expect(chart).toMatch(/import\s*\{[^}]*canUndoReminder[^}]*reopenReminder[^}]*\}\s*from\s*"\.\.\/lib\/reminderWall"/s);
    expect(chart).toMatch(/canUndoReminder\(it, now/);
    expect(chart).toMatch(/reopenReminder\(reminderWall, id, new Date\(\)\.toISOString\(\)\)/);
    expect(chart).toMatch(/setReminderWallP\(r\.wall\)/);
    expect(chart).toContain("Undo closed");
    expect(chart).toMatch(/<Undo2 size=\{13\} \/>/);
    expect(chart).toMatch(/from "lucide-react"/);
    expect(chart).not.toMatch(/useArmed|window\.confirm|deleteReminder/);
  });

  // AC-11
  it("passes the app's ticking now to TodoChartTab", () => {
    const app = read("../../src/App.jsx");
    expect(app).toMatch(/<TodoChartTab[^>]*now=\{now\}/);
  });
});

describe("stored shape stays unchanged (AC-12)", () => {
  it("normalizeReminderWall preserves doneAt and no undo deadline is introduced", () => {
    const input = wallOf([ITEM({ doneAt: DONE_AT })]);
    const out = normalizeReminderWall(input);
    expect(out.items[0].doneAt).toBe(DONE_AT);
    expect("undoUntil" in out.items[0]).toBe(false);

    const lib = read("../../src/lib/reminderWall.js");
    expect(lib).not.toMatch(/undoUntil/);

    const store = read("../../src/lib/useStore.js");
    expect(store).not.toMatch(/undoUntil|undoWindow/);

    // The Done view still offers no permanent delete.
    const chart = read("../../src/components/TodoChartTab.jsx");
    expect(chart).not.toMatch(/deleteReminder/);
  });
});
