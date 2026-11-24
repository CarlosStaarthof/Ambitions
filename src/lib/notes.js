// Block notes live inside the existing `weeks` value — one optional `notes` array
// next to `cells` — so they ride the one backup that already exists. A note is
// anchored to a half-hour range, never to a task id: the week grid is the record of
// the time, so renaming, repainting or retiring a task must not move or delete it.
//
// Everything here is pure. No React, no DOM, no storage and no clock: `at` is always
// supplied by the caller, which is what makes the run/overlap rules testable without
// a device.

export const WEEK_CELLS = 336;
export const SLOTS_PER_DAY = 48;

const cellKey = (day, slot) => `${day}-${slot}`;

export const notesOf = (week) => (week && Array.isArray(week.notes) ? week.notes : []);

function taskIndex(tasks) {
  const map = new Map();
  for (const t of Array.isArray(tasks) ? tasks : []) {
    if (t && t.id != null && !map.has(t.id)) map.set(t.id, t);
  }
  return map;
}

// Resolve the maximal run of filled cells whose tasks share the category of the task
// at `index`, bounded to that cell's day. The run stops at an empty cell, a different
// category, an unresolvable task, or the day's edge, so a note never crosses midnight.
export function categoryRunAt(cells, tasks, index) {
  if (!Number.isInteger(index) || index < 0 || index >= WEEK_CELLS) return null;
  const grid = cells && typeof cells === "object" ? cells : {};
  const byId = taskIndex(tasks);
  const day = Math.floor(index / SLOTS_PER_DAY);
  const slot = index % SLOTS_PER_DAY;

  const taskAt = (s) => {
    const id = grid[cellKey(day, s)];
    return id ? byId.get(id) : undefined;
  };

  const origin = taskAt(slot);
  if (!origin || origin.categoryId == null) return null;
  const categoryId = origin.categoryId;
  const sameCategory = (s) => {
    const t = taskAt(s);
    return !!t && t.categoryId === categoryId;
  };

  let lo = slot;
  let hi = slot;
  while (lo > 0 && sameCategory(lo - 1)) lo -= 1;
  while (hi < SLOTS_PER_DAY - 1 && sameCategory(hi + 1)) hi += 1;

  return { start: day * SLOTS_PER_DAY + lo, end: day * SLOTS_PER_DAY + hi + 1 };
}

export function noteAt(notes, index) {
  for (const note of Array.isArray(notes) ? notes : []) {
    if (note && note.start <= index && index < note.end) return note;
  }
  return null;
}

export function canPlaceNote(notes, start, end, ignoreId) {
  return (Array.isArray(notes) ? notes : []).every(
    (n) => !n || n.id === ignoreId || n.end <= start || n.start >= end
  );
}

const validRange = (start, end) =>
  Number.isInteger(start) && Number.isInteger(end) && start >= 0 && end <= WEEK_CELLS && start < end;

export function validateNote(note) {
  if (!note || !validRange(note.start, note.end)) return "range-invalid";
  if (typeof note.text !== "string" || !note.text.trim()) return "empty-note";
  return null;
}

export function addNote(notes, note) {
  const list = Array.isArray(notes) ? notes : [];
  const error = validateNote(note);
  if (error) return { notes: list, error };
  if (!canPlaceNote(list, note.start, note.end, null)) return { notes: list, error: "overlap" };

  const at = note.at !== undefined ? note.at : note.createdAt;
  const stored = {
    id: note.id,
    start: note.start,
    end: note.end,
    text: note.text.trim(),
    createdAt: at,
    updatedAt: at
  };
  return { notes: [...list, stored], error: null };
}

export function updateNote(notes, id, patch, at) {
  const list = Array.isArray(notes) ? notes : [];
  const current = list.find((n) => n && n.id === id);
  if (!current) return { notes: list, error: "note-not-found" };

  const text = patch && typeof patch.text === "string" ? patch.text.trim() : "";
  if (!text) return { notes: list, error: "empty-note" };
  if (!canPlaceNote(list, current.start, current.end, id)) return { notes: list, error: "overlap" };

  const next = list.map((n) => (n && n.id === id ? { ...n, text, updatedAt: at } : n));
  return { notes: next, error: null };
}

export function removeNote(notes, id) {
  return (Array.isArray(notes) ? notes : []).filter((n) => !n || n.id !== id);
}

// Pure, non-AI cleanup of a phone transcript: drop the fillers "uh", "um" and the
// phrase "you know", reduce an immediately repeated word to its first occurrence,
// collapse whitespace and trim. Deliberately idempotent so a second pass is a no-op.
export function cleanDictation(text) {
  if (typeof text !== "string") return "";
  let out = text.replace(/\b(?:uh|um)\b/gi, " ");
  out = out.replace(/\byou\s+know\b/gi, " ");
  out = out.replace(/\s+/g, " ").trim();
  out = out.replace(/\b([A-Za-z]+)(?:\s+\1\b)+/gi, "$1");
  out = out.replace(/\s+/g, " ").trim();
  return out;
}

// Import mirrors the task/category merges: the file wins a shared id, every stored
// note the file omits survives, and entries are never validated away — a backup must
// not silently lose content just because an old file had an overlap.
export function mergeImportedNotes(stored, imported) {
  const asList = (v) => (Array.isArray(v) ? v.filter((n) => n && n.id != null) : []);
  const first = asList(imported);
  const have = new Set(first.map((n) => n.id));
  return [...first, ...asList(stored).filter((n) => !have.has(n.id))];
}
