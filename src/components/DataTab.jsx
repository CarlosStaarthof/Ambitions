import { useState } from "react";
import { Download } from "lucide-react";
import { download } from "../lib/io";
import { SEED_QUESTIONS, normalizeModel } from "../lib/seed";
import { card, btnPrimary } from "../lib/ui";

const visionCount = (p) => Object.values((p && p.vision) || {}).reduce((a, list) => a + (Array.isArray(list) ? list.length : 0), 0);

export default function DataTab({ tasks, categories, questions, weeks, reflections, vision, setTasksP, setCategoriesP, setQuestionsP, setWeeksP, setReflectionsP, setVisionP }) {
  const [pendingImport, setPendingImport] = useState(null);
  const [importMsg, setImportMsg] = useState("");
  const [exportMsg, setExportMsg] = useState({ text: "", error: false });

  async function doExport() {
    setExportMsg({ text: "", error: false });
    // Date-stamped so repeat exports don't silently pile up as "(1)", "(2)"…
    const stamp = new Date().toISOString().slice(0, 10);
    // v5 adds `vision`. Older files simply lack it and import fine.
    const payload = { version: 5, exportedAt: new Date().toISOString(), tasks, categories, questions, weeks, reflections, vision };
    try {
      const where = await download(`ambitions-${stamp}.json`, JSON.stringify(payload, null, 2), "application/json");
      setExportMsg({ text: `Saved to ${where}`, error: false });
    } catch (e) {
      setExportMsg({ text: (e && e.message) || "Could not save the file.", error: true });
    }
  }

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
        <button onClick={doExport} className={btnPrimary}><Download size={14} /> Export JSON</button>
        {exportMsg.text && <div className={"text-xs " + (exportMsg.error ? "text-red-400" : "text-amber-400")}>{exportMsg.text}</div>}
      </div>
      <div className={card + " p-4 space-y-3"}>
        <div className="text-sm font-medium">Import</div>
        <input type="file" accept="application/json" onChange={(e) => { if (e.target.files[0]) doImportFile(e.target.files[0]); e.target.value = ""; }} className="text-sm text-zinc-400" />
        {importMsg && <div className="text-xs text-red-400">{importMsg}</div>}
        {pendingImport && (
          <div className="border border-amber-500 bg-zinc-900 rounded-lg p-3 space-y-2">
            <div className="text-xs text-amber-300">Replace everything with {pendingImport.tasks.length} tasks, {Object.keys(pendingImport.weeks).length} weeks, and {Object.keys(pendingImport.reflections || {}).length} monthly reflections{visionCount(pendingImport) ? `, and ${visionCount(pendingImport)} vision images` : ""}?</div>
            <div className="flex gap-2">
              <button onClick={() => { const m = normalizeModel(pendingImport.tasks, pendingImport.categories); setTasksP(m.tasks); setCategoriesP(m.categories); setQuestionsP(pendingImport.questions || SEED_QUESTIONS); setWeeksP(pendingImport.weeks); setReflectionsP(pendingImport.reflections || {}); setVisionP(pendingImport.vision || {}); setPendingImport(null); }} className="text-xs px-3 py-1.5 rounded-lg bg-amber-500 text-black font-medium">Confirm</button>
              <button onClick={() => setPendingImport(null)} className="text-xs px-3 py-1.5 rounded-lg text-zinc-400 hover:bg-zinc-800">Cancel</button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
