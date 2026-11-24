import { useState, useRef, useMemo } from "react";
import { ChevronLeft, ChevronRight, ImagePlus, Trash2, Check, Loader2 } from "lucide-react";
import { uid } from "../lib/time";
import { card, btnPrimary } from "../lib/ui";
import { useArmed } from "../lib/useArmed";
import { fileToScaledDataUrl } from "../lib/image";
import { VISION_TEXT_MAX, clampVisionText } from "../lib/vision";

// The board is grouped by year: a vision is something you're chasing across a year,
// which is the horizon above the week grid and the monthly reflection.
export default function VisionTab({ vision, setVisionP }) {
  const currentYear = new Date().getFullYear();
  const [year, setYear] = useState(currentYear);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef(null);
  const { arm, isArmed } = useArmed();

  const key = String(year);
  const items = useMemo(() => (vision && vision[key]) || [], [vision, key]);
  const done = items.filter((i) => i.done).length;

  const setItems = (next) => setVisionP((prev) => ({ ...(prev || {}), [key]: next }));
  const patch = (id, p) => setItems(items.map((i) => (i.id === id ? { ...i, ...p } : i)));
  const remove = (id) => setItems(items.filter((i) => i.id !== id));

  async function addFiles(fileList) {
    const files = Array.from(fileList || []);
    if (!files.length) return;
    setBusy(true); setError("");
    try {
      const added = [];
      for (const f of files) {
        try { added.push({ id: uid(), img: await fileToScaledDataUrl(f), caption: "", done: false, createdAt: new Date().toISOString() }); }
        catch (e) { setError(e.message || "One image couldn't be added."); }
      }
      if (added.length) setItems([...items, ...added]);
    } finally { setBusy(false); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <button onClick={() => setYear(year - 1)} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-900 shrink-0"><ChevronLeft size={18} /></button>
        <div className="flex items-center gap-2 min-w-0">
          <div className="text-sm font-medium">{year}</div>
          {year !== currentYear && <button onClick={() => setYear(currentYear)} className="text-[11px] px-2 py-0.5 rounded-md border border-zinc-700 text-zinc-400 hover:bg-zinc-800 shrink-0">This year</button>}
        </div>
        <button onClick={() => setYear(year + 1)} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-900 shrink-0"><ChevronRight size={18} /></button>
      </div>

      <div className={card + " p-4 space-y-3"}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 space-y-2">
            <div className="flex items-baseline gap-2 flex-wrap">
              <div className="text-sm font-medium">What {year} looks like</div>
              <span className="text-xs text-zinc-500">{done}/{items.length} reached</span>
            </div>
            {items.length > 0 && (
              <div className="h-2 rounded-full bg-zinc-800 overflow-hidden">
                <div className="h-full rounded-full bg-amber-500" style={{ width: (items.length ? Math.round((done / items.length) * 100) : 0) + "%" }} />
              </div>
            )}
          </div>
          <div className="shrink-0">
            <input ref={fileRef} type="file" accept="image/*" multiple onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} className="hidden" />
            <button onClick={() => fileRef.current && fileRef.current.click()} disabled={busy} className={btnPrimary}>
              {busy ? <Loader2 size={14} className="animate-spin" /> : <ImagePlus size={14} />}{busy ? "adding…" : "Add image"}
            </button>
          </div>
        </div>
        <p className="text-xs text-zinc-500">Pictures of what you're aiming at this year, each with a line of your own. Nothing here is tied to a task — it's just what you want to be true.</p>
        {error && <div className="text-xs text-red-400">{error}</div>}
      </div>

      {items.length === 0 ? (
        <div className={card + " p-6 text-center text-sm text-zinc-500"}>
          Nothing on the board for {year} yet. Add a picture and a line about something you want to be true by the end of the year.
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {items.map((it) => (
            <div key={it.id} className={card + " overflow-hidden flex flex-col"}>
              <div className="relative">
                <img src={it.img} alt={it.caption || "Vision"} className={"w-full object-cover " + (it.done ? "opacity-40" : "")} style={{ aspectRatio: "1 / 1" }} />
                <button
                  onClick={() => patch(it.id, { done: !it.done })}
                  aria-label={it.done ? "Mark as not reached" : "Mark as reached"}
                  className={"absolute top-1.5 left-1.5 w-7 h-7 rounded-full flex items-center justify-center border " + (it.done ? "bg-amber-500 border-amber-400 text-black" : "bg-black/60 border-zinc-600 text-zinc-300")}
                >
                  <Check size={15} />
                </button>
                <button
                  onClick={() => arm("delVis" + it.id, () => remove(it.id))}
                  aria-label="Delete"
                  className={"absolute top-1.5 right-1.5 rounded-full flex items-center justify-center border " + (isArmed("delVis" + it.id) ? "bg-red-600 border-red-500 text-white px-2 h-7 text-[11px]" : "bg-black/60 border-zinc-600 text-zinc-300 w-7 h-7")}
                >
                  {isArmed("delVis" + it.id) ? "sure?" : <Trash2 size={14} />}
                </button>
              </div>
              <div className="p-2 space-y-1">
                <textarea
                  value={it.caption || ""}
                  onChange={(e) => patch(it.id, { caption: clampVisionText(e.target.value) })}
                  maxLength={VISION_TEXT_MAX}
                  rows={3}
                  placeholder="What do you want to be true?"
                  className="w-full resize-none bg-transparent text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none"
                />
                <div className="text-[10px] text-zinc-600 text-right">{(it.caption || "").length}/{VISION_TEXT_MAX}</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11px] text-zinc-600 px-1">Images are shrunk before saving and stay on this device. They're included in your JSON export.</p>
    </div>
  );
}
