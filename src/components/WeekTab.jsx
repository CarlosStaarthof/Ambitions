import { useState, useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, Eraser } from "lucide-react";
import { addDays, isoDate, slotLabel, codeFor, weekStatsOf } from "../lib/time";
import { DAYS, SLOTS } from "../lib/seed";
import { card } from "../lib/ui";
import { useArmed } from "../lib/useArmed";

function FragmentRow({ children }) { return <>{children}</>; }

export default function WeekTab({ tasks, weeks, setWeeksP, weekStart, setWeekStart }) {
  const [brush, setBrush] = useState(null);
  const paintingRef = useRef(false);
  const { arm, isArmed } = useArmed();

  useEffect(() => { const up = () => { paintingRef.current = false; }; window.addEventListener("mouseup", up); return () => window.removeEventListener("mouseup", up); }, []);

  const weekKey = isoDate(weekStart);
  const weekCells = useMemo(() => (weeks[weekKey] && weeks[weekKey].cells) || {}, [weeks, weekKey]);
  const taskById = (id) => tasks.find((t) => t.id === id);
  const { basicH, ambitionH, freeH } = weekStatsOf(weekCells, tasks);

  function applyBrush(d, s) {
    if (brush == null) return;
    const key = `${d}-${s}`;
    setWeeksP((prev) => { const wk = prev[weekKey] || { cells: {} }; const cells = { ...wk.cells }; if (brush === "erase") delete cells[key]; else cells[key] = brush; return { ...prev, [weekKey]: { ...wk, cells } }; });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={() => setWeekStart(addDays(weekStart, -7))} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-900"><ChevronLeft size={18} /></button>
        <div className="text-sm font-medium">{weekStart.toLocaleDateString(undefined, { month: "short", day: "numeric" })} – {addDays(weekStart, 6).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</div>
        <button onClick={() => setWeekStart(addDays(weekStart, 7))} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-900"><ChevronRight size={18} /></button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {[["Basic", basicH, "text-zinc-100"], ["Ambition", ambitionH, "text-amber-400"], ["Free", freeH, "text-zinc-400"]].map(([l, v, c]) => (
          <div key={l} className={card + " p-3 text-center"}><div className={"text-2xl font-semibold " + c}>{v}h</div><div className="text-xs text-zinc-500">{l}</div></div>
        ))}
      </div>

      <div className="border border-zinc-800 rounded-xl bg-zinc-900 overflow-auto" style={{ maxHeight: "58vh", userSelect: "none" }}>
        <div style={{ display: "grid", gridTemplateColumns: "44px repeat(7, 1fr)" }}>
          <div className="sticky top-0 z-10 bg-zinc-800 border-b border-zinc-700" style={{ height: 34 }} />
          {DAYS.map((d, i) => (
            <div key={d} className="sticky top-0 z-10 bg-zinc-800 border-b border-l border-zinc-700 flex flex-col items-center justify-center" style={{ height: 34 }}>
              <span className="text-xs font-medium text-zinc-200">{d}</span>
              <span className="text-zinc-500" style={{ fontSize: 10 }}>{addDays(weekStart, i).getDate()}</span>
            </div>
          ))}
          {Array.from({ length: SLOTS }).map((_, s) => {
            const onHour = s % 2 === 0;
            return (
              <FragmentRow key={s}>
                <div className={"flex items-start justify-end pr-1 border-r border-zinc-800 " + (onHour ? "border-t border-zinc-700" : "")} style={{ height: 26 }}>
                  <span style={{ fontSize: 9, color: onHour ? "#a1a1aa" : "#52525b", marginTop: 1 }}>{slotLabel(s)}</span>
                </div>
                {DAYS.map((_, d) => {
                  const id = weekCells[`${d}-${s}`]; const t = id ? taskById(id) : null; const isStart = t && weekCells[`${d}-${s - 1}`] !== id;
                  return (
                    <div key={d} title={t ? `${t.name} · ${slotLabel(s)}` : slotLabel(s)}
                      onMouseDown={() => { paintingRef.current = true; applyBrush(d, s); }}
                      onMouseEnter={() => { if (paintingRef.current) applyBrush(d, s); }}
                      onClick={() => applyBrush(d, s)}
                      className={"border-l border-zinc-800 cursor-pointer flex items-center justify-center " + (onHour ? "border-t border-zinc-700" : "")}
                      style={{ height: 26, background: t ? t.color : "transparent" }}>
                      {isStart && <span style={{ fontSize: 9, color: "#fff", fontWeight: 600 }}>{codeFor(t.name)}</span>}
                    </div>
                  );
                })}
              </FragmentRow>
            );
          })}
        </div>
      </div>

      <div className={card + " p-3 space-y-2"}>
        <div className="text-xs text-zinc-500">Tap a task, then tap (or drag) cells to fill.</div>
        <div className="flex flex-wrap gap-1.5">
          {tasks.map((t) => (
            <button key={t.id} onClick={() => setBrush(t.id)} style={{ borderColor: t.color }} className={"inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border-2 text-xs text-zinc-200 " + (brush === t.id ? "ring-2 ring-amber-400 font-medium" : "")}>
              <span className="w-3 h-3 rounded-sm" style={{ background: t.color }} /> {t.name}
            </button>
          ))}
          <button onClick={() => setBrush("erase")} className={"inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border-2 border-zinc-600 text-xs text-zinc-300 " + (brush === "erase" ? "ring-2 ring-amber-400 bg-zinc-800" : "")}><Eraser size={13} /> Erase</button>
        </div>
        <div className="pt-1">
          <button onClick={() => arm("clearWeek", () => setWeeksP((p) => ({ ...p, [weekKey]: { cells: {} } })))} className={"text-xs px-2 py-1 rounded-lg " + (isArmed("clearWeek") ? "bg-red-600 text-white" : "text-red-400 hover:bg-zinc-800")}>{isArmed("clearWeek") ? "tap to confirm" : "clear this week"}</button>
        </div>
      </div>
    </div>
  );
}
