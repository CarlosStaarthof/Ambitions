import { describe, it, expect } from "vitest";
import {
  normalizeModel, backfillOpenWeeks, loadDecision, AMBITION_ID, OPEN_ID,
  SEED_TASKS, SEED_CATEGORIES, DAYS, SLOTS, CELLS
} from "../../src/lib/seed.js";
import { activeTasks, activeCategories, retiredTasks } from "../../src/lib/tasks.js";

describe("seed shape", () => {
  it("keeps the finite-week arithmetic the product rests on", () => {
    expect(DAYS).toHaveLength(7);
    expect(SLOTS).toBe(48);
    expect(CELLS).toBe(336);
  });

  it("ships Ambition first and protected", () => {
    expect(SEED_CATEGORIES[0].id).toBe(AMBITION_ID);
    expect(SEED_CATEGORIES[0].protected).toBe(true);
  });

  it("gives every seed task a category that exists", () => {
    const ids = new Set(SEED_CATEGORIES.map((c) => c.id));
    for (const t of SEED_TASKS) expect(ids.has(t.categoryId)).toBe(true);
  });
});

describe("normalizeModel", () => {
  it("migrates V1 task.category into categoryId", () => {
    const { tasks } = normalizeModel(
      [{ id: "t1", name: "Reading", category: "ambition" }],
      []
    );
    expect(tasks[0].categoryId).toBe(AMBITION_ID);
    expect(tasks[0].category).toBeUndefined();
  });

  it("routes legacy non-ambition tasks into a Basic catch-all", () => {
    const { tasks, categories } = normalizeModel(
      [{ id: "t1", name: "Sleep", category: "basic" }],
      []
    );
    expect(tasks[0].categoryId).toBe("basic");
    expect(categories.some((c) => c.id === "basic")).toBe(true);
  });

  it("always produces an Ambition category, first in the list", () => {
    const { categories } = normalizeModel([], [{ id: "work", name: "Work", protected: false }]);
    expect(categories[0].id).toBe(AMBITION_ID);
    expect(categories[0].protected).toBe(true);
  });

  it("keeps Open last so it never displaces a real category", () => {
    const { categories } = normalizeModel([], [
      { id: AMBITION_ID, name: "Ambition", protected: true },
      { id: OPEN_ID, name: "Open", protected: false },
      { id: "work", name: "Work", protected: false }
    ]);
    expect(categories[categories.length - 1].id).toBe(OPEN_ID);
  });

  it("re-homes a task whose category no longer exists", () => {
    const { tasks, categories } = normalizeModel(
      [{ id: "t1", name: "Orphan", categoryId: "deleted-cat" }],
      [{ id: AMBITION_ID, name: "Ambition", protected: true }]
    );
    expect(tasks[0].categoryId).toBe("basic");
    expect(categories.some((c) => c.id === "basic")).toBe(true);
  });

  it("is idempotent — running it twice changes nothing", () => {
    const once = normalizeModel(SEED_TASKS, SEED_CATEGORIES);
    const twice = normalizeModel(once.tasks, once.categories);
    expect(twice.tasks).toEqual(once.tasks);
    expect(twice.categories).toEqual(once.categories);
  });

  it("survives being handed nothing at all", () => {
    const { tasks, categories } = normalizeModel(undefined, undefined);
    expect(tasks).toEqual([]);
    expect(categories[0].id).toBe(AMBITION_ID);
  });
});

describe("backfillOpenWeeks", () => {
  const FALLBACK = "2026-08-24";
  const weeks = {
    "2026-08-17": { cells: { "0-10": "o1" } },
    "2026-08-24": { cells: { "1-5": "o1", "2-6": "t1" } }
  };

  it("infers an unscoped open task's week from where it was first painted", () => {
    const tasks = [{ id: "o1", name: "Dentist", categoryId: OPEN_ID }];
    const { tasks: out, changed } = backfillOpenWeeks(tasks, weeks, FALLBACK);
    expect(out[0].weekKey).toBe("2026-08-17");
    expect(changed).toBe(true);
  });

  it("falls back to the given week for an open task never placed on the grid", () => {
    const tasks = [{ id: "ghost", name: "Never placed", categoryId: OPEN_ID }];
    const { tasks: out } = backfillOpenWeeks(tasks, weeks, FALLBACK);
    expect(out[0].weekKey).toBe(FALLBACK);
  });

  it("leaves an already-scoped open task alone", () => {
    const tasks = [{ id: "o3", name: "Scoped", categoryId: OPEN_ID, weekKey: "2026-09-07" }];
    const { tasks: out, changed } = backfillOpenWeeks(tasks, weeks, FALLBACK);
    expect(out[0].weekKey).toBe("2026-09-07");
    expect(changed).toBe(false);
  });

  it("never stamps a weekKey onto an ordinary task", () => {
    const tasks = [
      { id: "t1", name: "Sleep", categoryId: "sleep" },
      { id: "o1", name: "One-off", categoryId: OPEN_ID }
    ];
    const { tasks: out } = backfillOpenWeeks(tasks, weeks, FALLBACK);
    expect(out.find((t) => t.id === "t1").weekKey).toBeUndefined();
    expect(out.find((t) => t.id === "o1").weekKey).toBeDefined();
  });

  it("is idempotent — a second pass reports no change", () => {
    const tasks = [{ id: "o1", name: "Dentist", categoryId: OPEN_ID }];
    const first = backfillOpenWeeks(tasks, weeks, FALLBACK);
    const second = backfillOpenWeeks(first.tasks, weeks, FALLBACK);
    expect(second.changed).toBe(false);
    expect(second.tasks).toEqual(first.tasks);
  });
});

describe("normalizeModel and retirement", () => {
  const CATS = [
    { id: AMBITION_ID, name: "Ambition", protected: true },
    { id: "work", name: "Work", protected: false },
    { id: OPEN_ID, name: "Open", protected: false }
  ];

  // AC-40
  it("carries retired and retiredAt through untouched", () => {
    const tasks = [
      { id: "t1", name: "Kept", categoryId: "work", color: "#fff", target: null },
      { id: "t2", name: "Gone", categoryId: "work", color: "#000", target: 2, retired: true, retiredAt: "2026-09-29T09:00:00.000Z" }
    ];
    const cats = [...CATS, { id: "old", name: "Old life", protected: false, retired: true }];
    const { tasks: out, categories } = normalizeModel(tasks, cats);
    expect(out[1]).toEqual(tasks[1]);
    expect(out[1].retiredAt).toBe("2026-09-29T09:00:00.000Z");
    expect(categories.find((c) => c.id === "old").retired).toBe(true);
    expect(retiredTasks(out).map((t) => t.id)).toEqual(["t2"]);
    expect(activeTasks(out).map((t) => t.id)).toEqual(["t1"]);
  });

  // AC-40 — the mandatory idempotency test
  it("is idempotent over data containing retired entries", () => {
    const tasks = [
      { id: "t1", name: "Kept", categoryId: "work", color: "#fff", target: null },
      { id: "t2", name: "Gone", categoryId: "old", color: "#000", target: 2, retired: true, retiredAt: "2026-09-29T09:00:00.000Z" }
    ];
    const cats = [...CATS, { id: "old", name: "Old life", protected: false, retired: true }];
    const once = normalizeModel(tasks, cats);
    const twice = normalizeModel(once.tasks, once.categories);
    expect(twice.tasks).toEqual(once.tasks);
    expect(twice.categories).toEqual(once.categories);
  });

  // AC-41
  it("does not re-home a task whose category exists but is retired", () => {
    const tasks = [{ id: "t2", name: "Gone", categoryId: "old", color: "#000", target: null, retired: true, retiredAt: "2026-09-29T09:00:00.000Z" }];
    const cats = [...CATS, { id: "old", name: "Old life", protected: false, retired: true }];
    const { tasks: out, categories } = normalizeModel(tasks, cats);
    expect(out[0].categoryId).toBe("old");
    expect(categories.some((c) => c.id === "basic")).toBe(false);
  });

  // AC-42
  it("returns the structural categories active, Ambition first and Open last", () => {
    const cats = [
      { id: AMBITION_ID, name: "Ambition", protected: true, retired: true },
      { id: "work", name: "Work", protected: false },
      { id: OPEN_ID, name: "Open", protected: false, retired: true }
    ];
    const { categories } = normalizeModel([], cats);
    expect(categories[0].id).toBe(AMBITION_ID);
    expect(categories[categories.length - 1].id).toBe(OPEN_ID);
    expect("retired" in categories[0]).toBe(false);
    expect("retired" in categories[categories.length - 1]).toBe(false);
    expect(activeCategories(categories).map((c) => c.id)).toEqual(categories.map((c) => c.id));
  });

  // AC-39
  it("adds no retirement field to data written before this feature", () => {
    const { tasks, categories } = normalizeModel(SEED_TASKS, SEED_CATEGORIES);
    expect(JSON.stringify({ tasks, categories })).not.toContain("retired");
    expect(activeTasks(tasks)).toHaveLength(SEED_TASKS.length);
    expect(activeCategories(categories)).toHaveLength(SEED_CATEGORIES.length);
    expect(retiredTasks(tasks)).toEqual([]);
  });

  // AC-43 — the import half: old files still load fully active, a new file keeps its flags
  it("imports a v4 file, a pre-feature v5 file and a post-feature v5 file correctly", () => {
    const v4 = { version: 4, tasks: [{ id: "t1", name: "Sleep", categoryId: "sleep", color: "#fff", target: 56 }], categories: [{ id: AMBITION_ID, name: "Ambition", protected: true }, { id: "sleep", name: "Sleep", protected: false }] };
    const oldV5 = { version: 5, tasks: SEED_TASKS, categories: SEED_CATEGORIES, vision: {} };
    for (const file of [v4, oldV5]) {
      const m = normalizeModel(file.tasks, file.categories);
      expect(activeTasks(m.tasks)).toHaveLength(file.tasks.length);
      expect(retiredTasks(m.tasks)).toEqual([]);
      expect(activeCategories(m.categories)).toHaveLength(m.categories.length);
    }
    const newV5 = { version: 5, tasks: [{ id: "t9", name: "Removed", categoryId: "work", color: "#000", target: null, retired: true, retiredAt: "2026-09-29T09:00:00.000Z" }], categories: CATS };
    const round = normalizeModel(JSON.parse(JSON.stringify(newV5)).tasks, JSON.parse(JSON.stringify(newV5)).categories);
    expect(retiredTasks(round.tasks).map((t) => t.id)).toEqual(["t9"]);
    expect(activeTasks(round.tasks)).toEqual([]);
  });
});

describe("loadDecision", () => {
  const ok = (value) => ({ ok: true, value });
  const reads = (over = {}) => ({
    tasks: ok(null), categories: ok(null), questions: ok(null), weeks: ok(null),
    reflections: ok(null), vision: ok(null), settings: ok(null), ...over
  });

  // AC-30
  it("seeds only when every read succeeded and every value is empty", () => {
    expect(loadDecision(reads())).toEqual({ seed: true, storageError: false });
    expect(loadDecision(reads({ tasks: ok(undefined), categories: ok([]), weeks: ok({}), settings: ok("") }))).toEqual({ seed: true, storageError: false });
  });

  // AC-31
  it("does not seed when any one key still has content", () => {
    // the exact shape of the reported incident: tasks empty, weeks full
    expect(loadDecision(reads({ tasks: ok([]), weeks: ok({ "2026-09-21": { cells: { "0-0": "abc" } } }) }))).toEqual({ seed: false, storageError: false });
    expect(loadDecision(reads({ tasks: ok(null), weeks: ok({ "2026-09-21": { cells: {} } }) })).seed).toBe(false);
    expect(loadDecision(reads({ categories: ok([{ id: AMBITION_ID, name: "Ambition", protected: true }]) })).seed).toBe(false);
    expect(loadDecision(reads({ questions: ok([{ id: "g2", text: "?" }]) })).seed).toBe(false);
    expect(loadDecision(reads({ reflections: ok({ "2026-09": { g2: "yes" } }) })).seed).toBe(false);
    expect(loadDecision(reads({ vision: ok({ 2026: [] }) })).seed).toBe(false);
    expect(loadDecision(reads({ settings: ok({ ai: { enabled: false } }) })).seed).toBe(false);
  });

  // AC-32
  it("reports a storage error, and never seeds, when any read failed", () => {
    expect(loadDecision(reads({ weeks: { ok: false, value: null } }))).toEqual({ seed: false, storageError: true });
    expect(loadDecision(reads({ tasks: { ok: false, value: null }, weeks: ok({ "2026-09-21": { cells: {} } }) }))).toEqual({ seed: false, storageError: true });
    for (const key of ["tasks", "categories", "questions", "weeks", "reflections", "vision", "settings"]) {
      const d = loadDecision(reads({ [key]: { ok: false, value: null } }));
      expect(d).toEqual({ seed: false, storageError: true });
    }
  });

  it("never reports both a fresh install and a storage error", () => {
    for (const r of [reads(), reads({ weeks: { ok: false, value: null } }), reads({ tasks: ok([{ id: "x" }]) }), {}]) {
      const d = loadDecision(r);
      expect(d.seed && d.storageError).toBe(false);
    }
  });

  it("refuses to seed on a malformed or empty read set", () => {
    expect(loadDecision({})).toEqual({ seed: false, storageError: true });
    expect(loadDecision(null)).toEqual({ seed: false, storageError: true });
    expect(loadDecision(reads({ vision: undefined }))).toEqual({ seed: false, storageError: true });
  });
});
