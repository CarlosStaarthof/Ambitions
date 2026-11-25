import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";

const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
const menu = () => read("../../src/components/AppMenu.jsx");

const entries = (src) =>
  [...src.matchAll(/\{ id: "([a-z]+)", label: "([^"]+)", icon:/g)].map((m) => ({
    id: m[1],
    label: m[2]
  }));

describe("Main menu order (source-read)", () => {
  // AC-1
  it("lists the sections as plan, reminders, vision, tasks, settings", () => {
    expect(entries(menu()).map((e) => e.id)).toEqual([
      "plan",
      "reminders",
      "vision",
      "tasks",
      "settings"
    ]);
  });

  // AC-2
  it("keeps the five labels, each exactly once, in the new order", () => {
    const src = menu();
    expect(entries(src).map((e) => e.label)).toEqual([
      "Plan & Balance",
      "To-Do's Chart",
      "Vision Board",
      "Records",
      "Settings"
    ]);
    for (const label of ["Plan & Balance", "To-Do's Chart", "Vision Board", "Records", "Settings"]) {
      expect(src.split(`label: "${label}"`)).toHaveLength(2);
    }
  });

  // AC-3
  it("keeps every section id so active highlighting and routing are unchanged", () => {
    expect(entries(menu()).map((e) => e.id).sort()).toEqual([
      "plan",
      "reminders",
      "settings",
      "tasks",
      "vision"
    ]);
    expect(menu()).toContain("const active = section === it.id");
    expect(menu()).toContain("onSelect(it.id)");
  });

  // AC-4
  it("leaves the header labels mapped to the same section ids", () => {
    const app = read("../../src/App.jsx");
    expect(app).toMatch(/tasks: "Records"/);
    expect(app).toMatch(/reminders: "To-Do's Chart"/);
    expect(app).toMatch(/plan: "Plan & Balance"/);
    expect(app).toMatch(/vision: "Vision Board"/);
    expect(app).toMatch(/settings: "Settings"/);
  });
});
