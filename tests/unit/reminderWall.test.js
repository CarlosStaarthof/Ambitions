import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  UNCATEGORIZED_ID, UNCATEGORIZED_COLOR,
  emptyReminderWall, normalizeReminderWall, activeReminders, archivedReminders, categoryUsage,
  addCategory, renameCategory, deleteCategory, addReminder, editReminder, markDone,
  deleteReminder, mergeImportedReminderWall
} from "../../src/lib/reminderWall.js";
import { PALETTE } from "../../src/lib/seed.js";

const AT = "2026-11-18T10:00:00.000Z";
const LATER = "2026-11-18T11:00:00.000Z";
const CAT = (id, name, color = PALETTE[0]) => ({ id, name, color });
const ITEM = (id, categoryId, text, extra = {}) => ({ id, categoryId, text, createdAt: AT, updatedAt: AT, ...extra });
const wallOf = (categories = [], items = []) => ({ categories, items });
const clone = (v) => JSON.parse(JSON.stringify(v));

describe("normalizeReminderWall", () => {
  // AC-3
  it("turns absent, null, empty and malformed values into a valid empty wall", () => {
    for (const v of [undefined, null, {}, "nope", 7, [], { categories: "x", items: 5 }]) {
      expect(normalizeReminderWall(v)).toEqual({ categories: [], items: [] });
    }
    expect(emptyReminderWall()).toEqual({ categories: [], items: [] });
  });

  // AC-3
  it("keeps valid entries, trims names and text, and drops malformed entries", () => {
    const out = normalizeReminderWall({
      categories: [null, { id: "", name: "No id" }, { id: "blank", name: "   " }, CAT("home", "  Home  ", "#123456")],
      items: [null, { id: "empty", categoryId: "home", text: "   " }, ITEM("a", "home", "  take out bins  ")]
    });
    expect(out.categories).toEqual([CAT("home", "Home", "#123456")]);
    expect(out.items).toEqual([ITEM("a", "home", "take out bins")]);
  });

  // AC-3 — the fallback is created only when needed, and only once.
  it("moves every missing-category item to one uncategorized category, creating it only when needed", () => {
    const noNeed = normalizeReminderWall(wallOf([CAT("home", "Home")], [ITEM("a", "home", "keep")]));
    expect(noNeed.categories.some((c) => c.id === UNCATEGORIZED_ID)).toBe(false);

    const out = normalizeReminderWall(wallOf([CAT("home", "Home")], [
      ITEM("a", "gone", "one"),
      ITEM("b", "also-gone", "two")
    ]));
    expect(out.items.map((i) => i.categoryId)).toEqual([UNCATEGORIZED_ID, UNCATEGORIZED_ID]);
    expect(out.categories.filter((c) => c.id === UNCATEGORIZED_ID)).toHaveLength(1);
    expect(out.categories.find((c) => c.id === UNCATEGORIZED_ID)).toEqual({ id: UNCATEGORIZED_ID, name: "Uncategorized", color: UNCATEGORIZED_COLOR });
  });

  // AC-3 — the mandatory idempotency and non-mutation case.
  it("is idempotent and never mutates its input", () => {
    const input = wallOf(
      [CAT("home", "Home"), { id: "orphan", name: "Gone", color: "#abcdef" }],
      [ITEM("a", "home", "keep"), ITEM("b", "missing", "move", { doneAt: LATER })]
    );
    const before = clone(input);
    const once = normalizeReminderWall(input);
    const twice = normalizeReminderWall(once);
    expect(twice).toEqual(once);
    expect(input).toEqual(before);
  });
});

describe("category CRUD", () => {
  // AC-4
  it("adds a trimmed category with the first unused palette colour and keeps the supplied id", () => {
    const input = wallOf([CAT("one", "One", PALETTE[0]), CAT("two", "Two", PALETTE[1])], []);
    const before = clone(input);
    const { wall, error } = addCategory(input, { id: "three", name: "  Three  " });
    expect(error).toBeUndefined();
    expect(wall.categories).toHaveLength(3);
    expect(wall.categories[2]).toEqual({ id: "three", name: "Three", color: PALETTE[2] });
    expect(input).toEqual(before);
    expect(wall).not.toBe(input);
  });

  // AC-4
  it("rejects an empty or case-insensitive duplicate category name", () => {
    const input = wallOf([CAT("one", "Work")], []);
    expect(addCategory(input, { id: "x", name: "   " }).error).toBe("name-empty");
    expect(addCategory(input, { id: "x", name: "wOrK" }).error).toBe("name-duplicate");
    expect(addCategory(input, { id: "x", name: "Home" }).error).toBeUndefined();
    expect(input.categories).toHaveLength(1);
  });

  // AC-5
  it("renames a category, allowing a case-only change of its own name", () => {
    const input = wallOf([CAT("work", "Work", "#123456")], [ITEM("a", "work", "keep")]);
    const before = clone(input);
    const { wall, error } = renameCategory(input, "work", "  Work  ");
    expect(error).toBeUndefined();
    expect(wall.categories[0]).toEqual(CAT("work", "Work", "#123456"));
    expect(wall.items).toEqual(input.items);

    const cased = renameCategory(wall, "work", "WORK");
    expect(cased.error).toBeUndefined();
    expect(cased.wall.categories[0].name).toBe("WORK");
    expect(cased.wall.categories[0].id).toBe("work");
    expect(cased.wall.categories[0].color).toBe("#123456");
    expect(input).toEqual(before);
  });

  // AC-5
  it("rejects empty and duplicate renames, and reports an unknown id", () => {
    const input = wallOf([CAT("one", "One"), CAT("two", "Two")], []);
    expect(renameCategory(input, "one", "   ").error).toBe("name-empty");
    expect(renameCategory(input, "one", "TWO").error).toBe("name-duplicate");
    expect(renameCategory(input, "nope", "New").error).toBe("category-missing");
    expect(input.categories.map((c) => c.name)).toEqual(["One", "Two"]);
  });

  // AC-6 — the crucial one: nothing is orphaned, active or archived.
  it("deletes a user category by moving every item, active and archived, to uncategorized", () => {
    const input = wallOf(
      [CAT("home", "Home"), CAT("work", "Work")],
      [ITEM("a", "home", "active"), ITEM("b", "home", "archived", { doneAt: LATER }), ITEM("c", "work", "other")]
    );
    const before = clone(input);
    const { wall, error } = deleteCategory(input, "home");
    expect(error).toBeUndefined();
    expect(wall.categories.map((c) => c.id)).toEqual(["work", UNCATEGORIZED_ID]);
    expect(wall.items).toHaveLength(3);
    expect(wall.items.filter((i) => i.categoryId === UNCATEGORIZED_ID).map((i) => i.id)).toEqual(["a", "b"]);
    expect(wall.items.find((i) => i.id === "b").doneAt).toBe(LATER);
    expect(input).toEqual(before);
  });

  // AC-6
  it("refuses to delete uncategorized while it holds reminders, and removes an empty category cleanly", () => {
    const holding = wallOf([CAT(UNCATEGORIZED_ID, "Uncategorized", UNCATEGORIZED_COLOR)], [ITEM("a", UNCATEGORIZED_ID, "x")]);
    expect(deleteCategory(holding, UNCATEGORIZED_ID)).toEqual({ wall: holding, error: "category-not-empty" });

    const input = wallOf([CAT("empty", "Empty"), CAT("used", "Used")], [ITEM("a", "used", "x")]);
    const { wall, error } = deleteCategory(input, "empty");
    expect(error).toBeUndefined();
    expect(wall.categories.map((c) => c.id)).toEqual(["used"]);
    expect(wall.items).toEqual(input.items);
    expect(deleteCategory(input, "nope").error).toBe("category-missing");
  });
});

describe("reminder CRUD", () => {
  // AC-7
  it("adds a trimmed reminder with createdAt and updatedAt from the caller and no doneAt", () => {
    const input = wallOf([CAT("home", "Home")], []);
    const before = clone(input);
    const { wall, error } = addReminder(input, { id: "r1", categoryId: "home", text: "  remember this  ", at: AT });
    expect(error).toBeUndefined();
    expect(wall.items).toEqual([{ id: "r1", categoryId: "home", text: "remember this", createdAt: AT, updatedAt: AT }]);
    expect("doneAt" in wall.items[0]).toBe(false);
    expect(input).toEqual(before);
  });

  // AC-7
  it("rejects empty text and an unknown category when adding", () => {
    const input = wallOf([CAT("home", "Home")], []);
    expect(addReminder(input, { id: "r1", categoryId: "home", text: "   ", at: AT }).error).toBe("text-empty");
    expect(addReminder(input, { id: "r1", categoryId: "nope", text: "x", at: AT }).error).toBe("category-missing");
    expect(input.items).toEqual([]);
  });

  // AC-8
  it("edits text and category while preserving id, createdAt and doneAt", () => {
    const input = wallOf([CAT("home", "Home"), CAT("work", "Work")], [
      ITEM("r1", "home", "old text", { createdAt: "2026-01-01T00:00:00.000Z" })
    ]);
    const before = clone(input);
    const { wall, error } = editReminder(input, "r1", { categoryId: "work", text: "  new text  ", at: LATER });
    expect(error).toBeUndefined();
    expect(wall.items[0]).toEqual({
      id: "r1", categoryId: "work", text: "new text",
      createdAt: "2026-01-01T00:00:00.000Z", updatedAt: LATER
    });
    expect(input).toEqual(before);
  });

  // AC-8
  it("rejects empty text, unknown categories, unknown ids and archived reminders", () => {
    const input = wallOf([CAT("home", "Home")], [
      ITEM("active", "home", "open"),
      ITEM("done", "home", "closed", { doneAt: LATER })
    ]);
    expect(editReminder(input, "active", { categoryId: "home", text: "  ", at: LATER }).error).toBe("text-empty");
    expect(editReminder(input, "active", { categoryId: "nope", text: "x", at: LATER }).error).toBe("category-missing");
    expect(editReminder(input, "nope", { categoryId: "home", text: "x", at: LATER }).error).toBe("reminder-not-found");
    expect(editReminder(input, "done", { categoryId: "home", text: "x", at: LATER }).error).toBe("reminder-archived");
  });

  // AC-9
  it("ticks a reminder done, and a second tick is a no-op with no error", () => {
    const input = wallOf([CAT("home", "Home")], [ITEM("r1", "home", "do it")]);
    const first = markDone(input, "r1", LATER);
    expect(first.error).toBeUndefined();
    expect(first.wall.items[0]).toEqual({ id: "r1", categoryId: "home", text: "do it", createdAt: AT, updatedAt: LATER, doneAt: LATER });
    expect(input.items[0].doneAt).toBeUndefined();

    const second = markDone(first.wall, "r1", "2026-11-19T00:00:00.000Z");
    expect(second.error).toBeUndefined();
    expect(second.wall).toEqual(first.wall);
    expect(markDone(input, "nope", LATER).error).toBe("reminder-not-found");
  });

  // AC-16 — permanent delete, active and archived, with categories untouched.
  it("permanently deletes an active or archived reminder and leaves categories alone", () => {
    const input = wallOf(
      [CAT("home", "Home"), CAT("work", "Work")],
      [
        ITEM("active", "home", "delete me"),
        ITEM("keep", "home", "keep me"),
        ITEM("archived", "work", "delete me too", { doneAt: LATER })
      ]
    );
    const before = clone(input);

    const first = deleteReminder(input, "active");
    expect(first.error).toBeUndefined();
    expect(first.wall.items.map((i) => i.id)).toEqual(["keep", "archived"]);
    expect(first.wall.categories).toEqual(input.categories);
    expect(activeReminders(first.wall.items).some((i) => i.id === "active")).toBe(false);
    expect(input).toEqual(before);

    const second = deleteReminder(first.wall, "archived");
    expect(second.error).toBeUndefined();
    expect(second.wall.items.map((i) => i.id)).toEqual(["keep"]);
    expect(archivedReminders(second.wall.items)).toEqual([]);
    expect(second.wall.categories).toEqual(input.categories);
    expect(categoryUsage(second.wall, "work")).toBe(0);
    expect(input).toEqual(before);

    expect(deleteReminder(input, "nope")).toEqual({ wall: input, error: "reminder-not-found" });
  });

  // AC-16 — a deleted reminder cannot survive into an export built from the wall.
  it("leaves no trace of a deleted reminder in a wall export", () => {
    const input = wallOf([CAT("home", "Home")], [ITEM("gone", "home", "gone"), ITEM("stay", "home", "stay")]);
    const { wall } = deleteReminder(input, "gone");
    const envelope = JSON.parse(JSON.stringify({ version: 6, reminderWall: wall }));
    expect(envelope.reminderWall.items.map((i) => i.id)).toEqual(["stay"]);
    expect(JSON.stringify(envelope)).not.toContain("gone");
  });

  // AC-10
  it("sorts active and archived lists newest first, stable for equal timestamps", () => {
    const items = [
      ITEM("a", "c", "old", { createdAt: "2026-01-01T00:00:00.000Z" }),
      ITEM("b", "c", "new", { createdAt: "2026-03-01T00:00:00.000Z" }),
      ITEM("c", "c", "tie", { createdAt: "2026-03-01T00:00:00.000Z" }),
      ITEM("d", "c", "done-old", { doneAt: "2026-02-01T00:00:00.000Z" }),
      ITEM("e", "c", "done-new", { doneAt: "2026-04-01T00:00:00.000Z" })
    ];
    expect(activeReminders(items).map((i) => i.id)).toEqual(["b", "c", "a"]);
    expect(archivedReminders(items).map((i) => i.id)).toEqual(["e", "d"]);
    expect(activeReminders(items)).not.toBe(items);
    expect(archivedReminders(items)).not.toBe(items);
    expect(categoryUsage(wallOf([], items), "c")).toBe(5);
  });
});

describe("merging imported walls", () => {
  // AC-14
  it("keeps stored entries the file omits and lets the file win a shared id", () => {
    const stored = wallOf(
      [CAT("keep", "Keep"), CAT("shared", "Stored name", "#111111")],
      [ITEM("s", "keep", "stored only"), ITEM("shared-item", "keep", "stored version")]
    );
    const imported = wallOf(
      [CAT("shared", "File name", "#222222"), CAT("new", "New")],
      [ITEM("shared-item", "new", "file version"), ITEM("n", "new", "new only")]
    );
    const beforeStored = clone(stored);
    const beforeImported = clone(imported);
    const out = mergeImportedReminderWall(stored, imported);

    expect(out.categories.find((c) => c.id === "shared")).toEqual(CAT("shared", "File name", "#222222"));
    expect(out.categories.some((c) => c.id === "keep")).toBe(true);
    expect(out.categories.some((c) => c.id === "new")).toBe(true);
    expect(out.items.find((i) => i.id === "shared-item").text).toBe("file version");
    expect(out.items.find((i) => i.id === "s").text).toBe("stored only");
    expect(out.items.find((i) => i.id === "n").text).toBe("new only");
    expect(stored).toEqual(beforeStored);
    expect(imported).toEqual(beforeImported);
  });

  // AC-14 — an old v4/v5 export has no wall, and the stored one survives.
  it("keeps the stored wall when the file has no reminderWall field", () => {
    const stored = wallOf([CAT("home", "Home")], [ITEM("a", "home", "keep")]);
    expect(mergeImportedReminderWall(stored, undefined)).toEqual(stored);
    expect(mergeImportedReminderWall(stored, null)).toEqual(stored);
  });

  // AC-14 — round-trip and idempotency.
  it("round-trips every category, item and doneAt, and is idempotent", () => {
    const imported = wallOf(
      [CAT("home", "Home", "#123456")],
      [ITEM("a", "home", "active"), ITEM("b", "home", "archived", { doneAt: LATER })]
    );
    const once = mergeImportedReminderWall(emptyReminderWall(), imported);
    expect(once).toEqual(imported);
    expect(mergeImportedReminderWall(once, imported)).toEqual(once);
    expect(mergeImportedReminderWall(once, once)).toEqual(once);
  });
});

describe("structural guarantees (source-read)", () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

  // AC-1 — the wall is the eighth key, and its only writer is setReminderWallP.
  it("reads, normalizes and writes the reminderWall key through the one store", () => {
    const src = read("../../src/lib/useStore.js");
    expect(src).toMatch(/loadKey\("reminderWall"\)/);
    expect(src).toMatch(/normalizeReminderWall\(rw\.value\)/);
    expect(src).toMatch(/saveKey\("reminderWall", n\)/);
    expect(src).toMatch(/reminderWall, settings, aiKeys/);
    expect(src).toMatch(/setReminderWallP/);
  });

  // AC-2 / AC-15 — the wall cannot touch weeks, tasks, settings or the network.
  it("gives the wall module and view no route to time-block data, notifications or AI", () => {
    const lib = read("../../src/lib/reminderWall.js");
    expect(lib).not.toMatch(/localforage|from "\.\/storage"|react|document|window/);
    expect(lib).not.toMatch(/setTasksP|setWeeksP|setCategoriesP|setSettingsP/);
    expect(lib).not.toMatch(/callAI|aiEnabled|aiErrorText|notify|@capacitor/);

    const view = read("../../src/components/ReminderWallTab.jsx");
    expect(view).not.toMatch(/setTasksP|setWeeksP|setCategoriesP|setSettingsP/);
    expect(view).not.toMatch(/callAI|aiEnabled|aiErrorText|lib\/ai|notify|@capacitor|fetch\(/);
    expect(view).toMatch(/useArmed/);
    expect(view).not.toMatch(/window\.confirm/);
  });

  // AC-16 — permanent delete is offered from the wall and from the archive,
  // always behind the two-tap confirmation pattern.
  it("arms a permanent delete control on both the wall and the archive", () => {
    const view = read("../../src/components/ReminderWallTab.jsx");
    expect(view).toMatch(/import\s*\{[^}]*deleteReminder[^}]*\}\s*from\s*"\.\.\/lib\/reminderWall"/s);
    expect(view).toMatch(/deleteReminder\(reminderWall, id\)/);
    expect(view.match(/arm\("rmDel" \+ it\.id/g) || []).toHaveLength(2);
    expect(view).toMatch(/Trash2/);
    expect(view).not.toMatch(/window\.confirm/);
  });

  // AC-14 — the envelope carries version 6 and the wall.
  it("puts the wall in the version 6 export envelope and merges it on import", () => {
    const data = read("../../src/components/DataTab.jsx");
    const payload = data.split("\n").find((l) => l.includes("const payload ="));
    expect(payload).toMatch(/version:\s*6\b/);
    expect(payload).toMatch(/reminderWall/);
    expect(data).toMatch(/mergeImportedReminderWall\(reminderWall, pendingImport\.reminderWall\)/);
    expect(data).toMatch(/normalizeReminderWall\(mergeImportedReminderWall/);
  });
});
