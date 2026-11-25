import { useState, useEffect, useMemo, useRef } from "react";
import { ChevronLeft, ChevronRight, Eraser, Plus, X, Mic, Sparkles, Trash2 } from "lucide-react";
import { addDays, isoDate, slotLabel, endLabel, weekStatsOf, mondayOf, uid, nextColor, fmtHM } from "../lib/time";
import { DAYS, SLOTS, OPEN_ID, clampLongPressMs } from "../lib/seed";
import { activeTasks, activeCategories, taskIndex, resolveCell } from "../lib/tasks";
import { notesOf, categoryRunAt, noteAt, canPlaceNote, addNote, updateNote, removeNote, cleanDictation } from "../lib/notes";
import { dictationSupported, startDictation, cancelDictation } from "../lib/dictation";
import { polishText } from "../lib/notePolish";
import { card, inputCls, btnPrimary, btnGhost } from "../lib/ui";
import { useArmed } from "../lib/useArmed";

function FragmentRow({ children }) { return <>{children}</>; }

const NOTE_ERRORS = {
  "range-invalid": "That range is invalid.",
  "empty-note": "Write something before saving.",
  overlap: "That range already has a note. Open it first.",
  "note-not-found": "That note no longer exists."
};

const DICTATION_ERRORS = {
  "dictation-denied": "Microphone access is blocked. Type the note instead.",
  "dictation-unsupported": "Dictation is not available here. Type the note instead.",
  "dictation-no-speech": "No speech was heard. Try again or type the note."
};

const rangeLabel = (start, end) => {
  const day = Math.floor(start / SLOTS);
  const from = start % SLOTS;
  const to = end - day * SLOTS;
  return `${DAYS[day]} ${slotLabel(from)}–${endLabel(to)}`;
};

// A finger that moves this far before the hold time is scrolling, not holding,
// so the gesture is cancelled and the grid scrolls normally.
const HOLD_CANCEL_PX = 8;

// Live clock for the grid highlights. 30s is plenty — a slot is 30 minutes, and
// re-rendering 336 cells every second would be wasteful.
function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const id = setInterval(() => setNow(new Date()), intervalMs); return () => clearInterval(id); }, [intervalMs]);
  return now;
}

export default function WeekTab({ tasks, categories, weeks, settings, ai, aiEnabled, setWeeksP, setTasksP, weekStart, setWeekStart }) {
  const [brush, setBrush] = useState(null);
  const [openCat, setOpenCat] = useState(null);
  const [openDlg, setOpenDlg] = useState(false);
  const [openName, setOpenName] = useState("");
  const [noteDlg, setNoteDlg] = useState(null);
  const [noteMsg, setNoteMsg] = useState("");
  const [scrollLocked, setScrollLocked] = useState(false);
  const paintingRef = useRef(false);
  const holdRef = useRef(null);
  const holdStart = useRef(null);
  // A long hold ends with a synthetic click/mousedown. That trailing tap must not
  // also paint, so the timer sets this flag and the next tap consumes it.
  const suppressTapRef = useRef(false);
  // Touch and pen paint on tap (click), never through the mouse-compatibility
  // path, so the hold gets its full time before anything changes.
  const pointerIsTouchRef = useRef(false);
  const { arm, isArmed } = useArmed();
  const now = useNow();
  const holdMs = clampLongPressMs(settings && settings.longPressMs);
  const canDictate = dictationSupported();

  useEffect(() => { const up = () => { paintingRef.current = false; }; window.addEventListener("mouseup", up); return () => window.removeEventListener("mouseup", up); }, []);
  // Release the hold lock however the touch ends, including when the editor
  // overlay takes the pointerup that the cell itself would have received.
  useEffect(() => {
    const end = () => clearHold();
    window.addEventListener("pointerup", end);
    window.addEventListener("pointercancel", end);
    return () => { window.removeEventListener("pointerup", end); window.removeEventListener("pointercancel", end); };
  }, []);
  useEffect(() => () => clearHold(), []);

  const weekKey = isoDate(weekStart);
  const weekCells = useMemo(() => (weeks[weekKey] && weeks[weekKey].cells) || {}, [weeks, weekKey]);
  const weekNotes = useMemo(() => notesOf(weeks[weekKey]), [weeks, weekKey]);
  const noteStarts = useMemo(() => new Set(weekNotes.map((n) => n && n.start)), [weekNotes]);
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

  function clearHold() {
    if (holdRef.current) { clearTimeout(holdRef.current); holdRef.current = null; }
    holdStart.current = null;
    setScrollLocked(false);
  }

  // Notes are a sibling field of `cells`, so every write keeps the rest of the week —
  // including feature 8's approval/snapshot fields — untouched.
  function writeNotes(next) {
    setWeeksP((prev) => {
      const wk = prev[weekKey] || { cells: {} };
      return { ...prev, [weekKey]: { ...wk, notes: next } };
    });
  }

  function openNoteAt(index) {
    setNoteMsg("");
    const existing = noteAt(weekNotes, index);
    if (existing) {
      setNoteDlg({ mode: "view", id: existing.id, start: existing.start, end: existing.end, text: existing.text, error: "", notice: "", dictationError: "", micOff: false, busy: false });
      return;
    }
    const run = categoryRunAt(weekCells, tasks, index);
    if (!run) {
      setNoteMsg("Long-press a filled block to add a note.");
      return;
    }
    if (!canPlaceNote(weekNotes, run.start, run.end)) {
      setNoteMsg("That range already has a note. Open it first.");
      return;
    }
    setNoteDlg({ mode: "edit", id: null, start: run.start, end: run.end, text: "", error: "", notice: "", dictationError: "", micOff: false, busy: false });
  }

  function handleCellPointerDown(d, s, e) {
    // The note gesture belongs to the calendar, not to the brush: a selected task
    // or the eraser no longer disables it. Only an open note dialog does. A short
    // tap still paints below, because the hold is cancelled on lift.
    if (noteDlg) return;
    clearHold();
    suppressTapRef.current = false;
    pointerIsTouchRef.current = e.pointerType === "touch" || e.pointerType === "pen";
    const index = d * SLOTS + s;
    holdStart.current = { x: e.clientX, y: e.clientY };
    holdRef.current = setTimeout(() => {
      holdRef.current = null;
      holdStart.current = null;
      // The hold is real: swallow the tap that ends it and pause scrolling until
      // the finger lifts or cancels.
      suppressTapRef.current = true;
      setScrollLocked(true);
      openNoteAt(index);
    }, holdMs);
  }

  // Moving before the hold completes means the user is scrolling, so cancel
  // the note gesture and leave the grid fully scrollable.
  function handleCellPointerMove(e) {
    if (!holdStart.current) return;
    const dx = e.clientX - holdStart.current.x;
    const dy = e.clientY - holdStart.current.y;
    if (Math.hypot(dx, dy) > HOLD_CANCEL_PX) clearHold();
  }

  function closeNote() {
    cancelDictation();
    setNoteDlg(null);
  }

  function saveNote() {
    const at = new Date().toISOString();
    const text = noteDlg.text;
    const result = noteDlg.id
      ? updateNote(weekNotes, noteDlg.id, { text }, at)
      : addNote(weekNotes, { id: uid(), start: noteDlg.start, end: noteDlg.end, text, at });
    if (result.error) { setNoteDlg((d) => ({ ...d, error: NOTE_ERRORS[result.error] || "Could not save the note." })); return; }
    writeNotes(result.notes);
    closeNote();
  }

  function deleteNote(id) {
    writeNotes(removeNote(weekNotes, id));
    closeNote();
  }

  async function dictate() {
    if (!canDictate || noteDlg.busy) return;
    setNoteDlg((d) => ({ ...d, dictationError: "", notice: "", busy: true }));
    const res = await startDictation();
    if (res && res.error) {
      setNoteDlg((d) => ({ ...d, busy: false, micOff: res.error === "dictation-denied", dictationError: DICTATION_ERRORS[res.error] || DICTATION_ERRORS["dictation-unsupported"] }));
      return;
    }
    // The phone's transcript always passes the non-AI cleanup before it reaches the field.
    const cleaned = cleanDictation((res && res.text) || "");
    setNoteDlg((d) => ({
      ...d,
      busy: false,
      text: [d.text.trim(), cleaned].filter(Boolean).join(" "),
      notice: cleaned ? "" : "Nothing was heard. Try again or type the note."
    }));
  }

  async function polish() {
    if (!aiEnabled || !noteDlg || noteDlg.busy) return;
    if (!noteDlg.text.trim()) { setNoteDlg((d) => ({ ...d, error: "Write something before polishing." })); return; }
    setNoteDlg((d) => ({ ...d, busy: true, error: "", notice: "" }));
    const res = await polishText(noteDlg.text, { settings, aiKeys: (ai && ai.keys) || {} });
    if (res && res.error) {
      setNoteDlg((d) => ({ ...d, busy: false, error: "Could not polish the note. Your text is unchanged." }));
      return;
    }
    // Shown for review only — the user still has to Save, so nothing is replaced silently.
    setNoteDlg((d) => ({ ...d, busy: false, text: res.text, notice: "Polished — review it, then Save." }));
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

      {noteMsg && <div className="text-xs text-amber-300">{noteMsg}</div>}

      <div className="border border-zinc-800 rounded-xl bg-zinc-900 overflow-auto" style={{ maxHeight: "58vh", userSelect: "none" }}>
        <div style={{ display: "grid", gridTemplateColumns: "44px repeat(7, 1fr)", touchAction: scrollLocked ? "none" : "pan-y" }} onContextMenu={(e) => e.preventDefault()}>
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
                  const globalIndex = d * SLOTS + s;
                  // Three kinds only: empty, a task, or a scheduled half hour whose task
                  // cannot be named. An unknown cell used to render pixel-identical to an
                  // empty one, which is what made the lost history invisible.
                  const cell = resolveCell(id, index);
                  const filledCell = cell.kind !== "empty";
                  const isStart = filledCell && weekCells[`${d}-${s - 1}`] !== id;
                  const isToday = isThisWeek && d === todayIdx;
                  const isNowCell = isNowRow && isToday;
                  // A note is marked on the first cell of its range, even after the cells
                  // under it were erased — the note stays anchored to time, not to a task.
                  const hasNoteStart = noteStarts.has(globalIndex);
                  // Tints only paint on empty cells, so they never fight a block colour.
                  const tint = filledCell ? null : isNowCell ? "rgba(245,158,11,0.30)" : isNowRow ? "rgba(245,158,11,0.12)" : isToday ? "rgba(245,158,11,0.06)" : null;
                  return (
                    <div key={d} title={filledCell ? `${cell.name} · ${slotLabel(s)}` : slotLabel(s)}
                      onMouseDown={() => { if (pointerIsTouchRef.current || suppressTapRef.current) return; paintingRef.current = true; applyBrush(d, s); }}
                      onMouseEnter={() => { if (paintingRef.current && !suppressTapRef.current) applyBrush(d, s); }}
                      onClick={() => { if (suppressTapRef.current) { suppressTapRef.current = false; return; } applyBrush(d, s); }}
                      onPointerDown={(e) => handleCellPointerDown(d, s, e)}
                      onPointerMove={handleCellPointerMove}
                      onPointerUp={clearHold}
                      onPointerCancel={clearHold}
                      onPointerLeave={clearHold}
                      className={"relative border-l border-zinc-800 cursor-pointer flex items-center justify-center " + (onHour ? "border-t border-zinc-700" : "")}
                      style={{
                        height: 26,
                        background: filledCell ? cell.color : tint || "transparent",
                        // The "now" line sits on the top edge of the current slot.
                        boxShadow: isNowRow ? "inset 0 2px 0 rgba(245,158,11,0.85)" : undefined,
                        outline: isNowCell ? "1px solid #f59e0b" : undefined,
                        outlineOffset: isNowCell ? -1 : undefined
                      }}>
                      {isStart && <span style={{ fontSize: 9, color: "#fff", fontWeight: 600 }}>{cell.code}</span>}
                      {hasNoteStart && <span aria-label="Note" title="Note" style={{ position: "absolute", top: 2, right: 2, width: 6, height: 6, borderRadius: 9999, background: "#fbbf24", boxShadow: "0 0 0 1px rgba(0,0,0,0.5)" }} />}
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
          <button onClick={() => arm("clearWeek", () => setWeeksP((p) => {
            const wk = p[weekKey] || { cells: {} };
            // Notes are user writing about the time, not part of the schedule. The
            // armed action clears blocks only; their markers stay anchored.
            return { ...p, [weekKey]: { ...wk, cells: {} } };
          }))} title="Clears the painted blocks; notes are kept" className={"text-xs px-2 py-1 rounded-lg " + (isArmed("clearWeek") ? "bg-red-600 text-white" : "text-red-400 hover:bg-zinc-800")}>{isArmed("clearWeek") ? "tap to confirm" : "clear this week"}</button>
          <span className="text-[11px] text-zinc-500">blocks only — notes are kept</span>
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

      {noteDlg && (
        <>
          <div className="fixed inset-0 z-40 bg-black/70" />
          <div className="fixed z-50 left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[min(24rem,92vw)] bg-zinc-900 border border-zinc-700 rounded-xl p-4 space-y-3 shadow-xl">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-sm font-medium">{noteDlg.mode === "view" ? "Note" : noteDlg.id ? "Edit note" : "New note"}</div>
                <div className="text-[11px] text-zinc-500">{rangeLabel(noteDlg.start, noteDlg.end)}</div>
              </div>
              <button onClick={closeNote} aria-label="Close" className="p-1 rounded-lg text-zinc-400 hover:bg-zinc-800 shrink-0"><X size={16} /></button>
            </div>

            {noteDlg.mode === "view" ? (
              <>
                <p className="text-sm text-zinc-200 whitespace-pre-wrap break-words max-h-52 overflow-auto">{noteDlg.text}</p>
                <div className="flex flex-wrap items-center justify-end gap-2">
                  <button
                    onClick={() => arm("note-" + noteDlg.id, () => deleteNote(noteDlg.id))}
                    className={"inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-lg " + (isArmed("note-" + noteDlg.id) ? "bg-red-600 text-white" : "text-red-400 hover:bg-zinc-800")}
                  >
                    <Trash2 size={13} /> {isArmed("note-" + noteDlg.id) ? "tap to confirm" : "Delete"}
                  </button>
                  <button onClick={closeNote} className="text-xs px-3 py-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800">Close</button>
                  <button onClick={() => setNoteDlg((d) => ({ ...d, mode: "edit", error: "", notice: "" }))} className={btnPrimary + " text-xs py-1.5"}>Edit</button>
                </div>
              </>
            ) : (
              <>
                <textarea
                  value={noteDlg.text}
                  onChange={(e) => setNoteDlg((d) => ({ ...d, text: e.target.value, error: "" }))}
                  placeholder="What happened?"
                  rows={5}
                  autoFocus
                  className={inputCls + " resize-y"}
                />

                {noteDlg.error && <p className="text-[11px] text-red-400">{noteDlg.error}</p>}
                {noteDlg.notice && <p className="text-[11px] text-amber-300">{noteDlg.notice}</p>}

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={dictate}
                    disabled={!canDictate || noteDlg.busy || noteDlg.micOff}
                    title={canDictate ? "Dictate with the phone's speech-to-text" : "Dictation needs the Android app"}
                    className={btnGhost + " text-xs py-1.5 disabled:opacity-40"}
                  >
                    <Mic size={13} /> Dictate
                  </button>
                  {aiEnabled && (
                    <button onClick={polish} disabled={noteDlg.busy} className={btnGhost + " text-xs py-1.5 disabled:opacity-40"}>
                      <Sparkles size={13} /> Polish
                    </button>
                  )}
                  {noteDlg.id && (
                    <button
                      onClick={() => arm("note-" + noteDlg.id, () => deleteNote(noteDlg.id))}
                      className={"inline-flex items-center gap-1 text-xs px-2 py-1.5 rounded-lg " + (isArmed("note-" + noteDlg.id) ? "bg-red-600 text-white" : "text-red-400 hover:bg-zinc-800")}
                    >
                      <Trash2 size={13} /> {isArmed("note-" + noteDlg.id) ? "tap to confirm" : "Delete"}
                    </button>
                  )}
                </div>

                {!canDictate && <p className="text-[11px] text-zinc-500">Dictation needs the Android app. Type the note instead.</p>}
                {noteDlg.dictationError && <p className="text-[11px] text-amber-400">{noteDlg.dictationError}</p>}
                <p className="text-[11px] text-zinc-500">No audio is stored. AI polish appears only when your own key is set up in Settings.</p>

                <div className="flex justify-end gap-2">
                  <button onClick={closeNote} className="text-xs px-3 py-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800">Cancel</button>
                  <button onClick={saveNote} disabled={!noteDlg.text.trim() || noteDlg.busy} className={btnPrimary + " text-xs py-1.5"}>Save</button>
                </div>
              </>
            )}
          </div>
        </>
      )}
    </div>
  );
}
