import { nextColor } from "./time";

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
    if (createdAt) item.createdAt = createdAt;
    if (updatedAt) item.updatedAt = updatedAt;
    if (doneAt) item.doneAt = doneAt;
    items.push(item);
    seenItems.add(it.id);
  }

  if (needUncategorized && !categoryIds.has(UNCATEGORIZED_ID)) {
    categories.push({ id: UNCATEGORIZED_ID, name: "Uncategorized", color: UNCATEGORIZED_COLOR });
  }

  return { categories, items };
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

export function addReminder(wall, { id, categoryId, text, at } = {}) {
  const w = cloneWall(wall);
  const clean = trimmed(text);
  if (!clean) return { wall: w, error: "text-empty" };
  if (!w.categories.some((c) => c.id === categoryId)) return { wall: w, error: "category-missing" };

  const item = { id, categoryId, text: clean, createdAt: at, updatedAt: at };
  return { wall: { categories: w.categories, items: [...w.items, item] }, error: undefined };
}

export function editReminder(wall, id, { categoryId, text, at } = {}) {
  const w = cloneWall(wall);
  const index = w.items.findIndex((it) => it.id === id);
  if (index === -1) return { wall: w, error: "reminder-not-found" };
  if (w.items[index].doneAt) return { wall: w, error: "reminder-archived" };

  const clean = trimmed(text);
  if (!clean) return { wall: w, error: "text-empty" };
  if (!w.categories.some((c) => c.id === categoryId)) return { wall: w, error: "category-missing" };

  w.items[index] = { ...w.items[index], categoryId, text: clean, updatedAt: at };
  return { wall: { categories: w.categories, items: w.items }, error: undefined };
}

export function markDone(wall, id, at) {
  const w = cloneWall(wall);
  const index = w.items.findIndex((it) => it.id === id);
  if (index === -1) return { wall: w, error: "reminder-not-found" };
  if (w.items[index].doneAt) return { wall: w, error: undefined };

  w.items[index] = { ...w.items[index], doneAt: at, updatedAt: at };
  return { wall: { categories: w.categories, items: w.items }, error: undefined };
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
