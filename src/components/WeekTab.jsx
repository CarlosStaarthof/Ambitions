import { useState, useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, Eraser, Plus, X } from "lucide-react";
import { addDays, isoDate, slotLabel, weekStatsOf, mondayOf, uid, nextColor, fmtHM } from "../lib/time";
import { DAYS, SLOTS, OPEN_ID } from "../lib/seed";
import { activeTasks, activeCategories, taskIndex, resolveCell } from "../lib/tasks";
import { card, inputCls, btnPrimary } from "../lib/ui";
import { useArmed } from "../lib/useArmed";

function FragmentRow({ children }) { return <>{children}</>; }

// Live clock for the grid highlights. 30s is plenty — a slot is 30 minutes, and
// re-rendering 336 cells every second would be wasteful.
function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), intervalMs); return () => clearInterval(id); }, [intervalMs]);
  return now;
}

export default function WeekTab({ tasks, categories, weeks, setWeeksP, setTasksP, weekStart, setWeekStart }) {
  const [brush, setBrush] = useState(null);
  const [openCat, setOpenCat] = useState(null);
  const [openDlg, setOpenDlg] = useState(false);
  const [openName, setOpenName] = useState("");
  const paintingRef = useRef(false);
  const { arm, isArmed } = useArmed();
  const now = useNow();

  useEffect(() => { const up = () => { paintingRef.current = false; }; window.addEventListener("mouseup", up); return () => window.removeEventListener("mouseup", up); }, []);

  const weekKey = isoDate(weekStart);
  const weekCells = useMemo(() => (weeks[weekKey] && weeks[weekKey].cells) || {}, [weeks, weekKey]);
  // The grid resolves against ALL tasks, retired included: a week already painted is a
  // record of what was done, so its blocks keep their real name and colour forever.
  // Everything that *edits* the week — picker, chips, counts — uses the active lists only.
  const index = useMemo(() => taskIndex(tasks), [tasks]);
  const liveTasks = activeTasks(tasks);
  const liveCategories = activeCategories(categories);
  // Stats take the full arrays so a retired task still counts exactly like an active one.
  const { ambitionH, committedH, freeH } = weekStatsOf(weekCells, tasks, categories);

  // Live position — only meaningful while the grid is showing the current week.
  const isThisWeek = isoDate(mondayOf(now)) === weekKey;
  const todayIdx = (now.getDay() + 6) % 7;                 // Mon=0 … Sun=6
  const nowSlot = now.getHours() * 2 + (now.getMinutes() >= 30 ? 1 : 0);

  // A task carrying `weekKey` belongs to that week alone — one-offs shouldn't clutter
  // the picker on every other week. Everything else is available always.
  const inThisWeek = (t) => !t.weekKey || t.weekKey === weekKey;

  // Categories drive the brush picker — there are always far fewer of them than tasks.
  // Open is hidden outright on weeks with no one-offs, rather than sitting there empty.
  const visibleCategories = liveCategories.filter(
    (c) => c.id !== OPEN_ID || liveTasks.some((t) => t.categoryId === OPEN_ID && inThisWeek(t))
  );
  const activeCat = visibleCategories.some((c) => c.id === openCat) ? openCat : (visibleCategories[0] || {}).id;
  const catTasks = liveTasks.filter((t) => t.categoryId === activeCat && inThisWeek(t));
  const brushTask = brush && brush !== "erase" ? liveTasks.find((t) => t.id === brush) : null;

  // One-off tasks: named on the spot, dropped into the Open category, and handed
  // straight to the brush so the next tap puts them on the calendar. They are real
  // tasks, so they still show up in Balance when you look back at the week.
  function createOpenTask() {
    const name = openName.trim();
    if (!name) return;
    const id = uid();
    setTasksP([...tasks, { id, name, categoryId: OPEN_ID, color: nextColor(tasks.map((t) => t.color)), target: null, weekKey }]);
    setBrush(id);
    setOpenCat(OPEN_ID);
    setOpenDlg(false);
  }

  function applyBrush(d, s) {
    if (brush == null) return;
    const key = `${d}-${s}`;
    setWeeksP((prev) => { const wk = prev[weekKey] || { cells: {} }; const cells = { ...wk.cells }; if (brush === "erase") delete cells[key]; else cells[key] = brush; return { ...prev, [weekKey]: { ...wk, cells } }; });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-900 shrink-0"><ChevronLeft size={18} /></button>
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-sm font-medium truncate">{weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – {addDays(weekStart, 6).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
          {!isThisWeek && <button onClick={() => setWeekStart(mondayOf(new Date()))} className="text-[11px] px-2 py-0.5 rounded-md border border-zinc-700 text-zinc-400 hover:bg-zinc-800 shrink-0">Today</button>}
        </div>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-900 shrink-0"><ChevronRight size={18} /></button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[["Ambition", ambitionH, "text-amber-400"], ["Committed", committedH, "text-zinc-100"], ["Free", freeH, "text-zinc-400"]].map(([l, v, c]) => (
          <div key={l} className={card + " p-3 text-center"}><div className={"text-2xl font-semibold " + c}>{fmtHM(v)}</div><div className="text-xs text-zinc-500">{l}</div></div>
        ))}
      </div>

      <div className="border border-zinc-800 rounded-xl bg-zinc-900 overflow-auto" style={{ maxHeight: "58vh", userSelect: "none" }}>
        <div style={{ display: "grid", gridTemplateColumns: "44px repeat(7, 1fr)" }}>
          {/* The header's corner box doubles as the Erase toggle — it's sticky, so it
              stays reachable no matter how far down the grid you've scrolled. */}
          <button onClick={() => setBrush(brush === "erase" ? null : "erase")} aria-label="Erase" title="Erase"
            className={"sticky top-0 z-10 border-b border-zinc-700 flex items-center justify-center " + (brush === "erase" ? "bg-red-600 text-white" : "bg-zinc-800 text-red-400 hover:bg-zinc-700 hover:text-red-300")}
            style={{ height: 34 }}>
            <Eraser size={15} />
          </button>
          {DAYS.map((d, i) => {
            const isToday = isThisWeek && i === todayIdx;
            return (
              <div key={d} className={"sticky top-0 z-10 border-b border-l border-zinc-700 flex flex-col items-center justify-center " + (isToday ? "bg-amber-500/25" : "bg-zinc-800")} style={{ height: 34 }}>
                <span className={"text-xs font-medium " + (isToday ? "text-amber-300" : "text-zinc-200")}>{d}</span>
                <span className={isToday ? "text-amber-400" : "text-zinc-500"} style={{ fontSize: 10 }}>{addDays(weekStart, i).getDate()}</span>
              </div>
            );
          })}
          {Array.from({ length: SLOTS }).map((_, s) => {
            const onHour = s % 2 === 0;
            const isNowRow = isThisWeek && s === nowSlot;
            return (
              <FragmentRow key={s}>
                <div className={"flex items-start justify-end pr-1 border-r border-zinc-800 " + (onHour ? "border-t border-zinc-700" : "")}
                  style={{ height: 26, background: isNowRow ? "rgba(245,158,11,0.12)" : undefined }}>
                  <span style={{ fontSize: 9, color: isNowRow ? "#fbbf24" : onHour ? "#a1a1aa" : "#52525b", marginTop: 1, fontWeight: isNowRow ? 700 : 400 }}>{slotLabel(s)}</span>
                </div>
                {DAYS.map((_, d) => {
                  const id = weekCells[`${d}-${s}`];
                  // Three kinds only: empty, a task, or a scheduled half hour whose task
                  // cannot be named. An unknown cell used to render pixel-identical to an
                  // empty one, which is what made the lost history invisible.
                  const cell = resolveCell(id, index);
                  const filledCell = cell.kind !== "empty";
                  const isStart = filledCell && weekCells[`${d}-${s - 1}`] !== id;
                  const isToday = isThisWeek && d === todayIdx;
                  const isNowCell = isNowRow && isToday;
                  // Tints only paint on empty cells, so they never fight a block colour.
                  const tint = filledCell ? null : isNowCell ? "rgba(245,158,11,0.30)" : isNowRow ? "rgba(245,158,11,0.12)" : isToday ? "rgba(245,158,11,0.06)" : null;
                  return (
                    <div key={d} title={filledCell ? `${cell.name} · ${slotLabel(s)}` : slotLabel(s)}
                      onMouseDown={() => { paintingRef.current = true; applyBrush(d, s); }}
                      onMouseEnter={() => { if (paintingRef.current) applyBrush(d, s); }}
                      onClick={() => applyBrush(d, s)}
                      className={"border-l border-zinc-800 cursor-pointer flex items-center justify-center " + (onHour ? "border-t border-zinc-700" : "")}
                      style={{
                        height: 26,
                        background: filledCell ? cell.color : tint || "transparent",
                        // The "now" line sits on the top edge of the current slot.
                        boxShadow: isNowRow ? "inset 0 2px 0 rgba(245,158,11,0.85)" : undefined,
                        outline: isNowCell ? "1px solid #f59e0b" : undefined,
                        outlineOffset: isNowCell ? -1 : undefined
                      }}>
                      {isStart && <span style={{ fontSize: 9, color: "#fff", fontWeight: 600 }}>{cell.code}</span>}
                    </div>
                  );
                })}
              </FragmentRow>
            );
          })}
        </div>
      </div>

      <div className={card + " p-3 space-y-2.5"}>
        <div className="flex items-center justify-between gap-2">
          <div className="text-xs text-zinc-500">Pick a category, then a task — tap or drag cells to fill.</div>
          {brushTask && <span className="text-xs text-zinc-300 flex items-center gap-1.5 shrink-0"><span className="w-3 h-3 rounded-sm" style={{ background: brushTask.color }} />{brushTask.name}</span>}
        </div>

        <div className="flex flex-wrap gap-1.5">
          {visibleCategories.map((c) => {
            const open = c.id === activeCat;
            const count = liveTasks.filter((t) => t.categoryId === c.id && inThisWeek(t)).length;
            return (
              <button key={c.id} onClick={() => setOpenCat(c.id)}
                className={"inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs " + (open ? "bg-zinc-800 border-amber-500 text-zinc-100 font-medium" : "border-zinc-700 text-zinc-400 hover:bg-zinc-800")}>
                {c.protected && <span className="text-amber-400">★</span>}
                {c.name}
                <span className="text-zinc-500">{count}</span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap gap-1.5 border-t border-zinc-800 pt-2.5">
          {catTasks.length === 0
            ? <div className="text-xs text-zinc-600">No tasks in this category yet.</div>
            : catTasks.map((t) => (
              <button key={t.id} onClick={() => setBrush(t.id)} style={{ borderColor: t.color }} className={"inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border-2 text-xs text-zinc-200 " + (brush === t.id ? "ring-2 ring-amber-400 font-medium" : "")}>
                <span className="w-3 h-3 rounded-sm" style={{ background: t.color }} /> {t.name}
              </button>
            ))}
        </div>

        <div className="pt-1 flex items-center gap-2">
          <button onClick={() => arm("clearWeek", () => setWeeksP((p) => ({ ...p, [weekKey]: { cells: {} } })))} className={"text-xs px-2 py-1 rounded-lg " + (isArmed("clearWeek") ? "bg-red-600 text-white" : "text-red-400 hover:bg-zinc-800")}>{isArmed("clearWeek") ? "tap to confirm" : "clear this week"}</button>
          <button onClick={() => { setOpenName(""); setOpenDlg(true); }} className="text-xs px-2 py-1 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800 inline-flex items-center gap-1"><Plus size={12} /> Open task</button>
        </div>
      </div>

      {openDlg && (
        <>
          <div className="fixed inset-0 z-40 bg-black/70" onClick={() => setOpenDlg(false)} />
          <div className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(22rem,90vw)] bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-3 shadow-xl">
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-medium">One-off task</div>
              <button onClick={() => setOpenDlg(false)} aria-label="Close" className="p-1 rounded-lg text-zinc-400 hover:bg-zinc-800"><X size={16} /></button>
            </div>
            <p className="text-xs text-zinc-500">Something you did once and want to remember. It lands in <span className="text-zinc-300">Open</span> and shows up in Balance — no category needed.</p>
            <input
              value={openName}
              onChange={(e) => setOpenName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createOpenTask(); if (e.key === "Escape") setOpenDlg(false); }}
              placeholder="What did you do?"
              autoFocus
              className={inputCls}
            />
            <div className="flex justify-end gap-2">
              <button onClick={() => setOpenDlg(false)} className="text-xs px-3 py-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800">Cancel</button>
              <button onClick={createOpenTask} disabled={!openName.trim()} className={btnPrimary + " text-xs py-1.5"}>Create &amp; paint</button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
