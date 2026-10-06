import { NONE, providerById } from "./providers";

// Bring-your-own-key, called straight from the WebView.
//
// The key belongs to the USER. It is stored on their device and sent only to the
// provider they picked — Ambitions runs no proxy and never sees it. That is the
// whole point of Route B (docs/ROADMAP-V2.md D1): no server, no shared bill, and
// nothing to trust us not to log.
//
// Every adapter returns a plain string, so the tabs never learn which vendor answered.

export function isOnline() { return typeof navigator === "undefined" ? true : navigator.onLine; }

const MAX_TOKENS = 1000;

function friendly(status, msg) {
  if (status === 401 || status === 403) return "Your API key was rejected — check it in Settings.";
  if (status === 404) return "That model isn't available on your account. Pick another in Settings.";
  if (status === 429) return "Your provider is rate-limiting you, or the account is out of credit.";
  if (status >= 500) return "The provider is having trouble right now. Try again shortly.";
  return msg || `Request failed (${status})`;
}

async function readJson(res) {
  let data = null;
  try { data = await res.json(); } catch { /* provider returned no/!json body */ }
  if (!res.ok) {
    const err = data && data.error;
    const msg = (err && (err.message || err.type)) || (data && data.message) || "";
    throw new Error(friendly(res.status, msg));
  }
  return data || {};
}

const ADAPTERS = {
  anthropic: {
    // `anthropic-dangerous-direct-browser-access` is Anthropic's supported opt-in for
    // calling from a browser. It is appropriate here precisely because the key is the
    // user's own, on their own device.
    headers: (key) => ({
      "content-type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true"
    }),
    async send({ key, model, content }) {
      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: ADAPTERS.anthropic.headers(key),
        body: JSON.stringify({ model, max_tokens: MAX_TOKENS, messages: [{ role: "user", content }] })
      });
      const data = await readJson(res);
      return (data.content || []).filter((b) => b.type === "text").map((b) => b.text).join("\n\n").trim();
    },
    async models({ key }) {
      const res = await fetch("https://api.anthropic.com/v1/models?limit=100", { headers: ADAPTERS.anthropic.headers(key) });
      const data = await readJson(res);
      return (data.data || []).map((m) => ({ id: m.id, label: m.display_name || m.id }));
    }
  },

  openai: {
    headers: (key) => ({ "content-type": "application/json", authorization: `Bearer ${key}` }),
    async send({ key, model, content }) {
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: ADAPTERS.openai.headers(key),
        body: JSON.stringify({ model, messages: [{ role: "user", content }] })
      });
      const data = await readJson(res);
      const choice = (data.choices || [])[0];
      return ((choice && choice.message && choice.message.content) || "").trim();
    },
    async models({ key }) {
      const res = await fetch("https://api.openai.com/v1/models", { headers: ADAPTERS.openai.headers(key) });
      const data = await readJson(res);
      // The raw list mixes in embeddings/audio/image models. This is a heuristic, not
      // a guarantee — Settings also accepts a typed model id for anything it misses.
      const skip = /embed|whisper|tts|dall-e|moderation|audio|image|realtime|transcribe/i;
      return (data.data || [])
        .map((m) => ({ id: m.id, label: m.id }))
        .filter((m) => !skip.test(m.id))
        .sort((a, b) => a.id.localeCompare(b.id));
    }
  },

  google: {
    headers: (key) => ({ "content-type": "application/json", "x-goog-api-key": key }),
    async send({ key, model, content }) {
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
        method: "POST",
        headers: ADAPTERS.google.headers(key),
        body: JSON.stringify({ contents: [{ parts: [{ text: content }] }] })
      });
      const data = await readJson(res);
      const cand = (data.candidates || [])[0];
      const parts = (cand && cand.content && cand.content.parts) || [];
      return parts.map((p) => p.text || "").join("").trim();
    },
    async models({ key }) {
      const res = await fetch("https://generativelanguage.googleapis.com/v1beta/models", { headers: ADAPTERS.google.headers(key) });
      const data = await readJson(res);
      return (data.models || [])
        .filter((m) => (m.supportedGenerationMethods || []).includes("generateContent"))
        .map((m) => ({ id: String(m.name || "").replace(/^models\//, ""), label: m.displayName || m.name }));
    }
  }
};

// Main entry point. `ai` = settings.ai = { enabled, provider, model, keys }.
export async function callAI(content, ai = {}) {
  const { enabled = false, provider = NONE, model, keys = {} } = ai;
  if (!enabled || provider === NONE) throw new Error("ai-disabled");
  const adapter = ADAPTERS[provider];
  if (!adapter) throw new Error("Unknown provider: " + provider);
  const key = String(keys[provider] || "").trim();
  if (!key) throw new Error("no-key");
  if (!isOnline()) throw new Error("offline");
  const p = providerById(provider);
  const text = await adapter.send({ key, model: model || (p && p.defaultModel), content });
  if (!text) throw new Error("The provider returned an empty response.");
  return text;
}

// Ask the provider for its current model list, so the picker never goes stale.
export async function fetchModels(provider, key) {
  const adapter = ADAPTERS[provider];
  if (!adapter) throw new Error("Unknown provider: " + provider);
  if (!String(key || "").trim()) throw new Error("no-key");
  if (!isOnline()) throw new Error("offline");
  return adapter.models({ key: String(key).trim() });
}

// Turn the thrown sentinels into something worth showing a person.
export function aiErrorText(e) {
  const m = (e && e.message) || "";
  if (m === "offline") return "You're offline — connect to use this.";
  if (m === "no-key") return "Add your provider API key in Settings first.";
  if (m === "ai-disabled") return "AI is switched off. Turn it on in Settings.";
  return m || "Something went wrong.";
}
