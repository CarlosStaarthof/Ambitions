# CLAUDE.md

> ## You are an orchestrator in this repository, not an editor.
>
> **Do not edit `src/`, `tests/`, or `android/` yourself.** Read `AGENTS.md`, then
> delegate through the subagent harness:
>
> ```
> spec-writer  →  (explorer ×2-3)  →  implementer  →  reviewer
> ```
>
> Launch them with the `Agent` tool, one feature at a time, and require each to write
> its output to a file under `progress/` and return only a one-line file reference.
> State lives on disk, not in chat.
>
> You may read anything, run `./init.ps1`, and edit harness files (`AGENTS.md`,
> `CHECKPOINTS.md`, `feature_list.json`, `specs/`, `docs/`, `progress/`) directly.
>
> **No feature reaches `done` without a reviewer `APPROVED` and a green `init`.**
>
> The one exception: if the user explicitly asks you to make a change directly, do it —
> their instruction outranks this file.

Guidance for AI agents (Claude Code and others) working in this repository. Keep this file current when architecture, conventions, or invariants change.

Deeper context lives in [docs/](docs/): [ROADMAP-V2.md](docs/ROADMAP-V2.md) (multi-provider AI, no-AI mode, accounts, and the open decisions), [BEST-PRACTICES.md](docs/BEST-PRACTICES.md), [PROJECT-STRUCTURE.md](docs/PROJECT-STRUCTURE.md), and [WORKING-WITH-CLAUDE-CODE.md](docs/WORKING-WITH-CLAUDE-CODE.md).

## What this is

**Ambitions** — a local-first weekly time-planner and monthly reflection tool. The web app is a Vite + React + Tailwind SPA; it ships as an installable PWA and is wrapped for Android/iOS with Capacitor. All user data lives on the device (IndexedDB via localForage); the JSON export is the only backup. AI features call Claude through a serverless proxy and only work online.

## Product philosophy (don't break these assumptions)

The whole app rests on one idea: **a week is finite — 7 days × 48 half-hour slots = 336 cells of 30 minutes each.** Time is organized into user-defined **categories**, each holding **tasks**:

- **Ambition** — the one protected, highest-priority track (the category with `protected: true`, fixed id `ambition`). Always kept first, never deletable; grown toward per-task weekly targets.
- **Everything else** — as many categories as the user wants (Sleep, Work, Health, Meals…). These are the committed realities of life; the app calls their scheduled hours "Committed".

"Ambition-first" is load-bearing across the Week/Balance stat cards (Ambition · Committed · Free) and the AI coach persona. If you change the category model, move the seed data, the `normalizeModel()` migration, the AI personas, and the Week/Balance/Tasks tabs together.

## Commands

```bash
npm install        # install deps
npm run dev        # Vite dev server (web)
npm run build      # production build to dist/
npm run preview    # preview the production build
npm run cap:sync   # build + npx cap sync (push web build into native projects)
npm run android    # build + sync + open Android Studio
```

```bash
npm test           # vitest run - unit tests for the pure helpers in src/lib/
npm run test:watch # vitest in watch mode
./init.ps1         # the gate: build + tests + one-feature check. Must print [OK].
```

There is **no linter and no type-checker.** `npm run build` is what catches a bad import
or broken JSX; `npm test` (Vitest) covers `src/lib/`. Neither proves the UI is right —
components are not unit-tested, so say plainly what still needs checking on the device
rather than implying coverage.

## Architecture

- **Single store, prop-drilled.** [src/lib/useStore.js](src/lib/useStore.js) is the one source of truth. It loads four keys from localForage on mount, seeds defaults on first run, and exposes state plus persisting setters. `App.jsx` calls `useStore()` once and passes slices down to each tab. There is no Context, Redux, or router.
- **Persist-on-write.** Every setter suffixed `P` (`setTasksP`, `setWeeksP`, `setReflectionsP`, `setQuestionsP`) writes to localForage as a side effect of setting React state. **Never call the raw `setTasks`/`setWeeks` etc. from a component — always go through the `P` setters**, or the change won't survive a reload. `setWeeksP` and `setReflectionsP` accept a value or an updater function (like `setState`).
- **Tabs are leaf views.** [src/App.jsx](src/App.jsx) switches between five tab components by string id; each receives only the store slices and setters it needs.
- **Pure helpers in `src/lib/`.** Time math, week-stat aggregation, id generation, and block-merging live in [src/lib/time.js](src/lib/time.js) and [src/lib/seed.js](src/lib/seed.js). Keep them pure and framework-free.

### Data model & storage keys

localForage instance `ambitions` (V1/V2 data is auto-migrated once from the legacy `my-time` instance on first load — see `storage.js`) / store `kv`, five keys:

| key | shape |
| --- | --- |
| `categories` | `[{ id, name, protected: bool }]` — Ambition (`protected:true`) is first & not deletable |
| `tasks` | `[{ id, name, categoryId, color, target: number\|null }]` |
| `questions` | `[{ id, text }]` |
| `weeks` | `{ [isoMondayDate]: { cells: { "<dayIdx>-<slot>": taskId } } }` |
| `reflections` | `{ [yyyy-mm]: { [questionId]: answerText, _ai?: aiText } }` |
| `settings` | `{ ai: { enabled, provider, model, keys } }` — app prefs; `keys` is a per-provider BYO-key map, never included in the JSON export |

- Week keys are the ISO date of that week's Monday (`isoDate(mondayOf(d))`). Cell keys are `` `${dayIndex}-${slot}` `` where dayIndex 0–6 = Mon–Sun and slot 0–47 = 00:00–23:30.
- `_ai` is a **reserved key** inside a month's reflections object — it stores Claude's generated response, not a user answer. Code that iterates answers must skip `_ai` (see how `answeredCount` filters by the real `questions` list).
- The export envelope is `{ version: 5, exportedAt, tasks, categories, questions, weeks, reflections, vision }`. `normalizeModel()` in `seed.js` migrates old shapes (incl. V1 `task.category`) forward on both load and import — extend it and bump `version` if you change any shape.

## AI integration (read before touching anything AI-related)

- **Ambitions never owns an API key, and runs no server.** This is **bring-your-own-key**: the user pastes *their own* provider key, it is stored on their device under `settings.ai.keys[provider]`, and [src/lib/ai.js](src/lib/ai.js) calls the vendor **directly from the WebView**. There is no proxy in the request path. Never add a project-owned key to `.env`, the React app, or any committed file — `VITE_*` vars are bundled into client JS and are public by definition. The distinction that matters: *the user's own key on their own device is by design; a key belonging to the project in the client is never acceptable.*
- **Provider-agnostic dispatcher.** `callAI(content, settings.ai)` routes to a per-provider adapter keyed on `settings.ai.provider`; [src/lib/providers.js](src/lib/providers.js) is the catalog (Anthropic/OpenAI/Google + a `none` option). All three adapters are wired: Anthropic `/v1/messages` (with `anthropic-dangerous-direct-browser-access`), OpenAI `/v1/chat/completions`, Google `:generateContent`. Each returns a plain string, so callers never learn which vendor answered. `enabled:false` or `provider:"none"` throws `ai-disabled` — the intended **no-AI mode**, and the shipping default.
- **Errors are sentinels, rendered via `aiErrorText(e)`** — `offline`, `no-key`, `ai-disabled`, plus friendly text mapped from HTTP status. AI UI only renders when enabled *and* a key exists for the selected provider (see `aiEnabled` in `App.jsx`), so buttons never appear in a state where they'd just fail.
- **Model ids are not hardcoded truth.** `providers.js` `models` is a *fallback*; `fetchModels(provider, key)` asks the vendor for its live catalogue, and Settings also accepts a typed model id. Vendor catalogs move constantly — don't bake a list in. For current Claude ids, consult the `claude-api` skill rather than guessing.
- **[api/ai.js](api/ai.js) is unused** and kept only as a starting point should managed keys ever be offered (roadmap D1 "Route A"). Nothing in the app calls it.
- **Prompts live with the feature, not in a shared file.** The two personas are inline strings in [src/components/BalanceTab.jsx](src/components/BalanceTab.jsx) (`askCoach`) and [src/components/GuidingTab.jsx](src/components/GuidingTab.jsx) (`bounceGuiding`). They encode the basic-first / ambition-second philosophy — preserve that framing if you edit them.

## Conventions

- **JavaScript + JSX, not TypeScript.** No type annotations; match the existing terse, single-line-handler style.
- **Styling is Tailwind utility classes.** Shared class strings (cards, inputs, buttons, chart tooltip) are centralized in [src/lib/ui.js](src/lib/ui.js) — reuse `card`, `inputCls`, `btnPrimary`, etc. instead of re-deriving them. Dark theme only (`bg-black` / zinc scale, `amber-500` accent).
- **Icons** come from `lucide-react`.
- **Charts** come from `recharts`; reuse the `TIP` tooltip style from `ui.js`.
- **Destructive actions use the two-tap confirm pattern** — `useArmed()` ([src/lib/useArmed.js](src/lib/useArmed.js)): first tap arms (4s window), second tap commits. Use it for any new delete/clear, don't add `window.confirm`.
- **IDs** for new entities come from `uid()` in `time.js`. Seed entities use fixed ids (`t1…`, `g2…`).

## Security & privacy invariants

- No analytics, no network calls except the AI proxy. "No data leaves the device" must stay true (it's the Play Store data-safety claim).
- Keep secrets out of git: `.env`, `*.keystore`, `key.properties` are gitignored. The **Android keystore is the app's permanent signing identity** — never commit it, never regenerate it once published.
- `appId` in `capacitor.config.json` (`com.carlos.ambitions`) is permanent after publishing.

## Native / release notes

- `android/` and `ios/` are generated by `npx cap add …` and are not present until then. After any web change that needs to reach a device, run `npm run cap:sync`.
- Icons: drop `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` into `public/icons/` (not yet present — PWA manifest and native builds reference them). See README for `@capacitor/assets`.

## Gotchas

- First run with empty storage seeds `SEED_TASKS` / `SEED_QUESTIONS`; to test the empty state, clear IndexedDB in devtools.
- Question numbering in the Guiding tab renders `i + 2` (historical — the original list started at g2). It's cosmetic; don't "fix" it into a data dependency.
- The week grid paints on mouse drag via a `paintingRef`; a global `mouseup` listener ends a stroke. Touch uses tap-to-fill.
