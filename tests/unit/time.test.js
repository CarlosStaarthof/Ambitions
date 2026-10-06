import { describe, it, expect } from "vitest";
import {
  pad, slotLabel, endLabel, codeFor, mondayOf, addDays, isoDate,
  monthKeyOf, mergeDay, weekStatsOf, fmtHM, parseHM, nextColor
} from "../../src/lib/time.js";
import { PALETTE, CELLS } from "../../src/lib/seed.js";

describe("slot and day maths", () => {
  it("labels slots as half-hours from midnight", () => {
    expect(slotLabel(0)).toBe("00:00");
    expect(slotLabel(1)).toBe("00:30");
    expect(slotLabel(47)).toBe("23:30");
  });

  it("reports the end of the final slot as 24:00 rather than wrapping to 00:00", () => {
    expect(endLabel(48)).toBe("24:00");
    expect(endLabel(20)).toBe("10:00");
  });

  it("pads single digits", () => {
    expect(pad(7)).toBe("07");
    expect(pad(12)).toBe("12");
  });
});

describe("mondayOf", () => {
  // The whole data model keys weeks by their Monday, so Sunday is the edge that matters.
  it("returns the same week's Monday for a midweek date", () => {
    expect(isoDate(mondayOf(new Date(2026, 7, 26)))).toBe("2026-08-24"); // Wed 26 Aug
  });

  it("treats Sunday as the END of its week, not the start", () => {
    expect(isoDate(mondayOf(new Date(2026, 7, 30)))).toBe("2026-08-24"); // Sun 30 Aug
  });

  it("is idempotent on a Monday", () => {
    const mon = mondayOf(new Date(2026, 7, 24));
    expect(isoDate(mondayOf(mon))).toBe("2026-08-24");
  });

  it("strips the time component", () => {
    const m = mondayOf(new Date(2026, 7, 26, 23, 59, 59));
    expect([m.getHours(), m.getMinutes(), m.getSeconds()]).toEqual([0, 0, 0]);
  });
});

describe("date keys", () => {
  it("formats iso dates zero-padded", () => {
    expect(isoDate(new Date(2026, 0, 5))).toBe("2026-01-05");
  });

  it("builds month keys", () => {
    expect(monthKeyOf(new Date(2026, 8, 14))).toBe("2026-09");
  });

  it("adds days across a month boundary", () => {
    expect(isoDate(addDays(new Date(2026, 7, 30), 2))).toBe("2026-09-01");
  });
});

describe("codeFor", () => {
  it("initialises multi-word names", () => {
    expect(codeFor("Side project")).toBe("SP");
    expect(codeFor("Tiempo AI App Development")).toBe("TAA");
  });

  it("takes the first three letters of a single word", () => {
    expect(codeFor("Sleep")).toBe("SLE");
  });

  it("ignores punctuation", () => {
    expect(codeFor("Work #2!")).toBe("W2");
  });
});

describe("fmtHM / parseHM", () => {
  it("formats decimal hours as h:mm", () => {
    expect(fmtHM(1.5)).toBe("1:30");
    expect(fmtHM(0.5)).toBe("0:30");
    expect(fmtHM(56)).toBe("56:00");
  });

  it("returns an empty string for no target", () => {
    expect(fmtHM(null)).toBe("");
    expect(fmtHM(undefined)).toBe("");
  });

  it("parses h:mm, plain numbers and minute suffixes", () => {
    expect(parseHM("1:30")).toBeCloseTo(1.5);
    expect(parseHM("1.5")).toBeCloseTo(1.5);
    expect(parseHM("90m")).toBeCloseTo(1.5);
    expect(parseHM("56")).toBe(56);
  });

  it("treats blank input as no target", () => {
    expect(parseHM("")).toBeNull();
    expect(parseHM("   ")).toBeNull();
    expect(parseHM(null)).toBeNull();
  });

  it("round-trips every half-hour value the grid can produce", () => {
    for (let slots = 0; slots <= 48; slots++) {
      const hours = slots * 0.5;
      expect(parseHM(fmtHM(hours))).toBeCloseTo(hours);
    }
  });

  it("clamps out-of-range minutes rather than overflowing the hour", () => {
    expect(parseHM("1:90")).toBeCloseTo(1 + 59 / 60);
  });
});

describe("mergeDay", () => {
  it("collapses contiguous cells of the same task into one block", () => {
    const cells = { "0-10": "t1", "0-11": "t1", "0-12": "t1" };
    expect(mergeDay(cells, 0)).toEqual([{ taskId: "t1", start: 10, end: 13 }]);
  });

  it("splits when the task changes", () => {
    const cells = { "0-10": "t1", "0-11": "t2" };
    expect(mergeDay(cells, 0)).toEqual([
      { taskId: "t1", start: 10, end: 11 },
      { taskId: "t2", start: 11, end: 12 }
    ]);
  });

  it("splits across a gap", () => {
    const cells = { "0-10": "t1", "0-12": "t1" };
    expect(mergeDay(cells, 0)).toEqual([
      { taskId: "t1", start: 10, end: 11 },
      { taskId: "t1", start: 12, end: 13 }
    ]);
  });

  it("ignores other days and returns nothing for an empty day", () => {
    expect(mergeDay({ "1-10": "t1" }, 0)).toEqual([]);
  });
});

describe("weekStatsOf", () => {
  const categories = [
    { id: "ambition", name: "Ambition", protected: true },
    { id: "work", name: "Work", protected: false }
  ];
  const tasks = [
    { id: "a1", name: "Reading", categoryId: "ambition", color: "#f00", target: 3 },
    { id: "w1", name: "Work 1", categoryId: "work", color: "#0f0", target: 40 }
  ];

  it("counts half an hour per filled cell, split by protected category", () => {
    const cells = { "0-0": "a1", "0-1": "a1", "1-0": "w1" };
    const s = weekStatsOf(cells, tasks, categories);
    expect(s.ambitionH).toBe(1);
    expect(s.committedH).toBe(0.5);
  });

  it("derives free time from the finite 336-cell week", () => {
    const s = weekStatsOf({ "0-0": "a1" }, tasks, categories);
    expect(s.filled).toBe(1);
    expect(s.freeH).toBe((CELLS - 1) * 0.5);
  });

  it("reports a completely empty week as entirely free", () => {
    const s = weekStatsOf({}, tasks, categories);
    expect(s.ambitionH).toBe(0);
    expect(s.committedH).toBe(0);
    expect(s.freeH).toBe(CELLS * 0.5); // 168h — a real week
  });

  it("aggregates hours per category", () => {
    const s = weekStatsOf({ "0-0": "a1", "0-1": "w1" }, tasks, categories);
    expect(s.byCategory.ambition).toBe(0.5);
    expect(s.byCategory.work).toBe(0.5);
  });

  it("exposes per-task hours", () => {
    const s = weekStatsOf({ "0-0": "a1", "0-1": "a1" }, tasks, categories);
    expect(s.hoursOf("a1")).toBe(1);
    expect(s.hoursOf("w1")).toBe(0);
  });

  // A whole week of ids, for the "every cell unresolvable" case.
  const fullWeek = (id) => {
    const cells = {};
    for (let d = 0; d < 7; d++) for (let s = 0; s < 48; s++) cells[`${d}-${s}`] = typeof id === "function" ? id(d, s) : id;
    return cells;
  };
  const sum = (s) => s.ambitionH + s.committedH + s.freeH;

  // AC-1
  it("always splits the finite week into exactly 168 hours", () => {
    expect(sum(weekStatsOf({}, tasks, categories))).toBe(168);
    expect(sum(weekStatsOf({ "0-0": "a1", "0-1": "w1", "3-20": "a1" }, tasks, categories))).toBe(168);
    expect(sum(weekStatsOf({ "0-0": "a1", "0-1": "ghost", "3-20": "w1", "4-4": "gone-too" }, tasks, categories))).toBe(168);
    expect(sum(weekStatsOf(fullWeek("a1"), tasks, categories))).toBe(168);
    expect(sum(weekStatsOf(fullWeek((d, s) => `ghost-${d}-${s}`), tasks, categories))).toBe(168);
    const allUnknown = weekStatsOf(fullWeek("ghost"), tasks, categories);
    expect(allUnknown.committedH).toBe(168);
    expect(allUnknown.ambitionH).toBe(0);
    expect(allUnknown.freeH).toBe(0);
    expect(allUnknown.unknownH).toBe(168);
  });

  // AC-2
  it("counts a cell whose task cannot be resolved as Committed, never as Ambition", () => {
    const s = weekStatsOf({ "0-0": "a1", "0-1": "ghost", "0-2": "ghost", "1-0": "w1" }, tasks, categories);
    expect(s.ambitionH).toBe(0.5);
    expect(s.committedH).toBe(1.5);   // 0.5 work + 1.0 unknown
    expect(s.unknownH).toBe(1);
    expect(s.unknownIds).toEqual(["ghost"]);
    expect(weekStatsOf({ "0-0": "a1" }, tasks, categories).unknownH).toBe(0);
    expect(weekStatsOf({}, tasks, categories).unknownH).toBe(0);
    expect(weekStatsOf({}, tasks, categories).unknownIds).toEqual([]);
  });

  // AC-3
  it("lets an unresolvable cell consume free time like any other", () => {
    const s = weekStatsOf({ "2-9": "long-gone" }, tasks, categories);
    expect(s.filled).toBe(1);
    expect(s.freeH).toBe(167.5);
    expect(fmtHM(s.freeH)).toBe("167:30");
  });

  // AC-4
  it("counts a retired task exactly like an active one", () => {
    const withRetired = [...tasks, { id: "r1", name: "Old ambition", categoryId: "ambition", color: "#00f", target: null, retired: true, retiredAt: "2026-09-29T09:00:00.000Z" }];
    const s = weekStatsOf({ "0-0": "r1", "0-1": "r1" }, withRetired, categories);
    expect(s.ambitionH).toBe(1);
    expect(s.committedH).toBe(0);
    expect(s.unknownH).toBe(0);
    expect(s.byCategory.ambition).toBe(1);
    expect(sum(s)).toBe(168);
  });

  // AC-5
  it("counts a cell once even when two tasks share an id", () => {
    const dupes = [...tasks, { id: "a1", name: "Duplicate", categoryId: "ambition", color: "#00f", target: null }];
    const s = weekStatsOf({ "0-0": "a1" }, dupes, categories);
    expect(s.ambitionH).toBe(0.5);
    expect(s.byCategory.ambition).toBe(0.5);
    expect(sum(s)).toBe(168);
  });

  it("puts every unknown id in the diagnostics list, sorted", () => {
    const s = weekStatsOf({ "0-0": "zz", "0-1": "aa", "0-2": "zz", "0-3": "a1" }, tasks, categories);
    expect(s.unknownIds).toEqual(["aa", "zz"]);
    expect(s.unknownH).toBe(1.5);
  });
});

describe("nextColor", () => {
  it("picks the first unused palette colour", () => {
    expect(nextColor([PALETTE[0]])).toBe(PALETTE[1]);
  });

  it("falls back to a generated colour once the palette is exhausted", () => {
    const c = nextColor([...PALETTE]);
    expect(c).toMatch(/^#[0-9a-f]{6}$/i);
    expect(PALETTE).not.toContain(c);
  });
});
