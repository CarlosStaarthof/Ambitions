import { User, KeyRound } from "lucide-react";
import { card } from "../lib/ui";

export default function AccountTab() {
  return (
    <div className="space-y-4">
      <div className={card + " p-4 space-y-2"}>
        <div className="flex items-center gap-2 text-sm font-medium"><User size={16} className="text-amber-400" /> Your Tiempo account</div>
        <p className="text-xs text-zinc-500 leading-relaxed">Sign-in is coming in the next phase. It will be <span className="text-zinc-300">optional</span> — Tiempo works fully offline without it — and used to sync your plan and your AI connections across devices.</p>
      </div>
      <div className={card + " p-4 space-y-2"}>
        <div className="flex items-center gap-2 text-sm font-medium"><KeyRound size={16} className="text-amber-400" /> AI connections</div>
        <p className="text-xs text-zinc-500 leading-relaxed">You'll connect each AI provider (Claude, ChatGPT, Gemini and more) with your own API key from that provider's developer console. The key stays private to you and is entered once. Nothing to set up here yet — turn AI on or off under <span className="text-zinc-300">Settings</span>.</p>
      </div>
    </div>
  );
}
