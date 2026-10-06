// Catalog of AI providers Ambitions can talk to. Pure config — the transport for
// each one lives in ai.js.
//
// Ambitions is bring-your-own-key: the user pastes *their own* provider key, it is
// stored only on their device, and the app calls the vendor directly from the
// WebView (see docs/ROADMAP-V2.md D1, "Route B"). Ambitions never owns a key and
// never runs a server in the middle, so nobody's usage is billed to the project.
//
// `models` here is only a FALLBACK for when the live list can't be fetched.
// Vendor catalogs change constantly — ai.js `fetchModels()` asks the provider for
// the real list using the user's key, and Settings also allows a custom model id.

export const NONE = "none"; // the "use the app without any AI" choice

export const PROVIDERS = [
  {
    id: "anthropic",
    label: "Claude (Anthropic)",
    accountUrl: "https://console.anthropic.com/settings/keys",
    keyHint: "Starts with sk-ant-",
    defaultModel: "claude-opus-5",
    models: [
      { id: "claude-opus-5", label: "Claude Opus 5" },
      { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5 (cheapest)" }
    ]
  },
  {
    id: "openai",
    label: "ChatGPT (OpenAI)",
    accountUrl: "https://platform.openai.com/api-keys",
    keyHint: "Starts with sk-",
    defaultModel: "gpt-4o",
    models: [{ id: "gpt-4o", label: "GPT-4o" }]
  },
  {
    id: "google",
    label: "Gemini (Google)",
    accountUrl: "https://aistudio.google.com/app/apikey",
    keyHint: "Starts with AIza",
    defaultModel: "gemini-1.5-pro",
    models: [{ id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" }]
  }
];

export const providerById = (id) => PROVIDERS.find((p) => p.id === id) || null;
export const isAiProvider = (id) => id && id !== NONE && !!providerById(id);
