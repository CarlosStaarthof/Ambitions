# CHECKPOINTS.md

The reviewer walks this list for every feature and marks each `[x]` or `[ ]` **with a
reason**. A feature does not reach `done` with an unexplained `[ ]`.

## C1 — Verification

- C1.1 `./init.ps1` prints `[OK]`
- C1.2 Every acceptance criterion in the spec names a test that proves it
- C1.3 No test was deleted, skipped, or weakened to reach green
- C1.4 New pure logic in `src/lib/` has unit tests

## C2 — Scope

- C2.1 Exactly one feature was `in_progress`
- C2.2 Every file touched is listed in `progress/impl_<feature>.md`
- C2.3 Nothing outside the feature's stated scope was changed
- C2.4 No unrelated "while I was in there" fix crept in

## C3 — Architecture (`docs/architecture.md`)

- C3.1 No component reads or writes localForage directly — everything goes through
  `useStore()`
- C3.2 State changes use the `P` setters (`setTasksP`, `setWeeksP`, …), never the raw
  `setState` behind them
- C3.3 `src/lib/` helpers stayed pure — no React, no DOM, no storage access
- C3.4 Native access goes through a Capacitor plugin wrapper in `src/lib/`, not from a
  component

## C4 — Conventions (`docs/conventions.md`)

- C4.1 JavaScript + JSX, no TypeScript annotations
- C4.2 Shared Tailwind strings reused from `src/lib/ui.js` rather than re-derived
- C4.3 Icons from `lucide-react`; charts from `recharts` using the shared `TIP`
- C4.4 Destructive actions use the two-tap `useArmed()` pattern, not `window.confirm`
- C4.5 New entity ids come from `uid()`

## C5 — Data safety

- C5.1 Any change to a stored shape extends `normalizeModel()` and bumps the export
  `version`
- C5.2 A migration for existing data was written **and tested** — new code that only
  works for new installs is incomplete
- C5.3 Nothing in the "Never touch" list of `AGENTS.md` was modified
- C5.4 No API key, token, or secret can reach localForage or the JSON export

## C6 — Product philosophy (`CLAUDE.md`)

- C6.1 The finite week (7 × 48 = 336 half-hour cells) still holds
- C6.2 Ambition stays the protected, first, non-deletable category
- C6.3 The app remains fully usable with AI switched off — and shows no AI surface at
  all in that state
- C6.4 "No data leaves the device" still holds, except a user-enabled AI call with the
  user's own key

## C7 — Reaching the device

- C7.1 Web-only changes: `npm run build` is enough to verify
- C7.2 Anything touching `android/` needs `npm run cap:sync` **and** a rebuild — say so
  in the report; the user runs the install
- C7.3 A new Capacitor plugin is registered in `MainActivity.onCreate` *before*
  `super.onCreate()`
