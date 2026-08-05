import { X, User, CalendarRange, ListTodo, Settings, LogOut } from "lucide-react";

const ITEMS = [
  { id: "account", label: "Account", icon: User },
  { id: "plan", label: "Plan & Balance", icon: CalendarRange },
  { id: "tasks", label: "Task & Questions", icon: ListTodo },
  { id: "settings", label: "Settings", icon: Settings },
  { id: "logout", label: "Logout", icon: LogOut }
];

export default function AppMenu({ open, section, onSelect, onClose }) {
  return (
    <>
      <div onClick={onClose} className={"fixed inset-0 z-40 bg-black/60 transition-opacity duration-200 " + (open ? "opacity-100" : "opacity-0 pointer-events-none")} />
      <aside className={"fixed top-0 left-0 z-50 h-full w-72 max-w-[80%] bg-zinc-950 border-r border-zinc-800 p-3 transition-transform duration-200 " + (open ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center justify-between px-2 py-2">
          <span className="text-lg font-semibold">Tiempo</span>
          <button onClick={onClose} aria-label="Close menu" className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-900"><X size={18} /></button>
        </div>
        <nav className="mt-2 space-y-1">
          {ITEMS.map((it) => {
            const I = it.icon; const active = section === it.id;
            return (
              <button key={it.id} onClick={() => onSelect(it.id)} className={"w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm " + (active ? "bg-amber-500 text-black font-medium" : "text-zinc-300 hover:bg-zinc-900")}>
                <I size={17} /> {it.label}
              </button>
            );
          })}
        </nav>
        <p className="absolute bottom-4 left-3 right-3 text-[11px] text-zinc-600">Every cell is 30 minutes of your finite week.</p>
      </aside>
    </>
  );
}
