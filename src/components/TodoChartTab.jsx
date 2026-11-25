import { Check } from "lucide-react";
import { card } from "../lib/ui";
import { UNCATEGORIZED_COLOR, activeReminders, archivedReminders, markDone } from "../lib/reminderWall";

const tint = (color) => (/^#[0-9a-fA-F]{6}$/.test(color) ? color + "22" : "rgba(255,255,255,0.04)");
const dateLabel = (iso) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? null : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};
// The board's whole point is that each item is a dated commitment. A legacy item
// without a timestamp says so rather than pretending it appeared today.
const addedLabel = (iso) => {
  const d = dateLabel(iso);
  return d ? `Added ${d}` : "Added date unknown";
};

export default function TodoChartTab({ reminderWall, setReminderWallP, view = "open" }) {
  const categories = reminderWall.categories;
  const categoryOf = (id) => categories.find((c) => c.id === id) || { name: "Uncategorized", color: UNCATEGORIZED_COLOR };
  const open = activeReminders(reminderWall.items);
  const done = archivedReminders(reminderWall.items);

  function tick(id) {
    const r = markDone(reminderWall, id, new Date().toISOString());
    if (!r.error) setReminderWallP(r.wall);
  }

  if (view === "done") {
    return (
      <div className="space-y-3">
        {done.length === 0 ? (
          <div className={card + " p-6 text-center text-sm text-zinc-500"}>Nothing done yet.</div>
        ) : (
          done.map((it) => {
            const cat = categoryOf(it.categoryId);
            return (
              <div key={it.id} className={card + " p-3 space-y-2"} style={{ borderColor: cat.color }}>
                <div className="flex items-center gap-1.5 text-[11px] min-w-0" style={{ color: cat.color }}>
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color }} />
                  <span className="truncate">{cat.name}</span>
                </div>
                <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words line-through decoration-zinc-600">{it.text}</p>
                <div className="flex flex-wrap items-center justify-between gap-1 text-[10px] text-zinc-500">
                  <span>{addedLabel(it.createdAt)}</span>
                  <span>Done {dateLabel(it.doneAt) || "date unknown"}</span>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  }

  // Group by category so the board reads as a few colour-coded stacks instead of
  // one long list. Categories with nothing open are omitted.
  const groups = categories
    .map((cat) => ({ cat, items: open.filter((it) => it.categoryId === cat.id) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="space-y-4">
      <div className={card + " px-4 py-3 flex items-center justify-between gap-3"}>
        <div>
          <div className="text-2xl font-semibold text-amber-400 leading-none">{open.length}</div>
          <div className="text-[11px] text-zinc-500 mt-1">open to-do{open.length === 1 ? "" : "s"}</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-medium text-zinc-300 leading-none">{done.length}</div>
          <div className="text-[11px] text-zinc-500 mt-1">done</div>
        </div>
      </div>

      {open.length === 0 ? (
        <div className={card + " p-6 text-center text-sm text-zinc-500"}>Nothing to do. Add reminders in Records.</div>
      ) : (
        groups.map(({ cat, items }) => (
          <div key={cat.id} className="space-y-2">
            <div className="flex items-center gap-2 px-1">
              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: cat.color }} />
              <span className="text-sm font-medium truncate" style={{ color: cat.color }}>{cat.name}</span>
              <span className="text-[11px] text-zinc-500 shrink-0">{items.length}</span>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              {items.map((it) => (
                <div key={it.id} className="flex min-h-[112px] flex-col gap-2 rounded-xl border p-3" style={{ borderColor: cat.color, background: tint(cat.color) }}>
                  <p className="flex-1 text-sm text-zinc-100 whitespace-pre-wrap break-words">{it.text}</p>
                  <div className="flex items-end justify-between gap-2">
                    <span className="min-w-0 truncate text-[10px] text-zinc-500" title={addedLabel(it.createdAt)}>{addedLabel(it.createdAt)}</span>
                    <button onClick={() => tick(it.id)} aria-label="Mark done" title="Mark done" className="shrink-0 inline-flex items-center gap-1 rounded bg-zinc-800/80 px-2 py-1 text-xs text-zinc-200 hover:bg-zinc-700"><Check size={13} /> Done</button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
