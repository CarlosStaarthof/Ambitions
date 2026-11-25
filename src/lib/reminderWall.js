import { nextColor, normalizeOptionalClock } from "./time";

// The wall is its own small store. It is deliberately not the time-block
// `categories` and not `tasks`: a post-it is captured context, not a calendar
// commitment. Everything here is pure — no React, no DOM, no storage.
export const UNCATEGORIZED_ID = "uncategorized";
export const UNCATEGORIZED_COLOR = "#64748b";

const isObject = (v) => !!v && typeof v === "object" && !Array.isArray(v);
const trimmed = (v) => (typeof v === "string" ? v.trim() : "");
const nonEmptyString = (v) => (typeof v === "string" && v.length > 0 ? v : null);

export function emptyReminderWall() {
  return { categories: [], items: [] };
}

// Newest first, stable for equal timestamps. ISO strings compare correctly as text.
const newest = (a, b) => {
  const x = a || "";
  const y = b || "";
  return x < y ? 1 : x > y ? -1 : 0;
};

function asRawWall(value) {
  const v = isObject(value) ? value : {};
  return {
    categories: Array.isArray(v.categories) ? v.categories : [],
    items: Array.isArray(v.items) ? v.items : []
  };
}

// A defensive copy so no operation can mutate the wall it was handed.
function cloneWall(wall) {
  const { categories, items } = asRawWall(wall);
  return {
    categories: categories.map((c) => ({ ...c })),
    items: items.map((it) => ({ ...it }))
  };
}

// Drops malformed entries, trims names and text, and guarantees every reminder
// belongs to a category in this same wall. Items whose category is missing are
// moved to one `uncategorized` category, created only when it is needed.
// Idempotent and non-mutating.
export function normalizeReminderWall(value) {
  const { categories: rawCategories, items: rawItems } = asRawWall(value);

  const categories = [];
  const seenCategories = new Set();
  for (const c of rawCategories) {
    if (!isObject(c) || c.id == null || c.id === "") continue;
    if (seenCategories.has(c.id)) continue;
    const name = trimmed(c.name);
    if (!name) continue;
    seenCategories.add(c.id);
    categories.push({ id: c.id, name, color: nonEmptyString(c.color) });
  }

  // Any category that arrived without a usable colour gets the first free
  // palette colour, so a rename or a later load can never repaint it.
  for (const c of categories) {
    if (c.color) continue;
    c.color = c.id === UNCATEGORIZED_ID
      ? UNCATEGORIZED_COLOR
      : nextColor(categories.map((x) => x.color).filter(Boolean));
  }

  const categoryIds = new Set(categories.map((c) => c.id));
  const items = [];
  const seenItems = new Set();
  let needUncategorized = false;

  for (const it of rawItems) {
    if (!isObject(it) || it.id == null || it.id === "") continue;
    if (seenItems.has(it.id)) continue;
    const text = trimmed(it.text);
    if (!text) continue;
    let categoryId = it.categoryId;
    if (!categoryIds.has(categoryId)) {
      categoryId = UNCATEGORIZED_ID;
      needUncategorized = true;
    }
    const item = { id: it.id, categoryId, text };
    const createdAt = nonEmptyString(it.createdAt);
    const updatedAt = nonEmptyString(it.updatedAt);
    const doneAt = nonEmptyString(it.doneAt);
    const startTime = normalizeOptionalClock(it.startTime);
    const endTime = normalizeOptionalClock(it.endTime);
    if (createdAt) item.createdAt = createdAt;
    if (updatedAt) item.updatedAt = updatedAt;
    if (doneAt) item.doneAt = doneAt;
    if (startTime) item.startTime = startTime;
    if (endTime) item.endTime = endTime;
    items.push(item);
    seenItems.add(it.id);
  }

  if (needUncategorized && !categoryIds.has(UNCATEGORIZED_ID)) {
    categories.push({ id: UNCATEGORIZED_ID, name: "Uncategorized", color: UNCATEGORIZED_COLOR });
  }

  return { categories, items };
}

// The local calendar day an item was first captured, as YYYY-MM-DD, or null when
// the stored value is missing or unparseable. Items written before the wall stored
// timestamps simply have none — nothing is backfilled on load.
export function createdDate(iso) {
  if (typeof iso !== "string" || !iso.trim()) return null;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return null;
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export function activeReminders(items) {
  return (Array.isArray(items) ? items : [])
    .filter((it) => it && !it.doneAt)
    .sort((a, b) => newest(a.createdAt, b.createdAt));
}

export function archivedReminders(items) {
  return (Array.isArray(items) ? items : [])
    .filter((it) => it && it.doneAt)
    .sort((a, b) => newest(a.doneAt, b.doneAt));
}

// Shapes the To-Do's Chart in one place so the component only renders. Open items
// keep their category's wall order and newest-first order within a group; an item
// whose category is missing still lands in a read-only Uncategorized group, so no
// captured commitment can be invisible on the board. Empty groups are dropped.
export function chartGroups(wall) {
  const w = asRawWall(wall);
  const open = activeReminders(w.items);
  const groups = w.categories
    .map((category) => ({ category, items: open.filter((it) => it.categoryId === category.id) }))
    .filter((g) => g.items.length > 0);

  const known = new Set(w.categories.map((c) => c.id));
  const orphans = open.filter((it) => !known.has(it.categoryId));
  if (orphans.length > 0) {
    groups.push({
      category: { id: UNCATEGORIZED_ID, name: "Uncategorized", color: UNCATEGORIZED_COLOR },
      items: orphans
    });
  }
  return groups;
}

// The two numbers the board leads with, plus the share already done so the header
// can show progress without the component recomputing. An empty wall is 0%, never
// NaN, because the bar is rendered from this value directly.
export function chartSummary(wall) {
  const { items } = asRawWall(wall);
  const open = activeReminders(items).length;
  const done = archivedReminders(items).length;
  const total = open + done;
  return { open, done, total, donePercent: total === 0 ? 0 : Math.round((done / total) * 100) };
}

export function categoryUsage(wall, categoryId) {
  const { items } = asRawWall(wall);
  return items.filter((it) => it && it.categoryId === categoryId).length;
}

export function addCategory(wall, { id, name } = {}) {
  const w = cloneWall(wall);
  const clean = trimmed(name);
  if (!clean) return { wall: w, error: "name-empty" };
  const lower = clean.toLowerCase();
  if (w.categories.some((c) => trimmed(c.name).toLowerCase() === lower)) {
    return { wall: w, error: "name-duplicate" };
  }
  const color = nextColor(w.categories.map((c) => c.color).filter(Boolean));
  return {
    wall: { categories: [...w.categories, { id, name: clean, color }], items: w.items },
    error: undefined
  };
}

export function renameCategory(wall, id, name) {
  const w = cloneWall(wall);
  const index = w.categories.findIndex((c) => c.id === id);
  if (index === -1) return { wall: w, error: "category-missing" };

  const clean = trimmed(name);
  if (!clean) return { wall: w, error: "name-empty" };
  const lower = clean.toLowerCase();
  if (w.categories.some((c) => c.id !== id && trimmed(c.name).toLowerCase() === lower)) {
    return { wall: w, error: "name-duplicate" };
  }

  const current = w.categories[index];
  if (current.name === clean) return { wall: w, error: undefined };

  w.categories[index] = { ...current, name: clean };
  return { wall: w, error: undefined };
}

export function deleteCategory(wall, id) {
  const w = cloneWall(wall);
  const category = w.categories.find((c) => c.id === id);
  if (!category) return { wall: w, error: "category-missing" };

  const used = w.items.some((it) => it.categoryId === id);
  if (id === UNCATEGORIZED_ID && used) return { wall: w, error: "category-not-empty" };

  if (used) {
    if (!w.categories.some((c) => c.id === UNCATEGORIZED_ID)) {
      w.categories.push({ id: UNCATEGORIZED_ID, name: "Uncategorized", color: UNCATEGORIZED_COLOR });
    }
    w.items = w.items.map((it) => (it.categoryId === id ? { ...it, categoryId: UNCATEGORIZED_ID } : it));
  }

  return {
    wall: { categories: w.categories.filter((c) => c.id !== id), items: w.items },
    error: undefined
  };
}

// Times are optional: a blank or malformed one is simply absent, never stored as null.
// Keeping that rule here means every writer — the form, import and load — agrees.
function withTimes(item, startTime, endTime) {
  const start = normalizeOptionalClock(startTime);
  const end = normalizeOptionalClock(endTime);
  if (start) item.startTime = start; else delete item.startTime;
  if (end) item.endTime = end; else delete item.endTime;
  return item;
}

export function addReminder(wall, { id, categoryId, text, at, startTime, endTime } = {}) {
  const w = cloneWall(wall);
  const clean = trimmed(text);
  if (!clean) return { wall: w, error: "text-empty" };
  if (!w.categories.some((c) => c.id === categoryId)) return { wall: w, error: "category-missing" };

  const item = withTimes({ id, categoryId, text: clean, createdAt: at, updatedAt: at }, startTime, endTime);
  return { wall: { categories: w.categories, items: [...w.items, item] }, error: undefined };
}

export function editReminder(wall, id, { categoryId, text, at, startTime, endTime } = {}) {
  const w = cloneWall(wall);
  const index = w.items.findIndex((it) => it.id === id);
  if (index === -1) return { wall: w, error: "reminder-not-found" };
  if (w.items[index].doneAt) return { wall: w, error: "reminder-archived" };

  const clean = trimmed(text);
  if (!clean) return { wall: w, error: "text-empty" };
  if (!w.categories.some((c) => c.id === categoryId)) return { wall: w, error: "category-missing" };

  w.items[index] = withTimes({ ...w.items[index], categoryId, text: clean, updatedAt: at }, startTime, endTime);
  return { wall: { categories: w.categories, items: w.items }, error: undefined };
}

export function hasTodoTime(item) {
  return !!(item && (normalizeOptionalClock(item.startTime) || normalizeOptionalClock(item.endTime)));
}

export function todoTimeLabel(item) {
  const start = normalizeOptionalClock(item && item.startTime);
  const end = normalizeOptionalClock(item && item.endTime);
  if (start && end) return `${start}–${end}`;
  if (start) return `from ${start}`;
  if (end) return `until ${end}`;
  return "";
}

export function markDone(wall, id, at) {
  const w = cloneWall(wall);
  const index = w.items.findIndex((it) => it.id === id);
  if (index === -1) return { wall: w, error: "reminder-not-found" };
  if (w.items[index].doneAt) return { wall: w, error: undefined };

  w.items[index] = { ...w.items[index], doneAt: at, updatedAt: at };
  return { wall: { categories: w.categories, items: w.items }, error: undefined };
}

export const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000;

// The deadline is derived from `doneAt` rather than stored, so it cannot drift
// from the timestamp it is based on. A legacy item with no `doneAt` simply cannot
// be reopened. `now` is passed in so the decision stays pure and testable.
function timeMs(value) {
  if (value instanceof Date) return value.getTime();
  if (typeof value === "string" && value.trim()) return new Date(value).getTime();
  return NaN;
}

export function canUndoReminder(item, now) {
  if (!isObject(item)) return false;
  const doneAtMs = timeMs(item.doneAt);
  const nowMs = timeMs(now);
  if (isNaN(doneAtMs) || isNaN(nowMs)) return false;
  return nowMs - doneAtMs < UNDO_WINDOW_MS;
}

// Reopening restores an item instead of destroying anything, so it is not armed.
// `doneAt` is removed by destructuring — never set to null — so the next
// `markDone` stamps a fresh one and the 24-hour period restarts from that instant.
export function reopenReminder(wall, id, now) {
  const w = cloneWall(wall);
  const index = w.items.findIndex((it) => it.id === id);
  if (index === -1) return { wall: w, error: "reminder-not-found" };

  const item = w.items[index];
  if (!item.doneAt) return { wall: w, error: "not-archived" };
  if (!canUndoReminder(item, now)) return { wall: w, error: "undo-expired" };

  const { doneAt, ...rest } = item;
  w.items[index] = now === undefined ? rest : { ...rest, updatedAt: now };
  return { wall: { categories: w.categories, items: w.items }, error: undefined };
}

// Permanent: the reminder is gone, active or archived. Categories are left
// untouched, including an empty one that losing its last reminder created.
export function deleteReminder(wall, id) {
  const w = cloneWall(wall);
  const index = w.items.findIndex((it) => it.id === id);
  if (index === -1) return { wall: w, error: "reminder-not-found" };

  return {
    wall: { categories: w.categories, items: w.items.filter((_, i) => i !== index) },
    error: undefined
  };
}

// Import is a merge, never a replace: a file that omits the wall (or part of it)
// must not erase what is stored. The file wins a shared id, then the shape is
// repaired. Idempotent and non-mutating.
export function mergeImportedReminderWall(stored, imported) {
  const s = asRawWall(stored);
  const i = asRawWall(imported);
  const categories = mergeById(s.categories, i.categories);
  const items = mergeById(s.items, i.items);
  return normalizeReminderWall({ categories, items });
}

function mergeById(stored, imported) {
  const valid = (x) => isObject(x) && x.id != null && x.id !== "";
  const first = imported.filter(valid);
  const have = new Set(first.map((x) => x.id));
  return [...first, ...stored.filter((x) => valid(x) && !have.has(x.id))];
}
