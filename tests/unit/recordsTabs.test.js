import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const app = () => read("../../src/App.jsx");
const menu = () => read("../../src/components/AppMenu.jsx");

describe("Records sub-tabs named after the main sections (source-read)", () => {
  // AC-1
  it("puts Plan & Balance and To-Do's at the top of Records", () => {
    const src = app();
    expect(src).toContain(
      '<SubTabs value={recordsSub} onChange={setRecordsSub} tabs={[["plan", "Plan & Balance"], ["todos", "To-Do\'s"]]} />'
    );
    expect(src).not.toContain('["reminders", "Reminders"]');
  });

  // AC-2
  it("keeps Tasks and Questions under Plan & Balance with the same components", () => {
    const src = app();
    expect(src).toContain(
      '<SubTabs value={taskSub} onChange={setTaskSub} tabs={[["tasks", "Tasks"], ["guiding", "Questions"]]} nested />'
    );
    expect(src).toMatch(/recordsSub === "plan" &&/);
    expect(src).toMatch(/<TasksTab tasks=\{store\.tasks\}/);
    expect(src).toMatch(/<GuidingTab questions=\{store\.questions\}/);
  });

  // AC-3
  it("keeps Manage and Archive under To-Do's with the reminder controls reachable", () => {
    const src = app();
    expect(src).toMatch(/recordsSub === "todos" &&/);
    expect(src).toContain(
      '<SubTabs value={recordsReminderSub} onChange={setRecordsReminderSub} tabs={[["wall", "Manage"], ["archive", "Archive"]]} nested />'
    );
    expect(src).toContain(
      '<ReminderWallTab reminderWall={store.reminderWall} setReminderWallP={store.setReminderWallP} view={recordsReminderSub} />'
    );
  });

  // AC-4
  it("leaves the main menu and section headers unchanged", () => {
    expect(menu()).toMatch(/\{ id: "tasks", label: "Records"/);
    expect(menu()).toMatch(/\{ id: "reminders", label: "To-Do's Chart"/);
    const src = app();
    expect(src).toMatch(/tasks: "Records"/);
    expect(src).toMatch(/reminders: "To-Do's Chart"/);
  });

  // AC-5
  it("touches no storage, export or Android surface from App", () => {
    const src = app();
    expect(src).not.toMatch(/localforage|saveKey|loadKey/);
    expect(src).not.toMatch(/version:/);
  });

  // The two levels must be visually distinct, so the inner bar is marked nested.
  it("marks both inner tab bars as nested", () => {
    const src = app();
    expect(src.match(/ nested \/>/g)).toHaveLength(2);
  });
});
