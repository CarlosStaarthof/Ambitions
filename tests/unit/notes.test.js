import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import {
  WEEK_CELLS, SLOTS_PER_DAY, notesOf, categoryRunAt, noteAt, canPlaceNote,
  validateNote, addNote, updateNote, removeNote, cleanDictation, mergeImportedNotes
} from "../../src/lib/notes.js";
import { mergeImportedWeeks } from "../../src/lib/seed.js";

const TASKS = [
  { id: "sleep", name: "Sleep", categoryId: "sleep" },
  { id: "sleep2", name: "Nap", categoryId: "sleep" },
  { id: "work", name: "Work", categoryId: "work" },
  { id: "gym", name: "GYM", categoryId: "health" }
];

const note = (id, start, end, text = "n") => ({ id, start, end, text });

describe("constants and notesOf", () => {
  it("uses the same 336-cell, 48-slot grid as the week", () => {
    expect(WEEK_CELLS).toBe(336);
    expect(SLOTS_PER_DAY).toBe(48);
  });

  it("treats an absent or malformed notes field as no notes", () => {
    expect(notesOf(undefined)).toEqual([]);
    expect(notesOf({ cells: {} })).toEqual([]);
    expect(notesOf({ notes: "nope" })).toEqual([]);
    const notes = [note("a", 0, 1)];
    expect(notesOf({ notes })).toBe(notes);
  });
});

describe("categoryRunAt", () => {
  it("returns the maximal same-category run through adjacent different tasks", () => {
    const cells = { "0-40": "sleep", "0-41": "sleep2", "0-42": "sleep", "0-43": "sleep" };
    expect(categoryRunAt(cells, TASKS, 41)).toEqual({ start: 40, end: 44 });
  });

  it("stops at an empty cell, another category and an unresolvable task", () => {
    const cells = {
      "0-10": "sleep", "0-11": "sleep", "0-12": "work",
      "0-14": "sleep", "0-15": "ghost", "0-16": "sleep"
    };
    expect(categoryRunAt(cells, TASKS, 10)).toEqual({ start: 10, end: 12 });
    expect(categoryRunAt(cells, TASKS, 14)).toEqual({ start: 14, end: 15 });
    expect(categoryRunAt(cells, TASKS, 16)).toEqual({ start: 16, end: 17 });
  });

  it("returns null on an empty or unresolvable cell and out-of-grid indices", () => {
    expect(categoryRunAt({}, TASKS, 0)).toBeNull();
    expect(categoryRunAt({ "0-0": "ghost" }, TASKS, 0)).toBeNull();
    expect(categoryRunAt({ "0-0": "sleep" }, TASKS, -1)).toBeNull();
    expect(categoryRunAt({ "0-0": "sleep" }, TASKS, WEEK_CELLS)).toBeNull();
  });

  it("never crosses midnight", () => {
    const cells = { "0-47": "sleep", "1-0": "sleep", "1-1": "sleep2" };
    expect(categoryRunAt(cells, TASKS, 47)).toEqual({ start: 47, end: 48 });
    expect(categoryRunAt(cells, TASKS, 48)).toEqual({ start: 48, end: 50 });
  });
});

describe("noteAt and canPlaceNote", () => {
  const notes = [note("a", 0, 4), note("b", 10, 12)];

  it("returns the note whose half-open range contains the index", () => {
    expect(noteAt(notes, 0).id).toBe("a");
    expect(noteAt(notes, 3).id).toBe("a");
    expect(noteAt(notes, 4)).toBeNull();
    expect(noteAt(notes, 10).id).toBe("b");
    expect(noteAt(notes, 12)).toBeNull();
  });

  it("returns the first note in array order when an imported file overlaps", () => {
    const overlapping = [note("a", 0, 6), note("b", 4, 8)];
    expect(noteAt(overlapping, 5).id).toBe("a");
  });

  it("refuses an intersecting range but ignores the note being edited", () => {
    expect(canPlaceNote(notes, 3, 5)).toBe(false);
    expect(canPlaceNote(notes, 4, 10)).toBe(true);
    expect(canPlaceNote(notes, 0, 4, "a")).toBe(true);
    expect(canPlaceNote(notes, 0, 4, "b")).toBe(false);
  });
});

describe("validateNote", () => {
  it("rejects out-of-grid and empty ranges", () => {
    expect(validateNote(note("a", -1, 4))).toBe("range-invalid");
    expect(validateNote(note("a", 0, WEEK_CELLS + 1))).toBe("range-invalid");
    expect(validateNote(note("a", 4, 4))).toBe("range-invalid");
    expect(validateNote(note("a", 5, 4))).toBe("range-invalid");
  });

  it("rejects text that is empty after trimming", () => {
    expect(validateNote(note("a", 0, 4, "   "))).toBe("empty-note");
    expect(validateNote(note("a", 0, 4, "ok"))).toBeNull();
  });
});

describe("addNote", () => {
  it("trims text, stores the supplied at twice and never mutates its inputs", () => {
    const notes = [note("a", 0, 4)];
    const input = { ...note("b", 10, 12, "  hello  "), at: "2026-11-24T10:00:00.000Z" };
    const { notes: out, error } = addNote(notes, input);
    expect(error).toBeNull();
    expect(out).toHaveLength(2);
    expect(out[1]).toEqual({
      id: "b", start: 10, end: 12, text: "hello",
      createdAt: "2026-11-24T10:00:00.000Z", updatedAt: "2026-11-24T10:00:00.000Z"
    });
    expect(input.text).toBe("  hello  ");
    expect(notes).toEqual([note("a", 0, 4)]);
    expect(out).not.toBe(notes);
  });

  it("returns empty-note and range-invalid without appending", () => {
    const notes = [note("a", 0, 4)];
    expect(addNote(notes, note("b", 10, 12, "   "))).toEqual({ notes, error: "empty-note" });
    expect(addNote(notes, note("b", 12, 10, "x"))).toEqual({ notes, error: "range-invalid" });
  });

  it("returns overlap and the unchanged array for an intersecting range", () => {
    const notes = [note("a", 0, 4)];
    const result = addNote(notes, note("b", 3, 8, "x"));
    expect(result.error).toBe("overlap");
    expect(result.notes).toBe(notes);
  });
});

describe("updateNote", () => {
  const created = {
    id: "a", start: 0, end: 4, text: "old",
    createdAt: "2026-11-01T00:00:00.000Z", updatedAt: "2026-11-01T00:00:00.000Z"
  };

  it("changes only the text and updatedAt, preserving the anchor", () => {
    const notes = [created, note("b", 10, 12)];
    const { notes: out, error } = updateNote(notes, "a", { text: "  new  " }, "2026-11-24T12:00:00.000Z");
    expect(error).toBeNull();
    expect(out[0]).toEqual({ ...created, text: "new", updatedAt: "2026-11-24T12:00:00.000Z" });
    expect(out[1]).toBe(notes[1]);
    expect(notes[0]).toBe(created);
    expect(created.text).toBe("old");
  });

  it("returns empty-note for blank text and note-not-found for an unknown id", () => {
    const notes = [created];
    expect(updateNote(notes, "a", { text: "  " }, "x")).toEqual({ notes, error: "empty-note" });
    expect(updateNote(notes, "zzz", { text: "new" }, "x")).toEqual({ notes, error: "note-not-found" });
  });

  it("returns overlap when an imported file already has an intersecting note", () => {
    const notes = [created, note("b", 2, 8)];
    expect(updateNote(notes, "a", { text: "new" }, "x").error).toBe("overlap");
  });
});

describe("removeNote", () => {
  it("removes the note, keeps the others deep-equal and mutates nothing", () => {
    const notes = [note("a", 0, 4), note("b", 10, 12)];
    const out = removeNote(notes, "a");
    expect(out.map((n) => n.id)).toEqual(["b"]);
    expect(out[0]).toBe(notes[1]);
    expect(notes.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("is idempotent for an unknown id", () => {
    const notes = [note("a", 0, 4)];
    expect(removeNote(notes, "zzz")).toEqual(notes);
    expect(removeNote(undefined, "a")).toEqual([]);
  });
});

describe("cleanDictation", () => {
  it("removes fillers, the phrase you know and one repeated word", () => {
    expect(cleanDictation("um I I think you know this works")).toBe("I think this works");
  });

  it("leaves an already-clean string unchanged", () => {
    expect(cleanDictation("I think this works")).toBe("I think this works");
  });

  it("matches fillers case-insensitively and only as whole words", () => {
    expect(cleanDictation("UH this Um works")).toBe("this works");
    expect(cleanDictation("You Know the album is here")).toBe("the album is here");
    expect(cleanDictation("album umbrella")).toBe("album umbrella");
  });

  it("collapses whitespace and is idempotent", () => {
    const once = cleanDictation("  the   the   meeting   was   fine  ");
    expect(once).toBe("the meeting was fine");
    expect(cleanDictation(once)).toBe(once);
  });
});

describe("mergeImportedNotes", () => {
  it("lets the file win a shared id and keeps stored notes it omits", () => {
    const stored = [note("a", 0, 4, "stored"), note("b", 10, 12)];
    const imported = [note("a", 0, 4, "file"), note("c", 20, 24)];
    const out = mergeImportedNotes(stored, imported);
    expect(out.map((n) => n.id)).toEqual(["a", "c", "b"]);
    expect(out[0].text).toBe("file");
    expect(stored[0].text).toBe("stored");
    expect(mergeImportedNotes(stored, imported)).toEqual(out);
  });

  it("keeps imported overlaps rather than validating content away", () => {
    const out = mergeImportedNotes([], [note("a", 0, 6), note("b", 4, 8)]);
    expect(out.map((n) => n.id)).toEqual(["a", "b"]);
  });

  it("ignores entries without an id and tolerates non-arrays", () => {
    expect(mergeImportedNotes(undefined, [{ start: 0, end: 1 }])).toEqual([]);
    expect(mergeImportedNotes("nope", null)).toEqual([]);
  });
});

describe("mergeImportedWeeks carries notes", () => {
  it("merges notes by id for a week both sides have", () => {
    const stored = { "2026-11-23": { cells: { "0-0": "sleep" }, notes: [note("a", 0, 4, "stored"), note("b", 10, 12)] } };
    const imported = { "2026-11-23": { cells: { "0-1": "work" }, notes: [note("a", 0, 4, "file"), note("c", 20, 24)] } };
    const out = mergeImportedWeeks(stored, imported);
    expect(out["2026-11-23"].cells).toEqual({ "0-0": "sleep", "0-1": "work" });
    expect(out["2026-11-23"].notes.map((n) => n.id)).toEqual(["a", "c", "b"]);
    expect(out["2026-11-23"].notes[0].text).toBe("file");
  });

  it("imports notes from a week whose file has no cells", () => {
    const out = mergeImportedWeeks({}, { "2026-11-30": { cells: {}, notes: [note("a", 0, 4)] } });
    expect(out["2026-11-30"].notes.map((n) => n.id)).toEqual(["a"]);
  });

  it("keeps a stored week's notes when the file omits that week", () => {
    const stored = { "2026-11-23": { cells: {}, notes: [note("a", 0, 4)] } };
    const out = mergeImportedWeeks(stored, { "2026-11-30": { cells: {} } });
    expect(out["2026-11-23"].notes).toEqual(stored["2026-11-23"].notes);
  });

  it("imports a v4/v5 file with no notes without adding a notes field", () => {
    const out = mergeImportedWeeks({}, { "2026-11-30": { cells: { "0-0": "sleep" } } });
    expect("notes" in out["2026-11-30"]).toBe(false);
  });

  it("is idempotent and mutates neither argument", () => {
    const stored = { "2026-11-23": { cells: {}, notes: [note("a", 0, 4)] } };
    const imported = { "2026-11-23": { cells: {}, notes: [note("b", 6, 8)] } };
    const once = mergeImportedWeeks(stored, imported);
    expect(mergeImportedWeeks(once, imported)).toEqual(once);
    expect(stored["2026-11-23"].notes.map((n) => n.id)).toEqual(["a"]);
    expect(imported["2026-11-23"].notes.map((n) => n.id)).toEqual(["b"]);
  });
});

describe("source guarantees for the note data and the export", () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

  it("the note writer stores no taskId, no audio and no key field", () => {
    const src = read("../../src/lib/notes.js");
    expect(src).not.toMatch(/taskId\s*:/);
    expect(src).not.toMatch(/\baudio\s*:/);
    expect(src).not.toMatch(/apiKey|aiKey|keys\s*:/);
  });

  it("the export envelope stays at version 6 and has no key or secure field", () => {
    const src = read("../../src/components/DataTab.jsx");
    const payload = src.split("\n").find((l) => l.includes("const payload ="));
    expect(payload).toMatch(/version:\s*6\b/);
    expect(payload).toMatch(/\bweeks\b/);
    expect(payload).not.toMatch(/aiKeys|\bsecure\b|providerKey/);
  });

  it("clear this week spreads the week and clears only cells", () => {
    const src = read("../../src/components/WeekTab.jsx");
    expect(src).toMatch(/\{\s*\.\.\.(?:wk|week)\s*,\s*cells:\s*\{\}\s*\}/);
  });

  it("dictation never persists audio and adds RECORD_AUDIO as the only new permission", () => {
    const src = read("../../src/lib/dictation.js");
    expect(src).not.toMatch(/createObjectURL|new Blob|data:audio|\[data:|FileWriter|writeFile/);
    const manifest = read("../../android/app/src/main/AndroidManifest.xml");
    const perms = [...manifest.matchAll(/<uses-permission\s+android:name="([^"]+)"/g)].map((m) => m[1]);
    expect(perms).toContain("android.permission.RECORD_AUDIO");
    expect(new Set(perms)).toEqual(new Set([
      "android.permission.INTERNET",
      "android.permission.POST_NOTIFICATIONS",
      "android.permission.SCHEDULE_EXACT_ALARM",
      "android.permission.USE_EXACT_ALARM",
      "android.permission.RECORD_AUDIO"
    ]));
  });

  it("registers the Dictation plugin before super.onCreate()", () => {
    const src = read("../../android/app/src/main/java/com/carlos/ambitions/MainActivity.java");
    const create = src.slice(src.indexOf("public void onCreate"));
    expect(create.indexOf("registerPlugin(DictationPlugin.class)")).toBeGreaterThan(-1);
    expect(create.indexOf("registerPlugin(DictationPlugin.class)")).toBeLessThan(create.lastIndexOf("super.onCreate"));
  });
});

describe("source guarantees for the week note UI", () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");
  const week = read("../../src/components/WeekTab.jsx");

  it("selects the same-category run and resolves an existing note before opening an editor", () => {
    expect(week).toMatch(/categoryRunAt\(weekCells, tasks, index\)/);
    expect(week).toMatch(/noteAt\(weekNotes, index\)/);
    expect(week).toMatch(/canPlaceNote\(weekNotes, run\.start, run\.end\)/);
    expect(week).toMatch(/addNote\(weekNotes/);
    expect(week).toMatch(/updateNote\(weekNotes/);
    expect(week).toMatch(/removeNote\(weekNotes/);
  });

  it("uses the user's hold time and never starts a note gesture while a brush is active", () => {
    expect(week).toMatch(/settings\.longPressMs/);
    expect(week).toMatch(/setTimeout\(/);
    expect(week).toMatch(/if \(brush != null \|\| noteDlg\) return;/);
  });

  it("keeps the grid from scrolling under the finger and marks the range start", () => {
    expect(week).toMatch(/touchAction:\s*"none"/);
    expect(week).toMatch(/preventDefault\(\)/);
    expect(week).toMatch(/noteStarts\.has\(globalIndex\)/);
  });

  it("cleans the transcript before the field and gates polish on the AI setting", () => {
    expect(week).toMatch(/cleanDictation\(/);
    expect(week).toMatch(/polishText\(/);
    expect(week).toMatch(/aiEnabled &&/);
    expect(week).toMatch(/notes: next/);
  });

  it("passes settings and the AI context from the app into the week tab", () => {
    const app = read("../../src/App.jsx");
    const line = app.split("\n").find((l) => l.includes("<WeekTab"));
    expect(line).toMatch(/settings=\{store\.settings\}/);
    expect(line).toMatch(/ai=\{ai\}/);
    expect(line).toMatch(/aiEnabled=\{aiEnabled\}/);
  });
});

describe("source guarantees for the hold-time setting", () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), "utf8");

  it("renders a settings row that changes the hold time in clamped 500 ms steps", () => {
    const settings = read("../../src/components/SettingsTab.jsx");
    expect(settings).toMatch(/clampLongPressMs/);
    expect(settings).toMatch(/LONG_PRESS_MIN/);
    expect(settings).toMatch(/LONG_PRESS_MAX/);
    expect(settings).toMatch(/LONG_PRESS_STEP/);
    expect(settings).toMatch(/longPressMs/);
  });

  it("uses the same clamp in the grid gesture as the settings row", () => {
    const week = read("../../src/components/WeekTab.jsx");
    expect(week).toMatch(/clampLongPressMs\(settings && settings\.longPressMs\)/);
  });
});
