// Catalog of AI providers Tiempo can talk to. This is pure config — the first
// step to supporting a provider end-to-end. A model-selection UI reads this list,
// and the AI dispatcher (ai.js) + proxy (api/ai.js) turn a choice into a real call.
//
// `keyOwner` records the core design decision per provider (see docs/ROADMAP-V2.md):
//   "user"   -> the user brings their own account/key for that vendor (default plan)
//   "tiempo" -> Tiempo hosts a managed key server-side (costs money, simplest UX)
//
// NOTE: the non-Anthropic model ids below are placeholders — confirm the current
// ids before shipping (the `claude-api` skill has authoritative Claude ids).

export const NONE = "none"; // the "use the app without any AI" choice

export const PROVIDERS = [
  {
    id: "anthropic",
    label: "Claude (Anthropic)",
    keyOwner: "user",
    accountUrl: "https://console.anthropic.com/",
    defaultModel: "claude-sonnet-4-6",
    models: [
      { id: "claude-sonnet-4-6", label: "Claude Sonnet 4.6" },
      { id: "claude-haiku-4-5-20251001", label: "Claude Haiku 4.5" }
    ]
  },
  {
    id: "openai",
    label: "ChatGPT (OpenAI)",
    keyOwner: "user",
    accountUrl: "https://platform.openai.com/",
    defaultModel: "gpt-4o",
    models: [
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4o-mini", label: "GPT-4o mini" }
    ]
  },
  {
    id: "google",
    label: "Gemini (Google)",
    keyOwner: "user",
    accountUrl: "https://ai.google.dev/",
    defaultModel: "gemini-1.5-pro",
    models: [
      { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
      { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" }
    ]
  }
];

export const providerById = (id) => PROVIDERS.find((p) => p.id === id) || null;
export const isAiProvider = (id) => id && id !== NONE && !!providerById(id);
