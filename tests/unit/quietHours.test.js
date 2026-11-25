import { describe, it, expect } from "vitest";
import { normalizeClock, normalizeQuietHours, minutesOfClock, inQuietHours } from "../../src/lib/time.js";
import { filterQuietOccurrences } from "../../src/lib/reminders.js";
import { mergeSettings } from "../../src/lib/seed.js";
import { DEFAULT_SETTINGS } from "../../src/lib/useStore.js";

const DEFAULTS = { enabled: true, start: "23:00", end: "07:00" };
const at = (h, m = 0) => new Date(2026, 0, 5, h, m);
const wrap = { enabled: true, start: "23:00", end: "07:00" };

describe("the quiet-hours default", () => {
  // AC-1
  it("ships enabled, 23:00 to 07:00", () => {
    expect(DEFAULT_SETTINGS.quietHours).toEqual(DEFAULTS);
  });
});

describe("normalizeClock", () => {
  it("zero-pads and clamps a clock-shaped value", () => {
    expect(normalizeClock("7:05", "23:00")).toBe("07:05");
    expect(normalizeClock("25:70", "23:00")).toBe("23:59");
  });

  it("returns the fallback when the value is not clock-shaped", () => {
    expect(normalizeClock("nope", "23:00")).toBe("23:00");
    expect(normalizeClock(undefined, "07:00")).toBe("07:00");
  });
});

describe("minutesOfClock", () => {
  // AC-4
  it("converts midnight and the last minute of the day", () => {
    expect(minutesOfClock("23:00")).toBe(1380);
    expect(minutesOfClock("00:00")).toBe(0);
  });

  it("returns null for malformed or out-of-range clocks", () => {
    expect(minutesOfClock("nope")).toBeNull();
    expect(minutesOfClock("25:70")).toBeNull();
  });
});

describe("normalizeQuietHours", () => {
  // AC-2
  it("falls back to the defaults for missing or nonsense input", () => {
    expect(normalizeQuietHours(undefined)).toEqual(DEFAULTS);
    expect(normalizeQuietHours(null)).toEqual(DEFAULTS);
    expect(normalizeQuietHours("nonsense")).toEqual(DEFAULTS);
  });

  it("preserves a valid stored window", () => {
    const stored = { enabled: false, start: "22:15", end: "06:30" };
    expect(normalizeQuietHours(stored)).toEqual(stored);
  });

  // AC-3
  it("treats a missing enabled as on and only false as off", () => {
    expect(normalizeQuietHours({ start: "22:00", end: "06:00" }).enabled).toBe(true);
    expect(normalizeQuietHours({ enabled: false }).enabled).toBe(false);
  });

  it("zero-pads, clamps and repairs each clock independently", () => {
    expect(normalizeQuietHours({ start: "7:05", end: "6:30" })).toEqual({ enabled: true, start: "07:05", end: "06:30" });
    expect(normalizeQuietHours({ start: "25:70" }).start).toBe("23:59");
    expect(normalizeQuietHours({ enabled: false, start: "abc", end: "06:30" })).toEqual({ enabled: false, start: "23:00", end: "06:30" });
  });

  // AC-3, idempotency
  it("returns the same value when run twice", () => {
    const once = normalizeQuietHours({ enabled: false, start: "7:05", end: "25:70" });
    expect(normalizeQuietHours(once)).toEqual(once);
  });
});

describe("inQuietHours", () => {
  // AC-5, a window inside one day
  it("includes the start minute and excludes the end minute", () => {
    const day = { enabled: true, start: "08:00", end: "17:00" };
    expect(inQuietHours(at(8, 0), day)).toBe(true);
    expect(inQuietHours(at(16, 59), day)).toBe(true);
    expect(inQuietHours(at(7, 59), day)).toBe(false);
    expect(inQuietHours(at(17, 0), day)).toBe(false);
  });

  // AC-5, the default window crossing midnight
  it("handles a window that crosses midnight", () => {
    expect(inQuietHours(at(23, 0), wrap)).toBe(true);
    expect(inQuietHours(at(0, 0), wrap)).toBe(true);
    expect(inQuietHours(at(6, 59), wrap)).toBe(true);
    expect(inQuietHours(at(7, 0), wrap)).toBe(false);
    expect(inQuietHours(at(22, 59), wrap)).toBe(false);
  });

  // AC-6
  it("is false when disabled, empty or given an invalid date", () => {
    expect(inQuietHours(at(23, 30), { enabled: false, start: "23:00", end: "07:00" })).toBe(false);
    expect(inQuietHours(at(12, 0), { enabled: true, start: "09:00", end: "09:00" })).toBe(false);
    expect(inQuietHours("not-a-date", wrap)).toBe(false);
    expect(inQuietHours(undefined, wrap)).toBe(false);
  });
});

describe("filterQuietOccurrences", () => {
  const plan = [
    { id: 1, at: at(22, 59) },
    { id: 2, at: at(23, 0) },
    { id: 3, at: at(0, 0) },
    { id: 4, at: at(7, 0) },
    { id: 5, at: at(12, 0) }
  ];

  // AC-7
  it("drops exactly the in-window entries and keeps the rest in order", () => {
    const out = filterQuietOccurrences(plan, wrap);
    expect(out.map((p) => p.id)).toEqual([1, 4, 5]);
  });

  it("returns a new array and leaves the input untouched", () => {
    const copy = plan.map((p) => ({ ...p }));
    const out = filterQuietOccurrences(plan, wrap);
    expect(out).not.toBe(plan);
    expect(plan).toEqual(copy);
  });

  it("keeps every entry when quiet hours are off", () => {
    const out = filterQuietOccurrences(plan, { enabled: false, start: "23:00", end: "07:00" });
    expect(out.map((p) => p.id)).toEqual([1, 2, 3, 4, 5]);
    expect(out).not.toBe(plan);
  });

  it("handles an absent plan", () => {
    expect(filterQuietOccurrences(undefined, wrap)).toEqual([]);
    expect(filterQuietOccurrences(null, wrap)).toEqual([]);
  });
});

describe("loading settings written before quiet hours", () => {
  // AC-8
  it("fills the defaults and preserves an existing valid window", () => {
    const old = { ai: { enabled: false }, reminders: { reflection: { enabled: true } } };
    const merged = mergeSettings(DEFAULT_SETTINGS, old);
    expect(merged.quietHours).toEqual(DEFAULTS);
    expect(merged.reminders.reflection.enabled).toBe(true);

    const stored = { enabled: false, start: "22:15", end: "06:30" };
    expect(mergeSettings(DEFAULT_SETTINGS, { quietHours: stored }).quietHours).toEqual(stored);
  });

  it("is idempotent", () => {
    const once = mergeSettings(DEFAULT_SETTINGS, { quietHours: { enabled: false, start: "22:15", end: "06:30" } });
    expect(mergeSettings(DEFAULT_SETTINGS, once)).toEqual(once);
  });

  // AC-8, the in-memory repair useStore performs after merging
  it("repairs an invalid stored clock through normalizeQuietHours", () => {
    const merged = mergeSettings(DEFAULT_SETTINGS, { quietHours: { start: "nope", end: "25:70" } });
    expect(normalizeQuietHours(merged.quietHours)).toEqual({ enabled: true, start: "23:00", end: "23:59" });
  });
});
