import { useState, useEffect } from "react";
import { Menu as MenuIcon } from "lucide-react";
import { useStore } from "./lib/useStore";
import { mondayOf, pad } from "./lib/time";
import { NONE } from "./lib/providers";
import { card } from "./lib/ui";
import { REMINDER_SOURCES, HORIZON, plannedReminders, filterQuietOccurrences } from "./lib/reminders";
import { unrecordedNudge, normalizeUnrecorded } from "./lib/nudge";
import { syncReminders } from "./lib/notify";
import AppMenu from "./components/AppMenu";
import WeekTab from "./components/WeekTab";
import TasksTab from "./components/TasksTab";
import BalanceTab from "./components/BalanceTab";
import GuidingTab from "./components/GuidingTab";
import VisionTab from "./components/VisionTab";
import ReminderWallTab from "./components/ReminderWallTab";
import TodoChartTab from "./components/TodoChartTab";
import SettingsTab from "./components/SettingsTab";

const SECTION_LABEL = { plan: "Plan & Balance", tasks: "Records", reminders: "To-Do's Chart", vision: "Vision Board", settings: "Settings" };

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
  const [recordsReminderSub, setRecordsReminderSub] = useState("wall");
  const [reminderSub, setReminderSub] = useState("open");
  const [weekStart, setWeekStart] = useState(mondayOf(new Date()));
  const [now, setNow] = useState(new Date());
  const [online, setOnline] = useState(typeof navigator === "undefined" ? true : navigator.onLine);

  useEffect(() => { const id = setInterval(() => setNow(new Date()), 1000); return () => clearInterval(id); }, []);
  useEffect(() => {
    const on = () => setOnline(true), off = () => setOnline(false);
    window.addEventListener("online", on); window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  // Reminder schedules are re-derived, never remembered: Android drops pending
  // alarms on reboot, force-stop and clock changes, so the whole plan is recomputed
  // from today and reconciled against the OS on load and on every return to the
  // foreground. Quiet hours filter the plan before it can reach the OS. The plan also
  // depends on the wall and week data future sources read, so editing either re-plans.
  const { loading, storageError, settings, reflections, questions, reminderWall, weeks } = store;
  useEffect(() => {
    // Nothing is derived from a store we could not read — not even a notification.
    if (loading || storageError) return;
    const sync = () => {
      const now = new Date();
      const nudge = unrecordedNudge(now, weeks, settings.unrecorded);
      const planned = plannedReminders(REMINDER_SOURCES, settings, now, HORIZON, { reflections, questions });
      const plan = filterQuietOccurrences(nudge ? [...planned, nudge.entry] : planned, settings.quietHours);
      syncReminders(plan);
      // Mark the gap only once the nudge is actually in the filtered plan: a nudge
      // silenced by quiet hours must be able to fire after the window, not count as
      // sent. While its scheduled time is still ahead, the same entry stays in the
      // plan on every re-run so reconciliation cannot cancel it.
      if (nudge && !nudge.alreadyMarked && plan.some((p) => p.id === nudge.entry.id)) {
        store.setSettingsP((prev) => ({
          ...prev,
          unrecorded: {
            ...normalizeUnrecorded(prev.unrecorded),
            lastNudgedGapStart: nudge.gapKey,
            lastNudgedAt: nudge.entry.at.toISOString()
          }
        }));
      }
    };
    sync();
    const onVis = () => { if (document.visibilityState === "visible") sync(); };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [loading, storageError, settings, reflections, questions, reminderWall, weeks]);

  if (store.loading) return <div className="min-h-screen bg-black flex items-center justify-center text-zinc-500">loading…</div>;

  // A read failed, so what is on disk is unknown. Render one message and nothing else:
  // no tabs means no setter is reachable, and the saved data stays exactly as it is.
  // Severe on purpose — editing a partly-read store is how history gets overwritten.
  if (storageError) return (
    <div className="min-h-screen bg-black flex items-center justify-center px-6">
      <div className={card + " p-4 max-w-sm text-sm text-zinc-300 leading-relaxed"}>
        Could not read your saved data. Nothing has been changed. Close the app and open it again.
      </div>
    </div>
  );

  const clock = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(now.getSeconds())}`;
  // AI UI only appears when it can actually run: switched on, a real provider, and a
  // key on file for that provider. Otherwise the buttons would just error on tap.
  // Keys live in secure storage, not in settings — recombined here for the adapters.
  const ai = { ...((store.settings && store.settings.ai) || {}), keys: store.aiKeys || {} };
  const aiEnabled = !!ai.enabled && ai.provider !== NONE && !!ai.keys[ai.provider];
  const go = (id) => { setSection(id); setMenuOpen(false); };

  return (
    <div className="min-h-screen bg-black text-zinc-100">
      <AppMenu open={menuOpen} section={section} onSelect={go} onClose={() => setMenuOpen(false)} />

      <div className="max-w-3xl mx-auto px-3 pb-safe">
        <header className="pt-safe pb-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <button onClick={() => setMenuOpen(true)} aria-label="Open menu" className="p-2 -ml-1 rounded-lg text-zinc-300 hover:bg-zinc-900 shrink-0"><MenuIcon size={20} /></button>
            <h1 className="text-lg font-semibold leading-tight truncate">{SECTION_LABEL[section] || "Ambitions"}</h1>
          </div>
          <div className="bg-zinc-900 border border-zinc-800 rounded-lg px-2.5 py-1.5 text-amber-400 font-mono text-sm tracking-wide shrink-0">{clock}</div>
        </header>

        {!online && <div className="mb-3 text-xs bg-zinc-900 border border-zinc-700 text-zinc-400 rounded-lg p-2">{aiEnabled ? "Offline — everything works except the AI features." : "Offline — everything still works."}</div>}

        {section === "plan" && (
          <>
            <SubTabs value={planSub} onChange={setPlanSub} tabs={[["week", "Week"], ["balance", "Balance"]]} />
            {planSub === "week" && <WeekTab tasks={store.tasks} categories={store.categories} weeks={store.weeks} settings={store.settings} ai={ai} aiEnabled={aiEnabled} setWeeksP={store.setWeeksP} setTasksP={store.setTasksP} weekStart={weekStart} setWeekStart={setWeekStart} />}
            {planSub === "balance" && <BalanceTab tasks={store.tasks} categories={store.categories} weeks={store.weeks} weekStart={weekStart} questions={store.questions} reflections={store.reflections} setReflectionsP={store.setReflectionsP} online={online} aiEnabled={aiEnabled} ai={ai} />}
          </>
        )}

        {section === "tasks" && (
          <>
            <SubTabs value={taskSub} onChange={setTaskSub} tabs={[["tasks", "Tasks"], ["guiding", "Questions"], ["reminders", "Reminders"]]} />
            {taskSub === "tasks" && <TasksTab tasks={store.tasks} categories={store.categories} setTasksP={store.setTasksP} setCategoriesP={store.setCategoriesP} />}
            {taskSub === "guiding" && <GuidingTab questions={store.questions} setQuestionsP={store.setQuestionsP} reflections={store.reflections} setReflectionsP={store.setReflectionsP} online={online} aiEnabled={aiEnabled} ai={ai} />}
            {taskSub === "reminders" && (
              <>
                <SubTabs value={recordsReminderSub} onChange={setRecordsReminderSub} tabs={[["wall", "Manage"], ["archive", "Archive"]]} />
                <ReminderWallTab reminderWall={store.reminderWall} setReminderWallP={store.setReminderWallP} view={recordsReminderSub} />
              </>
            )}
          </>
        )}

        {section === "reminders" && (
          <>
            <SubTabs value={reminderSub} onChange={setReminderSub} tabs={[["open", "Open"], ["done", "Done"]]} />
            <TodoChartTab reminderWall={store.reminderWall} setReminderWallP={store.setReminderWallP} view={reminderSub} now={now} />
          </>
        )}

        {section === "vision" && <VisionTab vision={store.vision} setVisionP={store.setVisionP} />}

        {section === "settings" && <SettingsTab store={store} />}
      </div>
    </div>
  );
}
