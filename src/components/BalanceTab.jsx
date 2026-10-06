import { useState, useMemo } from "react";
import { BarChart, Bar, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { Sparkles, Loader2 } from "lucide-react";
import { isoDate, slotLabel, endLabel, mergeDay, weekStatsOf, monthKeyOf, fmtHM } from "../lib/time";
import { DAYS, MONTHS } from "../lib/seed";
import { activeTasks, UNKNOWN_COLOR } from "../lib/tasks";
import { card, btnPrimary, selectCls, TIP } from "../lib/ui";
import { callAI, aiErrorText } from "../lib/ai";

export default function BalanceTab({ tasks, categories, weeks, weekStart, questions, reflections, setReflectionsP, online, aiEnabled, ai }) {
  const [coach, setCoach] = useState({ loading: false, text: "", error: "" });
  const [balSel, setBalSel] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });

  const weekKey = isoDate(weekStart);
  const weekCells = (weeks[weekKey] && weeks[weekKey].cells) || {};
  const { hoursOf, ambitionH, committedH, freeH, unknownH } = weekStatsOf(weekCells, tasks, categories);
  const taskById = (id) => tasks.find((t) => t.id === id);
  const protectedIds = new Set(categories.filter((c) => c.protected).map((c) => c.id));
  // Plans are about what to do next, so a removed task is not one. The chart below is
  // about what the shown week actually holds, so it keeps reporting every painted block.
  const ambitionTasks = activeTasks(tasks).filter((t) => protectedIds.has(t.categoryId));
  const taskHoursData = tasks.map((t) => ({ name: t.name, hours: hoursOf(t.id), color: t.color })).filter((d) => d.hours > 0).sort((a, b) => b.hours - a.hours);
  // Hours whose task cannot be named are still hours the user spent — one aggregate bar
  // keeps the chart honest instead of quietly dropping them.
  if (unknownH > 0) taskHoursData.push({ name: "Unknown", hours: unknownH, color: UNKNOWN_COLOR });

  const balKey = monthKeyOf(balSel);
  const balAnswers = reflections[balKey] || {};
  const allYears = useMemo(() => { const s = new Set(Object.keys(reflections).map((k) => k.split("-")[0])); s.add(String(new Date().getFullYear())); s.add(String(balSel.getFullYear())); return Array.from(s).sort().reverse(); }, [reflections, balSel]);

  async function askCoach() {
    setCoach({ loading: true, text: "", error: "" });
    try {
      const lines = DAYS.map((dn, di) => { const blocks = mergeDay(weekCells, di).filter((b) => b.taskId); if (!blocks.length) return `${dn}: (empty)`; return `${dn}: ` + blocks.map((b) => `${slotLabel(b.start)}-${endLabel(b.end)} ${(taskById(b.taskId) || {}).name || "?"}`).join("; "); }).join("\n");
      const targets = ambitionTasks.map((t) => `- ${t.name}: scheduled ${fmtHM(hoursOf(t.id))}${t.target ? `, target ${fmtHM(t.target)}` : ""}`).join("\n");
      const persona = "You are a pragmatic weekly time coach. The person protects one thing above all: their Ambition time (learning, side projects, growth) — it must be grown toward its weekly targets. Everything else on the calendar is the committed reality of life (sleep, work, health, meals, and whatever categories they've set) and should not be sacrificed. Time is the only real unit — each slot is 30 minutes of a finite 7-day week (Mon–Sun). Read their schedule and propose concrete moves: name the exact day and 30-minute slots (preferring unallocated time) to convert to which ambition task to close the gap to targets, without cutting committed essentials. Be specific and brief — a short list of concrete suggestions, then one sentence of encouragement. No generic advice.";
      const task = `My week (Mon–Sun, blank = unallocated):\n${lines}\n\nAmbition plans:\n${targets || "(none set)"}\n\nTotals (h:mm) — ambition ${fmtHM(ambitionH)}, committed ${fmtHM(committedH)}, unallocated ${fmtHM(freeH)}.`;
      const text = await callAI(persona + "\n\n" + task, ai);
      setCoach({ loading: false, text, error: "" });
    } catch (e) { setCoach({ loading: false, text: "", error: aiErrorText(e) }); }
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-3 gap-2">
        {[["Ambition", ambitionH, "text-amber-400"], ["Committed", committedH, "text-zinc-100"], ["Free", freeH, "text-zinc-400"]].map(([l, v, c]) => (
          <div key={l} className={card + " p-3 text-center"}><div className={"text-2xl font-semibold " + c}>{fmtHM(v)}</div><div className="text-xs text-zinc-500">{l}</div></div>
        ))}
      </div>

      <div className={card + " p-4 space-y-3"}>
        <div className="text-sm font-medium">Ambition plans this week</div>
        {ambitionTasks.length === 0 ? <div className="text-xs text-zinc-500">No ambition tasks yet.</div> : ambitionTasks.map((t) => {
          const h = hoursOf(t.id); const pct = t.target ? Math.min(100, Math.round((h / t.target) * 100)) : null;
          return (
            <div key={t.id} className="space-y-1">
              <div className="flex items-center justify-between text-xs"><span className="flex items-center gap-1.5 text-zinc-300"><span className="w-2.5 h-2.5 rounded-sm" style={{ background: t.color }} />{t.name}</span><span className="text-zinc-500">{fmtHM(h)}{t.target ? ` / ${fmtHM(t.target)}` : ""}</span></div>
              {t.target != null && <div className="h-2 rounded-full bg-zinc-800 overflow-hidden"><div className="h-full rounded-full" style={{ width: pct + "%", background: t.color }} /></div>}
            </div>
          );
        })}
      </div>

      {taskHoursData.length > 0 && (
        <div className={card + " p-4"}>
          <div className="text-sm font-medium mb-2">Hours by task</div>
          {/* Horizontal bars: full task names never fit under a vertical axis, and
              this grows with the number of tasks instead of squeezing them. */}
          <ResponsiveContainer width="100%" height={Math.max(140, taskHoursData.length * 34 + 30)}>
            <BarChart data={taskHoursData} layout="vertical" margin={{ top: 5, right: 16, left: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#a1a1aa" }} tickFormatter={fmtHM} />
              <YAxis type="category" dataKey="name" width={110} tick={{ fontSize: 11, fill: "#d4d4d8" }} interval={0} />
              <Tooltip {...TIP} cursor={{ fill: "#27272a" }} formatter={(v) => [fmtHM(v), "scheduled"]} />
              <Bar dataKey="hours" radius={[0, 4, 4, 0]}>{taskHoursData.map((d, i) => <Cell key={i} fill={d.color} />)}</Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {aiEnabled && (
      <div className={card + " p-4 space-y-3"}>
        <div className="flex items-center gap-1.5 text-sm font-medium"><Sparkles size={15} className="text-amber-400" /> Make room for ambition</div>
        <p className="text-xs text-zinc-500">Sends this week to your AI provider. It keeps your basic needs intact and points to exact slots you could give to ambition.</p>
        <button onClick={askCoach} disabled={coach.loading || !online} className={btnPrimary}>{coach.loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}{coach.loading ? "thinking…" : online ? "Find me some time" : "Needs internet"}</button>
        {coach.error && <div className="text-xs text-red-400">{coach.error}</div>}
        {coach.text && <div className="border border-amber-500 bg-zinc-900 rounded-xl p-3 text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">{coach.text}</div>}
      </div>
      )}

      <div className={card + " p-4 space-y-3"}>
        <div className="flex items-center justify-between gap-2">
          <div className="text-sm font-medium">Guiding questions & answers</div>
          <div className="flex gap-2">
            <select value={balSel.getMonth() + 1} onChange={(e) => setBalSel(new Date(balSel.getFullYear(), Number(e.target.value) - 1, 1))} className={selectCls}>{MONTHS.map((m) => <option key={m.v} value={m.v}>{m.label}</option>)}</select>
            <select value={balSel.getFullYear()} onChange={(e) => setBalSel(new Date(Number(e.target.value), balSel.getMonth(), 1))} className={selectCls}>{allYears.map((y) => <option key={y} value={y}>{y}</option>)}</select>
          </div>
        </div>
        {questions.map((q) => (
          <div key={q.id} className="space-y-0.5">
            <div className="text-xs text-zinc-400">{q.text}</div>
            <div className="text-sm text-zinc-200 whitespace-pre-wrap">{(balAnswers[q.id] || "").trim() ? balAnswers[q.id] : <span className="text-zinc-600">—</span>}</div>
          </div>
        ))}
        {/* A stored bounce is still AI output — with AI switched off the app shows
            no trace of it anywhere. The text stays in storage, just hidden. */}
        {aiEnabled && balAnswers._ai && (
          <div className="border border-amber-500 bg-zinc-900 rounded-xl p-3 space-y-1">
            <div className="flex items-center gap-1.5 text-xs text-amber-400"><Sparkles size={12} /> AI bounce</div>
            <div className="text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">{balAnswers._ai}</div>
          </div>
        )}
      </div>
    </div>
  );
}
