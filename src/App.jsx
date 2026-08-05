import { useState, useEffect } from "react";
import { Calendar, ListTodo, BarChart3, HelpCircle, Database } from "lucide-react";
import { useStore } from "./lib/useStore";
import { mondayOf, pad } from "./lib/time";
import WeekTab from "./components/WeekTab";
import TasksTab from "./components/TasksTab";
import BalanceTab from "./components/BalanceTab";
import GuidingTab from "./components/GuidingTab";
import DataTab from "./components/DataTab";

const TABS = [
  { id: "week", label: "Week", icon: Calendar },
  { id: "tasks", label: "Tasks", icon: ListTodo },
  { id: "balance", label: "Balance", icon: BarChart3 },
  { id: "guiding", label: "Guiding Questions", icon: HelpCircle },
  { id: "data", label: "Data", icon: Database }
];

export default function App() {
  const store = useStore();
  const [tab, setTab] = useState("week");
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

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <div className="max-w-3xl mx-auto px-3 pb-16">
        <header className="pt-5 pb-3 flex items-start justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-amber-500 text-black flex items-center justify-center"><Calendar size={18} /></div>
            <div>
              <h1 className="text-xl font-semibold leading-tight">Tiempo</h1>
              <p className="text-xs text-zinc-500">Mon–Sun · every cell is 30 minutes of your finite week.</p>
            </div>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-amber-400 font-mono text-sm tracking-wide shrink-0">{clock}</div>
        </header>

        {!online && <div className="mb-3 text-xs bg-zinc-900 border border-zinc-700 text-zinc-400 rounded-lg p-2">Offline — everything works except the AI features.</div>}

        <nav className="flex gap-1 overflow-x-auto pb-2 mb-3 border-b border-zinc-800">
          {TABS.map((t) => {
            const I = t.icon; const isData = t.id === "data"; const active = tab === t.id;
            return (
              <button key={t.id} onClick={() => setTab(t.id)} className={"inline-flex items-center gap-1.5 px-3 py-2 text-sm rounded-lg whitespace-nowrap " + (isData ? "ml-auto " : "") + (active ? "bg-amber-500 text-black font-medium" : isData ? "text-zinc-600 hover:text-zinc-400" : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200")}><I size={15} /> {t.label}</button>
            );
          })}
        </nav>

        {tab === "week" && <WeekTab tasks={store.tasks} weeks={store.weeks} setWeeksP={store.setWeeksP} weekStart={weekStart} setWeekStart={setWeekStart} />}
        {tab === "tasks" && <TasksTab tasks={store.tasks} setTasksP={store.setTasksP} setWeeksP={store.setWeeksP} />}
        {tab === "balance" && <BalanceTab tasks={store.tasks} weeks={store.weeks} weekStart={weekStart} questions={store.questions} reflections={store.reflections} setReflectionsP={store.setReflectionsP} online={online} />}
        {tab === "guiding" && <GuidingTab questions={store.questions} setQuestionsP={store.setQuestionsP} reflections={store.reflections} setReflectionsP={store.setReflectionsP} online={online} />}
        {tab === "data" && <DataTab tasks={store.tasks} questions={store.questions} weeks={store.weeks} reflections={store.reflections} setTasksP={store.setTasksP} setQuestionsP={store.setQuestionsP} setWeeksP={store.setWeeksP} setReflectionsP={store.setReflectionsP} />}
      </div>
    </div>
  );
}
