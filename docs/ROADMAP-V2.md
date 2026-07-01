# Tiempo — V2 Roadmap & Architecture

This turns your "core thinking" into an architecture and a sequence. It also isolates
the handful of **decisions only you can make** — I've recommended one for each so you can
just confirm or override.

## The vision, restated

Tiempo is a **personal-first** app you also want **publicly available**. It should:
- Work **with AI or completely without it** — AI is an enhancement, never a requirement.
- Support **any major AI provider** (Anthropic, OpenAI, Google to start), chosen by the user.
- Let the user **bring their own provider account** — Tiempo talks to the AI *on the user's behalf*, using the user's access, not a key Tiempo pays for.
- Offer a **Tiempo account** (log in) as the identity layer, with model selection after login.

## What already exists after this session (the foundation)

- `src/lib/providers.js` — the catalog of AI providers + a `none` option. A settings/model-picker UI reads this list; adding a provider starts here.
- `src/lib/ai.js` — a provider-aware dispatcher (`callAI(content, settings.ai)`) with per-provider adapters and an `ai-disabled` path. The old `callClaude()` still works, so V1 is untouched.
- `src/lib/useStore.js` — a persisted `settings` slice (`settings.ai = { enabled, provider, model }`), defaulting to Claude-on. Setting `enabled:false` or `provider:"none"` is the "no-AI" mode.

Nothing user-visible changed yet — the UI wiring waits on the decisions below and your change list, so we don't build UI twice.

## Decisions to make (my recommendation first)

### D1 — Where do provider API keys live?
Because the user brings their own account, *their* key/token has to reach the vendor somehow.
- **(Recommended) BYO-key through a thin, stateless proxy.** The user pastes their provider key once; it's stored **only on their device** (encrypted at rest), and sent per-request to a Tiempo proxy that *forwards* it to the vendor and returns the reply — **never logging or storing it**. This solves browser CORS (vendors block direct browser calls) without Tiempo ever owning the key.
- Direct browser → vendor: no server, but CORS-blocked by Anthropic/OpenAI and leaks the key in network tools.
- Tiempo-hosted managed keys: simplest UX, but **you pay every user's AI bill** — contradicts "user brings their own account."

### D2 — What is the "Tiempo account" actually for, and when?
- **(Recommended) Make it optional, and add it in Phase 2.** Ship V2 local-first with **no login required**; the app works fully offline and privately. Introduce an *optional* Tiempo account later purely for **cross-device sync + cloud backup**. This preserves today's "nothing leaves the device" privacy promise as the default.
- Required-account-from-day-one is possible but forces a backend (auth + database + privacy policy for stored personal data) before you can ship, and breaks offline-first.

### D3 — If/when you add accounts, who runs auth?
- **(Recommended) A managed auth + database service** (Supabase, Firebase, or Clerk) rather than hand-rolling login/password/crypto. Faster, safer, and it gives you the sync database in the same product.

### D4 — Hosting
- **(Recommended) Vercel** for the web app + the serverless proxy (they deploy together; `VITE_AI_PROXY_URL` defaults to same-origin `/api/ai`). Swap in a managed DB only when D2 Phase 2 arrives.

## Phased plan

- **P0 — Harden V1.** Apply your page-by-page fix list. Add real app icons. Deploy the proxy so AI works on the phone. Tag `v1.0.0`.
- **P1 — "Any model, or none."** Settings UI: an AI on/off switch + provider/model picker (reads `providers.js`), BYO-key entry stored on-device, proxy upgraded to route by provider and forward the user's key (D1). AI buttons hide/disable in no-AI mode.
- **P2 — Optional Tiempo account (D2/D3).** Managed auth; optional cloud sync/backup of the same JSON the export produces. Local-first stays the default.
- **P3 — Store submission.** Play Store first (Android, no Mac needed): signed AAB, data-safety form, privacy policy URL. App Store later (needs a Mac + Xcode + Apple Developer Program).
- **P4 — Update pipeline.** GitHub Actions builds web/PWA + Android on every tagged release; optionally fastlane to push builds to the stores. Web/PWA updates are instant; native store updates always wait on review.

## Honest division of labor for shipping

I **can**: write all the code and config, set up GitHub Actions CI, prepare signing config, fastlane lanes, store metadata/screenshots scaffolding, privacy policy draft, and versioning automation.
You **must**: create the developer accounts (Google Play ~$25 one-time, Apple ~$99/yr), hold the signing keystore, click through the store consoles, and — for iOS specifically — run the final build/upload on a **Mac with Xcode** (it cannot be done from Windows or from here).
