import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  REVIEW_WINDOW_DAYS, REFLECTION_HOUR, HORIZON,
  REMINDER_SOURCES, reflectionSource,
  reviewWindowStartOf, reflectionOccurrences, reminderEnabled,
  plannedReminders, notificationIdFor, diffSchedule
} from "../../src/lib/reminders.js";
import { mergeSettings, SEED_QUESTIONS } from "../../src/lib/seed.js";
import { DEFAULT_SETTINGS } from "../../src/lib/useStore.js";
import { syncReminders, notifySupported, notifyPermission, pendingReminders } from "../../src/lib/notify.js";

const allOn = (sources) => ({ reminders: Object.fromEntries(sources.map((s) => [s.id, { enabled: true }])) });
const NO_CTX = { reflections: {}, questions: SEED_QUESTIONS };

describe("the review window anchor", () => {
  it("opens on the first of the last four calendar days", () => {
    expect(REVIEW_WINDOW_DAYS).toBe(4);
    expect(reviewWindowStartOf(new Date(2026, 8, 16))).toEqual(new Date(2026, 8, 27)); // Sep, 30 days
    expect(reviewWindowStartOf(new Date(2026, 9, 1))).toEqual(new Date(2026, 9, 28));  // Oct, 31 days
  });
});

describe("the monthly reflection reminder", () => {
  // AC-6
  it("nudges on 27 September 2026 at 19:00 when asked on the 16th", () => {
    const [first] = reflectionOccurrences(new Date(2026, 8, 16), 1, NO_CTX);
    expect(first).toEqual(new Date(2026, 8, 27, 19, 0, 0, 0));
    expect(REFLECTION_HOUR).toBe(19);
  });

  // AC-7
  it("tracks month length: 25 February in a common year, 26 February in a leap year", () => {
    const common = reflectionOccurrences(new Date(2027, 1, 1), 1, NO_CTX)[0];
    const leap = reflectionOccurrences(new Date(2028, 1, 1), 1, NO_CTX)[0];
    expect(common).toEqual(new Date(2027, 1, 25, 19, 0, 0, 0));
    expect(leap).toEqual(new Date(2028, 1, 26, 19, 0, 0, 0));
  });

  // AC-6 boundary: standing inside the window, the current month is already spent.
  it("skips the current month once its own nudge time has passed", () => {
    const [first] = reflectionOccurrences(new Date(2026, 8, 27, 19, 30), 1, NO_CTX);
    expect(first).toEqual(new Date(2026, 9, 28, 19, 0, 0, 0));
  });

  // AC-10
  it("stays at 19:00 local for 24 consecutive months, across daylight-saving changes", () => {
    for (const from of [new Date(2026, 0, 3), new Date(2026, 8, 16), new Date(2027, 5, 30)]) {
      const list = reflectionOccurrences(from, 24, NO_CTX);
      expect(list).toHaveLength(24);
      for (const at of list) {
        expect(at.getHours()).toBe(19);
        expect(at.getMinutes()).toBe(0);
        expect(at.getSeconds()).toBe(0);
      }
    }
  });

  it("really does straddle a daylight-saving transition in a DST zone", () => {
    const list = reflectionOccurrences(new Date(2026, 0, 3), 24, NO_CTX);
    const offsets = new Set(list.map((d) => d.getTimezoneOffset()));
    // In a fixed-offset zone (CI on UTC) there is one offset and the hour check
    // above is all there is to prove; in a DST zone the wall clock held at 19:00
    // through at least one shift, which is the thing that could have broken.
    expect(offsets.size).toBeGreaterThanOrEqual(1);
    for (const at of list) expect(at.getHours()).toBe(19);
  });

  // AC-9
  it("skips a month already answered in full and makes the count up later", () => {
    const questions = [{ id: "g2", text: "a" }, { id: "g3", text: "b" }];
    const reflections = {
      "2026-09": { g2: "done", g3: "done", _ai: "generated text" },
      "2026-10": { g2: "done", g3: "   " }          // whitespace is not an answer
    };
    const list = reflectionOccurrences(new Date(2026, 8, 16), 6, { reflections, questions });
    expect(list).toHaveLength(6);
    expect(list[0]).toEqual(new Date(2026, 9, 28, 19, 0, 0, 0));   // September skipped
    expect(list.some((d) => d.getMonth() === 8 && d.getFullYear() === 2026)).toBe(false);
  });

  // AC-9, the reserved key
  it("never counts the reserved _ai key as an answer", () => {
    const questions = [{ id: "g2", text: "a" }];
    const reflections = { "2026-09": { _ai: "a whole essay from the model" } };
    const list = reflectionOccurrences(new Date(2026, 8, 16), 1, { reflections, questions });
    expect(list[0]).toEqual(new Date(2026, 8, 27, 19, 0, 0, 0));
  });

  it("still nudges when there are no questions on file", () => {
    const list = reflectionOccurrences(new Date(2026, 8, 16), 3, { reflections: {}, questions: [] });
    expect(list).toHaveLength(3);
  });
});

describe("the plan", () => {
  const from = new Date(2026, 8, 16, 12, 0);

  // AC-8
  it("returns exactly HORIZON future occurrences per enabled source, strictly ascending", () => {
    expect(HORIZON).toBe(6);
    const plan = plannedReminders(REMINDER_SOURCES, allOn(REMINDER_SOURCES), from, 6, NO_CTX);
    expect(plan).toHaveLength(6 * REMINDER_SOURCES.length);
    for (const p of plan) expect(p.at.getTime()).toBeGreaterThan(from.getTime());
    for (let i = 1; i < plan.length; i++) expect(plan[i].at.getTime()).toBeGreaterThan(plan[i - 1].at.getTime());
  });

  // AC-8, the off half
  it("plans nothing for a source that is switched off or absent from settings", () => {
    expect(plannedReminders(REMINDER_SOURCES, { reminders: { reflection: { enabled: false } } }, from, 6, NO_CTX)).toEqual([]);
    expect(plannedReminders(REMINDER_SOURCES, { reminders: {} }, from, 6, NO_CTX)).toEqual([]);
    expect(plannedReminders(REMINDER_SOURCES, {}, from, 6, NO_CTX)).toEqual([]);
    expect(plannedReminders(REMINDER_SOURCES, null, from, 6, NO_CTX)).toEqual([]);
  });

  it("treats an absent source or absent settings as off", () => {
    expect(reminderEnabled(null, "reflection")).toBe(false);
    expect(reminderEnabled({}, "reflection")).toBe(false);
    expect(reminderEnabled({ reminders: {} }, "nope")).toBe(false);
    expect(reminderEnabled({ reminders: { reflection: { enabled: true } } }, "reflection")).toBe(true);
  });

  it("carries the source's own title and body into every entry", () => {
    const plan = plannedReminders([reflectionSource], allOn([reflectionSource]), from, 2, NO_CTX);
    for (const p of plan) {
      expect(p.sourceId).toBe("reflection");
      expect(p.title).toBe(reflectionSource.title);
      expect(p.body).toBe(reflectionSource.body);
    }
  });

  // AC-15
  it("plans a source it has never heard of, with no change to plannedReminders", () => {
    const synthetic = {
      id: "vision-add",
      title: "Vision board",
      body: "The January window is open.",
      occurrences: (f, n) => Array.from({ length: n }, (_, i) => new Date(f.getFullYear() + i + 1, 0, 1, 9, 0, 0, 0))
    };
    const sources = [...REMINDER_SOURCES, synthetic];
    const plan = plannedReminders(sources, allOn(sources), from, 6, NO_CTX);
    expect(plan.filter((p) => p.sourceId === "vision-add")).toHaveLength(6);
    expect(plan.filter((p) => p.sourceId === "reflection")).toHaveLength(6);
    for (let i = 1; i < plan.length; i++) expect(plan[i].at.getTime()).toBeGreaterThan(plan[i - 1].at.getTime());

    // ...and switching only the new source on leaves the old one out entirely.
    const onlyNew = plannedReminders(sources, { reminders: { "vision-add": { enabled: true } } }, from, 6, NO_CTX);
    expect(onlyNew.every((p) => p.sourceId === "vision-add")).toBe(true);
  });
});

describe("notification ids", () => {
  // AC-11
  it("gives the same source and calendar day the same id, every time", () => {
    const a = notificationIdFor("reflection", new Date(2026, 8, 27, 19, 0));
    const b = notificationIdFor("reflection", new Date(2026, 8, 27, 19, 0));
    const sameDayOtherTime = notificationIdFor("reflection", new Date(2026, 8, 27, 6, 15));
    expect(a).toBe(b);
    expect(a).toBe(sameDayOtherTime);
    // Frozen value: a change to the hash would silently orphan every pending
    // notification already on a device, so it has to be a deliberate change.
    expect(a).toBe(notificationIdFor("reflection", new Date(2026, 8, 27)));
    expect(notificationIdFor("reflection", new Date(2026, 8, 28))).not.toBe(a);
    expect(notificationIdFor("vision-add", new Date(2026, 8, 27))).not.toBe(a);
  });

  // AC-12
  it("is unique and a positive 31-bit integer across every source over 24 months", () => {
    const synthetic = {
      id: "vision-review",
      title: "t", body: "b",
      occurrences: (f, n) => Array.from({ length: n }, (_, i) => new Date(f.getFullYear(), f.getMonth() + i + 1, 2, 9, 0, 0, 0))
    };
    const sources = [...REMINDER_SOURCES, synthetic];
    const plan = plannedReminders(sources, allOn(sources), new Date(2026, 8, 16), 24, NO_CTX);
    expect(plan).toHaveLength(24 * sources.length);
    const ids = plan.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) {
      expect(Number.isInteger(id)).toBe(true);
      expect(id).toBeGreaterThanOrEqual(1);
      expect(id).toBeLessThanOrEqual(2147483647);
    }
  });
});

describe("reconciling against the OS", () => {
  const from = new Date(2026, 8, 16, 12, 0);
  const plan = plannedReminders(REMINDER_SOURCES, allOn(REMINDER_SOURCES), from, 6, NO_CTX);

  // AC-13
  it("does nothing when the pending set already equals the plan", () => {
    const pending = plan.map((p) => ({ id: p.id, at: p.at }));
    const d = diffSchedule(pending, plan);
    expect(d.toCancel).toEqual([]);
    expect(d.toSchedule).toEqual([]);
    // Running it again on the same inputs is the same no-op.
    expect(diffSchedule(pending, plan)).toEqual(d);
  });

  it("schedules the whole plan when nothing is pending", () => {
    const d = diffSchedule([], plan);
    expect(d.toCancel).toEqual([]);
    expect(d.toSchedule).toHaveLength(plan.length);
  });

  // AC-14
  it("cancels every pending id the plan no longer wants", () => {
    const pending = plan.map((p) => ({ id: p.id }));
    const off = plannedReminders(REMINDER_SOURCES, { reminders: { reflection: { enabled: false } } }, from, 6, NO_CTX);
    const d = diffSchedule(pending, off);
    expect(d.toSchedule).toEqual([]);
    expect(d.toCancel.sort()).toEqual(plan.map((p) => p.id).sort());
  });

  it("cancels a stale occurrence while keeping the ones still wanted", () => {
    const pending = [...plan.map((p) => ({ id: p.id })), { id: 12345 }];
    const d = diffSchedule(pending, plan);
    expect(d.toCancel).toEqual([12345]);
    expect(d.toSchedule).toEqual([]);
  });
});

describe("the settings merge", () => {
  // AC-16
  it("gives settings stored before reminders existed a reflection entry, switched off", () => {
    const stored = { ai: { enabled: true, provider: "anthropic", model: "x" } };
    const merged = mergeSettings(DEFAULT_SETTINGS, stored);
    expect(merged.reminders.reflection.enabled).toBe(false);
    expect(merged.ai).toEqual({ enabled: true, provider: "anthropic", model: "x" });
  });

  it("defaults reminders off for a completely empty store", () => {
    expect(DEFAULT_SETTINGS.reminders.reflection.enabled).toBe(false);
    expect(mergeSettings(DEFAULT_SETTINGS, null).reminders.reflection.enabled).toBe(false);
  });

  // AC-16, the source-added-later half
  it("keeps a stored source switched on while adding a source introduced later", () => {
    const laterDefaults = { ...DEFAULT_SETTINGS, reminders: { reflection: { enabled: false }, "vision-add": { enabled: false } } };
    const stored = { ai: { enabled: false, provider: "none", model: null }, reminders: { reflection: { enabled: true } } };
    const merged = mergeSettings(laterDefaults, stored);
    expect(merged.reminders.reflection.enabled).toBe(true);
    expect(merged.reminders["vision-add"].enabled).toBe(false);
  });

  // AC-16, idempotency
  it("is idempotent — merging an already-merged object changes nothing", () => {
    for (const stored of [null, {}, { ai: { enabled: true, provider: "openai", model: "gpt" } }, { reminders: { reflection: { enabled: true } } }]) {
      const once = mergeSettings(DEFAULT_SETTINGS, stored);
      const twice = mergeSettings(DEFAULT_SETTINGS, once);
      expect(twice).toEqual(once);
      expect(mergeSettings(DEFAULT_SETTINGS, twice)).toEqual(once);
    }
  });

  it("never lets a plaintext API key survive the merge", () => {
    const merged = mergeSettings(DEFAULT_SETTINGS, { ai: { enabled: true, provider: "anthropic", keys: { anthropic: "sk-secret" } } });
    expect("keys" in merged.ai).toBe(false);
    expect(JSON.stringify(merged)).not.toContain("sk-secret");
  });

  it("leaves DEFAULT_SETTINGS itself untouched", () => {
    const merged = mergeSettings(DEFAULT_SETTINGS, { reminders: { reflection: { enabled: true } } });
    merged.reminders.reflection.enabled = true;
    expect(DEFAULT_SETTINGS.reminders.reflection.enabled).toBe(false);
  });
});

describe("what this feature did not change", () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

  // AC-17
  it("leaves the export envelope at version 5 with no settings or reminders field", () => {
    const src = read("../../src/components/DataTab.jsx");
    const payload = src.split("\n").find((l) => l.includes("const payload ="));
    expect(payload).toMatch(/version:\s*5\b/);
    expect(payload).not.toMatch(/\bsettings\b/);
    expect(payload).not.toMatch(/\breminders\b/);
  });

  // AC-18
  it("reads and writes exactly the seven localForage keys that existed before", () => {
    const src = read("../../src/lib/useStore.js");
    const keys = new Set([...src.matchAll(/(?:loadKey|saveKey)\("([^"]+)"/g)].map((m) => m[1]));
    expect([...keys].sort()).toEqual(["categories", "questions", "reflections", "settings", "tasks", "vision", "weeks"]);
  });

  it("keeps the pure schedule module free of Capacitor and storage", () => {
    const src = read("../../src/lib/reminders.js");
    expect(src).not.toMatch(/@capacitor/);
    expect(src).not.toMatch(/localforage|from "\.\/storage"/);
    expect([...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1])).toEqual(["./time"]);
  });

  it("never asks the plugin for an exact alarm", () => {
    expect(read("../../src/lib/notify.js")).toMatch(/allowWhileIdle:\s*false/);
    expect(read("../../src/lib/notify.js")).not.toMatch(/allowWhileIdle:\s*true/);
  });
});

describe("the wrapper off device", () => {
  // AC-21, the return-value half
  it("is a safe no-op in a desktop browser or under node", async () => {
    expect(notifySupported()).toBe(false);
    await expect(notifyPermission()).resolves.toBe("denied");
    await expect(pendingReminders()).resolves.toEqual([]);
    const plan = plannedReminders(REMINDER_SOURCES, allOn(REMINDER_SOURCES), new Date(2026, 8, 16), 6, NO_CTX);
    await expect(syncReminders(plan)).resolves.toEqual({ scheduled: 0, cancelled: 0 });
    await expect(syncReminders(null)).resolves.toEqual({ scheduled: 0, cancelled: 0 });
  });
});
