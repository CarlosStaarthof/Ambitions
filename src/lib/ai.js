import { NONE, providerById } from "./providers";

export function isOnline() { return typeof navigator === "undefined" ? true : navigator.onLine; }

const proxyUrl = () => import.meta.env.VITE_AI_PROXY_URL || "/api/ai";

// Every online provider is routed through the same serverless proxy. The proxy
// decides which vendor API to call and holds/forwards the key, so no secret ever
// touches the client. The client only says which provider + model it wants.
async function viaProxy({ provider, content, model }) {
  if (!isOnline()) throw new Error("offline");
  const res = await fetch(proxyUrl(), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ provider, model, content })
  });
  if (!res.ok) throw new Error("Request failed (" + res.status + ")");
  const data = await res.json();
  // Anthropic response shape today; the proxy will normalize others to { text }.
  const text =
    (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n\n").trim() ||
    (data.text || "").trim();
  if (!text) throw new Error("Empty response");
  return text;
}

// Per-provider adapters. Non-Anthropic ones are declared so settings/UI can offer
// them now, but they fail clearly until the proxy side + account model land.
const ADAPTERS = {
  anthropic: (args) => viaProxy({ provider: "anthropic", ...args }),
  openai: () => { throw new Error("OpenAI isn't connected yet"); },
  google: () => { throw new Error("Gemini isn't connected yet"); }
};

// Main entry point. `settings` = { enabled, provider, model }.
export async function callAI(content, settings = {}) {
  const { enabled = true, provider = "anthropic", model } = settings;
  if (!enabled || provider === NONE) throw new Error("ai-disabled");
  const adapter = ADAPTERS[provider];
  if (!adapter) throw new Error("Unknown provider: " + provider);
  const p = providerById(provider);
  return adapter({ content, model: model || (p && p.defaultModel) });
}

// Backward-compatible wrapper: existing tabs call this and get V1 behavior
// (Claude via the proxy). New code should prefer callAI(content, settings.ai).
export async function callClaude(content) {
  return callAI(content, { enabled: true, provider: "anthropic" });
}
