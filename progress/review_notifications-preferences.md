# Review — feature 19 notifications-preferences

**Verdict:** APPROVED

Spec: `specs/features/019-notifications-preferences.md`. Reviewed the working-tree diff plus
untracked `tests/unit/quietHours.test.js`, the spec and the impl report.

## Gate

- `npm test --silent` -> 13 files, **297 passed**, 0 failed, 0 skipped (matches the impl report).
- `bash init.sh` -> `-> in progress: 19 notifications-preferences` / `[OK] build green, tests green, scope clean`. No step skipped.
- `git status` after the runs: only the files listed in the impl report plus `feature_list.json` / `progress/current.md` (see C2).

## Acceptance criteria

| AC | Verdict | Evidence |
|---|---|---|
| AC-1 | PASS | `useStore.js` `DEFAULT_SETTINGS.quietHours = { enabled: true, start: "23:00", end: "07:00" }`; test `quietHours.test.js:13-15`. Eight keys: existing `reminders.test.js:285` "reads and writes exactly the eight localForage keys" (green; diff adds no `loadKey`/`saveKey` literal). |
| AC-2 | PASS | `time.js` `normalizeQuietHours` (non-object/array -> `{}` -> defaults); tests `quietHours.test.js:45-54` (undefined, null, "nonsense", preserved `{false,"22:15","06:30"}`). |
| AC-3 | PASS | `enabled: q.enabled !== false`; `normalizeClock` pads/clamps/falls back. Tests `:57-66` ("7:05"->"07:05", "25:70"->"23:59", "abc"->fallback), idempotency `:69-72`. |
| AC-4 | PASS | `minutesOfClock`; tests `:32-39` (1380, 0, null; also null for "25:70"). |
| AC-5 | PASS | `inQuietHours` `start < end ? m>=start && m<end : m>=start || m<end`. Tests `:77-92` assert exactly the spec's minutes (08:00/16:59 true, 07:59/17:00 false; 23:00/00:00/06:59 true, 07:00/22:59 false). Start inclusive, end exclusive confirmed. |
| AC-6 | PASS | Guards for `!enabled`, `start===end`, invalid date; test `:95-100` (disabled, equal, "not-a-date", undefined). |
| AC-7 | PASS | `reminders.js` `filterQuietOccurrences` uses `.filter` (new array, order kept, no mutation). Tests `:113-134`: exact drop `[1,4,5]`, `not.toBe(plan)` + deep-equal copy, disabled keeps all, null plan -> `[]`. |
| AC-8 | PASS | `mergeSettings` (`seed.js:219`) fills nested `quietHours` defaults and preserves stored; `useStore.js` load path normalizes (`next = {...merged, quietHours: normalizeQuietHours(...)}`) and `setSettingsP` normalizes on every write. Tests `:139-158` (fill, preserve, idempotent, repair). The in-hook normalize line itself is verified by diff inspection; the repair function is unit-tested. |
| AC-9 | PASS (inspection) | `App.jsx` sync: `filterQuietOccurrences(plannedReminders(REMINDER_SOURCES, settings, new Date(), HORIZON, {reflections, questions}), settings.quietHours)` then `syncReminders(plan)`. No automated test (see observation 1); the default 19:00 reflection lies outside 23:00-07:00, and the filter itself is covered by AC-7 tests. |
| AC-10 | PASS (inspection) | Effect deps `[loading, storageError, settings, reflections, questions, reminderWall, weeks]`; `visibilitychange` handler still calls `sync()`, which builds the filtered plan each run. No automated test (observation 1). |
| AC-11 | PASS | `time.js` imports only `./seed` (pre-existing line 1, unchanged); `reminders.js` imports only `./time` (existing test `reminders.test.js` "keeps the pure schedule module free of Capacitor and storage" asserts `["./time"]`, green). No React/DOM/Capacitor/storage in the added code. |
| AC-12 | PASS | `DataTab.jsx` untouched; existing test `reminders.test.js:271-280` asserts `version: 6`, no `settings` in payload (green). Import of v4/5/6 untouched. Existing reminder/reflection tests all pass; new tests cover AC-1..8 (20 tests). |

Boundary semantics, fallback/clamp/idempotency, no-mutation, merge idempotency: all verified by
the tests cited above and by reading `time.js` / `reminders.js` in the diff.

## Settings UI
`SettingsTab.jsx`: card titled Notifications, a Quiet hours checkbox switch (`enabled`), two
`type="time"` inputs (disabled only when the switch is off, so they stay editable on web where
the reminder toggles are disabled), and copy about midnight crossing. Edits go through
`store.setSettingsP` with `normalizeQuietHours`, and `setSettingsP` normalizes again before saving.
No component touches localForage (C3.1).

## CHECKPOINTS

- [x] C1.1 `init.sh` prints `[OK]` (POSIX equivalent of init.ps1).
- [x] C1.2 AC-1..8, 11, 12 have tests; AC-9/10 are App wiring covered by inspection (spec AC-12 scopes new tests to AC-1..8) — see observation 1.
- [x] C1.3 No test deleted/skipped/weakened: diff touches no existing test file; 297 pass.
- [x] C1.4 New pure logic has unit tests (`quietHours.test.js`).
- [x] C2.1 Exactly one feature `in_progress` (id 19; the other grep hit is the statuses vocabulary list).
- [x] C2.2 Every touched file is in the impl report, except `feature_list.json` and `progress/current.md` (the former is spec-phase bookkeeping that adds ids 19-22, the latter a plan note; both outside the code scope and non-blocking).
- [x] C2.3 Nothing outside scope changed.
- [x] C2.4 No unrelated fix.
- [x] C3.1 No component reads/writes localForage.
- [x] C3.2 State written via `setSettingsP`.
- [x] C3.3 `src/lib/` helpers pure.
- [x] C3.4 No new native access.
- [x] C4.1 JS/JSX only. [x] C4.2 reuses `card`, `inputCls`. [x] C4.3 `Bell` from lucide-react retained. [x] C4.4 n/a, no destructive action. [x] C4.5 n/a, no new entity ids.
- [x] C5.1 Stored shape: `settings` normalized via `mergeSettings`/`normalizeQuietHours`; the export excludes `settings`, so no version bump per the spec. [x] C5.2 Migration of pre-feature settings written and tested (AC-8 tests). [x] C5.3 Never-touch list untouched (storage name, appId, Ambition category). [x] C5.4 No secret added.
- [x] C6.1-C6.4 unaffected; no AI surface or network change.
- [x] C7.1 Web-only change; `npm run build` green via init.sh. [x] C7.2/C7.3 `android/` untouched.

## Required changes
None.

## Observations (non-blocking)
1. AC-9/AC-10 have no automated test; they were verified by reading the diff. The repo already uses source-reading tests of `App.jsx` (e.g. `tests/unit/todoChart.test.js:128`). A follow-up could add one asserting `filterQuietOccurrences` precedes `syncReminders` and the dep list contains `reminderWall`/`weeks`. Accepted here because spec AC-12 explicitly limits required new tests to AC-1..8.
2. Clearing a `type="time"` input yields `""`, which `normalizeClock` turns into the default (23:00/07:00) rather than leaving it empty; acceptable repair behaviour.
3. `normalizeQuietHours` runs on every `inQuietHours` call (per plan entry); cost is trivial at `HORIZON` size.
4. Equal start/end is stored as-is and treated as "no window" (spec-conformant).

## Device-only checks
No new native code. For the user after install: set quiet hours spanning a scheduled reflection
time and confirm it is not delivered, then narrow the window and confirm it returns. Delivery
checks from feature 3 still apply. No `cap:sync` needed for this change (web code only, but a
normal rebuild is needed to ship it to the device).
