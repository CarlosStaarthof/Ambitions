import { useState } from "react";
import { Trash2, Plus, Star, RotateCcw, ChevronRight, ChevronDown } from "lucide-react";
import { uid, nextColor, fmtHM, parseHM } from "../lib/time";
import { PALETTE } from "../lib/seed";
import { activeTasks, activeCategories, retiredTasks, retireTask, retireCategory, restoreTask } from "../lib/tasks";
import { card, inputCls, btnPrimary, btnGhost, advanceOnEnter } from "../lib/ui";
import { useArmed } from "../lib/useArmed";

// Armed copy states the new semantics outright: removing a task is not a deletion of
// the record. The em dash matches the rest of the app's copy.
const ARMED_TASK_LABEL = "Tap again to remove — past weeks keep it";
const ARMED_CAT_LABEL = "Tap again to remove the category and its tasks — past weeks keep them";

// Week-scoped tasks show which Monday they belong to, e.g. "24 Aug".
const weekLabel = (key) => {
  const [y, m, d] = String(key).split("-").map(Number);
  if (!y || !m || !d) return key;
  return new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

function ColorPicker({ color, onPick, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="absolute left-0 top-7 z-50 p-2 bg-zinc-900 border border-zinc-700 rounded-lg shadow-xl" style={{ width: 184 }}>
        <div className="grid grid-cols-6 gap-1.5">
          {PALETTE.map((c) => (
            <button key={c} onClick={() => { onPick(c); onClose(); }} className={"w-6 h-6 rounded " + (color === c ? "ring-2 ring-amber-400" : "")} style={{ background: c }} />
          ))}
        </div>
        <label className="flex items-center justify-between gap-2 text-xs text-zinc-400 mt-2 cursor-pointer">
          <span>Custom</span>
          <input type="color" value={/^#[0-9a-fA-F]{6}$/.test(color) ? color : "#888888"} onChange={(e) => onPick(e.target.value)} className="w-8 h-6 bg-transparent border-0 p-0 cursor-pointer" />
        </label>
      </div>
    </>
  );
}

export default function TasksTab({ tasks, categories, setTasksP, setCategoriesP }) {
  const [newNames, setNewNames] = useState({});
  const [newCat, setNewCat] = useState("");
  const [showRetired, setShowRetired] = useState(false);
  const [colorFor, setColorFor] = useState(null);
  // Targets are typed as h:mm but stored as decimal hours, so the raw text is held
  // while editing and only parsed on blur — otherwise "1:" would parse mid-keystroke.
  const [targetDraft, setTargetDraft] = useState({});
  const { arm, isArmed } = useArmed();

  const retired = retiredTasks(tasks);
  // A retired task's category may itself be retired, so name lookup spans all of them.
  const categoryNameOf = (id) => (categories.find((c) => c.id === id) || {}).name || "no category";

  const updateTask = (id, patch) => setTasksP(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));

  function commitTarget(id) {
    if (!(id in targetDraft)) return;
    updateTask(id, { target: parseHM(targetDraft[id]) });
    const next = { ...targetDraft }; delete next[id]; setTargetDraft(next);
  }
  const updateCategory = (id, patch) => setCategoriesP(categories.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  // Removing a task retires it: it leaves every list, picker and count here, and
  // nothing in `weeks` is read, written or rewritten. Every week that already holds it
  // keeps rendering its blocks with its real name and colour. This tab has no route to
  // `weeks` at all any more — that absence is the regression barrier.
  function removeTask(id) {
    setTasksP(retireTask(tasks, id, new Date().toISOString()));
  }

  function undoRemoveTask(id) {
    const next = restoreTask(tasks, categories, id);
    setTasksP(next.tasks);
    setCategoriesP(next.categories);
  }

  function addTask(catId) {
    const name = (newNames[catId] || "").trim();
    if (!name) return;
    // Every colour in `tasks`, retired included — a new task taking a retired task's
    // colour would make two different things look identical in past weeks.
    const color = nextColor(tasks.map((t) => t.color));
    setTasksP([...tasks, { id: uid(), name, categoryId: catId, color, target: null }]);
    setNewNames({ ...newNames, [catId]: "" });
  }

  function addCategory() {
    const name = newCat.trim();
    if (!name) return;
    setCategoriesP([...categories, { id: uid(), name, protected: false }]);
    setNewCat("");
  }

  // Same deal for a category: it and its tasks are retired together, with one
  // timestamp, so restoring any of them brings the category back too.
  function removeCategory(cat) {
    const next = retireCategory(tasks, categories, cat.id, new Date().toISOString());
    setTasksP(next.tasks);
    setCategoriesP(next.categories);
  }

  return (
    <div className="space-y-3">
      {activeCategories(categories).map((cat) => {
        const catTasks = activeTasks(tasks).filter((t) => t.categoryId === cat.id);
        return (
          <div key={cat.id} className={card + " p-3 space-y-2"}>
            <div className="flex items-center gap-2">
              {cat.protected && <Star size={14} className="text-amber-400 shrink-0" fill="currentColor" />}
              <input value={cat.name} onChange={(e) => updateCategory(cat.id, { name: e.target.value })} onKeyDown={advanceOnEnter} className="flex-1 min-w-0 text-sm font-medium bg-transparent text-zinc-100 focus:outline-none" />
              {cat.protected ? (
                <span className="text-[10px] uppercase tracking-wide text-amber-400/80 shrink-0">priority</span>
              ) : (
                <button onClick={() => arm("delCat" + cat.id, () => removeCategory(cat))} title={isArmed("delCat" + cat.id) ? ARMED_CAT_LABEL : "Remove category"} className={"text-xs px-2 py-1 rounded shrink-0 " + (isArmed("delCat" + cat.id) ? "bg-red-600 text-white" : "text-zinc-600 hover:text-red-400")}>{isArmed("delCat" + cat.id) ? "tap again to remove" : "remove"}</button>
              )}
            </div>

            <div className="space-y-1.5">
              {catTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2">
                  <span className="relative shrink-0">
                    <button onClick={() => setColorFor(colorFor === t.id ? null : t.id)} aria-label="Pick color" className="w-5 h-5 rounded-sm border border-zinc-600" style={{ background: t.color }} />
                    {colorFor === t.id && <ColorPicker color={t.color} onPick={(c) => updateTask(t.id, { color: c })} onClose={() => setColorFor(null)} />}
                  </span>
                  <input value={t.name} onChange={(e) => updateTask(t.id, { name: e.target.value })} onKeyDown={advanceOnEnter} className="flex-1 min-w-0 text-sm bg-transparent text-zinc-100 focus:outline-none" />
                  {/* One-offs only appear in their own week's picker, so say which week. */}
                  {t.weekKey && <span className="text-[10px] text-zinc-500 shrink-0" title={`Only shown in the week of ${t.weekKey}`}>{weekLabel(t.weekKey)}</span>}
                  <input
                    type="text" inputMode="numeric"
                    value={targetDraft[t.id] ?? fmtHM(t.target)}
                    onChange={(e) => setTargetDraft({ ...targetDraft, [t.id]: e.target.value })}
                    onBlur={() => commitTarget(t.id)}
                    onKeyDown={(e) => { if (e.key === "Enter") { commitTarget(t.id); advanceOnEnter(e); } }}
                    placeholder="h:mm"
                    title="Weekly target as hours:minutes, e.g. 1:30"
                    className="w-16 shrink-0 rounded border border-zinc-700 bg-zinc-800 text-zinc-100 px-2 py-1 text-xs text-center"
                  />
                  {/* Two taps, same 4s window as the category control above. */}
                  <button onClick={() => arm("delTask" + t.id, () => removeTask(t.id))}
                    title={isArmed("delTask" + t.id) ? ARMED_TASK_LABEL : "Remove task"}
                    aria-label={isArmed("delTask" + t.id) ? ARMED_TASK_LABEL : "Remove task"}
                    className={"shrink-0 p-1 -mr-1 rounded " + (isArmed("delTask" + t.id) ? "bg-red-600 text-white" : "text-zinc-600 hover:text-red-400")}><Trash2 size={15} /></button>
                </div>
              ))}
              {catTasks.length === 0 && <div className="text-xs text-zinc-600 pl-7">No tasks yet.</div>}
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input value={newNames[cat.id] || ""} onChange={(e) => setNewNames({ ...newNames, [cat.id]: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") addTask(cat.id); }} placeholder="Add a task…" className={inputCls + " py-1.5"} />
              <button onClick={() => addTask(cat.id)} className={btnPrimary + " py-1.5 shrink-0"}><Plus size={14} /></button>
            </div>
          </div>
        );
      })}

      <div className={card + " p-3 flex items-center gap-2"}>
        <input value={newCat} onChange={(e) => setNewCat(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addCategory(); }} placeholder="New category…" className={inputCls} />
        <button onClick={addCategory} className={btnGhost + " shrink-0"}><Plus size={14} /> Category</button>
      </div>

      {/* Collapsed, newest first, and only rendered when something is actually retired —
          an empty header would just be noise. Restore is one tap and is deliberately not
          armed: it destroys nothing, and it is the only safe direction of travel. There
          is no "delete forever" here, because purging a task would orphan every cell it
          holds, which is the bug this section exists to undo. */}
      {retired.length > 0 && (
        <div className={card + " p-3 space-y-2"}>
          <button onClick={() => setShowRetired(!showRetired)} className="flex items-center gap-1.5 text-sm font-medium text-zinc-300 w-full text-left">
            {showRetired ? <ChevronDown size={14} className="shrink-0" /> : <ChevronRight size={14} className="shrink-0" />}
            Retired <span className="text-zinc-500 font-normal">{retired.length}</span>
          </button>
          {showRetired && (
            <div className="space-y-1.5">
              {retired.map((t) => (
                <div key={t.id} className="flex items-center gap-2">
                  <span className="w-5 h-5 rounded-sm border border-zinc-700 shrink-0" style={{ background: t.color }} />
                  <span className="flex-1 min-w-0 text-sm text-zinc-400 truncate">{t.name}</span>
                  <span className="text-[10px] text-zinc-500 shrink-0">{categoryNameOf(t.categoryId)}</span>
                  <button onClick={() => undoRemoveTask(t.id)} title="Restore task" aria-label="Restore task" className="shrink-0 p-1 -mr-1 rounded text-zinc-500 hover:text-amber-400"><RotateCcw size={15} /></button>
                </div>
              ))}
              <p className="text-[11px] text-zinc-600">Restoring puts a task back in its category, keeping its colour and target.</p>
            </div>
          )}
        </div>
      )}

      <p className="text-[11px] text-zinc-600 px-1">Ambition is your protected, highest-priority track and always stays on top. Everything else is yours to split into as many categories as you like. Weeks you have already filled keep a removed task, so your record of what you did never changes.</p>
    </div>
  );
}
