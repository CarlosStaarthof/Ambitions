import { callAI } from "./ai";
import { NONE } from "./providers";

// Optional AI polishing is strictly opt-in. It runs only when the user has switched
// AI on, picked a provider other than "none", and stored their own key in
// hardware-backed secure storage. The key is read from memory for this one call and
// is never written to a note, `weeks`, `settings` or the export envelope.
//
// The non-AI `cleanDictation` is always the default; polishing never runs on its own.
const PROMPT =
  "Rewrite the note below so it reads clearly. Keep the meaning and the writer's voice. " +
  "Return only the rewritten note, with no quotes and no commentary.\n\n";

export async function polishText(text, ctx = {}) {
  const ai = (ctx.settings && ctx.settings.ai) || {};
  const provider = ai.provider;
  const keys = ctx.aiKeys || {};
  const key = provider && provider !== NONE ? String(keys[provider] || "").trim() : "";

  if (!ai.enabled || !provider || provider === NONE || !key) return { error: "polish-disabled" };

  const source = typeof text === "string" ? text.trim() : "";
  if (!source) return { error: "polish-disabled" };

  try {
    const out = await callAI(PROMPT + source, {
      enabled: true,
      provider,
      model: ai.model,
      keys: { [provider]: key }
    });
    const polished = String(out || "").trim();
    return polished ? { text: polished } : { error: "polish-failed" };
  } catch {
    return { error: "polish-failed" };
  }
}
