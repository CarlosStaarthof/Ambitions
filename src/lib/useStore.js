import { useState, useEffect } from "react";
import { loadKey, saveKey } from "./storage";
import { SEED_TASKS, SEED_CATEGORIES, SEED_QUESTIONS, normalizeModel, backfillOpenWeeks, mergeSettings, loadDecision } from "./seed";
import { mondayOf, isoDate, normalizeQuietHours } from "./time";
import { normalizeUnrecorded } from "./nudge";
import { normalizeDigest } from "./morningDigest";
import { NONE, PROVIDERS } from "./providers";
import { secureGet, secureSet, secureRemove, aiKeyName } from "./secureStore";
import { emptyReminderWall, normalizeReminderWall } from "./reminderWall";
import { normalizeVision } from "./vision";

// App-wide preferences (not week data). Lives under one localForage key so new
// settings can be added without new plumbing. `ai` drives the "any model, or none"
// behavior: enabled=false or provider="none" means the app runs fully AI-free.
//
// Provider API keys are deliberately NOT part of settings — they live in
// hardware-backed secure storage (see secureStore.js) and are held in memory here.
// `reminders` is keyed by reminder source id (see REMINDER_SOURCES in reminders.js).
// Every source ships off: a notification nobody asked for is not a feature. The
// schedule itself is never stored — it is re-derived from the current date on every
// load, because the OS drops pending alarms on reboot and a stored copy would lie.
export const DEFAULT_SETTINGS = {
  ai: { enabled: false, provider: NONE, model: null },
  reminders: { reflection: { enabled: false } },
  // One local window silences every source. It wraps midnight by default, so the
  // start is included and the end is not.
  quietHours: { enabled: true, start: "23:00", end: "07:00" },
  // Optional nudge when a chosen stretch has no recorded block. Off by default;
  // `lastNudged*` is state, not a preference, but it lives here because settings is
  // one key and never part of the export.
  unrecorded: { enabled: false, gapMinutes: 60, lastNudgedGapStart: null, lastNudgedAt: null },
  // One optional morning list of open wall to-dos that have no start time. Off by
  // default like every notification source; the time is an editable local clock.
  digest: { enabled: false, time: "08:00" },
  // How long a finger must rest on a filled week cell before the note gesture
  // starts, in milliseconds. A user setting, never week data. Absent on older
  // installs, so mergeSettings fills it on load.
  longPressMs: 500
};

export function useStore() {
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [weeks, setWeeks] = useState({});
  const [reflections, setReflections] = useState({});
  const [vision, setVision] = useState({});
  const [reminderWall, setReminderWall] = useState(emptyReminderWall());
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [aiKeys, setAiKeys] = useState({});
  const [loading, setLoading] = useState(true);
  const [storageError, setStorageError] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const t = await loadKey("tasks");
      const cat = await loadKey("categories");
      const q = await loadKey("questions");
      const w = await loadKey("weeks");
      const r = await loadKey("reflections");
      const vis = await loadKey("vision");
      const rw = await loadKey("reminderWall");
      const s = await loadKey("settings");

      // Fresh install, or a store that could not be read? Decide before anything is
      // written, and hard-stop on a failed read: a partly-read store is not safe to
      // edit, because one paint would write a single-week object over the whole `weeks`
      // key. Nothing below this line runs in that state — not even the key migration.
      const { seed, storageError: readFailed } = loadDecision({ tasks: t, categories: cat, questions: q, weeks: w, reflections: r, vision: vis, reminderWall: rw, settings: s });
      if (readFailed) { if (mounted) { setStorageError(true); setLoading(false); } return; }

      // Keys written before secure storage existed sit in plaintext inside settings.
      // Move them into the Keystore and scrub the originals — leaving a copy behind
      // would defeat the whole point of L1.
      const legacy = (s.value && s.value.ai && s.value.ai.keys) || null;
      if (legacy && Object.keys(legacy).length) {
        for (const [provider, value] of Object.entries(legacy)) {
          if (value) await secureSet(aiKeyName(provider), value);
        }
      }

      const keys = {};
      for (const p of PROVIDERS) {
        const v = await secureGet(aiKeyName(p.id));
        if (v) keys[p.id] = v;
      }

      if (!mounted) return;

      // The one seeding branch. It fires only for a genuinely fresh install — all eight
      // reads succeeded and all eight came back empty. An empty `tasks` on its own is
      // NOT a fresh install: that is exactly the shape that overwrote the real task list
      // and orphaned every uid()-keyed cell.
      if (seed) {
        setTasks(SEED_TASKS); setCategories(SEED_CATEGORIES); setQuestions(SEED_QUESTIONS);
        saveKey("tasks", SEED_TASKS); saveKey("categories", SEED_CATEGORIES); saveKey("questions", SEED_QUESTIONS);
      } else {
        // Existing data (incl. V1 with task.category): migrate to the current shape.
        const m = normalizeModel(t.value, cat.value);
        // Open tasks predating week-scoping would otherwise show in every week.
        const bf = backfillOpenWeeks(m.tasks, w.value || {}, isoDate(mondayOf(new Date())));
        setTasks(bf.tasks); setCategories(m.categories);
        saveKey("tasks", bf.tasks); saveKey("categories", m.categories);
        setQuestions(q.value || []);
      }

      setWeeks(w.value || {});
      setReflections(r.value || {});
      setVision(normalizeVision(vis.value));
      // Missing or malformed wall shapes are repaired in memory, never rewritten on load.
      setReminderWall(normalizeReminderWall(rw.value));
      setAiKeys(keys);

      // Merge so new default settings keys appear for existing users (and drop any
      // `keys` field so a plaintext copy can never be re-persisted). mergeSettings
      // goes a level deeper than a spread, so a stored `reminders.reflection` is not
      // erased by a source a later feature adds.
      const merged = mergeSettings(DEFAULT_SETTINGS, s.value);
      const next = {
        ...merged,
        quietHours: normalizeQuietHours(merged.quietHours),
        unrecorded: normalizeUnrecorded(merged.unrecorded),
        digest: normalizeDigest(merged.digest)
      };
      setSettings(next);
      if (legacy && Object.keys(legacy).length) saveKey("settings", next);

      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const setTasksP = (n) => { setTasks(n); saveKey("tasks", n); };
  const setCategoriesP = (n) => { setCategories(n); saveKey("categories", n); };
  const setQuestionsP = (n) => { setQuestions(n); saveKey("questions", n); };
  const setWeeksP = (u) => setWeeks((prev) => { const n = typeof u === "function" ? u(prev) : u; saveKey("weeks", n); return n; });
  const setReflectionsP = (u) => setReflections((prev) => { const n = typeof u === "function" ? u(prev) : u; saveKey("reflections", n); return n; });
  const setVisionP = (u) => setVision((prev) => { const n = typeof u === "function" ? u(prev) : u; saveKey("vision", n); return n; });
  const setReminderWallP = (u) => setReminderWall((prev) => { const n = typeof u === "function" ? u(prev) : u; saveKey("reminderWall", n); return n; });
  const setSettingsP = (u) => setSettings((prev) => {
    const n = typeof u === "function" ? u(prev) : u;
    const next = {
      ...n,
      quietHours: normalizeQuietHours(n.quietHours),
      unrecorded: normalizeUnrecorded(n.unrecorded),
      digest: normalizeDigest(n.digest)
    };
    if (next.ai && "keys" in next.ai) delete next.ai.keys;   // never let a key reach localForage
    saveKey("settings", next);
    return next;
  });

  // Keys go straight to secure storage; React state mirrors them for the current session.
  const setAiKeyP = (provider, value) => {
    const v = String(value || "");
    setAiKeys((prev) => { const n = { ...prev }; if (v) n[provider] = v; else delete n[provider]; return n; });
    if (v) secureSet(aiKeyName(provider), v); else secureRemove(aiKeyName(provider));
  };

  return {
    loading, storageError, tasks, categories, questions, weeks, reflections, vision, reminderWall, settings, aiKeys,
    setTasksP, setCategoriesP, setQuestionsP, setWeeksP, setReflectionsP, setVisionP, setReminderWallP, setSettingsP, setAiKeyP
  };
}
