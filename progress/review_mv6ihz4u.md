# Review — issue-3 (hourly tasks missing in past weeks), branch hermes/mv6ihz4u

**Verdict:** APPROVED

**Spec:** `specs/fixes/issue-3.md` (16 ACs). **Diff reviewed:** `841a114..HEAD` (two commits, round 1 and round 2).
Files changed: `src/lib/seed.js`, `src/components/DataTab.jsx`, `tests/unit/seed.test.js`, `tests/unit/tasks.test.js`,
`specs/fixes/issue-3.md`, `progress/current.md`, `progress/impl_issue-3.md`. Nothing under `android/`, no `feature_list.json` change,
no new module (no week-key lookup).

## Gate

`bash init.sh` -> build green, vitest 5 files / 140 tests pass, `[OK] build green, tests green, scope clean`. Nothing skipped.

**Red-first check (done by me):** I checked out the pre-fix source (`841a114`) into a scratch dir and ran the branch's
tests against it. 11 tests failed: all 10 new `seed.test.js` merge tests (`mergeImportedWeeks`, `mergeImportedTasks`,
`mergeImportedCategories` do not exist) and the `DataTab` source-read in `tasks.test.js`. So the tests do reproduce the
loss on the old code and go green only with the fix.

## Audit verification (every writer of `weeks`)

I grepped `src/` for `setWeeksP` / `saveKey("weeks"` / `weeks[`. Writers:
- `useStore.js:109` `setWeeksP`, the only `saveKey("weeks"`.
- `WeekTab.jsx:75` paint / eraser, scoped to `[weekKey]`. Safe.
- `WeekTab.jsx:190` clear this week, scoped to `[weekKey]`. Safe for cells in other weeks.
- `DataTab.jsx:52` import. This was the only path reaching other weeks, and it is fixed here.
- `TasksTab` has no reference to `weeks`. Task / category delete only retires (`tasks.js:44,50`).
- `clearTaskIdsFromWeeks` no longer exists in `src` (it is only a negative assertion in a test). It was the pre-feature-7 sweep that
  explains the owner's already-missing cells (t2/t4/t6 gone).
- `normalizeModel` / `backfillOpenWeeks` do not write `weeks`. No prune or cleanup code exists.

## Acceptance criteria

| AC | Result | Evidence |
|---|---|---|
| AC-1 union, cell-level, imported wins, no mutation | PASS | `seed.js:150-163`; `seed.test.js` "keeps every stored week…" and "merges a shared week cell by cell…". Both fail on the old source. |
| AC-2 empty import removes nothing | PASS | `seed.test.js` "removes nothing when the imported file has no weeks" |
| AC-3 empty store adopts import | PASS | `seed.test.js` "adopts every week of the file when the store is empty" |
| AC-4 idempotent | PASS | `seed.test.js` "is idempotent" |
| AC-5 absent input -> `{}` | PASS | `seed.test.js` "survives being handed nothing at all"; `asMap` guard at `seed.js:151` |
| AC-6 DataTab uses `mergeImportedWeeks(weeks, pendingImport.weeks)`, never `setWeeksP(pendingImport.weeks)` | PASS | `DataTab.jsx:52`; `tasks.test.js` source-read (`mergeImportedWeeks\(weeks, pendingImport\.weeks\)` and the negative match) |
| AC-7 confirm copy | PASS | `DataTab.jsx:50`; source-read regex in `tasks.test.js` |
| AC-8 retirement leaves weeks deep-equal; cell still resolves with task's name and colour | PASS | `tasks.test.js` "retirement cannot touch history" (two tests) against `retireTask` / `retireCategory` / `resolveCell`. See observation 2. |
| AC-9 TasksTab has no weeks reference; App passes no `setWeeksP` to it | PASS | existing feature-7 source-read tests ("leaves the Tasks tab no route to the weeks key at all", ~`tasks.test.js:248-258`), still green and unmodified |
| AC-10 `saveKey("weeks"` exactly once, inside `setWeeksP` | PASS | `tasks.test.js` "writes the weeks key from setWeeksP and nowhere else"; `useStore.js:109` |
| AC-11 no week-key lookup module; `weekKey = isoDate(weekStart)` | PASS | `tasks.test.js` source-read (forbidden names regex, `WeekTab` `isoDate(weekStart)`); no new files in `src/` |
| AC-12 export envelope unchanged, `version: 5`, same fields | PASS | `DataTab.jsx:19` unchanged; source-read asserts `version: 5`; existing envelope test (~`tasks.test.js:418`) green |
| AC-13 `mergeImportedTasks` | PASS | `seed.js:169`, `seed.js:182-186`; `seed.test.js` "keeps stored tasks the file omits…" and "treats absent or non-array…" |
| AC-14 `mergeImportedCategories` | PASS | `seed.js:174`; `seed.test.js` "merges categories the same non-destructive way" |
| AC-15 DataTab persists `normalizeModel(mergeImportedTasks…, mergeImportedCategories…)`, no direct `setTasksP(pendingImport.tasks)` | PASS | `DataTab.jsx:52`; source-read regexes in `tasks.test.js` |
| AC-16 end to end: omitted task retained, past cell keeps its name and colour | PASS | `seed.test.js` "keeps a past cell's task name after an import that omits that task" asserts `{kind:"task", name:"Evening run", color:"#22c55e"}` |

## CHECKPOINTS.md

- [x] C1.1 gate prints `[OK]`.
- [x] C1.2 every AC maps to a test (table above).
- [x] C1.3 no test deleted, skipped or weakened. The test diff is additive; I verified the old assertions are intact.
- [x] C1.4 new pure logic in `src/lib/seed.js` has unit tests, with success and edge/failure inputs.
- [x] C2.1 `init.sh` reports no feature in progress. The fix is tracked by a spec, not a feature entry.
- [x] C2.2 touched files are listed in `impl_issue-3.md`. Minor: it omits `progress/current.md`. See observation 4.
- [x] C2.3 / C2.4 scope: only import and the merge helpers changed. The "clear this week" shape was recorded, not changed.
- [x] C3.1 / C3.2 DataTab uses the `P` setters and `useStore` props only. C3.3 helpers are pure (no React, DOM or storage).
- [x] C3.4 n/a. C4.1 JS only. C4.2-C4.5 n/a (no new UI, icons or ids; the destructive action is not new).
- [x] C5.1 / C5.2 stored shape unchanged, so no `normalizeModel` extension, no version bump and no migration is needed.
- [x] C5.3 localForage name, `appId` and the Ambition id are untouched. C5.4 no secret path touched.
- [x] C6.1-C6.4 untouched. C7.1 web only (no `android/` change).

## Required changes

None.

## Observations (non-blocking)

1. **Already-lost cells are not recoverable.** `2026-09-07` (17 cells) and `2026-09-14` (3 cells) are gone. The fix and the spec say
   so honestly. The branch makes sure no path (delete, edit, import) can lose more. The cause of the existing loss is inferred
   from the removed pre-feature-7 sweep, not reproduced on this branch. The deletion path cannot be failed-tested at HEAD
   because it no longer exists; the feature-7 negative assertions guard it. A device check on the owner's phone is still advisable.
2. The AC-8 "deep-equal" test is close to tautological, because `retireTask` never receives `weeks`. The real protection is the AC-9
   and AC-10 source-read guards. The test is still reasonable as a documented invariant.
3. `mergeImportedWeeks` (`seed.js:157-161`): if the file holds a non-object week (e.g. `null`) for a key whose stored week has no
   `cells`, the null replaces it. That stored week has no cells, so nothing is lost, but a guard would be tidier.
4. The spec has 16 ACs, above the 5-15 guideline. `impl_issue-3.md` still says "12 ACs" in its Changes list, which is stale
   (round 2 brought it to 16). It also omits `progress/current.md` from "Files touched".
5. Import still replaces `questions`, `reflections` and `vision`. This is documented out of scope and holds no cells.
6. Import lets the file's cell win a shared slot, so a restore can overwrite a cell with a different task. It never empties a slot.
   This is per spec.
