# Current session

**Date:** 2026-11-25
**Goal (owner):** four requests — (1) long-press note must always work on the week
grid; (2) a Settings language choice for the app and for the AI's understanding /
answers; (3) undo a done to-do within 24 hours; (4) main menu order Plan & Balance,
To-Do's Chart, Vision Board, Records, Settings.
**This round:** round 1 of 5 — request (1), the long-press bug.
**In flight:** feature 15 `week-note-longpress` (the single `in_progress` slot).
Feature 14 is closed (`done`, review `progress/review_mww2v497.md`); 11, 12 and 13
remain `in_review`.

## Round 1 — long-press opens a note with a brush selected

- Root cause: feature 12 gated the gesture on `brush == null`, and a brush is never
  cleared when the user switches categories. `WeekTab.jsx` now starts the hold for
  any pointer unless the note dialog is open; the release tap that ends a hold is
  swallowed so it cannot paint; touch/pen never paint on the mouse-compatibility path.
- `SettingsTab.jsx` copy no longer claims the gesture needs no brush.
- Spec 012 amended with the owner ruling of 2026-11-25 (UI states, AC-9, Open
  question 3). New spec `specs/features/015-week-note-longpress.md`.
- Tests: `tests/unit/notes.test.js` updated to the new rule; new
  `tests/unit/weekNoteLongPress.test.js` (9 tests). Report:
  `progress/impl_week-note-longpress.md`.
- Gate: `npm test --silent` → 11 files, 262 tests passed; `bash init.sh` → `[OK]`.

**Remaining for this request:** device check AC-10 (hold with a task selected opens the
note and leaves the block unchanged; the next tap paints).

## Next rounds (planned features, pending)

- 16 `todo-undo-window` — 24-hour undo of a done to-do; reopening then re-doning resets
  the window. Needs a small pure helper plus a Done-tab control.
- 17 `app-language` — **owner questions first:** which languages are supported, and is
  the AI answer-template proposal approved? Do not guess the language list or template.
- 18 `menu-order` — reorder `AppMenu.ITEMS` only; labels and section ids unchanged.

## Open question carried to the owner (feature 17)

The owner asked whether a fixed answer template should be sent to the AI so answers are
partly structured across users. This is a domain/product decision: the spec should state
the exact template and which surfaces use it before any prompt changes.
