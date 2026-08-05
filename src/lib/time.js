import { SLOTS, CELLS, PALETTE } from "./seed";

export const pad = (n) => String(n).padStart(2, "0");
export const uid = () => Math.random().toString(36).slice(2) + Date.now().toString(36);

export const slotLabel = (s) => `${pad(Math.floor(s / 2))}:${s % 2 ? "30" : "00"}`;
export const endLabel = (s) => (s >= SLOTS ? "24:00" : slotLabel(s));

export const codeFor = (name) => {
  const clean = name.replace(/[^A-Za-z0-9 ]/g, "").trim();
  const words = clean.split(/\s+/).filter(Boolean);
  if (words.length > 1) return words.map((w) => w[0]).join("").slice(0, 3).toUpperCase();
  return clean.slice(0, 3).toUpperCase();
};

export function mondayOf(d) { const x = new Date(d); const day = x.getDay(); x.setDate(x.getDate() + (day === 0 ? -6 : 1 - day)); x.setHours(0, 0, 0, 0); return x; }
export function addDays(d, n) { const x = new Date(d); x.setDate(x.getDate() + n); return x; }
export const isoDate = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const monthKeyOf = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
export const monthLabelOf = (d) => d.toLocaleDateString(undefined, { month: "long", year: "numeric" });
export const labelFromKey = (k) => { const [y, m] = k.split("-").map(Number); return monthLabelOf(new Date(y, m - 1, 1)); };

export function mergeDay(cells, dayIdx) {
  const blocks = []; let cur = null, start = 0;
  for (let s = 0; s <= SLOTS; s++) {
    const t = s < SLOTS ? cells[`${dayIdx}-${s}`] || null : null;
    if (t !== cur) { if (cur !== null) blocks.push({ taskId: cur, start, end: s }); cur = t; start = s; }
  }
  return blocks;
}

export function weekStatsOf(weekCells, tasks, categories = []) {
  const counts = {}; Object.values(weekCells).forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
  const hoursOf = (id) => (counts[id] || 0) * 0.5;
  const protectedIds = new Set(categories.filter((c) => c.protected).map((c) => c.id));
  const ambitionH = tasks.filter((t) => protectedIds.has(t.categoryId)).reduce((a, t) => a + hoursOf(t.id), 0);
  const committedH = tasks.filter((t) => !protectedIds.has(t.categoryId)).reduce((a, t) => a + hoursOf(t.id), 0);
  const filled = Object.keys(weekCells).length;
  const freeH = (CELLS - filled) * 0.5;
  const byCategory = {};
  categories.forEach((c) => { byCategory[c.id] = tasks.filter((t) => t.categoryId === c.id).reduce((a, t) => a + hoursOf(t.id), 0); });
  return { counts, hoursOf, ambitionH, committedH, freeH, filled, byCategory, protectedIds };
}

// Pick a color not already used by an existing task. Falls back to a random,
// pleasant mid-range color once the fixed palette is exhausted.
export function nextColor(used) {
  const taken = new Set(used);
  for (const c of PALETTE) if (!taken.has(c)) return c;
  const chan = () => (60 + Math.floor(Math.random() * 150)).toString(16).padStart(2, "0");
  return `#${chan()}${chan()}${chan()}`;
}
