import { useState } from "react";
import { Download } from "lucide-react";
import { download } from "../lib/io";
import { SEED_QUESTIONS } from "../lib/seed";
import { card, btnPrimary } from "../lib/ui";

export default function DataTab({ tasks, questions, weeks, reflections, setTasksP, setQuestionsP, setWeeksP, setReflectionsP }) {
  const [pendingImport, setPendingImport] = useState(null);
  const [importMsg, setImportMsg] = useState("");

  function doImportFile(file) {
    setImportMsg("");
    const r = new FileReader();
    r.onload = () => { try { const p = JSON.parse(r.result); if (!Array.isArray(p.tasks) || typeof p.weeks !== "object") throw 0; setPendingImport(p); } catch { setImportMsg("That file doesn't look like a valid export."); } };
    r.onerror = () => setImportMsg("Couldn't read that file.");
    r.readAsText(file);
  }

  return (
    <div className="space-y-4">
      <div className={card + " p-4 space-y-3"}>
        <div className="text-sm font-medium">Your data is yours</div>
        <p className="text-xs text-zinc-500">Everything is stored on this device. Export regularly — the file is the real backup.</p>
        <button onClick={() => download("tiempo.json", JSON.stringify({ version: 3, exportedAt: new Date().toISOString(), tasks, questions, weeks, reflections }, null, 2), "application/json")} className={btnPrimary}><Download size={14} /> Export JSON</button>
      </div>
      <div className={card + " p-4 space-y-3"}>
        <div className="text-sm font-medium">Import</div>
        <input type="file" accept="application/json" onChange={(e) => { if (e.target.files[0]) doImportFile(e.target.files[0]); e.target.value = ""; }} className="text-sm text-zinc-400" />
        {importMsg && <div className="text-xs text-red-400">{importMsg}</div>}
        {pendingImport && (
          <div className="border border-amber-500 bg-zinc-900 rounded-lg p-3 space-y-2">
            <div className="text-xs text-amber-300">Replace everything with {pendingImport.tasks.length} tasks, {Object.keys(pendingImport.weeks).length} weeks, and {Object.keys(pendingImport.reflections || {}).length} monthly reflections?</div>
            <div className="flex gap-2">
              <button onClick={() => { setTasksP(pendingImport.tasks); setQuestionsP(pendingImport.questions || SEED_QUESTIONS); setWeeksP(pendingImport.weeks); setReflectionsP(pendingImport.reflections || {}); setPendingImport(null); }} className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 text-black font-medium">Confirm</button>
              <button onClick={() => setPendingImport(null)} className="text-xs px-3 py-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
