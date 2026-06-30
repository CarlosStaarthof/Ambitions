import { useState, useEffect } from "react";
import { loadKey, saveKey } from "./storage";
import { SEED_TASKS, SEED_QUESTIONS } from "./seed";

export function useStore() {
  const [tasks, setTasks] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [weeks, setWeeks] = useState({});
  const [reflections, setReflections] = useState({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const t = await loadKey("tasks");
      const q = await loadKey("questions");
      const w = await loadKey("weeks");
      const r = await loadKey("reflections");
      if (!mounted) return;
      if (!t || !t.length) { setTasks(SEED_TASKS); saveKey("tasks", SEED_TASKS); } else setTasks(t);
      if (!q || !q.length) { setQuestions(SEED_QUESTIONS); saveKey("questions", SEED_QUESTIONS); } else setQuestions(q);
      setWeeks(w || {});
      setReflections(r || {});
      setLoading(false);
    })();
    return () => { mounted = false; };
  }, []);

  const setTasksP = (n) => { setTasks(n); saveKey("tasks", n); };
  const setQuestionsP = (n) => { setQuestions(n); saveKey("questions", n); };
  const setWeeksP = (u) => setWeeks((prev) => { const n = typeof u === "function" ? u(prev) : u; saveKey("weeks", n); return n; });
  const setReflectionsP = (u) => setReflections((prev) => { const n = typeof u === "function" ? u(prev) : u; saveKey("reflections", n); return n; });

  return { loading, tasks, questions, weeks, reflections, setTasksP, setQuestionsP, setWeeksP, setReflectionsP };
}
