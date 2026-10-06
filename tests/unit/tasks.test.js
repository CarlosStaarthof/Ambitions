import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  UNKNOWN_COLOR, isRetired, activeTasks, activeCategories, retiredTasks,
  retireTask, retireCategory, restoreTask, taskIndex, resolveCell
} from "../../src/lib/tasks.js";
import { AMBITION_ID, PALETTE } from "../../src/lib/seed.js";
import { nextColor } from "../../src/lib/time.js";

const CATS = [
  { id: AMBITION_ID, name: "Ambition", protected: true },
  { id: "work", name: "Work", protected: false },
  { id: "old", name: "Old life", protected: false }
];
const TASKS = [
  { id: "a1", name: "Reading", categoryId: AMBITION_ID, color: "#eab308", target: 3 },
  { id: "w1", name: "Work 1", categoryId: "work", color: "#0ea5e9", target: 40 },
  { id: "o1", name: "Commute", categoryId: "old", color: "#ef4444", target: null },
  { id: "o2", name: "Old hobby", categoryId: "old", color: "#a855f7", target: null, weekKey: "2026-09-21" }
];
const clone = (v) => JSON.parse(JSON.stringify(v));

describe("what counts as retired", () => {
  it("treats only an explicit retired flag as retirement", () => {
    expect(isRetired({ retired: true })).toBe(true);
    expect(isRetired({ retired: false })).toBe(false);
    expect(isRetired({})).toBe(false);
    expect(isRetired(null)).toBe(false);
    expect(isRetired(undefined)).toBe(false);
  });

  // AC-16, the two helpers
  it("drops retired tasks and categories from the active lists, keeping order", () => {
    const tasks = [TASKS[0], { ...TASKS[1], retired: true }, TASKS[2]];
    expect(activeTasks(tasks).map((t) => t.id)).toEqual(["a1", "o1"]);
    const cats = [CATS[0], { ...CATS[1], retired: true }, CATS[2]];
    expect(activeCategories(cats).map((c) => c.id)).toEqual([AMBITION_ID, "old"]);
  });

  // AC-39
  it("treats data written before this feature as entirely active", () => {
    expect(activeTasks(TASKS)).toHaveLength(TASKS.length);
    expect(activeCategories(CATS)).toHaveLength(CATS.length);
    expect(JSON.stringify(TASKS)).not.toContain("retired");
  });

  it("survives being handed nothing at all", () => {
    expect(activeTasks(undefined)).toEqual([]);
    expect(activeCategories(null)).toEqual([]);
    expect(retiredTasks(undefined)).toEqual([]);
  });
});

describe("retiring a task", () => {
  // AC-11
  it("keeps the task, flags it, and stores the supplied timestamp verbatim", () => {
    const before = clone(TASKS);
    const out = retireTask(TASKS, "w1", "2026-09-29T10:11:12.345Z");
    expect(out).toHaveLength(TASKS.length);
    expect(out[1]).toEqual({ ...before[1], retired: true, retiredAt: "2026-09-29T10:11:12.345Z" });
    expect(out[0]).toEqual(before[0]);
    expect(out[2]).toEqual(before[2]);
    expect(out[3]).toEqual(before[3]);
    // no mutation, of the array or of any object in it
    expect(TASKS).toEqual(before);
    expect(out).not.toBe(TASKS);
  });

  it("changes nothing for an id it does not hold", () => {
    const before = clone(TASKS);
    expect(retireTask(TASKS, "nope", "2026-09-29T00:00:00.000Z")).toEqual(before);
  });

  // AC-12
  it("retires a category together with every task in it, and nothing else", () => {
    const beforeT = clone(TASKS), beforeC = clone(CATS);
    const at = "2026-09-29T12:00:00.000Z";
    const { tasks, categories } = retireCategory(TASKS, CATS, "old", at);
    expect(tasks).toHaveLength(TASKS.length);
    expect(categories).toHaveLength(CATS.length);
    expect(categories[2]).toEqual({ ...beforeC[2], retired: true });
    expect(categories[0]).toEqual(beforeC[0]);
    expect(categories[1]).toEqual(beforeC[1]);
    expect(tasks[2]).toEqual({ ...beforeT[2], retired: true, retiredAt: at });
    expect(tasks[3]).toEqual({ ...beforeT[3], retired: true, retiredAt: at });
    expect(tasks[0]).toEqual(beforeT[0]);
    expect(tasks[1]).toEqual(beforeT[1]);
    expect(TASKS).toEqual(beforeT);
    expect(CATS).toEqual(beforeC);
  });
});

describe("the retired list", () => {
  // AC-20
  it("lists only retired tasks, most recently retired first", () => {
    const tasks = [
      { id: "x", name: "X", retired: true, retiredAt: "2026-09-01T00:00:00.000Z" },
      { id: "y", name: "Y" },
      { id: "z", name: "Z", retired: true, retiredAt: "2026-09-29T09:00:00.000Z" },
      { id: "w", name: "W", retired: true, retiredAt: "2026-09-15T00:00:00.000Z" }
    ];
    expect(retiredTasks(tasks).map((t) => t.id)).toEqual(["z", "w", "x"]);
  });

  it("puts a retired task with no timestamp last, in its original order", () => {
    const tasks = [
      { id: "n1", name: "N1", retired: true },
      { id: "d1", name: "D1", retired: true, retiredAt: "2026-09-01T00:00:00.000Z" },
      { id: "n2", name: "N2", retired: true },
      { id: "d2", name: "D2", retired: true, retiredAt: "2026-09-20T00:00:00.000Z" }
    ];
    expect(retiredTasks(tasks).map((t) => t.id)).toEqual(["d2", "d1", "n1", "n2"]);
  });

  it("keeps the original order for two tasks retired at the same instant", () => {
    const at = "2026-09-29T12:00:00.000Z";
    const { tasks } = retireCategory(TASKS, CATS, "old", at);
    expect(retiredTasks(tasks).map((t) => t.id)).toEqual(["o1", "o2"]);
  });
});

describe("restoring a task", () => {
  const at = "2026-09-29T12:00:00.000Z";

  // AC-21
  it("removes the flags rather than setting them false, restoring the exact stored shape", () => {
    const before = clone(TASKS);
    const retiredOut = retireTask(TASKS, "o2", at);
    const { tasks } = restoreTask(retiredOut, CATS, "o2");
    expect(tasks[3]).toEqual(before[3]);
    expect("retired" in tasks[3]).toBe(false);
    expect("retiredAt" in tasks[3]).toBe(false);
    expect(tasks[3].name).toBe("Old hobby");
    expect(tasks[3].color).toBe("#a855f7");
    expect(tasks[3].target).toBe(null);
    expect(tasks[3].weekKey).toBe("2026-09-21");
    expect(tasks.map((t) => t.id)).toEqual(before.map((t) => t.id));
    expect(tasks[0]).toEqual(before[0]);
    expect(retiredOut[3].retired).toBe(true);   // the input was not mutated
  });

  // AC-22
  it("un-retires the task's own category, leaving other retired categories alone", () => {
    const cats = [...CATS, { id: "gone", name: "Gone", protected: false, retired: true }];
    const r = retireCategory(TASKS, cats, "old", at);
    const { tasks, categories } = restoreTask(r.tasks, r.categories, "o1");
    expect(categories.find((c) => c.id === "old")).toEqual(CATS[2]);
    expect("retired" in categories.find((c) => c.id === "old")).toBe(false);
    expect(categories.find((c) => c.id === "gone").retired).toBe(true);
    // its sibling in the same category stays retired — restore is per task
    expect(tasks.find((t) => t.id === "o2").retired).toBe(true);
    expect(tasks.find((t) => t.id === "o1").retired).toBeUndefined();
  });

  // AC-23
  it("is idempotent, and is a no-op for a task that is not retired", () => {
    const once = restoreTask(retireTask(TASKS, "w1", at), CATS, "w1");
    const twice = restoreTask(once.tasks, once.categories, "w1");
    expect(twice.tasks).toEqual(once.tasks);
    expect(twice.categories).toEqual(once.categories);
    const never = restoreTask(TASKS, CATS, "w1");
    expect(never.tasks).toEqual(clone(TASKS));
    expect(never.categories).toEqual(clone(CATS));
  });

  // AC-24
  it("throws nothing and changes nothing for an id it has never seen", () => {
    const before = { tasks: clone(TASKS), categories: clone(CATS) };
    const out = restoreTask(TASKS, CATS, "does-not-exist");
    expect(out.tasks).toEqual(before.tasks);
    expect(out.categories).toEqual(before.categories);
    expect(() => restoreTask(undefined, undefined, "x")).not.toThrow();
  });

  it("round-trips a retired category's whole group back to the stored shape", () => {
    const before = { tasks: clone(TASKS), categories: clone(CATS) };
    const r = retireCategory(TASKS, CATS, "old", at);
    let out = restoreTask(r.tasks, r.categories, "o1");
    out = restoreTask(out.tasks, out.categories, "o2");
    expect(out.tasks).toEqual(before.tasks);
    expect(out.categories).toEqual(before.categories);
  });
});

describe("resolving a cell", () => {
  // AC-6
  it("tells empty, a task, and an id that is in no task apart", () => {
    const index = taskIndex([...TASKS, { id: "r1", name: "Old job", categoryId: "old", color: "#14b8a6", retired: true, retiredAt: "2026-09-01T00:00:00.000Z" }]);

    expect(resolveCell(undefined, index)).toEqual({ kind: "empty", name: "", color: null, code: "" });
    expect(resolveCell("", index)).toEqual({ kind: "empty", name: "", color: null, code: "" });

    expect(resolveCell("a1", index)).toEqual({ kind: "task", name: "Reading", color: "#eab308", code: "REA" });
    // a retired task still resolves, with its real name and colour — that is the point
    expect(resolveCell("r1", index)).toEqual({ kind: "task", name: "Old job", color: "#14b8a6", code: "OJ" });

    expect(resolveCell("k3j4h5", index)).toEqual({ kind: "unknown", name: "Unknown task", color: "#52525b", code: "?" });
    expect(UNKNOWN_COLOR).toBe("#52525b");
  });

  it("indexes every task, retired included, and keeps one entry per id", () => {
    const index = taskIndex([TASKS[0], { ...TASKS[1], retired: true }, { id: "a1", name: "Impostor", color: "#000000" }]);
    expect(index.size).toBe(2);
    expect(index.get("a1").name).toBe("Reading");
    expect(index.get("w1").name).toBe("Work 1");
    expect(taskIndex(undefined).size).toBe(0);
  });

  it("calls a cell unknown when there is no index at all", () => {
    expect(resolveCell("a1", undefined).kind).toBe("unknown");
  });
});

// The pattern tests/unit/reminders.test.js § "what this feature did not change" uses.
// These are the structural guarantees: the value of this feature is as much in what the
// code can no longer do as in what it does.
describe("structural guarantees (source-read)", () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  // Strip comments and quoted strings so prose about weeks is not mistaken for code.
  const codeOnly = (src) => src
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/^\s*\/\/.*$/gm, " ")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/`(?:[^`\\\n]|\\.)*`/g, "``");

  // AC-13
  it("leaves the Tasks tab no route to the weeks key at all", () => {
    const code = codeOnly(read("../../src/components/TasksTab.jsx"));
    expect(code).not.toMatch(/setWeeksP/);
    expect(code).not.toMatch(/\bweeks\b/);
    expect(code).not.toMatch(/clearTaskIdsFromWeeks/);
    expect(read("../../src/components/TasksTab.jsx")).not.toMatch(/lib\/storage/);

    const app = read("../../src/App.jsx");
    const el = app.split("\n").find((l) => l.includes("<TasksTab"));
    expect(el).toBeTruthy();
    expect(el).not.toMatch(/setWeeksP/);
  });

  // AC-36
  it("writes the weeks key from setWeeksP and nowhere else", () => {
    const src = read("../../src/lib/useStore.js");
    const lines = src.split("\n").filter((l) => /saveKey\("weeks"/.test(l));
    expect(lines).toHaveLength(1);
    expect(lines[0]).toMatch(/setWeeksP/);
    for (const f of ["WeekTab", "TasksTab", "BalanceTab", "DataTab"]) {
      expect(read(`../../src/components/${f}.jsx`)).not.toMatch(/saveKey/);
    }
  });

  // AC-33
  it("has exactly one seeding branch, gated on the freshness decision", () => {
    const src = read("../../src/lib/useStore.js");
    expect(src).toMatch(/loadDecision\(\{/);
    expect(src).not.toMatch(/!t\s*\|\|\s*!t\.length/);
    expect(src).not.toMatch(/!q\s*\|\|\s*!q\.length/);
    const lines = src.split("\n");
    const open = lines.findIndex((l) => /if \(seed\) \{/.test(l));
    const close = lines.findIndex((l, i) => i > open && /^\s*\} else \{/.test(l));
    expect(open).toBeGreaterThan(-1);
    expect(close).toBeGreaterThan(open);
    const seedLines = lines.map((l, i) => [l, i]).filter(([l]) => /SEED_(TASKS|CATEGORIES|QUESTIONS)/.test(l) && !/^import/.test(l));
    expect(seedLines.length).toBeGreaterThan(0);
    for (const [, i] of seedLines) { expect(i).toBeGreaterThan(open); expect(i).toBeLessThan(close); }
  });

  // AC-39, the "no load-time pass" half
  it("adds no load-time backfill of the retirement flags", () => {
    expect(read("../../src/lib/useStore.js")).not.toMatch(/retired/);
  });

  // AC-38
  it("keeps the task module pure", () => {
    const src = read("../../src/lib/tasks.js");
    expect([...src.matchAll(/from "([^"]+)"/g)].map((m) => m[1])).toEqual(["./time"]);
    expect(src).not.toMatch(/react|localforage|@capacitor|document|window|saveKey|loadKey/);
  });

  // AC-17
  it("arms both removal controls and introduces no window.confirm", () => {
    const src = read("../../src/components/TasksTab.jsx");
    expect(src).toMatch(/arm\("delTask" \+ t\.id, \(\) => removeTask\(t\.id\)\)/);
    expect(src).toMatch(/arm\("delCat" \+ cat\.id, \(\) => removeCategory\(cat\)\)/);
    // restore is deliberately not armed — it destroys nothing
    expect(src).toMatch(/onClick=\{\(\) => undoRemoveTask\(t\.id\)\}/);
    expect(src).not.toMatch(/arm\("restore/);
    // No purge control is offered on a retired row, and nothing in this tab removes an
    // element from either array any more — purging a task would orphan its cells.
    const code = codeOnly(src);
    expect(code).not.toMatch(/tasks\.filter\(/);
    expect(code).not.toMatch(/categories\.filter\(/);
    for (const f of ["TasksTab", "WeekTab", "BalanceTab", "DataTab", "SettingsTab", "GuidingTab", "VisionTab", "AppMenu", "AccountTab"]) {
      expect(read(`../../src/components/${f}.jsx`)).not.toMatch(/window\.confirm/);
    }
  });

  // AC-18
  it("states the new semantics in the Tasks tab copy", () => {
    const src = read("../../src/components/TasksTab.jsx");
    expect(src).toContain('const ARMED_TASK_LABEL = "Tap again to remove — past weeks keep it"');
    expect(src).toMatch(/title=\{isArmed\("delTask" \+ t\.id\) \? ARMED_TASK_LABEL/);
    expect(src).toMatch(/aria-label=\{isArmed\("delTask" \+ t\.id\) \? ARMED_TASK_LABEL/);
    // the armed category label must not claim that weeks are cleared
    const catLabel = src.split("\n").find((l) => l.includes('isArmed("delCat" + cat.id) ? "'));
    expect(catLabel).toBeTruthy();
    expect(catLabel).not.toMatch(/clear/i);
    expect(catLabel).not.toMatch(/week/i);
    // one footer sentence saying a filled week keeps a removed task
    const footer = src.split("\n").find((l) => l.includes("Ambition is your protected"));
    expect(footer).toMatch(/Weeks you have already filled keep a removed task/);
  });

  // AC-19
  it("never hands a new task the colour of a retired one", () => {
    const tasks = [{ id: "a", color: PALETTE[0] }, { id: "b", color: PALETTE[1], retired: true }];
    expect(nextColor(tasks.map((t) => t.color))).toBe(PALETTE[2]);
    const src = read("../../src/components/TasksTab.jsx");
    expect(src).toMatch(/nextColor\(tasks\.map\(\(t\) => t\.color\)\)/);
    expect(src).not.toMatch(/nextColor\(activeTasks/);
    expect(read("../../src/components/WeekTab.jsx")).toMatch(/nextColor\(tasks\.map\(\(t\) => t\.color\)\)/);
  });

  // AC-35, the "writes nothing" half. The rendered screen is device-only.
  it("returns from the load path before any write when a read failed", () => {
    const src = read("../../src/lib/useStore.js");
    const lines = src.split("\n");
    const guard = lines.findIndex((l) => /if \(readFailed\)/.test(l));
    const firstWrite = lines.findIndex((l) => /saveKey\(/.test(l));
    expect(guard).toBeGreaterThan(-1);
    expect(lines[guard]).toMatch(/return;/);
    expect(firstWrite).toBeGreaterThan(guard);
    expect(src).toMatch(/loading, storageError,/);   // exposed from the hook

    const app = read("../../src/App.jsx");
    expect(app).toMatch(/if \(loading \|\| storageError\) return;/);
    expect(app).toMatch(/if \(storageError\) return \(/);
    expect(app).toContain("Could not read your saved data. Nothing has been changed. Close the app and open it again.");
    const appLines = app.split("\n");
    expect(appLines.findIndex((l) => /if \(store\.loading\) return/.test(l)))
      .toBeLessThan(appLines.findIndex((l) => /if \(storageError\) return \(/.test(l)));
  });

  // AC-16 / AC-10, the wiring behind the four surfaces. What they render is device-only.
  it("wires every editing surface to the active lists and the grid to all tasks", () => {
    const week = read("../../src/components/WeekTab.jsx");
    expect(week).toMatch(/const index = useMemo\(\(\) => taskIndex\(tasks\), \[tasks\]\)/);
    expect(week).toMatch(/const cell = resolveCell\(id, index\)/);
    expect(week).toMatch(/const liveTasks = activeTasks\(tasks\)/);
    expect(week).toMatch(/const liveCategories = activeCategories\(categories\)/);
    expect(week).toMatch(/const visibleCategories = liveCategories\.filter/);
    expect(week).toMatch(/const catTasks = liveTasks\.filter/);
    expect(week).toMatch(/const count = liveTasks\.filter/);
    // stats still see every task, so a retired task's hours keep counting
    expect(week).toMatch(/weekStatsOf\(weekCells, tasks, categories\)/);
    // tints only where resolveCell said "empty"
    expect(week).toMatch(/const tint = filledCell \? null :/);

    const bal = read("../../src/components/BalanceTab.jsx");
    expect(bal).toMatch(/const ambitionTasks = activeTasks\(tasks\)\.filter/);
    expect(bal).toMatch(/if \(unknownH > 0\) taskHoursData\.push\(\{ name: "Unknown", hours: unknownH, color: UNKNOWN_COLOR \}\)/);

    const tab = read("../../src/components/TasksTab.jsx");
    expect(tab).toMatch(/activeCategories\(categories\)\.map/);
    expect(tab).toMatch(/activeTasks\(tasks\)\.filter\(\(t\) => t\.categoryId === cat\.id\)/);
    expect(tab).toMatch(/retiredTasks\(tasks\)/);
  });

  // AC-43, the envelope half
  it("leaves the export envelope at version 5 with the same field list", () => {
    const payload = read("../../src/components/DataTab.jsx").split("\n").find((l) => l.includes("const payload ="));
    expect(payload).toMatch(/version:\s*5\b/);
    expect(payload).toMatch(/exportedAt.*tasks, categories, questions, weeks, reflections, vision/);
  });

  // AC-44
  it("adds no AI surface anywhere", () => {
    expect(read("../../src/lib/tasks.js")).not.toMatch(/callAI|aiErrorText|provider/);
    const tab = read("../../src/components/TasksTab.jsx");
    expect(tab).not.toMatch(/callAI|aiEnabled|aiErrorText|lib\/ai/);
  });
});
