import { useState, useEffect } from "react";
import { loadKey, saveKey } from "./storage";
import { SEED_TASKS, SEED_CATEGORIES, SEED_QUESTIONS, normalizeModel } from "./seed";

// App-wide preferences (not week data). Lives under one localForage key so new
// settings can be added without new plumbing. `ai` drives the "any model, or none"
// behavior: enabled=false or provider="none" means the app runs fully AI-free.
export const DEFAULT_SETTINGS = {
  ai: { enabled: true, provider: "anthropic", model: null }
};

export function useStore() {
  const [tasks, setTasks] = useState([]);
  const [categories, setCategories] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [weeks, setWeeks] = useState({});
  const [reflections, setReflections] = useState({});
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const t = await loadKey("tasks");
      const cat = await loadKey("categories");
      const q = await loadKey("questions");
      const w = await loadKey("weeks");
      const r = await loadKey("reflections");
      const s = await loadKey("settings");
      if (!mounted) return;

      if (!t || !t.length) {
        // Fresh install: seed both.
        setTasks(SEED_TASKS); setCategories(SEED_CATEGORIES);
        saveKey("tasks", SEED_TASKS); saveKey("categories", SEED_CATEGORIES);
      } else {
        // Existing data (incl. V1 with task.category): migrate to the current shape.
        const m = normalizeModel(t, cat);
        setTasks(m.tasks); setCategories(m.categories);
        saveKey("tasks", m.tasks); saveKey("categories", m.categories);
      }

      if (!q || !q.length) { setQuestions(SEED_QUESTIONS); saveKey("questions", SEED_QUESTIONS); } else setQuestions(q);
      setWeeks(w || {});
      setReflections(r || {});
      // Merge so new default settings keys appear for existing users.
      setSettings(s ? { ...DEFAULT_SETTINGS, ...s, ai: { ...DEFAULT_SETTINGS.ai, ...(s.ai || {}) } } : DEFAULT_SETTINGS);
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const setTasksP = (n) => { setTasks(n); saveKey("tasks", n); };
  const setCategoriesP = (n) => { setCategories(n); saveKey("categories", n); };
  const setQuestionsP = (n) => { setQuestions(n); saveKey("questions", n); };
  const setWeeksP = (u) => setWeeks((prev) => { const n = typeof u === "function" ? u(prev) : u; saveKey("weeks", n); return n; });
  const setReflectionsP = (u) => setReflections((prev) => { const n = typeof u === "function" ? u(prev) : u; saveKey("reflections", n); return n; });
  const setSettingsP = (u) => setSettings((prev) => { const n = typeof u === "function" ? u(prev) : u; saveKey("settings", n); return n; });

  return { loading, tasks, categories, questions, weeks, reflections, settings, setTasksP, setCategoriesP, setQuestionsP, setWeeksP, setReflectionsP, setSettingsP };
}
