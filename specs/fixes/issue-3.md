# issue-3 — Hourly tasks missing in past weeks

**Status:** draft   **Feature:** fix for GitHub issue #3   **Supersedes:** the fix narrative in `specs/features/007-week-integrity-fix.md`
**Depends on:** feature 7 (retire-not-delete). This spec assumes the feature-7 code is present.

## Purpose

An export of the owner's real store (`version: 5`, weeks `2026-08-24` … `2026-10-12`) shows
past weeks short of cells — `2026-09-07` holds 319 of 336, `2026-09-14` holds 333 of 336 —
while every key is a Monday and no stored cell points at a task id that is absent from
`tasks`. The old `deleteTask`-sweeps-every-week path that feature 7 removed explains the
cells already gone (the seed ids `t2`, `t4`, `t6` are no longer in the task list), but one
writer of `weeks` can still destroy history outside the week on screen: **import replaces
the whole `weeks` object with the file's**. Restoring any backup taken before some weeks
were painted therefore permanently deletes those newer weeks. This spec pins the invariant
"only an edit of the one week on screen may remove that week's cells", audits every writer
of `weeks`, fixes the one that is still unsafe, and adds the regression tests that make the
guarantee explicit. A previous attempt proposed a *week-key lookup module*; the new evidence
(every key is already a correct Monday) rules that out, and it is **not** to be added.

## Audit — every writer of the `weeks` key

| Path | Scope | Verdict |
|---|---|---|
| `WeekTab.applyBrush` (paint / eraser) | the displayed week only | **safe** — scoped to `weekKey` |
| `WeekTab` "clear this week" | the displayed week only | **safe** for cells (it does replace the whole week object; see Out of scope) |
| `TasksTab` delete task / delete category | retired, never writes `weeks` | **safe** — feature 7; guarded by an existing source-read test |
| `DataTab` import | **every week** | **unsafe** — replaces `weeks` wholesale |
| load path (`useStore`, `normalizeModel`, `backfillOpenWeeks`) | none write `weeks` | **safe** — guarded by an existing source-read test |
| prune / retention / cleanup | does not exist | **n/a** |

## Data touched

`weeks` only, and only on import. No stored shape changes, so the export stays `version: 5`
and **no migration is added**. `tasks` / `categories` / `questions` / `reflections` / `vision`
keep their present import behaviour.

## Contract

```js
// src/lib/seed.js — pure, idempotent, mutates nothing.
// Union of two week maps. For a key present in both, the imported week wins (a restore
// is the user's chosen truth); every key only the store has is kept.
mergeImportedWeeks(storedWeeks, importedWeeks) -> { [isoMonday]: { cells } }
```

- Absent or non-object inputs are treated as `{}`.
- `DataTab` import calls it as `mergeImportedWeeks(weeks, pendingImport.weeks)` before
  `setWeeksP`, so the setter's value is the merged map.

## UI states

- **Success:** the import confirm names the file's week count and states that weeks not in
  the file are kept.
- **Empty file weeks (`{}`):** importing changes no stored week.
- **AI disabled / enabled:** no difference; this touches no AI surface.

## Acceptance criteria

1. AC-1: `mergeImportedWeeks(stored, imported)` returns a new object containing every key
   of `stored` and every key of `imported`; for a key in both, the value is the imported
   one; neither input object nor any nested week object is mutated.
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
7. AC-7: The import confirm copy states that weeks the file does not contain are kept.
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

## Verification

- AC-1 … AC-5: Vitest, `tests/unit/seed.test.js`, against `mergeImportedWeeks`.
- AC-6: Vitest source-read in `tests/unit/tasks.test.js` (the harness pattern already used
  for the `weeks`-writer guarantees).
- AC-7: Vitest source-read of the confirm string.
- AC-8: Vitest, `tests/unit/tasks.test.js`, using `retireTask` + `taskIndex` + `resolveCell`.
- AC-9, AC-10, AC-11, AC-12: Vitest source-read, extending the existing "structural
  guarantees" block.
- The rendered import confirm and the on-device import itself are **device checks**; a
  source-read proves the wiring, not the pixels.

## Out of scope

- **A week-key lookup module.** Explicitly excluded; the evidence shows keys are correct.
- **Recovering cells already removed by the pre-feature-7 build.** They are gone from
  `weeks`; there is no source from which to rebuild them. This fix only stops new loss.
- **Changing how import handles `tasks` / `categories` / `questions` / `reflections` /
  `vision`.** Only `weeks` is merge-protected, because only `weeks` is cell-level and
  unrecoverable.
- **"clear this week" writing `{ cells: {} }` instead of `{ ...wk, cells: {} }`.** It is
  scoped to the week on screen, so it removes no cell outside it; it is recorded against
  feature 8 (`week-approval`), which adds a sibling field and must fix it.
- **Any change under `android/`.**

## Open questions

None. The new evidence settles the two prior hypotheses (week-key lookup, orphaned cells)
and the remaining invariant is already established in `specs/domain-model.md` § Task
("Deletion never writes the `weeks` key").
