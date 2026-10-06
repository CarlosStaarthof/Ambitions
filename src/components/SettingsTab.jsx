import { useState, useEffect } from "react";
import { Sparkles, Eye, EyeOff, Loader2, ExternalLink, Check, Bell } from "lucide-react";
import { card, selectCls, inputCls, btnGhost } from "../lib/ui";
import { PROVIDERS, NONE, providerById } from "../lib/providers";
import { fetchModels, aiErrorText } from "../lib/ai";
import { REMINDER_SOURCES } from "../lib/reminders";
import { notifySupported, notifyPermission, requestNotifyPermission } from "../lib/notify";
import DataTab from "./DataTab";

const CUSTOM = "__custom__";

// Rendered from the reminder registry, so feature 6 adds a source and gets a row
// here for free. The permission is requested at the moment of intent — switching a
// reminder on — and never at launch, and never a second time unprompted.
function RemindersCard({ store }) {
  const supported = notifySupported();
  const [perm, setPerm] = useState("prompt");
  const [blocked, setBlocked] = useState(false);
  const reminders = (store.settings && store.settings.reminders) || {};

  // Reading the permission is instant on device and a no-op on web, so the toggles
  // render in their stored position straight away rather than behind a spinner.
  useEffect(() => { let on = true; notifyPermission().then((p) => { if (on) setPerm(p); }); return () => { on = false; }; }, []);

  const write = (id, enabled) => store.setSettingsP((prev) => ({
    ...prev,
    reminders: { ...(prev.reminders || {}), [id]: { ...((prev.reminders || {})[id] || {}), enabled } }
  }));

  async function toggle(id, on) {
    if (!on) { setBlocked(false); write(id, false); return; }
    let p = perm;
    if (p !== "granted") { p = await requestNotifyPermission(); setPerm(p); }
    // Denial leaves the toggle exactly where it was. The app stays fully usable
    // without notifications — nothing else in it depends on one arriving.
    if (p !== "granted") { setBlocked(true); return; }
    setBlocked(false);
    write(id, true);
  }

  return (
    <div className={card + " p-4 space-y-3"}>
      <div className="flex items-center gap-2 text-sm font-medium"><Bell size={16} className="text-amber-400" /> Reminders</div>

      {REMINDER_SOURCES.map((s) => (
        <div key={s.id} className="space-y-1">
          <label className={"flex items-center justify-between gap-3 text-sm text-zinc-300 " + (supported ? "cursor-pointer" : "opacity-50")}>
            <span className="min-w-0">{s.title}</span>
            <input
              type="checkbox"
              disabled={!supported}
              checked={!!(reminders[s.id] && reminders[s.id].enabled)}
              onChange={(e) => toggle(s.id, e.target.checked)}
              className="h-4 w-4 accent-amber-500 shrink-0 disabled:opacity-50"
            />
          </label>
          <p className="text-[11px] text-zinc-500 leading-relaxed">{s.body}</p>
        </div>
      ))}

      {!supported && <p className="text-[11px] text-zinc-500">Reminders need the Android app. A browser tab cannot schedule them.</p>}
      {blocked && <p className="text-[11px] text-red-400">Notifications are blocked for Ambitions. Turn them back on in Settings → Apps → Ambitions → Notifications, then try again.</p>}
      {supported && (
        <p className="text-[11px] text-zinc-500 leading-relaxed">
          Delivery is best-effort — battery optimisation can delay a reminder or drop it altogether. To make that less likely, set Settings → Apps → Ambitions → Battery → Unrestricted.
        </p>
      )}
    </div>
  );
}

export default function SettingsTab({ store }) {
  const ai = { ...((store.settings && store.settings.ai) || { enabled: false, provider: NONE }), keys: store.aiKeys || {} };
  const setAi = (patch) => store.setSettingsP((prev) => ({ ...prev, ai: { ...prev.ai, ...patch } }));
  const setKey = (provider, value) => store.setAiKeyP(provider, value);

  const [reveal, setReveal] = useState(false);
  const [models, setModels] = useState(null);            // live list, once fetched
  const [load, setLoad] = useState({ busy: false, error: "", ok: false });
  const [customMode, setCustomMode] = useState(false);

  const provider = ai.provider || NONE;
  const meta = providerById(provider);
  const key = (ai.keys || {})[provider] || "";
  const options = models || (meta ? meta.models : []);

  // Typing a model id is an explicit choice, not a second control shadowing the
  // dropdown. It also switches on by itself when a saved model isn't in the list.
  const selected = ai.model || (meta ? meta.defaultModel : "");
  const inList = options.some((m) => m.id === selected);
  const showCustom = customMode || (!!ai.model && !inList);

  function pickProvider(id) {
    // Model ids don't transfer between vendors — drop it so the new provider's default applies.
    setAi({ provider: id, model: null });
    setModels(null); setLoad({ busy: false, error: "", ok: false }); setCustomMode(false);
  }

  async function loadModels() {
    setLoad({ busy: true, error: "", ok: false });
    try {
      const list = await fetchModels(provider, key);
      setModels(list);
      setLoad({ busy: false, error: list.length ? "" : "No usable models returned.", ok: !!list.length });
    } catch (e) { setLoad({ busy: false, error: aiErrorText(e), ok: false }); }
  }

  return (
    <div className="space-y-4">
      <div className={card + " p-4 space-y-3"}>
        <div className="flex items-center gap-2 text-sm font-medium"><Sparkles size={16} className="text-amber-400" /> AI features</div>

        <label className="flex items-center justify-between gap-3 text-sm text-zinc-300 cursor-pointer">
          <span>Use AI in Ambitions</span>
          <input type="checkbox" checked={!!ai.enabled} onChange={(e) => setAi({ enabled: e.target.checked })} className="h-4 w-4 accent-amber-500" />
        </label>
        <p className="text-xs text-zinc-500">Off = Ambitions runs completely without AI; the coaching and reflection buttons disappear. Your plan never leaves the device.</p>

        {ai.enabled && (
          <div className="space-y-3 pt-1 border-t border-zinc-800">
            <div className="flex items-center justify-between gap-2 text-sm pt-3">
              <span className="text-zinc-300">Provider</span>
              <select value={provider} onChange={(e) => pickProvider(e.target.value)} className={selectCls}>
                <option value={NONE}>None</option>
                {PROVIDERS.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </div>

            {meta && (
              <>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-zinc-300">Your API key</span>
                    <a href={meta.accountUrl} target="_blank" rel="noreferrer" className="text-[11px] text-amber-400/90 inline-flex items-center gap-1">Get one <ExternalLink size={11} /></a>
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type={reveal ? "text" : "password"}
                      value={key}
                      onChange={(e) => setKey(provider, e.target.value)}
                      placeholder={meta.keyHint}
                      autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck="false"
                      className={inputCls}
                    />
                    <button onClick={() => setReveal(!reveal)} aria-label={reveal ? "Hide key" : "Show key"} className="px-2 rounded-lg border border-zinc-700 text-zinc-400 hover:bg-zinc-800 shrink-0">
                      {reveal ? <EyeOff size={15} /> : <Eye size={15} />}
                    </button>
                  </div>
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    Stored on this device only and sent straight to {meta.label} — it never passes through an Ambitions server. Your provider bills you directly. Not included in the JSON export.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm text-zinc-300">Model</span>
                    <button onClick={loadModels} disabled={!key || load.busy} className={btnGhost + " disabled:opacity-40"}>
                      {load.busy ? <Loader2 size={12} className="animate-spin" /> : load.ok ? <Check size={12} className="text-amber-400" /> : null}
                      {load.busy ? "loading…" : "Load models"}
                    </button>
                  </div>
                  <select
                    value={showCustom ? CUSTOM : selected}
                    onChange={(e) => {
                      if (e.target.value === CUSTOM) { setCustomMode(true); return; }
                      setCustomMode(false); setAi({ model: e.target.value });
                    }}
                    className={selectCls + " w-full"}
                  >
                    {options.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                    <option value={CUSTOM}>Custom model id…</option>
                  </select>
                  {showCustom && (
                    <input
                      value={ai.model || ""}
                      onChange={(e) => setAi({ model: e.target.value.trim() || null })}
                      placeholder="e.g. claude-opus-5"
                      autoComplete="off" autoCorrect="off" autoCapitalize="none" spellCheck="false"
                      className={inputCls}
                      autoFocus
                    />
                  )}
                  {load.error && <p className="text-[11px] text-red-400">{load.error}</p>}
                  <p className="text-[11px] text-zinc-500">The built-in list is a fallback. Load models asks {meta.label} for its current catalogue using your key.</p>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      <RemindersCard store={store} />

      <DataTab
        tasks={store.tasks}
        categories={store.categories}
        questions={store.questions}
        weeks={store.weeks}
        reflections={store.reflections}
        vision={store.vision}
        setTasksP={store.setTasksP}
        setCategoriesP={store.setCategoriesP}
        setQuestionsP={store.setQuestionsP}
        setWeeksP={store.setWeeksP}
        setReflectionsP={store.setReflectionsP}
        setVisionP={store.setVisionP}
      />
    </div>
  );
}
