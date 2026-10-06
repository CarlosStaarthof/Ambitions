import { codeFor } from "./time";

// Retirement, not deletion. `weeks` is the one stored key with no migration, no undo
// and no backup beyond a JSON export the user may never have taken, so removing a task
// must not read, write or rewrite it. A removed task stays in `tasks` carrying
// `retired: true`, vanishes from every list, picker and count, and keeps resolving for
// the cells it already occupies — so a recorded week stays a record of what was
// actually done, with the real name and colour, forever.
//
// Every function here is a pure transform of its arguments. `retiredAt` is always
// supplied by the caller and never read from the clock, which is what makes the whole
// retire/restore cycle unit-testable.

// zinc-600. A cell whose id resolves to no task at all paints this, so the damage an
// earlier re-seed already did is visible instead of looking like empty time.
export const UNKNOWN_COLOR = "#52525b";
export const UNKNOWN_NAME = "Unknown task";
export const UNKNOWN_CODE = "?";

// Absence of the flag means active: no task on any existing install is retired, which
// is why this feature needs no migration and no backfill.
export const isRetired = (entity) => !!entity && entity.retired === true;

export const activeTasks = (tasks) => (Array.isArray(tasks) ? tasks.filter((t) => !isRetired(t)) : []);
export const activeCategories = (categories) => (Array.isArray(categories) ? categories.filter((c) => !isRetired(c)) : []);

// Newest first, so an accidental delete is the top row of the Retired section and is
// two taps from being undone. ISO strings sort lexicographically, which is why
// `retiredAt` is stored verbatim as one. Anything retired without a timestamp (a
// hand-edited import) sorts last, keeping its original relative order.
export function retiredTasks(tasks) {
  const rows = (Array.isArray(tasks) ? tasks : []).filter(isRetired).map((t, i) => ({ t, i }));
  rows.sort((a, b) => {
    const x = a.t.retiredAt, y = b.t.retiredAt;
    if (x && y) return x < y ? 1 : x > y ? -1 : a.i - b.i;
    if (x) return -1;
    if (y) return 1;
    return a.i - b.i;
  });
  return rows.map((r) => r.t);
}

// Removes nothing and touches no other task. Same length in, same length out.
export function retireTask(tasks, id, at) {
  return (Array.isArray(tasks) ? tasks : []).map((t) => (t.id === id ? { ...t, retired: true, retiredAt: at } : t));
}

// Retiring a category retires its tasks with the same timestamp, so they come back as
// one group in the Retired list. Nothing is removed from either array.
export function retireCategory(tasks, categories, categoryId, at) {
  return {
    tasks: (Array.isArray(tasks) ? tasks : []).map((t) => (t.categoryId === categoryId ? { ...t, retired: true, retiredAt: at } : t)),
    categories: (Array.isArray(categories) ? categories : []).map((c) => (c.id === categoryId ? { ...c, retired: true } : c))
  };
}

// The flags are deleted rather than set to false, so a restored task is byte-identical
// to its pre-deletion shape and no "was retired once" residue accumulates. The task
// keeps its original id, so every cell it ever held — none of which were touched —
// simply keeps resolving. Its own category is un-retired too: restoring into a hidden
// container would be the same silent failure this feature exists to kill.
export function restoreTask(tasks, categories, id) {
  const list = Array.isArray(tasks) ? tasks : [];
  const cats = Array.isArray(categories) ? categories : [];
  const target = list.find((t) => t.id === id);
  if (!target) return { tasks: list, categories: cats };
  const nextTasks = list.map((t) => {
    if (t.id !== id) return t;
    const { retired, retiredAt, ...rest } = t;
    return rest;
  });
  const nextCategories = cats.map((c) => {
    if (c.id !== target.categoryId || !isRetired(c)) return c;
    const { retired, ...rest } = c;
    return rest;
  });
  return { tasks: nextTasks, categories: nextCategories };
}

// Built from ALL tasks, retired included — the grid must still resolve a retired task.
// First entry wins for a duplicated id so a duplicate can never double-count a cell.
export function taskIndex(tasks) {
  const index = new Map();
  for (const t of Array.isArray(tasks) ? tasks : []) {
    if (t && t.id != null && !index.has(t.id)) index.set(t.id, t);
  }
  return index;
}

// One place decides what a cell is: nothing, a task, or a scheduled half hour whose
// task cannot be named. Components hold no resolution logic of their own, which is the
// only reason the rendering rules are provable without a device.
export function resolveCell(id, index) {
  if (!id) return { kind: "empty", name: "", color: null, code: "" };
  const t = index && typeof index.get === "function" ? index.get(id) : undefined;
  if (!t) return { kind: "unknown", name: UNKNOWN_NAME, color: UNKNOWN_COLOR, code: UNKNOWN_CODE };
  return { kind: "task", name: t.name, color: t.color, code: codeFor(t.name || "") };
}
