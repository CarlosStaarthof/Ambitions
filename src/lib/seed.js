export const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
export const SLOTS = 48;                 // 30-min slots, 00:00–23:30
export const CELLS = DAYS.length * SLOTS; // 336
export const PALETTE = ["#6366f1", "#0ea5e9", "#14b8a6", "#22c55e", "#84cc16", "#eab308", "#f97316", "#ef4444", "#ec4899", "#a855f7", "#64748b", "#0891b2"];
export const MONTHS = Array.from({ length: 12 }, (_, i) => ({ v: i + 1, label: new Date(2000, i, 1).toLocaleDateString(undefined, { month: "long" }) }));

export const SEED_TASKS = [
  { id: "t1", name: "Sleep", category: "basic", color: "#6366f1", target: 56 },
  { id: "t2", name: "Work 1", category: "basic", color: "#0ea5e9", target: 40 },
  { id: "t3", name: "Work 2", category: "basic", color: "#14b8a6", target: null },
  { id: "t4", name: "GYM", category: "basic", color: "#22c55e", target: 5 },
  { id: "t5", name: "Meals", category: "basic", color: "#f97316", target: 14 },
  { id: "t6", name: "Language", category: "ambition", color: "#eab308", target: 5 },
  { id: "t7", name: "Reading", category: "ambition", color: "#ec4899", target: 3 },
  { id: "t8", name: "Side project", category: "ambition", color: "#a855f7", target: 4 }
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
