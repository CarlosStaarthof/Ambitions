# Current session

**Date:** 2026-10-13
**In flight:** issue-3 fix (not a numbered feature — no `feature_list.json` entry)
**Unblocked:** feature 8 `week-approval` (its dependencies 3 and 7 are both done)

## This round — issue-3

Resolving GitHub issue #3 "hourly tasks missing in past weeks" against the new evidence
from the owner's export (all week keys are valid Mondays; no cell points at a missing task
id; `t2`, `t4`, `t6` gone from `tasks`). The prior week-key-lookup theory is disproved and
was **not** implemented.

**Round 1** (committed `a4a424c`): spec `specs/fixes/issue-3.md`; audit showed the only
remaining `weeks` writer that reached history was **import**; added `mergeImportedWeeks` so a
stored week the file omits survives. Report: `progress/impl_issue-3.md`.

**Round 2** (this round): closed the other two halves of the same hole. Import kept a stored
week but replaced `tasks`/`categories` wholesale, so a kept week could lose the task its
cells named (cell survives, renders `Unknown task`), and a shared week lost any stored cell
the file did not fill.
- `mergeImportedWeeks` is now a **cell-level union**: a shared week keeps every stored cell,
  the file wins a slot both fill, no slot is ever emptied by an import.
- New pure `mergeImportedTasks` / `mergeImportedCategories` in `src/lib/seed.js`: the file
  wins a shared id, a stored task/category the file omits is **kept** (import is
  non-destructive for the task list, matching the retire-never-remove rule).
- `DataTab` import persists `normalizeModel(mergeImportedTasks(...), mergeImportedCategories(...))`
  and `mergeImportedWeeks(...)`; confirm copy now says weeks, tasks and categories the file
  does not contain are kept.
- Tests: 6 added, written red against the pre-change source (verified: 6 failed, then green).
  Gate: `bash init.sh` → `[OK]`, 140 tests.

### Not recoverable

The cells already missing in the export were physically removed by the pre-feature-7
build; they cannot be rebuilt. This fix stops new loss only.

## Waiting on the user (device)

Nothing from features 3 or 7, nor this issue-3 fix, has reached the phone. All need
`npm run cap:sync` + an Android rebuild + reinstall.

- Feature 3: 8 device-only criteria (permission dialog, delivery, channel, post-reboot).
- Feature 7: 14 device-only criteria, plus AC-16's four UI surfaces, AC-17's arming
  behaviour and AC-35's rendered failure screen. **AC-35 needs a temporary debug build in
  which `loadKey` throws for one key.**
- Issue-3: confirm on device that importing an export taken before newer weeks existed
  keeps those newer weeks.
- **Open diagnostic:** once feature 7 is installed, previously-orphaned cells render as
  visible "unknown" blocks and contribute an `Unknown` bar in Balance.

## Known, deliberately deferred

- `src/components/VisionTab.jsx:23` builds its ambition-link dropdown from the raw `tasks`
  array, so a retired ambition task is still offered there. Feature 6 deletes that control.
- `WeekTab`'s "clear this week" replaces the whole week object (`{ cells: {} }`) rather than
  `{ ...wk, cells: {} }`; scoped to the on-screen week, so no cell outside it is removed.
  Feature 8 owns the fix before adding an `approved` field.
- Import still replaces `questions` / `reflections` / `vision` wholesale; the task, category
  and week keys are now merge-protected (issue-3, rounds 1–2).
- Release note item: a user who deletes every guiding question now keeps an empty list
  rather than silently getting the seed seven back.
