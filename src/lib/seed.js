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
// Catch-all for one-off tasks created straight from the week grid. It is an
// ordinary (unprotected) category so it counts as Committed time and shows up in
// Balance — the point of a one-off is still being able to look back at it.
export const OPEN_ID = "open";

export const SEED_CATEGORIES = [
  { id: AMBITION_ID, name: "Ambition", protected: true },
  { id: "sleep", name: "Sleep", protected: false },
  { id: "work", name: "Work", protected: false },
  { id: "health", name: "Health", protected: false },
  { id: "meals", name: "Meals", protected: false },
  { id: OPEN_ID, name: "Open", protected: false }
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

// A stored value counts as empty only for the shapes localForage actually hands back
// for "nothing here": absent, an empty array, an empty object, an empty string.
const isEmptyRead = (v) => {
  if (v == null) return true;
  if (typeof v === "string") return v === "";
  if (Array.isArray(v)) return v.length === 0;
  if (typeof v === "object") return Object.keys(v).length === 0;
  return false;
};

// Decide, from the seven reads, whether this is a genuinely fresh install or a store
// that could not be read. A seed marker in `settings` would be useless: its absence is
// no evidence at all, because every existing install lacks it. The test used instead
// needs nothing stored — an install is fresh only when every read succeeded AND every
// value came back empty. In the reported incident `weeks` survived, so this holds.
// A malformed entry is treated as a read failure: refusing to write is the safe
// direction, and the two flags are never both true.
export function loadDecision(reads) {
  const entries = Object.values(reads || {});
  const storageError = !entries.length || entries.some((r) => !r || r.ok !== true);
  return { seed: !storageError && entries.every((r) => isEmptyRead(r.value)), storageError };
}

// Strip `retired` so a structural category can never be hidden. Ambition has no remove
// control at all, and Open's is effectively a no-op because this function re-creates it
// on the next load — leaving either retired would hide a container the app depends on.
const unretired = (c) => {
  if (!c || c.retired === undefined) return c;
  const { retired, ...rest } = c;
  return rest;
};

// Bring any tasks/categories (V1 data, an import, or already-current data) up to
// the current shape. Idempotent, so it's safe to run on every load and on import:
// - migrates legacy task.category ("basic"|"ambition") -> task.categoryId
// - guarantees an Ambition category exists and sits first
// - re-homes any task whose category is missing into a "Basic" catch-all
// It carries `retired` / `retiredAt` through untouched: absence already means active,
// so retirement needs no migration and a load-time pass over the flag would be a
// rewrite with no benefit. Only `ambition` and `open` are force-activated.
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
  categories = [unretired(categories.find((c) => c.id === AMBITION_ID)), ...categories.filter((c) => c.id !== AMBITION_ID)];

  // Guarantee the one-off bucket, and keep it last so it never displaces real categories.
  if (!categories.some((c) => c.id === OPEN_ID)) categories.push({ id: OPEN_ID, name: "Open", protected: false });
  categories = [...categories.filter((c) => c.id !== OPEN_ID), unretired(categories.find((c) => c.id === OPEN_ID))];

  // A retired category is still present in the array, so its tasks keep their own
  // categoryId and are never re-homed into "Basic" — retiring a category with its tasks
  // must not resurrect anything.
  const ids = new Set(categories.map((c) => c.id));
  if (tasks.some((t) => !ids.has(t.categoryId))) {
    if (!ids.has("basic")) categories.push({ id: "basic", name: "Basic", protected: false });
    tasks = tasks.map((t) => (ids.has(t.categoryId) || t.categoryId === "basic" ? t : { ...t, categoryId: "basic" }));
  }

  return { tasks, categories };
}

// One-time backfill for Open tasks created before week-scoping existed. Their week
// is inferred from where they were actually painted; anything never placed adopts
// the given fallback week so it can still be found rather than vanishing.
export function backfillOpenWeeks(tasks, weeks, fallbackWeekKey) {
  if (!Array.isArray(tasks) || !tasks.some((t) => t.categoryId === OPEN_ID && !t.weekKey)) {
    return { tasks, changed: false };
  }
  const firstUse = {};
  for (const wk of Object.keys(weeks || {})) {
    const cells = (weeks[wk] && weeks[wk].cells) || {};
    for (const id of Object.values(cells)) {
      if (!firstUse[id] || wk < firstUse[id]) firstUse[id] = wk;
    }
  }
  const next = tasks.map((t) =>
    t.categoryId === OPEN_ID && !t.weekKey ? { ...t, weekKey: firstUse[t.id] || fallbackWeekKey } : t
  );
  return { tasks: next, changed: true };
}

// Bring a stored `settings` object up to the current shape. Sibling of
// normalizeModel: a settings key added by a later feature has to appear for people
// who already have settings on disk, and a per-source group (`ai`, `reminders`) has
// to be merged one level deeper or adding a second AI field — or a second reminder
// source — would wipe the stored one. Idempotent by construction: merging an
// already-merged object is the same operation again.
//
// `ai.keys` is dropped on the way through. Plaintext keys were written there before
// secure storage existed, and re-persisting a copy would defeat the point of L1.
export function mergeSettings(defaults, stored) {
  const base = defaults || {};
  const s = stored && typeof stored === "object" ? stored : {};
  const out = { ...base, ...s };
  for (const [k, v] of Object.entries(base)) {
    if (!v || typeof v !== "object" || Array.isArray(v)) continue;
    const got = s[k] && typeof s[k] === "object" && !Array.isArray(s[k]) ? s[k] : {};
    out[k] = { ...v, ...got };
    // One more level for group-of-groups keys like `reminders`, so a source the
    // user has switched on survives a later feature adding a second source.
    for (const [sub, subDefault] of Object.entries(v)) {
      if (!subDefault || typeof subDefault !== "object" || Array.isArray(subDefault)) continue;
      const subGot = got[sub] && typeof got[sub] === "object" && !Array.isArray(got[sub]) ? got[sub] : {};
      out[k][sub] = { ...subDefault, ...subGot };
    }
  }
  if (out.ai && "keys" in out.ai) { out.ai = { ...out.ai }; delete out.ai.keys; }
  return out;
}
