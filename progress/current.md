# Current session

**Date:** 2026-11-25
**Goal (owner):** four requests — (1) long-press note must always work on the week
grid; (2) a Settings language choice for the app and for the AI's understanding /
answers; (3) undo a done to-do within 24 hours; (4) main menu order Plan & Balance,
To-Do's Chart, Vision Board, Records, Settings.
**This round:** round 2 of 5 — request (3), undo a done to-do within 24 hours.
**In flight:** nothing. Feature 16 `todo-undo-window` is `done` (review
`progress/review_todo-undo-window.md`); feature 15 is `in_review`.

Features 11, 12, 13 and 15 remain `in_review` (device checks pending). 14 and 16 are
`done`.

## Round 2 — 24-hour undo of a done to-do (feature 16, done)

- `src/lib/reminderWall.js`: `UNDO_WINDOW_MS`, `canUndoReminder(item, now)` (strict
  `< 24 h`, `now` as Date or ISO), `reopenReminder(wall, id, now)` (removes `doneAt` by
  destructuring, stamps `updatedAt` as an ISO string, errors `reminder-not-found` /
  `not-archived` / `undo-expired`). No stored deadline; expiry derived from `doneAt`.
- `src/components/TodoChartTab.jsx`: Done view shows `Undo` only while the window is
  open and `Undo closed` after; Undo persists through `setReminderWallP`.
- `src/App.jsx`: passes the ticking `now` to `TodoChartTab`.
- Tests: `tests/unit/todoUndoWindow.test.js` (15 tests). Report:
  `progress/impl_todo-undo-window.md`; review: `progress/review_todo-undo-window.md`.
- Gate: `npm test --silent` → 12 files, 277 tests passed; `bash init.sh` → `[OK]`.
- Not a stored-shape change, so no migration and no export version bump.

## Round 1 — long-press opens a note with a brush selected (feature 15, in_review)

- Root cause: feature 12 gated the gesture on `brush == null`, and a brush is never
  cleared when the user switches categories. `WeekTab.jsx` now starts the hold for
  any pointer unless the note dialog is open; the release tap that ends a hold is
  swallowed so it cannot paint; touch/pen never paint on the mouse-compatibility path.
- `SettingsTab.jsx` copy no longer claims the gesture needs no brush.
- Spec 012 amended with the owner ruling of 2026-11-25. New spec
  `specs/features/015-week-note-longpress.md`.
- Tests: `tests/unit/notes.test.js` updated; new `tests/unit/weekNoteLongPress.test.js`
  (9 tests). Report: `progress/impl_week-note-longpress.md`.
- Device check AC-10 still pending: hold with a task selected opens the note and leaves
  the block unchanged; the next tap paints.

## Next round (planned)

- 18 `menu-order` — reorder `AppMenu.ITEMS` only to Plan & Balance, To-Do's Chart,
  Vision Board, Records, Settings; labels and section ids unchanged. Spec to be written
  first (small, ~5 ACs).

## Open question carried to the owner (feature 17)

Request (2) cannot be implemented without the owner's decisions:
1. Which languages must the app ship with (a fixed, translated list)?
2. Is the proposed fixed AI answer template approved, and on which surfaces (Balance
   coach, Guiding bounce, note polish)?

The note-polish surface has its own constraints, so the template must be specified per
surface before any prompt changes. Do not guess the language list or the template.
