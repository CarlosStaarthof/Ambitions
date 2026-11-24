# Current session

**Date:** 2026-11-24
**In flight:** feature 11 `reminder-wall` — implemented this round, awaiting review.
Specs 011 and 012 are now `approved`; feature 12 is not started.
**Unblocked:** review of 11; feature 12 can start after 11 is reviewed.

## This round — feature 11 implemented (awaiting review)

Built the reminder wall exactly against `specs/features/011-reminder-wall.md` and the
2026-11-18 owner rulings. No feature 12 work.

- New pure module `src/lib/reminderWall.js`: `emptyReminderWall`, `normalizeReminderWall`,
  `activeReminders`, `archivedReminders`, `categoryUsage`, and the category/reminder CRUD
  helpers plus `mergeImportedReminderWall`, with the exact error codes in the contract.
- `useStore` reads and normalizes the eighth key `reminderWall`; `setReminderWallP` is its
  only writer. Seeding still requires all eight reads to succeed and be empty.
- Export is `version: 6` with `reminderWall`; import merges by id and normalizes, so a
  stored wall survives a v4/v5 file that has no wall field.
- New `Reminders` menu section with `Wall`/`Archive` sub-tabs; `ReminderWallTab` has
  create/edit/tick-done post-its coloured by category, category CRUD with `useArmed`,
  filter, archive view, and the specified empty states. No notifications, AI or time-block
  data is touched.
- Tests: new `tests/unit/reminderWall.test.js` (22); updated the pinned export/key
  assertions in `reminders.test.js`, `seed.test.js` and `tasks.test.js` to version 6 and
  eight keys (not weakened). `npm test --silent` → 6 files, 162 tests passed.
- Gate: `bash init.sh` → `[OK] build green, tests green, scope clean`.
- Device-only: the rendered behaviour of AC-11, AC-12, AC-13 and the rendered half of AC-2.

## Earlier round — owner rulings recorded in specs 011 and 012 (stopped for approval)

Applied the owner's 2026-11-18 rulings and the required changes in
`progress/review_mwv3gmgd.md`. Still spec-only: no `src/`, `tests/` or `android/` change.

- Both specs now end with `## Owner rulings, 2026-11-18`. 011 records ruling 1 (error list and
  ACs agree, with the code-to-AC mapping) and notes that rulings 2–4 concern 012 only.
- 012 rewritten for the rulings:
  - Ruling 2: the hold time is `settings.longPressMs`, default 500 ms, 500 ms steps (range is
    open question 4, not guessed). A long-press selects the whole unbroken same-category run
    above and below the pressed block **within that day**; the drag selection is gone. The
    brush/touch-action rule is kept. New pure `categoryRunAt(cells, tasks, index)` replaces
    `blockBoundsAt`/`selectionRange` (AC-2, AC-8, AC-9).
  - Ruling 3: no audio is stored. Removed `audio`, `dataUrl`, `mime`, `durationMs`,
    `MAX_VOICE_MS`, `voice-invalid`, `voice-too-long`, `startVoice`/`stopVoice` and the
    2-minute cap. Added phone speech-to-text (`dictation.js`), pure non-AI
    `cleanDictation` (AC-7), and opt-in AI polish (`notePolish.js`) only with the user's own
    key; the key stays in secure storage and is absent from exports (AC-12, AC-15). Error
    list is now `range-invalid`, `empty-note`, `overlap`, `note-not-found`, each with an AC.
  - Ruling 4: reading notes back in the user's own voice is listed as a future feature under
    Out of scope.
  - Replaced the stale "field list unchanged" wording, removed the 32 kbps open question, and
    updated `feature_list.json`'s 012 title/why to match.
- Both specs stay at 15 acceptance criteria (within 5–15).

Gate: `npm test --silent` → 5 files, 140 tests passed.

**Stopped for owner approval of specs 011 and 012. No implementation.**

## Earlier round — review fixes for specs 011 and 012

Addressed all four required changes in `progress/review_mwv2i4pq.md` (no implementation):

- 011 AC-9 / contract: `markDone` is idempotent — a second call returns the wall unchanged
  with `error: undefined`, never `reminder-archived`; `reminder-archived` now covers edit
  only.
- 011: added `category-missing` to AC-5/AC-6, `reminder-not-found` to AC-8/AC-9; AC-5 states
  a case-only rename of a category's own name is allowed (duplicate check excludes itself).
- 012 AC-5/AC-6: added a failing `voice-invalid` case (audio without `mime` or a `data:` URL);
  Verification now splits AC-8 into the pure `validateNote` half (Vitest) and the recorder
  auto-stop half (device).
- 012 AC-9 + UI states: long-press notes only when no brush/eraser is selected (paint still
  starts at touch-down with a brush), and the grid sets `touch-action: none` so a note drag
  never scrolls the `overflow-auto` container. Added as open question 5 (chosen default).
- Also deleted the stray 011 A1 self-reference flagged as observation 2.

Gate: `npm test --silent` → 5 files, 140 tests passed.

## Earlier round — specs 011 and 012

Wrote two specs, no implementation:

- `specs/features/011-reminder-wall.md` — a new top-level Reminders section: a post-it wall,
  user-owned reminder categories separate from time-block categories, every reminder in one
  category, create/edit/tick-done, and a read-only archive. New `reminderWall` localForage
  key; export becomes `version: 6` and carries the wall. No notification scheduling, no
  undo/edit of archived reminders, no per-reminder colour.
- `specs/features/012-block-notes.md` — comments on one block or several adjacent blocks on
  the Plan & Balance Week grid. Notes are stored inside `weeks[weekKey].notes`, anchored to
  a half-hour time range, not a task id. Text, a compressed voice clip (Android AAC 32 kbps,
  web Opus, 2-minute cap), or both. Import/export merge keeps both stored and incoming notes;
  `clear this week` keeps notes. No new localForage key.

Both feature_list entries were added as `spec_ready` with the acceptance arrays left to be
filled after approval. Each spec ends with the open questions the owner must settle before
implementation begins.

## Previous round — issue-3

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
