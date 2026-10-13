# Current session

**Date:** 2026-10-13
**In flight:** issue-3 fix (not a numbered feature — no `feature_list.json` entry)
**Unblocked:** feature 8 `week-approval` (its dependencies 3 and 7 are both done)

## This round — issue-3

Resolving GitHub issue #3 "hourly tasks missing in past weeks" against the new evidence
from the owner's export (all week keys are valid Mondays; no cell points at a missing task
id; `t2`, `t4`, `t6` gone from `tasks`). The prior week-key-lookup theory is disproved and
was **not** implemented.

- Spec: `specs/fixes/issue-3.md` (12 ACs). Replaces the fix narrative in
  `specs/features/007-week-integrity-fix.md`.
- Report: `progress/impl_issue-3.md`.
- Audit: feature 7 already made task/category deletion unable to touch `weeks`. The one
  remaining writer that reaches history was **import**, which replaced the whole `weeks`
  object with the file's.
- Fix: pure `mergeImportedWeeks` in `src/lib/seed.js`; `DataTab` import now merges, so a
  stored week the file omits survives. Export stays `version: 5`; no migration.
- Tests: 8 added (5 for the merge, 1 retirement-vs-history, 1 import source-read). Gate:
  `bash init.sh` → `[OK]`, 135 tests.

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
- Import still replaces `tasks` / `categories` / `questions` / `reflections` / `vision`
  wholesale; only `weeks` is merge-protected (issue-3).
- Release note item: a user who deletes every guiding question now keeps an empty list
  rather than silently getting the seed seven back.
