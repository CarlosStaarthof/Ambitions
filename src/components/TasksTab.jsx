import { useState } from "react";
import { Trash2, Plus, Star } from "lucide-react";
import { uid, nextColor } from "../lib/time";
import { PALETTE } from "../lib/seed";
import { card, inputCls, btnPrimary, btnGhost } from "../lib/ui";
import { useArmed } from "../lib/useArmed";

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

export default function TasksTab({ tasks, categories, setTasksP, setCategoriesP, setWeeksP }) {
  const [newNames, setNewNames] = useState({});
  const [newCat, setNewCat] = useState("");
  const [colorFor, setColorFor] = useState(null);
  const { arm, isArmed } = useArmed();

  const updateTask = (id, patch) => setTasksP(tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  const updateCategory = (id, patch) => setCategoriesP(categories.map((c) => (c.id === id ? { ...c, ...patch } : c)));

  function clearTaskIdsFromWeeks(ids) {
    const drop = new Set(ids);
    setWeeksP((prev) => { const n = {}; for (const k in prev) { const cells = {}; for (const c in prev[k].cells) if (!drop.has(prev[k].cells[c])) cells[c] = prev[k].cells[c]; n[k] = { ...prev[k], cells }; } return n; });
  }

  function deleteTask(id) {
    setTasksP(tasks.filter((t) => t.id !== id));
    clearTaskIdsFromWeeks([id]);
  }

  function addTask(catId) {
    const name = (newNames[catId] || "").trim();
    if (!name) return;
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

  function deleteCategory(cat) {
    const ids = tasks.filter((t) => t.categoryId === cat.id).map((t) => t.id);
    setTasksP(tasks.filter((t) => t.categoryId !== cat.id));
    setCategoriesP(categories.filter((c) => c.id !== cat.id));
    if (ids.length) clearTaskIdsFromWeeks(ids);
  }

  return (
    <div className="space-y-3">
      {categories.map((cat) => {
        const catTasks = tasks.filter((t) => t.categoryId === cat.id);
        return (
          <div key={cat.id} className={card + " p-3 space-y-2"}>
            <div className="flex items-center gap-2">
              {cat.protected && <Star size={14} className="text-amber-400 shrink-0" fill="currentColor" />}
              <input value={cat.name} onChange={(e) => updateCategory(cat.id, { name: e.target.value })} className="flex-1 text-sm font-medium bg-transparent text-zinc-100 focus:outline-none" />
              {cat.protected ? (
                <span className="text-[10px] uppercase tracking-wide text-amber-400/80 shrink-0">priority</span>
              ) : (
                <button onClick={() => arm("delCat" + cat.id, () => deleteCategory(cat))} className={"text-xs px-2 py-1 rounded shrink-0 " + (isArmed("delCat" + cat.id) ? "bg-red-600 text-white" : "text-zinc-600 hover:text-red-400")}>{isArmed("delCat" + cat.id) ? "delete category?" : "remove"}</button>
              )}
            </div>

            <div className="space-y-1.5">
              {catTasks.map((t) => (
                <div key={t.id} className="flex items-center gap-2">
                  <span className="relative shrink-0">
                    <button onClick={() => setColorFor(colorFor === t.id ? null : t.id)} aria-label="Pick color" className="w-5 h-5 rounded-sm border border-zinc-600" style={{ background: t.color }} />
                    {colorFor === t.id && <ColorPicker color={t.color} onPick={(c) => updateTask(t.id, { color: c })} onClose={() => setColorFor(null)} />}
                  </span>
                  <input value={t.name} onChange={(e) => updateTask(t.id, { name: e.target.value })} className="flex-1 text-sm bg-transparent text-zinc-100 focus:outline-none" />
                  <input type="number" min="0" value={t.target ?? ""} onChange={(e) => updateTask(t.id, { target: e.target.value === "" ? null : Number(e.target.value) })} placeholder="h/wk" className="w-14 rounded border border-zinc-700 bg-zinc-800 text-zinc-100 px-2 py-1 text-xs" />
                  <button onClick={() => deleteTask(t.id)} className="text-zinc-600 hover:text-red-400 shrink-0"><Trash2 size={15} /></button>
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

      <p className="text-[11px] text-zinc-600 px-1">Ambition is your protected, highest-priority track and always stays on top. Everything else is yours to split into as many categories as you like.</p>
    </div>
  );
}
