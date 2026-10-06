# Architecture

The layering rule the reviewer checks against. See `CLAUDE.md` for product philosophy
and `docs/conventions.md` for style.

## Shape

```
src/main.jsx            mounts App
  src/App.jsx           calls useStore() ONCE, switches tabs by string id,
                        prop-drills slices down. No router, no Context, no Redux.
    components/*.jsx    leaf views. Receive only the slices and setters they need.
      lib/ui.js         shared Tailwind class strings
  src/lib/useStore.js   the single source of truth
    lib/storage.js      localForage instance + key get/set
    lib/secureStore.js  Capacitor SecureStore wrapper (Android Keystore)
  src/lib/*.js          pure helpers: time, seed, image, io, ai, providers
android/…/*.java        Capacitor plugins (SecureStorePlugin, FileSaverPlugin)
```

## Layers, outermost in

**1. Components (`src/components/`)** — rendering and local UI state only.

- ❌ Never import `localforage`, `storage.js`, or `secureStore.js`
- ❌ Never call a Capacitor plugin directly — go through a wrapper in `src/lib/`
- ✅ Local `useState` for things that are not persisted (drafts, open dialogs,
  which colour picker is showing) is correct and expected

**2. The store (`src/lib/useStore.js`)** — the only module that persists.

- Every setter suffixed `P` writes to localForage as a side effect of setting state.
  **Components must always use the `P` setters.** Calling the raw `setTasks` behind one
  leaves the change unsaved on reload.
- `setWeeksP`, `setReflectionsP`, `setVisionP` and `setSettingsP` accept a value *or* an
  updater function.
- Load-time migration lives here (`normalizeModel`, `backfillOpenWeeks`, the secure-key
  migration). New migrations belong here too, not in a component.

**3. Pure helpers (`src/lib/time.js`, `seed.js`, `image.js`)** — framework-free.

- No React, no DOM (except `image.js`, which deliberately uses canvas), no storage
- These are the unit-test targets. New logic that *can* live here, should.

**4. Native (`android/app/src/main/java/com/carlos/ambitions/`)** — Capacitor plugins.

- Each plugin gets a thin JS wrapper in `src/lib/` that also provides a browser
  fallback, so `npm run dev` keeps working
- Register in `MainActivity.onCreate` **before** `super.onCreate()`

## Data flow

```
user action → component handler → store P setter → React state + localForage
                                                 ↓
                                   re-render with new props
```

There is no event bus, no subscription, no cache layer. If a change does not reach a
`P` setter, it is not saved.

## Storage keys

localForage instance `ambitions`, store `kv` (V1 data auto-migrates from the legacy
`my-time` instance once, in `storage.js`):

| key | shape |
|---|---|
| `categories` | `[{ id, name, protected }]` — Ambition first, Open last |
| `tasks` | `[{ id, name, categoryId, color, target, weekKey? }]` |
| `questions` | `[{ id, text }]` |
| `weeks` | `{ [isoMonday]: { cells: { "<day>-<slot>": taskId } } }` |
| `reflections` | `{ [yyyy-mm]: { [questionId]: text, _ai? } }` |
| `vision` | `{ [year]: [{ id, img, caption, done, taskId, createdAt }] }` |
| `settings` | `{ ai: { enabled, provider, model } }` — **never** `keys` |

API keys live only in `secureStore` (Android Keystore), never in localForage and never
in the export.

- Week keys are the ISO date of that week's Monday. Cell keys are `` `${day}-${slot}` ``,
  day 0–6 = Mon–Sun, slot 0–47 = 00:00–23:30.
- `_ai` is reserved inside a month's reflections — it is generated text, not an answer.
  Any code iterating answers must skip it.
- A task carrying `weekKey` is scoped to that week alone (one-offs). Absent means always
  available.

## AI

`callAI(content, settings.ai)` dispatches to a per-provider adapter that calls the
vendor **directly from the WebView** with the user's own key. No proxy, no server. See
`CLAUDE.md` § AI integration before touching any of it.

## Verification reality

There is no type-checker and no linter. `npm run build` is the only thing that catches a
bad import or broken JSX, and `npm test` (Vitest) covers `src/lib/` purity. Neither can
tell you the UI is right — say plainly in your report what still needs checking on the
device.
