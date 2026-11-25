# Current session

**Date:** 2026-11-25
**In flight:** feature 14 `records-todo-chart` — round 2 (chart polish + pure shaping,
gate green). Feature 11 and 13 remain `in_review`; 14 holds the single `in_progress` slot.

## Round 2 — To-Do's Chart visual polish

Owner goal, 2026-11-25: the To-Do's Chart must be a visual, easily digested board, each
item stamped with its original creation date, with a clean 390 px look.

- New pure `chartGroups(wall)` and `chartSummary(wall)` in `src/lib/reminderWall.js`.
  `chartGroups` keeps category order, newest-first inside a group, drops empty groups and
  puts any orphan item in an `Uncategorized` group so nothing is hidden. `chartSummary`
  yields `{ open, done, total, donePercent }` with `0` (never `NaN`) when empty.
- `src/components/TodoChartTab.jsx` rebuilt: summary card with counts + an accessible
  progress bar, category stacks with count chips, tinted post-its with a coloured left
  edge, a `Clock` + `Added <date>` stamp and a taller Done target; friendlier empty state.
  Single column below `sm`, so 390 px is one readable stack. Done view read-only, newest
  first, with category, created and done dates.
- `tests/unit/todoChart.test.js` now 17 tests (helper unit tests + source contracts).
- Gate: `npm test --silent` → 10 files, 250 tests passed; `bash init.sh` → `[OK]`.

**Remaining:** device-only visual check at 390 px and the Done transition; later rounds can
move any further per-tab backend settings into Records. No known source work for feature 14.
