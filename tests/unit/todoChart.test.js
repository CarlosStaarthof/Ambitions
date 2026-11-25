import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createdDate, chartGroups, chartSummary, markDone } from "../../src/lib/reminderWall.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const wall = (categories, items) => ({ categories, items });

describe("createdDate", () => {
  // AC-10
  it("returns the local calendar day for a valid timestamp", () => {
    expect(createdDate("2026-11-18T10:00:00")).toBe("2026-11-18");
    expect(createdDate("2026-01-02T23:30:00")).toBe("2026-01-02");
  });

  // AC-10
  it("returns null for missing, blank, non-string and unparseable values without throwing", () => {
    for (const v of [undefined, null, "", "   ", 42, {}, "not a date"]) {
      expect(createdDate(v)).toBeNull();
    }
  });
});

describe("chartGroups", () => {
  const categories = [
    { id: "home", name: "Home", color: "#111111" },
    { id: "work", name: "Work", color: "#222222" },
    { id: "empty", name: "Empty", color: "#333333" }
  ];

  it("groups open items by category in wall order, newest first, and drops empty groups", () => {
    const groups = chartGroups(
      wall(categories, [
        { id: "a", categoryId: "work", text: "older work", createdAt: "2026-11-01T10:00:00.000Z" },
        { id: "b", categoryId: "home", text: "buy milk", createdAt: "2026-11-02T10:00:00.000Z" },
        { id: "c", categoryId: "work", text: "newer work", createdAt: "2026-11-03T10:00:00.000Z" },
        { id: "d", categoryId: "home", text: "already done", createdAt: "2026-11-04T10:00:00.000Z", doneAt: "2026-11-05T10:00:00.000Z" }
      ])
    );
    expect(groups.map((g) => g.category.id)).toEqual(["home", "work"]);
    expect(groups.find((g) => g.category.id === "work").items.map((it) => it.id)).toEqual(["c", "a"]);
    expect(groups.find((g) => g.category.id === "home").items.map((it) => it.id)).toEqual(["b"]);
  });

  it("puts an item with a missing category in one Uncategorized group so nothing is hidden", () => {
    const groups = chartGroups(
      wall(categories, [
        { id: "x", categoryId: "gone", text: "orphan one", createdAt: "2026-11-02T10:00:00.000Z" },
        { id: "y", categoryId: null, text: "orphan two", createdAt: "2026-11-01T10:00:00.000Z" }
      ])
    );
    expect(groups).toHaveLength(1);
    expect(groups[0].category.name).toBe("Uncategorized");
    expect(groups[0].items.map((it) => it.id)).toEqual(["x", "y"]);
  });

  it("returns no groups for an empty or malformed wall and never mutates it", () => {
    expect(chartGroups(undefined)).toEqual([]);
    expect(chartGroups(wall([], []))).toEqual([]);
    const w = wall(categories, [{ id: "a", categoryId: "home", text: "x", createdAt: "2026-11-01T10:00:00.000Z" }]);
    chartGroups(w);
    expect(w.items[0].text).toBe("x");
  });
});

describe("chartSummary", () => {
  it("counts open and done items and rounds the completed share", () => {
    const s = chartSummary(
      wall([], [
        { id: "a", text: "one", createdAt: "2026-11-01T10:00:00.000Z" },
        { id: "b", text: "two", createdAt: "2026-11-02T10:00:00.000Z" },
        { id: "c", text: "three", createdAt: "2026-11-03T10:00:00.000Z", doneAt: "2026-11-04T10:00:00.000Z" }
      ])
    );
    expect(s).toEqual({ open: 2, done: 1, total: 3, donePercent: 33 });
  });

  it("is 0% on an empty wall, never NaN", () => {
    expect(chartSummary(undefined)).toEqual({ open: 0, done: 0, total: 0, donePercent: 0 });
    expect(chartSummary(wall([], []))).toEqual({ open: 0, done: 0, total: 0, donePercent: 0 });
  });

  it("reaches 100% when every item is done", () => {
    const s = chartSummary(wall([], [{ id: "a", text: "x", createdAt: "2026-11-01T10:00:00.000Z", doneAt: "2026-11-02T10:00:00.000Z" }]));
    expect(s.donePercent).toBe(100);
  });
});

describe("ticking an item done moves it to the archive (AC-8)", () => {
  const categories = [
    { id: "home", name: "Home", color: "#111111" },
    { id: "work", name: "Work", color: "#222222" }
  ];

  it("moves exactly the ticked item from open to done and leaves the rest alone", () => {
    const before = wall(categories, [
      { id: "a", categoryId: "home", text: "buy milk", createdAt: "2026-11-02T10:00:00.000Z" },
      { id: "b", categoryId: "work", text: "send report", createdAt: "2026-11-01T10:00:00.000Z" }
    ]);
    const r = markDone(before, "a", "2026-11-20T09:00:00.000Z");
    expect(r.error).toBeUndefined();
    expect(chartGroups(r.wall).flatMap((g) => g.items.map((it) => it.id))).toEqual(["b"]);
    expect(chartSummary(r.wall)).toEqual({ open: 1, done: 1, total: 2, donePercent: 50 });
    expect(r.wall.items.find((it) => it.id === "b")).toEqual(before.items[1]);
    expect(r.wall.items.find((it) => it.id === "a").doneAt).toBe("2026-11-20T09:00:00.000Z");
    expect(before.items.find((it) => it.id === "a").doneAt).toBeUndefined();
  });

  it("changes nothing when the id is not on the wall", () => {
    const before = wall(categories, [{ id: "a", categoryId: "home", text: "x", createdAt: "2026-11-02T10:00:00.000Z" }]);
    const r = markDone(before, "missing", "2026-11-20T09:00:00.000Z");
    expect(r.error).toBe("reminder-not-found");
    expect(r.wall).toEqual(before);
  });
});

describe("Records and To-Do's Chart (source-read)", () => {
  // AC-1
  it("renames the two menu entries", () => {
    const menu = read("../../src/components/AppMenu.jsx");
    expect(menu).toMatch(/\{ id: "tasks", label: "Records"/);
    expect(menu).toMatch(/\{ id: "reminders", label: "To-Do's Chart"/);
    expect(menu).not.toContain("Task & Questions");
    expect(menu).not.toMatch(/label:\s*"Reminders"/);
  });

  // AC-2
  it("labels the headers to match the menu", () => {
    const app = read("../../src/App.jsx");
    expect(app).toMatch(/tasks: "Records"/);
    expect(app).toMatch(/reminders: "To-Do's Chart"/);
  });

  // AC-3 / AC-4
  it("routes Records to tasks, questions and reminder management", () => {
    const app = read("../../src/App.jsx");
    expect(app).toContain('[["tasks", "Tasks"], ["guiding", "Questions"], ["reminders", "Reminders"]]');
    expect(app).toMatch(/taskSub === "reminders" &&/);
    expect(app).toMatch(/<ReminderWallTab /);
  });

  // AC-5
  it("routes To-Do's Chart to the visual-only view with Open and Done tabs", () => {
    const app = read("../../src/App.jsx");
    expect(app).toMatch(/<TodoChartTab /);
    expect(app).toMatch(/\[\"open\", \"Open\"\], \[\"done\", \"Done\"\]/);
  });

  // AC-6
  it("offers only a done control on the chart and imports no management helper", () => {
    const chart = read("../../src/components/TodoChartTab.jsx");
    expect(chart).toMatch(/markDone\(reminderWall, id/);
    expect(chart).not.toMatch(/addCategory|renameCategory|deleteCategory|addReminder|editReminder|deleteReminder/);
    expect(chart).not.toMatch(/useArmed|window\.confirm/);
    expect(chart).not.toMatch(/setTasksP|setWeeksP|setCategoriesP|setSettingsP/);
  });

  // AC-7 / AC-10
  it("stamps each item with its original creation date and never invents one", () => {
    const chart = read("../../src/components/TodoChartTab.jsx");
    expect(chart).toMatch(/it\.createdAt/);
    expect(chart).toContain("Added date unknown");
  });

  // AC-7 / AC-10 — the pure helper is the one source of the stamp, in both views.
  it("derives creation stamps through createdDate instead of parsing inline", () => {
    const chart = read("../../src/components/TodoChartTab.jsx");
    expect(chart).toMatch(/import\s*\{[^}]*createdDate[^}]*\}\s*from\s*"\.\.\/lib\/reminderWall"/s);
    expect(chart).toMatch(/createdDate\(iso\)/);
    const records = read("../../src/components/ReminderWallTab.jsx");
    expect(records).toMatch(/import\s*\{[^}]*createdDate[^}]*\}\s*from\s*"\.\.\/lib\/reminderWall"/s);
    expect(records).toMatch(/createdDate\(iso\)/);
    expect(records).toMatch(/addedLabel\(it\.createdAt\)/);
  });

  // AC-9
  it("keeps the done view read-only with both dates", () => {
    const chart = read("../../src/components/TodoChartTab.jsx");
    expect(chart).toMatch(/it\.doneAt/);
    expect(chart).toMatch(/addedLabel\(it\.createdAt\)/);
    expect(chart).not.toMatch(/deleteReminder/);
  });

  it("shapes the board with the pure helpers and stays one column on a 390 px width", () => {
    const chart = read("../../src/components/TodoChartTab.jsx");
    expect(chart).toMatch(/chartGroups\(reminderWall\)/);
    expect(chart).toMatch(/chartSummary\(reminderWall\)/);
    expect(chart).toMatch(/role="progressbar"/);
    // Single column by default; two columns only from the `sm` breakpoint up.
    expect(chart).toMatch(/grid gap-2\.5 sm:grid-cols-2/);
  });

  // AC-11 / AC-12
  it("adds no key, no export change and no AI or network surface", () => {
    const chart = read("../../src/components/TodoChartTab.jsx");
    expect(chart).not.toMatch(/localforage|saveKey|loadKey|callAI|aiEnabled|fetch\(/);
    const store = read("../../src/lib/useStore.js");
    expect(store).not.toMatch(/todoChart/);
  });
});
