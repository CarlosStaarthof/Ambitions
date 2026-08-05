import { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight, Pencil, Plus, Sparkles, Loader2 } from "lucide-react";
import { uid, monthKeyOf, monthLabelOf, labelFromKey } from "../lib/time";
import { card, inputCls, selectCls, btnPrimary, btnGhost } from "../lib/ui";
import { useArmed } from "../lib/useArmed";
import { callClaude } from "../lib/ai";

export default function GuidingTab({ questions, setQuestionsP, reflections, setReflectionsP, online, aiEnabled }) {
  const [monthSel, setMonthSel] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [editQ, setEditQ] = useState(false);
  const [gCoach, setGCoach] = useState({ loading: false, error: "" });
  const { arm, isArmed } = useArmed();

  const monthKey = monthKeyOf(monthSel);
  const monthKeys = useMemo(() => { const s = new Set(Object.keys(reflections)); s.add(monthKey); return Array.from(s).sort().reverse(); }, [reflections, monthKey]);
  const monthAnswers = reflections[monthKey] || {};
  const answeredCount = questions.filter((q) => (monthAnswers[q.id] || "").trim()).length;

  const setAnswer = (qid, text) => setReflectionsP((prev) => ({ ...prev, [monthKey]: { ...(prev[monthKey] || {}), [qid]: text } }));
  const stepMonth = (n) => setMonthSel(new Date(monthSel.getFullYear(), monthSel.getMonth() + n, 1));

  async function bounceGuiding() {
    setGCoach({ loading: true, error: "" });
    try {
      const qa = questions.map((q) => `Q: ${q.text}\nA: ${(monthAnswers[q.id] || "").trim() || "(blank)"}`).join("\n\n");
      const persona = "You are a thoughtful, warm sounding board — not a judge, never flattering. Once a month this person answers a fixed set of reflection questions that act as the compass for how they spend their finite time (their week is built basic-needs-first, then ambition). Read this month's questions and answers, reflect back the patterns or tensions you notice and anything that seems to be shifting, ask one or two sharp questions, and offer one angle they might be missing. Keep it to a short couple of paragraphs.";
      const text = await callClaude(`${persona}\n\nMonth: ${monthLabelOf(monthSel)}\n\n${qa}`);
      setReflectionsP((prev) => ({ ...prev, [monthKey]: { ...(prev[monthKey] || {}), _ai: text } }));
      setGCoach({ loading: false, error: "" });
    } catch (e) { setGCoach({ loading: false, error: e.message === "offline" ? "You're offline — connect to use this." : (e.message || "Something went wrong.") }); }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button onClick={() => stepMonth(-1)} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-900"><ChevronLeft size={18} /></button>
        <div className="text-sm font-medium">{monthLabelOf(monthSel)}</div>
        <button onClick={() => stepMonth(1)} className="p-1.5 rounded-lg text-zinc-400 hover:bg-zinc-900"><ChevronRight size={18} /></button>
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="text-xs text-zinc-500">jump to</span>
          <select value={monthKey} onChange={(e) => { const [y, m] = e.target.value.split("-").map(Number); setMonthSel(new Date(y, m - 1, 1)); }} className={selectCls}>{monthKeys.map((k) => <option key={k} value={k}>{labelFromKey(k)}</option>)}</select>
        </div>
        <button onClick={() => setEditQ((v) => !v)} className={btnGhost}><Pencil size={13} /> {editQ ? "Done" : "Edit questions"}</button>
      </div>

      <p className="text-xs text-zinc-500">Answer once a month — this is your reference for setting ambition targets. {answeredCount}/{questions.length} answered for {monthLabelOf(monthSel)}. Page back any time to trace how your thinking shifts.</p>

      {questions.map((q, i) => (
        <div key={q.id} className={card + " p-3 space-y-2"}>
          <div className="flex items-start gap-2">
            <span className="text-xs text-zinc-600 mt-0.5 shrink-0">{i + 2}</span>
            {editQ ? (
              <>
                <textarea value={q.text} onChange={(e) => setQuestionsP(questions.map((x) => x.id === q.id ? { ...x, text: e.target.value } : x))} rows={1} className="flex-1 text-sm bg-transparent text-zinc-100 focus:outline-none resize-none" />
                <button onClick={() => arm("delQ" + q.id, () => setQuestionsP(questions.filter((x) => x.id !== q.id)))} className={"text-xs px-2 py-1 rounded shrink-0 " + (isArmed("delQ" + q.id) ? "bg-red-600 text-white" : "text-zinc-600 hover:text-red-400")}>{isArmed("delQ" + q.id) ? "sure?" : "×"}</button>
              </>
            ) : (
              <div className="text-sm font-medium text-zinc-100">{q.text || "(untitled question)"}</div>
            )}
          </div>
          {!editQ && (
            <textarea value={monthAnswers[q.id] || ""} onChange={(e) => setAnswer(q.id, e.target.value)} rows={3} placeholder={`Your answer for ${monthLabelOf(monthSel)}…`} className={inputCls + " resize-y"} />
          )}
        </div>
      ))}

      {editQ ? (
        <button onClick={() => setQuestionsP([...questions, { id: uid(), text: "" }])} className={btnGhost}><Plus size={14} /> Add question</button>
      ) : aiEnabled ? (
        <div className={card + " p-4 space-y-3"}>
          <div className="flex items-center gap-1.5 text-sm font-medium"><Sparkles size={15} className="text-amber-400" /> Bounce it off Claude</div>
          <p className="text-xs text-zinc-500">Claude reads this month's answers and bounces back — patterns it notices, a couple of sharp questions, an angle you might be missing.</p>
          <button onClick={bounceGuiding} disabled={gCoach.loading || !online} className={btnPrimary}>{gCoach.loading ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />}{gCoach.loading ? "thinking…" : !online ? "Needs internet" : monthAnswers._ai ? "Bounce again" : "Bounce my answers back"}</button>
          {gCoach.error && <div className="text-xs text-red-400">{gCoach.error}</div>}
          {monthAnswers._ai && <div className="border border-amber-500 bg-zinc-900 rounded-xl p-3 text-sm text-zinc-200 whitespace-pre-wrap leading-relaxed">{monthAnswers._ai}</div>}
        </div>
      ) : null}
    </div>
  );
}
