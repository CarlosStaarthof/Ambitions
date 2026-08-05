import { Sparkles } from "lucide-react";
import { card, selectCls } from "../lib/ui";
import { PROVIDERS } from "../lib/providers";
import DataTab from "./DataTab";

export default function SettingsTab({ store }) {
  const ai = (store.settings && store.settings.ai) || { enabled: true, provider: "anthropic" };
  const setAi = (patch) => store.setSettingsP((prev) => ({ ...prev, ai: { ...prev.ai, ...patch } }));

  return (
    <div className="space-y-4">
      <div className={card + " p-4 space-y-3"}>
        <div className="flex items-center gap-2 text-sm font-medium"><Sparkles size={16} className="text-amber-400" /> AI features</div>
        <label className="flex items-center justify-between gap-3 text-sm text-zinc-300 cursor-pointer">
          <span>Use AI in Tiempo</span>
          <input type="checkbox" checked={!!ai.enabled} onChange={(e) => setAi({ enabled: e.target.checked })} className="h-4 w-4 accent-amber-500" />
        </label>
        <p className="text-xs text-zinc-500">Off = Tiempo runs completely without AI; the coaching and reflection buttons disappear.</p>
        {ai.enabled && (
          <div className="flex items-center justify-between gap-2 text-sm pt-1">
            <span className="text-zinc-300">Provider</span>
            <select value={ai.provider} onChange={(e) => setAi({ provider: e.target.value })} className={selectCls}>
              {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
            </select>
          </div>
        )}
        {ai.enabled && ai.provider !== "anthropic" && (
          <p className="text-xs text-amber-400/80">Only Claude is connected today — other providers arrive with the AI-connections phase.</p>
        )}
      </div>

      <DataTab
        tasks={store.tasks}
        questions={store.questions}
        weeks={store.weeks}
        reflections={store.reflections}
        setTasksP={store.setTasksP}
        setQuestionsP={store.setQuestionsP}
        setWeeksP={store.setWeeksP}
        setReflectionsP={store.setReflectionsP}
      />
    </div>
  );
}
