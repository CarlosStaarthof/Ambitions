import { Check, CheckCircle2, Clock, Inbox, Undo2 } from "lucide-react";
import { card } from "../lib/ui";
import { UNCATEGORIZED_COLOR, canUndoReminder, chartGroups, chartSummary, createdDate, markDone, reopenReminder } from "../lib/reminderWall";

const tint = (color) => (/^#[0-9a-fA-F]{6}$/.test(color) ? color + "22" : "rgba(255,255,255,0.04)");
const dateLabel = (iso) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};
// The board's whole point is that each item is a dated commitment. A legacy item
// without a timestamp says so rather than pretending it appeared today.
const addedLabel = (iso) => {
  const day = createdDate(iso);
  if (!day) return "Added date unknown";
  const [y, m, d] = day.split("-").map(Number);
  return `Added ${new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
};

export default function TodoChartTab({ reminderWall, setReminderWallP, view = "open", now }) {
  const nowDate = now instanceof Date ? now : new Date();
  const { open, done, donePercent } = chartSummary(reminderWall);
  const groups = chartGroups(reminderWall);
  const categoryOf = (id) => reminderWall.categories.find((c) => c.id === id) || { name: "Uncategorized", color: UNCATEGORIZED_COLOR };

  function tick(id) {
    const r = markDone(reminderWall, id, new Date().toISOString());
    if (!r.error) setReminderWallP(r.wall);
  }

  function undo(id) {
    const r = reopenReminder(reminderWall, id, new Date().toISOString());
    if (!r.error) setReminderWallP(r.wall);
  }

  if (view === "done") {
    return (
      <div className="space-y-2.5">
        {done === 0 ? (
          <div className={card + " flex flex-col items-center gap-2 px-4 py-8 text-center"}>
            <CheckCircle2 size={26} className="text-zinc-600" />
            <p className="text-sm text-zinc-500">Nothing done yet. Ticking a to-do moves it here.</p>
          </div>
        ) : (
          <p className="px-1 text-[11px] text-zinc-500">{done} finished to-do{done === 1 ? "" : "s"}</p>
        )}
        {reminderWall.items
          .filter((it) => it && it.doneAt)
          .sort((a, b) => (a.doneAt < b.doneAt ? 1 : a.doneAt > b.doneAt ? -1 : 0))
          .map((it) => {
            const cat = categoryOf(it.categoryId);
            return (
              <div key={it.id} className={card + " flex gap-3 p-3"} style={{ borderLeft: `4px solid ${cat.color}` }}>
                <CheckCircle2 size={16} className="mt-0.5 shrink-0" style={{ color: cat.color }} />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <p className="text-sm text-zinc-400 whitespace-pre-wrap break-words line-through decoration-zinc-600">{it.text}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px]">
                    <span className="inline-flex items-center gap-1 min-w-0 text-zinc-400">
                      <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ background: cat.color }} />
                      <span className="truncate">{cat.name}</span>
                    </span>
                    <span className="text-zinc-500">{addedLabel(it.createdAt)}</span>
                    <span className="text-zinc-500">Done {dateLabel(it.doneAt) || "date unknown"}</span>
                    {canUndoReminder(it, nowDate) ? (
                      <button
                        onClick={() => undo(it.id)}
                        aria-label="Undo done"
                        className="inline-flex min-h-[28px] shrink-0 items-center gap-1 rounded-lg bg-zinc-800 px-2 text-[11px] font-medium text-zinc-200 hover:bg-zinc-700 active:scale-95"
                        title="Undo done"
                      >
                        <Undo2 size={13} /> Undo
                      </button>
                    ) : (
                      <span className="text-zinc-600">Undo closed</span>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className={card + " space-y-3 px-4 py-3"}>
        <div className="flex items-end justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-semibold leading-none text-amber-400">{open}</span>
              <span className="text-xs text-zinc-500">open to-do{open === 1 ? "" : "s"}</span>
            </div>
            <div className="mt-1 text-[11px] text-zinc-500">{done} done</div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-lg font-medium leading-none text-zinc-300">{donePercent}%</div>
            <div className="mt-1 text-[10px] text-zinc-500">complete</div>
          </div>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={donePercent} aria-label="To-dos complete">
          <div className="h-full rounded-full bg-amber-500 transition-all" style={{ width: `${donePercent}%` }} />
        </div>
      </div>

      {open === 0 ? (
        <div className={card + " flex flex-col items-center gap-2 px-4 py-8 text-center"}>
          <Inbox size={26} className="text-zinc-600" />
          <p className="text-sm text-zinc-500">Nothing to do.</p>
          <p className="text-[11px] text-zinc-600">Add reminders in Records and they will appear here.</p>
        </div>
      ) : (
        groups.map(({ category: cat, items }) => (
          <section key={cat.id} className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: cat.color }} />
              <h2 className="truncate text-sm font-medium" style={{ color: cat.color }}>{cat.name}</h2>
              <span className="shrink-0 rounded-full bg-zinc-800 px-1.5 text-[10px] leading-4 text-zinc-400">{items.length}</span>
            </div>
            <div className="grid gap-2.5 sm:grid-cols-2">
              {items.map((it) => (
                <article
                  key={it.id}
                  className="flex min-h-[116px] min-w-0 flex-col gap-2 rounded-xl border border-zinc-800 p-3 shadow-sm shadow-black/30"
                  style={{ borderLeft: `4px solid ${cat.color}`, background: tint(cat.color) }}
                >
                  <p className="flex-1 whitespace-pre-wrap break-words text-sm leading-snug text-zinc-100">{it.text}</p>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="inline-flex min-w-0 items-center gap-1 text-[10px] text-zinc-500" title={addedLabel(it.createdAt)}>
                      <Clock size={11} className="shrink-0" />
                      <span className="truncate">{addedLabel(it.createdAt)}</span>
                    </span>
                    <button
                      onClick={() => tick(it.id)}
                      aria-label="Mark done"
                      className="inline-flex min-h-[34px] shrink-0 items-center gap-1 rounded-lg bg-zinc-800 px-2.5 text-xs font-medium text-zinc-200 hover:bg-zinc-700 active:scale-95"
                      title="Mark done"
                    >
                      <Check size={13} /> Done
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>
        ))
      )}
    </div>
  );
}
