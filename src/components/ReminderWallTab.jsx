import { useState } from "react";
import { Check, Clock, Pencil, Plus, Trash2, X } from "lucide-react";
import { uid } from "../lib/time";
import { card, inputCls, selectCls, btnPrimary, btnGhost } from "../lib/ui";
import { useArmed } from "../lib/useArmed";
import {
  UNCATEGORIZED_ID, UNCATEGORIZED_COLOR,
  activeReminders, archivedReminders, categoryUsage, createdDate,
  addCategory, renameCategory, deleteCategory, addReminder, editReminder, markDone,
  deleteReminder
} from "../lib/reminderWall";

const COPY = {
  "name-empty": "Give the category a name.",
  "name-duplicate": "That category name is already used.",
  "category-missing": "That category no longer exists.",
  "category-not-empty": "This category still holds reminders.",
  "text-empty": "Write something on the reminder.",
  "reminder-not-found": "That reminder no longer exists.",
  "reminder-archived": "That reminder is already archived."
};

const tint = (color) => (/^#[0-9a-fA-F]{6}$/.test(color) ? color + "22" : "rgba(255,255,255,0.04)");
const doneLabel = (iso) => {
  const d = new Date(iso);
  return isNaN(d.getTime()) ? "" : d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
};
const addedLabel = (iso) => {
  const day = createdDate(iso);
  if (!day) return "Added date unknown";
  const [y, m, d] = day.split("-").map(Number);
  return `Added ${new Date(y, m - 1, d).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" })}`;
};

export default function ReminderWallTab({ reminderWall, setReminderWallP, view = "wall" }) {
  const { arm, isArmed } = useArmed();
  const [newCat, setNewCat] = useState("");
  const [catError, setCatError] = useState("");
  const [catDrafts, setCatDrafts] = useState({});
  const [catErrors, setCatErrors] = useState({});
  const [filter, setFilter] = useState("all");
  const [newText, setNewText] = useState("");
  const [newCatId, setNewCatId] = useState("");
  const [addError, setAddError] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editText, setEditText] = useState("");
  const [editCatId, setEditCatId] = useState("");
  const [editError, setEditError] = useState("");
  const [deleteError, setDeleteError] = useState("");

  const categories = reminderWall.categories;
  const active = activeReminders(reminderWall.items);
  const archived = archivedReminders(reminderWall.items);
  const categoryOf = (id) => categories.find((c) => c.id === id) || { name: "Uncategorized", color: UNCATEGORIZED_COLOR };
  const selectedFilter = filter === "all" || categories.some((c) => c.id === filter) ? filter : "all";
  const shown = selectedFilter === "all" ? active : active.filter((it) => it.categoryId === selectedFilter);
  const selectedCat = categories.some((c) => c.id === newCatId) ? newCatId : (categories[0] ? categories[0].id : "");

  function addCat() {
    const r = addCategory(reminderWall, { id: uid(), name: newCat });
    if (r.error) { setCatError(r.error); return; }
    setReminderWallP(r.wall);
    setNewCat(""); setCatError("");
  }

  function commitRename(cat) {
    if (!(cat.id in catDrafts)) return;
    const r = renameCategory(reminderWall, cat.id, catDrafts[cat.id]);
    if (r.error) { setCatErrors({ ...catErrors, [cat.id]: r.error }); return; }
    setReminderWallP(r.wall);
    const nextDrafts = { ...catDrafts }; delete nextDrafts[cat.id]; setCatDrafts(nextDrafts);
    const nextErrors = { ...catErrors }; delete nextErrors[cat.id]; setCatErrors(nextErrors);
  }

  function removeCat(cat) {
    const r = deleteCategory(reminderWall, cat.id);
    if (r.error) { setCatErrors({ ...catErrors, [cat.id]: r.error }); return; }
    setReminderWallP(r.wall);
    const nextDrafts = { ...catDrafts }; delete nextDrafts[cat.id]; setCatDrafts(nextDrafts);
    const nextErrors = { ...catErrors }; delete nextErrors[cat.id]; setCatErrors(nextErrors);
    if (filter === cat.id) setFilter("all");
    if (newCatId === cat.id) setNewCatId("");
  }

  function addItem() {
    const r = addReminder(reminderWall, { id: uid(), categoryId: selectedCat, text: newText, at: new Date().toISOString() });
    if (r.error) { setAddError(r.error); return; }
    setReminderWallP(r.wall);
    setNewText(""); setAddError("");
  }

  function startEdit(it) {
    setEditingId(it.id); setEditText(it.text); setEditCatId(it.categoryId); setEditError("");
  }

  function commitEdit() {
    const r = editReminder(reminderWall, editingId, { categoryId: editCatId, text: editText, at: new Date().toISOString() });
    if (r.error) { setEditError(r.error); return; }
    setReminderWallP(r.wall);
    setEditingId(null); setEditError("");
  }

  function tickDone(id) {
    const r = markDone(reminderWall, id, new Date().toISOString());
    if (!r.error) setReminderWallP(r.wall);
    if (editingId === id) setEditingId(null);
  }

  // Permanent delete, from the wall or the archive. The armed click is the
  // confirmation step; no reminder is ever written back to another list.
  function removeItem(id) {
    const r = deleteReminder(reminderWall, id);
    if (r.error) { setDeleteError(r.error); return; }
    setReminderWallP(r.wall);
    setDeleteError("");
    if (editingId === id) setEditingId(null);
  }

  const uncategorizedUsage = categoryUsage(reminderWall, UNCATEGORIZED_ID);

  if (view === "archive") {
    return (
      <div className="space-y-3">
        {deleteError && <p className="text-[11px] text-red-400">{COPY[deleteError]}</p>}
        {archived.length === 0 ? (
          <div className={card + " p-6 text-center text-sm text-zinc-500"}>Nothing archived yet.</div>
        ) : (
          archived.map((it) => {
            const cat = categoryOf(it.categoryId);
            const armed = isArmed("rmDel" + it.id);
            return (
              <div key={it.id} className={card + " p-3 space-y-2"} style={{ borderColor: cat.color }}>
                <div className="flex items-center justify-between gap-2 text-[11px] text-zinc-500">
                  <span className="inline-flex items-center gap-1.5 min-w-0">
                    <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color }} />
                    <span className="truncate">{cat.name}</span>
                  </span>
                  <span className="shrink-0">{doneLabel(it.doneAt)}</span>
                </div>
                <p className="text-sm text-zinc-300 whitespace-pre-wrap break-words">{it.text}</p>
                <div className="flex justify-end">
                  <button
                    onClick={() => arm("rmDel" + it.id, () => removeItem(it.id))}
                    className={"inline-flex items-center gap-1 text-xs px-2 py-1 rounded " + (armed ? "bg-red-600 text-white" : "text-red-400 hover:bg-zinc-800")}
                  >
                    <Trash2 size={13} /> {armed ? "tap to confirm" : "Delete"}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {deleteError && <p className="text-[11px] text-red-400">{COPY[deleteError]}</p>}
      <div className={card + " p-3 space-y-3"}>
        <div className="text-sm font-medium">Reminder categories</div>
        {categories.length === 0 && (
          <p className="text-xs text-zinc-500">Your wall needs a category before it can hold a reminder.</p>
        )}

        <div className="space-y-2">
          {categories.map((cat) => {
            const usage = categoryUsage(reminderWall, cat.id);
            const armed = isArmed("rmCat" + cat.id);
            const locked = cat.id === UNCATEGORIZED_ID && usage > 0;
            return (
              <div key={cat.id} className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="w-4 h-4 rounded shrink-0" style={{ background: cat.color }} />
                  <input
                    value={catDrafts[cat.id] ?? cat.name}
                    onChange={(e) => setCatDrafts({ ...catDrafts, [cat.id]: e.target.value })}
                    onBlur={() => commitRename(cat)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); e.currentTarget.blur(); } }}
                    className="flex-1 min-w-0 text-sm bg-transparent text-zinc-100 focus:outline-none"
                  />
                  <button
                    onClick={() => arm("rmCat" + cat.id, () => removeCat(cat))}
                    disabled={locked}
                    title={locked ? "Uncategorized still holds reminders" : "Remove category"}
                    className={"text-xs px-2 py-1 rounded shrink-0 " + (locked ? "text-zinc-700 cursor-not-allowed" : armed ? "bg-red-600 text-white" : "text-zinc-500 hover:text-red-400")}
                  >
                    {armed ? `Tap again — ${usage} to Uncategorized` : "remove"}
                  </button>
                </div>
                {catErrors[cat.id] && <p className="text-[11px] text-red-400 pl-6">{COPY[catErrors[cat.id]]}</p>}
              </div>
            );
          })}
        </div>

        {uncategorizedUsage > 0 && (
          <p className="text-[11px] text-zinc-500">Uncategorized holds {uncategorizedUsage} reminder{uncategorizedUsage === 1 ? "" : "s"}, so it cannot be deleted until they move or are gone.</p>
        )}

        <div className="flex items-center gap-2">
          <input
            value={newCat}
            onChange={(e) => setNewCat(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") addCat(); }}
            placeholder="New category…"
            className={inputCls + " py-1.5"}
          />
          <button onClick={addCat} className={btnGhost + " py-1.5 shrink-0"}><Plus size={14} /> Category</button>
        </div>
        {catError && <p className="text-[11px] text-red-400">{COPY[catError]}</p>}
      </div>

      {categories.length > 0 && (
        <>
          <div className={card + " p-3 space-y-2"}>
            <div className="text-sm font-medium">New reminder</div>
            <textarea
              value={newText}
              onChange={(e) => setNewText(e.target.value)}
              placeholder="Remember this…"
              rows={2}
              className={inputCls + " resize-y"}
            />
            <div className="flex items-center gap-2">
              <select value={selectedCat} onChange={(e) => setNewCatId(e.target.value)} className={selectCls + " flex-1 min-w-0"}>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <button onClick={addItem} className={btnPrimary + " shrink-0"}><Plus size={14} /> Add</button>
            </div>
            {addError && <p className="text-[11px] text-red-400">{COPY[addError]}</p>}
          </div>

          <div className="flex flex-wrap gap-1.5">
            <button onClick={() => setFilter("all")} className={"px-3 py-1 rounded-full text-xs border " + (selectedFilter === "all" ? "bg-amber-500 text-black border-amber-500 font-medium" : "border-zinc-700 text-zinc-400 hover:bg-zinc-900")}>All</button>
            {categories.map((c) => (
              <button key={c.id} onClick={() => setFilter(c.id)} className={"px-3 py-1 rounded-full text-xs border " + (selectedFilter === c.id ? "bg-amber-500 text-black border-amber-500 font-medium" : "border-zinc-700 text-zinc-400 hover:bg-zinc-900")}>{c.name}</button>
            ))}
          </div>

          {active.length === 0 ? (
            <div className={card + " p-6 text-center text-sm text-zinc-500"}>No reminders on the wall.</div>
          ) : shown.length === 0 ? (
            <div className={card + " p-6 text-center text-sm text-zinc-500"}>No reminders in this category.</div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {shown.map((it) => {
                const cat = categoryOf(it.categoryId);
                const armed = isArmed("rmDel" + it.id);
                return (
                  <div key={it.id} className="rounded-xl border p-3 space-y-2" style={{ borderColor: cat.color, background: tint(cat.color) }}>
                    <div className="flex items-center gap-1.5 text-[11px] min-w-0" style={{ color: cat.color }}>
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cat.color }} />
                      <span className="truncate">{cat.name}</span>
                    </div>

                    {editingId === it.id ? (
                      <div className="space-y-2">
                        <textarea
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          rows={2}
                          className={inputCls + " resize-y"}
                        />
                        <select value={editCatId} onChange={(e) => setEditCatId(e.target.value)} className={selectCls + " w-full"}>
                          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                        </select>
                        {editError && <p className="text-[11px] text-red-400">{COPY[editError]}</p>}
                        <div className="flex items-center gap-1.5 justify-end">
                          <button onClick={() => setEditingId(null)} className="text-xs px-2 py-1 rounded text-zinc-400 hover:bg-zinc-800 inline-flex items-center gap-1"><X size={13} /> Cancel</button>
                          <button onClick={commitEdit} className="text-xs px-2 py-1 rounded bg-amber-500 text-black font-medium inline-flex items-center gap-1"><Check size={13} /> Save</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm text-zinc-100 whitespace-pre-wrap break-words">{it.text}</p>
                        <div className="flex flex-wrap items-center justify-between gap-1">
                          <span className="inline-flex min-w-0 items-center gap-1 text-[10px] text-zinc-500" title={addedLabel(it.createdAt)}>
                            <Clock size={11} className="shrink-0" />
                            <span className="truncate">{addedLabel(it.createdAt)}</span>
                          </span>
                          <div className="ml-auto flex items-center gap-1">
                            <button onClick={() => startEdit(it)} aria-label="Edit reminder" title="Edit reminder" className="p-1.5 rounded text-zinc-400 hover:bg-zinc-800"><Pencil size={14} /></button>
                            <button onClick={() => tickDone(it.id)} aria-label="Mark reminder done" className="text-xs px-2 py-1 rounded bg-zinc-800 text-zinc-300 hover:bg-zinc-700 inline-flex items-center gap-1"><Check size={13} /> Done</button>
                            <button
                              onClick={() => arm("rmDel" + it.id, () => removeItem(it.id))}
                              aria-label="Delete reminder"
                              title="Delete reminder permanently"
                              className={"inline-flex items-center gap-1 text-xs px-2 py-1 rounded " + (armed ? "bg-red-600 text-white" : "text-red-400 hover:bg-zinc-800")}
                            >
                              <Trash2 size={13} /> {armed ? "tap to confirm" : "Delete"}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
