import { useState, useEffect } from "react";
import { Menu as MenuIcon } from "lucide-react";
import { useStore } from "./lib/useStore";
import { mondayOf, pad } from "./lib/time";
import AppMenu from "./components/AppMenu";
import WeekTab from "./components/WeekTab";
import TasksTab from "./components/TasksTab";
import BalanceTab from "./components/BalanceTab";
import GuidingTab from "./components/GuidingTab";
import AccountTab from "./components/AccountTab";
import SettingsTab from "./components/SettingsTab";

const SECTION_LABEL = { account: "Account", plan: "Plan & Balance", tasks: "Task & Questions", settings: "Settings", logout: "Logout" };

function SubTabs({ value, onChange, tabs }) {
  return (
    <div className="flex gap-1 mb-3 border-b border-zinc-800">
      {tabs.map(([id, label]) => (
        <button key={id} onClick={() => onChange(id)} className={"px-3 py-2 text-sm -mb-px border-b-2 " + (value === id ? "text-amber-400 border-amber-400 font-medium" : "text-zinc-400 border-transparent hover:text-zinc-200")}>{label}</button>
      ))}
    </div>
  );
}

export default function App() {
  const store = useStore();
  const [section, setSection] = useState("plan");
  const [menuOpen, setMenuOpen] = useState(false);
  const [planSub, setPlanSub] = useState("week");
  const [taskSub, setTaskSub] = useState("tasks");
  const [weekStart, setWeekStart] = useState(mondayOf(new Date()));
  const [now, setNow] = useState(new Date());
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  if (store.loading) return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500">loading…</div>;

  const clock = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  const aiEnabled = !!(store.settings && store.settings.ai && store.settings.ai.enabled);
  const go = (id) => { setSection(id); setMenuOpen(false); };

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <AppMenu open={menuOpen} section={section} onSelect={go} onClose={() => setMenuOpen(false)} />

      <div className="max-w-3xl mx-auto px-3 pb-16">
        <header className="pt-5 pb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className="p-2 -ml-1 rounded-lg text-zinc-300 hover:bg-zinc-900 shrink-0"><MenuIcon size={20} /></button>
            <div className="min-w-0">
              <h1 className="text-lg font-semibold leading-tight truncate">{SECTION_LABEL[section] || "Tiempo"}</h1>
              <p className="text-[11px] text-zinc-500">Tiempo · Mon–Sun, 30-minute cells.</p>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-amber-400 font-mono text-sm tracking-wide shrink-0">{clock}</div>
        </header>

        {!online && <div className="mb-3 text-xs bg-zinc-900 border border-zinc-700 text-zinc-400 rounded-lg p-2">Offline — everything works except the AI features.</div>}

        {section === "account" && <AccountTab />}

        {section === "plan" && (
          <>
            <SubTabs value={planSub} onChange={setPlanSub} tabs={[["week", "Week"], ["balance", "Balance"]]} />
            {planSub === "week" && <WeekTab tasks={store.tasks} weeks={store.weeks} setWeeksP={store.setWeeksP} weekStart={weekStart} setWeekStart={setWeekStart} />}
            {planSub === "balance" && <BalanceTab tasks={store.tasks} weeks={store.weeks} weekStart={weekStart} questions={store.questions} reflections={store.reflections} setReflectionsP={store.setReflectionsP} online={online} aiEnabled={aiEnabled} />}
          </>
        )}

        {section === "tasks" && (
          <>
            <SubTabs value={taskSub} onChange={setTaskSub} tabs={[["tasks", "Tasks"], ["guiding", "Questions"]]} />
            {taskSub === "tasks" && <TasksTab tasks={store.tasks} setTasksP={store.setTasksP} setWeeksP={store.setWeeksP} />}
            {taskSub === "guiding" && <GuidingTab questions={store.questions} setQuestionsP={store.setQuestionsP} reflections={store.reflections} setReflectionsP={store.setReflectionsP} online={online} aiEnabled={aiEnabled} />}
          </>
        )}

        {section === "settings" && <SettingsTab store={store} />}

        {section === "logout" && (
          <div className="bg-zinc-900 border border-zinc-800 rounded-xl p-4 text-sm text-zinc-400">
            You're not signed in yet — Tiempo accounts (and sign-out) arrive in the next phase. Everything works offline without an account.
          </div>
        )}
      </div>
    </div>
  );
}
