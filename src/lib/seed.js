export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const SLOTS = 48;                 // 30-min slots, 00:00–23:30
export const CELLS = DAYS.length * SLOTS; // 336
export const PALETTE = ["#6366f1", "#0ea5e9", "#14b8a6", "#22c55e", "#84cc16", "#eab308", "#f97316", "#ef4444", "#ec4899", "#a855f7", "#64748b", "#0891b2"];
export const MONTHS = Array.from({ length: 12 }, (_, i) => ({ v: i + 1, label: new Date(2000, i, 1).toLocaleDateString(undefined, { month: "long" }) }));

// Categories group tasks. `protected: true` marks the Ambition track — the
// highest-priority, protect-and-grow bucket. Ambition is always kept first and
// is not deletable. Everything else is ordinary life, split into as many
// categories as the user wants (no priority ordering beyond "ambition first").
export const AMBITION_ID = "ambition";

export const SEED_CATEGORIES = [
  { id: AMBITION_ID, name: "Ambition", protected: true },
  { id: "sleep", name: "Sleep", protected: false },
  { id: "work", name: "Work", protected: false },
  { id: "health", name: "Health", protected: false },
  { id: "meals", name: "Meals", protected: false }
];

export const SEED_TASKS = [
  { id: "t1", name: "Sleep", categoryId: "sleep", color: "#6366f1", target: 56 },
  { id: "t2", name: "Work 1", categoryId: "work", color: "#0ea5e9", target: 40 },
  { id: "t3", name: "Work 2", categoryId: "work", color: "#14b8a6", target: null },
  { id: "t4", name: "GYM", categoryId: "health", color: "#22c55e", target: 5 },
  { id: "t5", name: "Meals", categoryId: "meals", color: "#f97316", target: 14 },
  { id: "t6", name: "Language", categoryId: AMBITION_ID, color: "#eab308", target: 5 },
  { id: "t7", name: "Reading", categoryId: AMBITION_ID, color: "#ec4899", target: 3 },
  { id: "t8", name: "Side project", categoryId: AMBITION_ID, color: "#a855f7", target: 4 }
];

export const SEED_QUESTIONS = [
  { id: "g2", text: "What do I want to do that I don't do now?" },
  { id: "g3", text: "What do I do that I like doing?" },
  { id: "g4", text: "What topics do I want to learn?" },
  { id: "g5", text: "What do I consider a big achievement?" },
  { id: "g6", text: "What is freedom for me?" },
  { id: "g7", text: "What image do I have of myself being successful today on average?" },
  { id: "g8", text: "Where do I want to live?" }
];

// Bring any tasks/categories (V1 data, an import, or already-current data) up to
// the current shape. Idempotent, so it's safe to run on every load and on import:
// - migrates legacy task.category ("basic"|"ambition") -> task.categoryId
// - guarantees an Ambition category exists and sits first
// - re-homes any task whose category is missing into a "Basic" catch-all
export function normalizeModel(tasks, categories) {
  tasks = Array.isArray(tasks) ? tasks.slice() : [];
  categories = Array.isArray(categories) ? categories.slice() : [];

  let needBasic = false;
  tasks = tasks.map((t) => {
    if (t.categoryId !== undefined) return t;
    const cid = t.category === "ambition" ? AMBITION_ID : "basic";
    if (cid === "basic") needBasic = true;
    const { category, ...rest } = t; // drop the legacy field
    return { ...rest, categoryId: cid };
  });

  if (!categories.length) {
    categories = [{ id: AMBITION_ID, name: "Ambition", protected: true }];
    if (needBasic) categories.push({ id: "basic", name: "Basic", protected: false });
  }
  if (!categories.some((c) => c.id === AMBITION_ID)) categories.unshift({ id: AMBITION_ID, name: "Ambition", protected: true });
  categories = [categories.find((c) => c.id === AMBITION_ID), ...categories.filter((c) => c.id !== AMBITION_ID)];

  const ids = new Set(categories.map((c) => c.id));
  if (tasks.some((t) => !ids.has(t.categoryId))) {
    if (!ids.has("basic")) categories.push({ id: "basic", name: "Basic", protected: false });
    tasks = tasks.map((t) => (ids.has(t.categoryId) || t.categoryId === "basic" ? t : { ...t, categoryId: "basic" }));
  }

  return { tasks, categories };
}
