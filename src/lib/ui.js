export const card = "bg-zinc-900 border border-zinc-800 rounded-xl";
export const inputCls = "w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-zinc-100 placeholder-zinc-500 focus:outline-none focus:border-amber-500";
export const selectCls = "rounded-lg border border-zinc-700 bg-zinc-800 px-2 py-1.5 text-sm text-zinc-100 focus:outline-none focus:border-amber-500";
export const btnPrimary = "inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-lg bg-amber-500 text-black font-medium hover:bg-amber-400 disabled:opacity-50";
export const btnGhost = "inline-flex items-center gap-1 text-sm px-3 py-1.5 rounded-lg border border-zinc-700 text-zinc-300 hover:bg-zinc-800";
export const TIP = { contentStyle: { background: "#18181b", border: "1px solid #3f3f46", borderRadius: 8 }, labelStyle: { color: "#fafafa" }, itemStyle: { color: "#fafafa" } };

// Enter should advance to the next field, not insert a newline. Several "single
// line" fields are textareas (so they auto-wrap long question text), where a
// stray Enter silently pushes the caret down and reads as data loss.
export function advanceOnEnter(e) {
  if (e.key !== "Enter" || e.shiftKey) return;
  e.preventDefault();
  const fields = Array.from(
    document.querySelectorAll("input:not([type=hidden]):not([disabled]), textarea:not([disabled]), select:not([disabled])")
  ).filter((el) => el.offsetParent !== null);
  const next = fields[fields.indexOf(e.target) + 1];
  if (next) next.focus(); else e.target.blur();
}
