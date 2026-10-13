# Implementation — issue-3 (hourly tasks missing in past weeks)

**Spec:** `specs/fixes/issue-3.md`
**Status:** complete — gate green (`bash init.sh` → `[OK]`), 135 tests pass
**Supersedes:** the fix narrative in `specs/features/007-week-integrity-fix.md`

## Audit result

Every writer of the `weeks` key, and whether it can remove cells outside the week on
screen:

| Writer | Scope | Verdict |
|---|---|---|
| `WeekTab.applyBrush` (paint / eraser) | the displayed week | safe — scoped to `weekKey` |
| `WeekTab` "clear this week" | the displayed week | safe for cells |
| `TasksTab` delete task / delete category | `tasks` only | safe — feature 7 retires, never writes `weeks` |
| `DataTab` import | every week | **fixed here — used to replace `weeks` wholesale** |
| load (`useStore`, `normalizeModel`, `backfillOpenWeeks`) | none write `weeks` | safe |
| prune / retention | does not exist | n/a |

The pre-feature-7 `deleteTask` sweep (which physically removed a task's cells from every
week) explains the cells already missing in the owner's export; feature 7 already removed
that code. The one remaining writer that reaches history is import: restoring any backup
taken before some weeks were painted permanently deleted those newer weeks. That is the
path fixed here.

## Changes

- `src/lib/seed.js` — added pure `mergeImportedWeeks(storedWeeks, importedWeeks)`.
  Returns a new map containing every stored week; the imported value wins for a week the
  file contains; a week the file simply omits is kept. Handles absent/non-object inputs as
  `{}`. Mutates nothing. No stored-shape change, so export stays `version: 5` and no
  migration is added.
- `src/components/DataTab.jsx` — import now persists
  `setWeeksP(mergeImportedWeeks(weeks, pendingImport.weeks))` instead of
  `setWeeksP(pendingImport.weeks)`; the confirm copy states that weeks the file does not
  contain are kept. No other key's import behaviour changed.
- `specs/fixes/issue-3.md` — new fix spec (12 ACs), replacing the old narrative.

## Tests (written failing first, then made green)

- `tests/unit/seed.test.js` — 5 tests for `mergeImportedWeeks` (AC-1 … AC-5). Red before
  the helper existed (`mergeImportedWeeks is not a function`).
- `tests/unit/tasks.test.js` — new describe "retirement cannot touch history":
  `retireTask`/`retireCategory` leave a supplied `weeks` map deep-equal, and a retired
  task's cell still resolves with its own name and colour (AC-8). Plus a source-read test
  that `DataTab` merges rather than replaces and adds no week-key lookup module
  (AC-6, AC-7, AC-11, AC-12).

No test was deleted, skipped or weakened. The existing `weeks`-writer and Tasks-tab
barriers (feature 7's AC-13 / AC-36) still pass unmodified and now sit next to the import
assertion.

## Files touched

- `src/lib/seed.js`
- `src/components/DataTab.jsx`
- `tests/unit/seed.test.js`
- `tests/unit/tasks.test.js`
- `specs/fixes/issue-3.md` (new)

Nothing under `android/`. No new localForage key. The localForage instance name and `appId`
are untouched.

## Needs checking on the device

- The import confirm's new copy and the merge itself are wired in source but not rendered
  by any unit test; confirm on a device that importing an old export keeps newer weeks.
- The already-lost cells in the owner's export (`2026-09-07`, `2026-09-14`) are **not
  recovered** — they were physically removed from `weeks` by the pre-feature-7 build and
  there is no source from which to rebuild them. This fix stops new loss only.

## Still open / not done here

- `WeekTab`'s "clear this week" still writes `{ cells: {} }` rather than `{ ...wk, cells: {} }`.
  It only edits the week on screen, so it removes no cell outside it; recorded against
  feature 8 (`week-approval`), which adds a sibling field.
- Tasks / categories / reflections / vision still replace wholesale on import; only `weeks`
  is merge-protected, because only `weeks` holds cells that cannot be retyped.
