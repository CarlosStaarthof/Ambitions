# CLAUDE.md

Guidance for AI agents (Claude Code and others) working in this repository. Keep this file current when architecture, conventions, or invariants change.

## What this is

**My Time** — a local-first weekly time-planner and monthly reflection tool. The web app is a Vite + React + Tailwind SPA; it ships as an installable PWA and is wrapped for Android/iOS with Capacitor. All user data lives on the device (IndexedDB via localForage); the JSON export is the only backup. AI features call Claude through a serverless proxy and only work online.

## Product philosophy (don't break these assumptions)

The whole app rests on one idea: **a week is finite — 7 days × 48 half-hour slots = 336 cells of 30 minutes each.** Tasks are split into two categories that are load-bearing across the UI and the AI prompts:

- **basic** — sleep, work, meals, exercise. Non-negotiable, come first.
- **ambition** — learning, reading, side projects. Protected and grown toward weekly targets.

If you change the category model, the seed data, the AI personas, and the Balance/Tasks tabs all have to move together.

## Commands

```bash
npm install        # install deps
npm run dev        # Vite dev server (web)
npm run build      # production build to dist/
npm run preview    # preview the production build
npm run cap:sync   # build + npx cap sync (push web build into native projects)
npm run android    # build + sync + open Android Studio
```

There is **no test runner, linter, or type-checker configured.** Don't claim "tests pass" — there are none. Verify changes by running `npm run dev` (or `npm run build` to catch build errors).

## Architecture

- **Single store, prop-drilled.** [src/lib/useStore.js](src/lib/useStore.js) is the one source of truth. It loads four keys from localForage on mount, seeds defaults on first run, and exposes state plus persisting setters. `App.jsx` calls `useStore()` once and passes slices down to each tab. There is no Context, Redux, or router.
- **Persist-on-write.** Every setter suffixed `P` (`setTasksP`, `setWeeksP`, `setReflectionsP`, `setQuestionsP`) writes to localForage as a side effect of setting React state. **Never call the raw `setTasks`/`setWeeks` etc. from a component — always go through the `P` setters**, or the change won't survive a reload. `setWeeksP` and `setReflectionsP` accept a value or an updater function (like `setState`).
- **Tabs are leaf views.** [src/App.jsx](src/App.jsx) switches between five tab components by string id; each receives only the store slices and setters it needs.
- **Pure helpers in `src/lib/`.** Time math, week-stat aggregation, id generation, and block-merging live in [src/lib/time.js](src/lib/time.js) and [src/lib/seed.js](src/lib/seed.js). Keep them pure and framework-free.

### Data model & storage keys

localForage instance `my-time` / store `kv`, four keys:

| key | shape |
| --- | --- |
| `tasks` | `[{ id, name, category: "basic"\|"ambition", color, target: number\|null }]` |
| `questions` | `[{ id, text }]` |
| `weeks` | `{ [isoMondayDate]: { cells: { "<dayIdx>-<slot>": taskId } } }` |
| `reflections` | `{ [yyyy-mm]: { [questionId]: answerText, _ai?: aiText } }` |

- Week keys are the ISO date of that week's Monday (`isoDate(mondayOf(d))`). Cell keys are `` `${dayIndex}-${slot}` `` where dayIndex 0–6 = Mon–Sun and slot 0–47 = 00:00–23:30.
- `_ai` is a **reserved key** inside a month's reflections object — it stores Claude's generated response, not a user answer. Code that iterates answers must skip `_ai` (see how `answeredCount` filters by the real `questions` list).
- The export envelope is `{ version: 3, exportedAt, tasks, questions, weeks, reflections }`. Bump `version` and handle migration in `DataTab` import if you change any shape.

## AI integration (read before touching anything AI-related)

- **The Anthropic API key NEVER lives in the client.** The browser calls a same-origin/configured proxy ([api/ai.js](api/ai.js)) that holds `ANTHROPIC_API_KEY` server-side and forwards to the Anthropic Messages API. Do not add the key to `.env`, the React app, or any committed file. `VITE_*` vars are bundled into client JS and are public by definition.
- **Client entry point** is `callClaude(content)` in [src/lib/ai.js](src/lib/ai.js): it short-circuits with `throw new Error("offline")` when `navigator.onLine` is false, POSTs `{ content }` to `VITE_AI_PROXY_URL` (default `/api/ai`), and flattens the Anthropic `content` blocks to text. AI buttons are disabled while `!online`.
- **Prompts live with the feature, not in a shared file.** The two personas are inline strings in [src/components/BalanceTab.jsx](src/components/BalanceTab.jsx) (`askCoach`) and [src/components/GuidingTab.jsx](src/components/GuidingTab.jsx) (`bounceGuiding`). They encode the basic-first / ambition-second philosophy — preserve that framing if you edit them.
- **Model** is set once, server-side, in `api/ai.js` (`claude-sonnet-4-6`). Change it there only; the client never names a model. For current model ids and the API contract, consult the `claude-api` skill rather than guessing.

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
- `appId` in `capacitor.config.json` (`com.carlos.mytime`) is permanent after publishing.

## Native / release notes

- `android/` and `ios/` are generated by `npx cap add …` and are not present until then. After any web change that needs to reach a device, run `npm run cap:sync`.
- Icons: drop `icon-192.png`, `icon-512.png`, `icon-maskable-512.png` into `public/icons/` (not yet present — PWA manifest and native builds reference them). See README for `@capacitor/assets`.

## Gotchas

- First run with empty storage seeds `SEED_TASKS` / `SEED_QUESTIONS`; to test the empty state, clear IndexedDB in devtools.
- Question numbering in the Guiding tab renders `i + 2` (historical — the original list started at g2). It's cosmetic; don't "fix" it into a data dependency.
- The week grid paints on mouse drag via a `paintingRef`; a global `mouseup` listener ends a stroke. Touch uses tap-to-fill.
