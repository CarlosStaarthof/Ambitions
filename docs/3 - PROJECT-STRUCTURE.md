# Project structure — current vs. a clean target

Honest take first: **for an app this size, today's layout is fine** — flat `components/`
and `lib/` folders are not a problem. The reorg below only earns its keep as V2 adds a
settings screen, provider adapters, i18n, and (maybe) accounts. So treat this as the shape
to grow *into*, ideally applied as **one dedicated, mechanical commit right before Phase 1**
— not mixed in with feature work.

## Current
```
Tiempo/
├─ api/ai.js                      # serverless proxy
├─ src/
│  ├─ App.jsx  main.jsx  index.css
│  ├─ components/                 # WeekTab, TasksTab, BalanceTab, GuidingTab, DataTab
│  └─ lib/                        # ai, providers, io, seed, storage, time, ui, useArmed, useStore
├─ android/                       # native (generated)
├─ docs/
├─ public/                        # icons go here
└─ vite/tailwind/capacitor configs
```

## Target (feature-based, scales to V2)
```
Tiempo/
├─ api/                           # keep this name — Vercel maps /api to functions
│  └─ ai.js
├─ public/
│  └─ icons/
├─ src/
│  ├─ app/                        # shell only: App.jsx, main.jsx, top-level layout
│  ├─ features/                   # one folder per feature = view + its own hooks/logic
│  │  ├─ week/        (WeekTab.jsx …)
│  │  ├─ tasks/
│  │  ├─ balance/
│  │  ├─ guiding/
│  │  ├─ data/
│  │  └─ settings/                # NEW (P1): AI on/off, provider + model picker, BYO-key
│  ├─ ai/                         # AI subsystem: ai.js, providers.js, adapters/
│  ├─ shared/
│  │  ├─ ui/                      # ui.js tokens + shared primitives (Card, Button)
│  │  ├─ lib/                     # time.js, io.js, useArmed.js (framework-agnostic)
│  │  └─ store/                   # useStore.js, storage.js, seed.js
│  ├─ i18n/                       # NEW: en/ es/ strings ("Tiempo" wants Spanish + English)
│  └─ styles/                     # index.css
├─ scripts/                       # release helpers (version bump, apk build)
├─ docs/
├─ android/  ios/                 # native (generated; ios later)
└─ config files (root — leave here; tooling expects them)
```

## Why these moves
- **`features/` over `components/`**: each screen keeps its markup *and* its logic together, so adding Settings or editing Balance is one folder, not a hunt across `components/` + `lib/`.
- **`ai/` as its own subsystem**: multi-provider support means adapters, a catalog, and a dispatcher — enough to deserve a home. It's also the highest-churn area in V2.
- **`shared/` split (ui / lib / store)**: separates "pure helpers" from "React state" from "styling", which keeps imports honest and makes the pieces reusable.
- **`i18n/` from the start**: retrofitting localization is painful; a strings folder now costs nothing.
- **Keep `api/` and root configs where they are**: Vercel and Vite/Tailwind/PostCSS look for them by convention — moving them creates friction for zero gain.

## How to migrate safely (when you're ready)
1. Do it on its own branch, as a **pure move** — no behavior changes in the same commit.
2. Move files, then fix imports (mostly relative-path updates). `npm run build` is the safety net: it fails loudly on any broken import.
3. Update the path references in [../CLAUDE.md](../CLAUDE.md) so the agent guide stays accurate.
4. Commit as `refactor: adopt feature-based structure` and review the diff before merging.

Say the word and I'll execute this reorg in one pass and confirm the build stays green.
