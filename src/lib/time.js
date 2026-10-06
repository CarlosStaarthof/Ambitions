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

// Walks the CELLS, not the task list. Iterating `tasks` used to drop the hours of a
// cell whose task had gone from the array into neither Ambition nor Committed while
// `filled` still counted it, so the three cards quietly stopped summing to 168 — which
// is what made an orphaned cell invisible. Each id is now resolved exactly once through
// an id→task map, so a duplicate id in `tasks` cannot double-count either.
export function weekStatsOf(weekCells, tasks, categories = []) {
  const cells = weekCells || {};
  const counts = {}; Object.values(cells).forEach((id) => { counts[id] = (counts[id] || 0) + 1; });
  const hoursOf = (id) => (counts[id] || 0) * 0.5;
  const protectedIds = new Set((categories || []).filter((c) => c.protected).map((c) => c.id));
  const byId = new Map();
  for (const t of tasks || []) if (t && !byId.has(t.id)) byId.set(t.id, t);

  const byCategory = {};
  (categories || []).forEach((c) => { byCategory[c.id] = 0; });
  let ambitionH = 0, committedH = 0, unknownH = 0;
  const unknown = [];
  for (const id of Object.keys(counts)) {
    const h = counts[id] * 0.5;
    const t = byId.get(id);
    // domain-model rule 2: a scheduled cell that cannot be shown to be Ambition is
    // Committed. Never inflate Ambition with a cell we cannot identify.
    if (!t) { committedH += h; unknownH += h; unknown.push(id); continue; }
    if (protectedIds.has(t.categoryId)) ambitionH += h; else committedH += h;
    if (byCategory[t.categoryId] !== undefined) byCategory[t.categoryId] += h;
  }
  const filled = Object.keys(cells).length;
  const freeH = (CELLS - filled) * 0.5;
  return { counts, hoursOf, ambitionH, committedH, freeH, filled, byCategory, protectedIds, unknownH, unknownIds: unknown.sort() };
}

// Pick a color not already used by an existing task. Falls back to a random,
// pleasant mid-range color once the fixed palette is exhausted.
export function nextColor(used) {
  const taken = new Set(used);
  for (const c of PALETTE) if (!taken.has(c)) return c;
  const chan = () => (60 + Math.floor(Math.random() * 150)).toString(16).padStart(2, "0");
  return `#${chan()}${chan()}${chan()}`;
}

// Targets and totals are stored as decimal hours (0.5 = 30 min) because the grid
// is half-hour cells, but people think in H:MM. These convert at the UI edge only —
// the stored shape never changes.
export function fmtHM(h) {
  if (h == null || isNaN(h)) return "";
  const total = Math.round(Number(h) * 60);
  const sign = total < 0 ? "-" : "";
  const abs = Math.abs(total);
  return `${sign}${Math.floor(abs / 60)}:${pad(abs % 60)}`;
}

// Accepts "1:30", "1.5" or "90m" and returns decimal hours (null when blank).
export function parseHM(text) {
  const t = String(text == null ? "" : text).trim();
  if (!t) return null;
  if (t.includes(":")) {
    const [hh, mm] = t.split(":");
    const h = parseInt(hh || "0", 10);
    const m = parseInt(mm || "0", 10);
    if (isNaN(h) || isNaN(m)) return null;
    return h + Math.min(59, Math.max(0, m)) / 60;
  }
  if (/m$/i.test(t)) { const m = parseFloat(t); return isNaN(m) ? null : m / 60; }
  const n = Number(t.replace(",", "."));
  return isNaN(n) ? null : n;
}
