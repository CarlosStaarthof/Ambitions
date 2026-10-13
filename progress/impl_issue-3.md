# Implementation — issue-3 (hourly tasks missing in past weeks)

**Spec:** `specs/fixes/issue-3.md`
**Status:** round 2 complete — gate green (`bash init.sh` → `[OK]`), 140 tests pass
**Supersedes:** the fix narrative in `specs/features/007-week-integrity-fix.md`

## Audit result

Every writer of the `weeks` key, and whether it can remove cells outside the week on
screen:

| Writer | Scope | Verdict |
|---|---|---|
| `WeekTab.applyBrush` (paint / eraser) | the displayed week | safe — scoped to `weekKey` |
| `WeekTab` "clear this week" | the displayed week | safe for cells |
| `TasksTab` delete task / delete category | `tasks` only | safe — feature 7 retires, never writes `weeks` |
| `DataTab` import | every week | **fixed here — round 1 merged weeks the file omits; round 2 merges weeks cell-by-cell and keeps omitted tasks/categories** |
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

## Round 2 — the other two halves of the import hole

Round 1 made import keep a stored week the file omits, but left two ways for an import to
erase the record:

1. **A shared week lost every stored cell the file did not fill.** The merge was week-deep:
   for a key in both, the imported week replaced the stored one wholesale.
2. **A kept week could lose the task its cells named.** Import still put
   `pendingImport.tasks` / `pendingImport.categories` straight into the store, so a task the
   file omitted was dropped; a cell that survived (round 1) then rendered `Unknown task`
   instead of the name the task had.

### Changes

- `src/lib/seed.js` — `mergeImportedWeeks` now merges at cell depth: a shared week keeps
  every stored cell and the imported cell wins a slot both fill. Added pure
  `mergeImportedTasks(stored, imported)` and `mergeImportedCategories(stored, imported)` over a
  shared `mergeImportedList`: imported entries first, then every stored entry whose id the file
  omits; the file wins a shared id; nothing is mutated. This makes import non-destructive for
  the task list, matching the domain rule that a task is retired, never removed.
- `src/components/DataTab.jsx` — import persists
  `normalizeModel(mergeImportedTasks(tasks, pendingImport.tasks), mergeImportedCategories(categories, pendingImport.categories))`
  and `mergeImportedWeeks(weeks, pendingImport.weeks)`. Confirm copy: "Weeks, tasks and
  categories the file does not contain are kept."

### Tests (written red first — 6 failed against the pre-change source, then green)

- `tests/unit/seed.test.js` — cell-level union keeps a stored cell the file lacks (AC-1);
  `mergeImportedTasks` keeps omitted tasks / file wins a shared id / handles absent input
  (AC-13); `mergeImportedCategories` (AC-14); end-to-end: a stored week whose task the file
  omits still resolves to that task's own name and colour after the full merge (AC-16).
- `tests/unit/tasks.test.js` — the source-read now asserts `DataTab` calls
  `mergeImportedTasks` / `mergeImportedCategories` and new copy (AC-15), and no longer writes
  `pendingImport.tasks` / `pendingImport.categories` directly.

## Still open / not done here

- `WeekTab`'s "clear this week" still writes `{ cells: {} }` rather than `{ ...wk, cells: {} }`.
  It only edits the week on screen, so it removes no cell outside it; recorded against
  feature 8 (`week-approval`), which adds a sibling field.
- `questions` / `reflections` / `vision` still replace wholesale on import. They hold no
  cells and name no task, so an import cannot orphan a week through them; leaving them as
  replace-on-import keeps the fix to the keys the issue is about.
