# Implementation — feature 16 `todo-undo-window`

**Branch:** `hermes/mwwlki8i`
**Spec:** `specs/features/016-todo-undo-window.md` (approved, unchanged)
**Status:** feature left `in_progress`; not marked done.

## Files touched

- `src/lib/reminderWall.js` — added `UNDO_WINDOW_MS`, `canUndoReminder`, `reopenReminder` (pure; reuses `isObject`, `timeMs`, `cloneWall`).
- `src/components/TodoChartTab.jsx` — `now` prop, `undo(id)` handler, guarded Undo button / muted `Undo closed` in each Done card.
- `src/App.jsx` — passes `now={now}` to `<TodoChartTab>`.
- `tests/unit/todoUndoWindow.test.js` — new, 15 tests covering AC-1..AC-12.
- `progress/current.md` — round-2 plan recorded.
- `progress/impl_todo-undo-window.md` — this report.

`feature_list.json` was not edited by this run (its feature 15/16 status change was already in the worktree).

## Acceptance criteria

| AC | Where satisfied | Test that proves it |
|---|---|---|
| AC-1 | `src/lib/reminderWall.js` `UNDO_WINDOW_MS` | `todoUndoWindow > UNDO_WINDOW_MS > exports the fixed 24-hour window in milliseconds` |
| AC-2 | `canUndoReminder` strict `<` comparison | `canUndoReminder > is true an hour after done, false at exactly 24 h and one millisecond later`; `is false for an open item with no doneAt` |
| AC-3 | `canUndoReminder` non-object / `timeMs` NaN guards | `returns false without throwing for missing, malformed, non-object and unparseable inputs`; `never mutates the item it inspects` |
| AC-4 | `timeMs` accepts `Date` and non-blank ISO string | `accepts a Date and an ISO string for the same instant and gives the same answer` |
| AC-5 | `reopenReminder` destructures `doneAt` out and sets `updatedAt` | `removes doneAt, stamps updatedAt and leaves every other field and item alone` |
| AC-6 | `reopenReminder` `canUndoReminder` guard -> `"undo-expired"` | `returns undo-expired at the boundary and keeps the item archived`; `returns undo-expired for an unparseable doneAt` |
| AC-7 | `reopenReminder` absent id / no `doneAt` branches | `returns not-archived for an open item and reminder-not-found for an absent id` |
| AC-8 | `markDone` -> `reopenReminder` -> `markDone` | `restarts the window when a reopened item is marked done again` (also asserts `activeReminders` contains the reopened item) |
| AC-9 | `reopenReminder` second call sees no `doneAt` | `is not-archived when called a second time on its own output` |
| AC-10 | `TodoChartTab.jsx` import, guard, handler, `setReminderWallP(r.wall)`, `Undo closed` | `Done view and App wiring (source-read) > imports the undo helpers, guards on canUndoReminder and persists through setReminderWallP` |
| AC-11 | `App.jsx` `<TodoChartTab ... now={now}>` | `Done view and App wiring (source-read) > passes the app's ticking now to TodoChartTab` |
| AC-12 | Wall shape unchanged; no deadline field; no delete in Done view | `stored shape stays unchanged (AC-12) > normalizeReminderWall preserves doneAt and no undo deadline is introduced` |

**Device ACs:** none in this spec. AC-10's UI result is proven only by the
source-contract test the spec asks for; the rendered button/date layout still merits a
visual check, but there is no device criterion to tick.

## Gate output

```
=== Ambitions verification gate ===
-> dependencies present
-> npm run build
(!) Some chunks are larger than 500 kB after minification. Consider:
- Using dynamic import() to code-split the application
- Use build.rollupOptions.output.manualChunks to improve chunking: https://rollupjs.org/configuration-options/#output-manualchunks
- Adjust chunk size limit for this warning via build.chunkSizeWarningLimit.
-> npm test

> ambitions@0.1.0 test
> vitest run

 RUN  v2.1.9 /scratch/Ambitions

 ✓ tests/unit/tasks.test.js (33 tests)
 ✓ tests/unit/seed.test.js (39 tests)
 ✓ tests/unit/reminderWall.test.js (25 tests)
 ✓ tests/unit/notes.test.js (45 tests)
 ✓ tests/unit/todoUndoWindow.test.js (15 tests)
 ✓ tests/unit/reminders.test.js (31 tests)
 ✓ tests/unit/time.test.js (36 tests)
 ✓ tests/unit/todoChart.test.js (20 tests)
 ✓ tests/unit/vision.test.js (14 tests)
 ✓ tests/unit/weekNoteLongPress.test.js (9 tests)
 ✓ tests/unit/notePolish.test.js (6 tests)
 ✓ tests/unit/storage.test.js (4 tests)

 Test Files  12 passed (12)
      Tests  277 passed (277)

-> in progress: 16 todo-undo-window

[OK] build green, tests green, scope clean
```

`npm test --silent` on its own: 12 files, 277 tests passed.

## Deviations from the spec

None.

## Notes for the reviewer

- `reopenReminder` stores the supplied `now` verbatim in `updatedAt`. The Done-tab
  handler now passes `new Date().toISOString()`, matching `markDone` and every other
  wall timestamp, so the in-memory value is a string and survives normalization.
- Existing structural test in `tests/unit/reminderWall.test.js` forbids the literal
  word `window` inside `src/lib/reminderWall.js`, so the new comments say "24-hour
  period" instead of "window".
- No stored shape, localForage key, export envelope, migration, AI surface, delete path
  or `useArmed` usage was added.
