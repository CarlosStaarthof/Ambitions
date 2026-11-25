import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { createdDate } from "../../src/lib/reminderWall.js";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

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

  // AC-7
  it("stamps each item with its original creation date and never invents one", () => {
    const chart = read("../../src/components/TodoChartTab.jsx");
    expect(chart).toMatch(/it\.createdAt/);
    expect(chart).toContain("Added date unknown");
  });

  // AC-9
  it("keeps the done view read-only with both dates", () => {
    const chart = read("../../src/components/TodoChartTab.jsx");
    expect(chart).toMatch(/it\.doneAt/);
    expect(chart).toMatch(/addedLabel\(it\.createdAt\)/);
    expect(chart).not.toMatch(/deleteReminder/);
  });

  // AC-11 / AC-12
  it("adds no key, no export change and no AI or network surface", () => {
    const chart = read("../../src/components/TodoChartTab.jsx");
    expect(chart).not.toMatch(/localforage|saveKey|loadKey|callAI|aiEnabled|fetch\(/);
    const store = read("../../src/lib/useStore.js");
    expect(store).not.toMatch(/todoChart/);
  });
});
