import { useState } from "react";
import { Trash2, Plus } from "lucide-react";
import { uid } from "../lib/time";
import { PALETTE } from "../lib/seed";
import { card, inputCls, selectCls, btnPrimary } from "../lib/ui";

export default function TasksTab({ tasks, setTasksP, setWeeksP }) {
  const [newTask, setNewTask] = useState({ name: "", category: "basic", color: PALETTE[0], target: "" });

  function deleteTask(id) {
    setTasksP(tasks.filter((t) => t.id !== id));
    setWeeksP((prev) => { const n = {}; for (const k in prev) { const cells = {}; for (const c in prev[k].cells) if (prev[k].cells[c] !== id) cells[c] = prev[k].cells[c]; n[k] = { ...prev[k], cells }; } return n; });
  }
  function addTask() {
    if (!newTask.name.trim()) return;
    const t = { id: uid(), name: newTask.name.trim(), category: newTask.category, color: newTask.color, target: newTask.target !== "" ? Number(newTask.target) : null };
    setTasksP([...tasks, t]);
    setNewTask({ name: "", category: "basic", color: PALETTE[(tasks.length + 1) % PALETTE.length], target: "" });
  }

  return (
    <div className="space-y-4">
      {["basic", "ambition"].map((cat) => (
        <div key={cat}>
          <div className={"text-xs font-medium mb-2 " + (cat === "ambition" ? "text-amber-400" : "text-zinc-400")}>{cat === "basic" ? "Basic needs — come first" : "Ambition — protect & grow"}</div>
          <div className="space-y-2">
            {tasks.filter((t) => t.category === cat).map((t) => (
              <div key={t.id} className={card + " p-3 space-y-2"}>
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded-sm shrink-0" style={{ background: t.color }} />
                  <input value={t.name} onChange={(e) => setTasksP(tasks.map((x) => x.id === t.id ? { ...x, name: e.target.value } : x))} className="flex-1 text-sm bg-transparent text-zinc-100 focus:outline-none" />
                  <select value={t.category} onChange={(e) => setTasksP(tasks.map((x) => x.id === t.id ? { ...x, category: e.target.value } : x))} className="text-xs rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-100 px-2 py-1"><option value="basic">Basic need</option><option value="ambition">Ambition</option></select>
                  <button onClick={() => deleteTask(t.id)} className="text-zinc-600 hover:text-red-400"><Trash2 size={15} /></button>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {PALETTE.map((c) => <button key={c} onClick={() => setTasksP(tasks.map((x) => x.id === t.id ? { ...x, color: c } : x))} className={"w-5 h-5 rounded-sm " + (t.color === c ? "ring-2 ring-amber-400" : "")} style={{ background: c }} />)}
                </div>
                <div className="flex items-center gap-2 text-xs text-zinc-400">
                  Weekly target (h):
                  <input type="number" min="0" value={t.target ?? ""} onChange={(e) => setTasksP(tasks.map((x) => x.id === t.id ? { ...x, target: e.target.value === "" ? null : Number(e.target.value) } : x))} className="w-16 rounded border border-zinc-700 bg-zinc-800 text-zinc-100 px-2 py-1" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div className={card + " p-3 space-y-2"}>
        <div className="text-xs font-medium text-zinc-400">Add a task</div>
        <input value={newTask.name} onChange={(e) => setNewTask({ ...newTask, name: e.target.value })} placeholder="Task name…" className={inputCls} />
        <div className="flex items-center gap-2 flex-wrap">
          <select value={newTask.category} onChange={(e) => setNewTask({ ...newTask, category: e.target.value })} className={selectCls}><option value="basic">Basic need</option><option value="ambition">Ambition</option></select>
          <input type="number" min="0" value={newTask.target} onChange={(e) => setNewTask({ ...newTask, target: e.target.value })} placeholder="target h" className="w-20 rounded-lg border border-zinc-700 bg-zinc-800 text-zinc-100 px-2 py-1.5 text-sm" />
          <div className="flex gap-1">{PALETTE.slice(0, 8).map((c) => <button key={c} onClick={() => setNewTask({ ...newTask, color: c })} className={"w-5 h-5 rounded-sm " + (newTask.color === c ? "ring-2 ring-amber-400" : "")} style={{ background: c }} />)}</div>
          <button onClick={addTask} className={btnPrimary + " py-1.5"}><Plus size={14} /> Add</button>
        </div>
      </div>
    </div>
  );
}
