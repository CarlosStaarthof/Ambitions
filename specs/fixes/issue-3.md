# issue-3 — Hourly tasks missing in past weeks

**Status:** draft   **Feature:** fix for GitHub issue #3   **Supersedes:** the fix narrative in `specs/features/007-week-integrity-fix.md`
**Depends on:** feature 7 (retire-not-delete). This spec assumes the feature-7 code is present.

## Purpose

An export of the owner's real store (`version: 5`, weeks `2026-08-24` … `2026-10-12`) shows
past weeks short of cells — `2026-09-07` holds 319 of 336, `2026-09-14` holds 333 of 336 —
while every key is a Monday and no stored cell points at a task id that is absent from
`tasks`. The old `deleteTask`-sweeps-every-week path that feature 7 removed explains the
cells already gone (the seed ids `t2`, `t4`, `t6` are no longer in the task list), but **import
still reaches history in two ways**:

1. it replaced the whole `weeks` key with the file's, so restoring any backup taken before some
   weeks were painted permanently deleted those newer weeks; and
2. it replaced `tasks` and `categories` wholesale, so a week that the merge *kept* could still
   lose the task its cells name — the cell survived but rendered `Unknown task`.

This spec pins the invariant **"an import may add or update, but it never erases a cell or the
task that a kept cell names"**, audits every writer of `weeks`, fixes the paths that are still
unsafe, and adds the regression tests that make the guarantee explicit. A previous attempt
proposed a *week-key lookup module*; the new evidence (every key is already a correct Monday)
rules that out, and it is **not** to be added.

## Audit — every writer of the `weeks` key

| Path | Scope | Verdict |
|---|---|---|
| `WeekTab.applyBrush` (paint / eraser) | the displayed week only | **safe** — scoped to `weekKey` |
| `WeekTab` "clear this week" | the displayed week only | **safe** for cells (it does replace the whole week object; see Out of scope) |
| `TasksTab` delete task / delete category | retired, never writes `weeks` | **safe** — feature 7; guarded by an existing source-read test |
| `DataTab` import | every week, but merged | **fixed here** — weeks merge cell-by-cell, and tasks / categories the file omits are kept |
| load path (`useStore`, `normalizeModel`, `backfillOpenWeeks`) | none write `weeks` | **safe** — guarded by an existing source-read test |
| prune / retention / cleanup | does not exist | **n/a** |

## Data touched

`weeks`, `tasks` and `categories`, and only on import. No stored shape changes, so the export
stays `version: 5` and **no migration is added**. `questions` / `reflections` / `vision` keep
their present import behaviour.

## Contract

```js
// src/lib/seed.js — pure, idempotent, mutates nothing.

// Union of two week maps that does not lose a single cell. For a key only one side has, that
// week is adopted. For a key both sides have, the cells are merged: every stored cell survives,
// and the imported cell wins for a slot both fill (the restore still changes identities).
mergeImportedWeeks(storedWeeks, importedWeeks) -> { [isoMonday]: { cells } }

// The file is the truth for every id it carries. A stored task the file omits is KEPT, because
// a stored week may still hold its cells — dropping it would turn them into "Unknown task".
// Imported order first, then the kept stored tasks. File wins a shared id.
mergeImportedTasks(storedTasks, importedTasks) -> Task[]

// Same contract, for the categories a kept task needs.
mergeImportedCategories(storedCategories, importedCategories) -> Category[]
```

- Absent or non-array/non-object inputs are treated as `[]` / `{}`.
- `DataTab` import computes `normalizeModel(mergeImportedTasks(tasks, file.tasks),
  mergeImportedCategories(categories, file.categories))`, persists both with the store's cells
  merged, and never persists `file.tasks` / `file.categories` / `file.weeks` directly.

## UI states

- **Success:** the import confirm names the counts and states that weeks, tasks and categories
  the file does not contain are kept.
- **Empty file weeks (`{}`):** importing changes no stored week.
- **AI disabled / enabled:** no difference; this touches no AI surface.

## Acceptance criteria

1. AC-1: `mergeImportedWeeks(stored, imported)` returns a new object containing every key of
   `stored` and every key of `imported`; for a key in both, the result week contains **every
   cell of the stored week and every cell of the imported week**, with the imported cell winning
   a slot both fill; neither input object nor any nested week object is mutated.
2. AC-2: `mergeImportedWeeks({ "2026-08-24": A }, {})` deep-equals `{ "2026-08-24": A }` —
   importing a file with no weeks removes nothing.
3. AC-3: `mergeImportedWeeks({}, imported)` deep-equals `imported`.
4. AC-4: `mergeImportedWeeks` is idempotent — merging its own result with the same import
   returns a deep-equal object, and `mergeImportedWeeks(stored, stored)` deep-equals
   `stored`.
5. AC-5: `mergeImportedWeeks(undefined, undefined)` returns `{}` and throws nothing.
6. AC-6: `DataTab.jsx` obtains the weeks it persists on import from
   `mergeImportedWeeks(weeks, pendingImport.weeks)`; it never calls
   `setWeeksP(pendingImport.weeks)`.
7. AC-7: The import confirm copy states that weeks, tasks and categories the file does not
   contain are kept.
8. AC-8: A retirement is provably unable to touch history — given a `weeks` map and a
   `tasks` array, `retireTask(tasks, id, at)` leaves the map deep-equal, and
   `resolveCell(cellId, taskIndex(nextTasks))` for every cell the retired task held still
   returns `{ kind: "task", name, color }` with the task's own name and colour.
9. AC-9: `TasksTab.jsx` still has no reference to `weeks`, `setWeeksP` or
   `saveKey("weeks"`, and `App.jsx` still passes no `setWeeksP` to it (feature-7 barrier,
   re-asserted here).
10. AC-10: `setWeeksP` remains the only writer of the `weeks` key — `saveKey("weeks"` still
    appears exactly once in `useStore.js`, inside `setWeeksP`.
11. AC-11: No week-key lookup module is added: no new module resolves a week key from a
    date, and `WeekTab` / `BalanceTab` still derive it as `isoDate(weekStart)`.
12. AC-12: The export envelope is unchanged — still `version: 5` with the same field list.
13. AC-13: `mergeImportedTasks(stored, imported)` returns the imported tasks first, then every
    stored task whose id the file omits; for a shared id the imported task wins; inputs are not
    mutated; absent / non-array inputs yield `[]`; a stored task no kept week needs is still
    kept (import is non-destructive for the task list).
14. AC-14: `mergeImportedCategories` follows the same rule as AC-13 for categories.
15. AC-15: `DataTab.jsx` persists `normalizeModel(mergeImportedTasks(tasks, pendingImport.tasks),
    mergeImportedCategories(categories, pendingImport.categories))` and never calls
    `setTasksP(pendingImport.tasks)` / `setCategoriesP(pendingImport.categories)` directly; the
    confirm copy matches AC-7.
16. AC-16: End to end through the pure merge, a stored week holding cells of a task the imported
    file omits survives the import with the task retained, so `resolveCell` for every one of
    those cells still returns the task's own name and colour (the issue's parenthetical:
    a task's past cells stay and show the name the task had).

## Verification

- AC-1 … AC-5: Vitest, `tests/unit/seed.test.js`, against `mergeImportedWeeks`.
- AC-13, AC-14, AC-16: Vitest, `tests/unit/seed.test.js`, against the merge helpers plus
  `normalizeModel` + `taskIndex` + `resolveCell`.
- AC-6, AC-7, AC-15: Vitest source-read in `tests/unit/tasks.test.js` (the harness pattern
  already used for the `weeks`-writer guarantees).
- AC-8: Vitest, `tests/unit/tasks.test.js`, using `retireTask` + `taskIndex` + `resolveCell`.
- AC-9, AC-10, AC-11, AC-12: Vitest source-read, extending the existing "structural
  guarantees" block.
- The rendered import confirm and the on-device import itself are **device checks**; a
  source-read proves the wiring, not the pixels.

## Out of scope

- **A week-key lookup module.** Explicitly excluded; the evidence shows keys are correct.
- **Recovering cells already removed by the pre-feature-7 build.** They are gone from
  `weeks`; there is no source from which to rebuild them. This fix only stops new loss.
- **Merging `questions` / `reflections` / `vision` on import.** They stay replace-on-import;
  only the task/category/week keys are non-destructive, because only they name or hold cells.
- **"clear this week" writing `{ cells: {} }` instead of `{ ...wk, cells: {} }`.** It is
  scoped to the week on screen, so it removes no cell outside it; it is recorded against
  feature 8 (`week-approval`), which adds a sibling field and must fix it.
- **Any change under `android/`.**

## Open questions

None. The new evidence settles the two prior hypotheses (week-key lookup, orphaned cells)
and the remaining invariant is already established in `specs/domain-model.md` § Task
("Deletion never writes the `weeks` key").
