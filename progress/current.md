# Current session

**Date:** 2026-11-24
**In flight:** feature 12 `block-notes` — round 3 (hold-time setting built; feature complete
for review). Feature 11 `reminder-wall` is `in_review`; 12 is the single `in_progress` feature
the gate allows.

**Open question 4 is answered by the owner (2026-11-24):** `settings.longPressMs` defaults to
500 ms, moves in 500 ms steps, and maxes out at 3000 ms. Minimum is 500 ms. The Settings row
and the shared clamp are built against that range.

## Round 4 — feature 12 review fixes (this round)

Addressed both required changes in `progress/review_mwv4y4y9.md`:

- `src/lib/notes.js` `cleanDictation` now repeats the filler-removal, "you know" removal,
  repeat-collapse and whitespace steps until the output stops changing, so a second pass is
  a true no-op. The result still satisfies the AC-7 examples. A brute-force over every 1–5
  token string drawn from {um, uh, you, know, I, think, the, UM, Know} now finds zero
  non-idempotent inputs (previously 112).
- `tests/unit/notes.test.js`: new idempotence cases for `"you you know know"` and
  `"um um you you know know"`.
- New `tests/unit/notePolish.test.js` (6 tests): mocks only the `callAI` transport and covers
  `polish-disabled` when AI is off, the provider is `none`, the key is missing/empty, or the
  text is blank; a success path asserting `{ text }`, the key only in the call context and
  absent from the return; and `polish-failed` when the transport rejects or answers empty.
- Gate: `npm test --silent` → 8 files, 215 tests passed. `bash init.sh` →
  `[OK] build green, tests green, scope clean`.

**Remaining for feature 12:** device-only checks (AC-8 to AC-11, marker half of AC-14,
dictation/polish UI half of AC-15). No source work remains.

## Round 3 — feature 12 hold-time setting

- `src/lib/seed.js`: new `LONG_PRESS_MIN = 500`, `LONG_PRESS_MAX = 3000`,
  `LONG_PRESS_STEP = 500` and pure `clampLongPressMs(value)` (non-finite → 500, snaps to the
  nearest step, clamps to 500…3000). `mergeSettings` runs it when defaults carry
  `longPressMs`, so a malformed older value is repaired in memory without a load-time write.
- `src/components/WeekTab.jsx`: the gesture now uses `clampLongPressMs(settings.longPressMs)`,
  the same helper as the Settings row, instead of trusting the stored number.
- `src/components/SettingsTab.jsx`: new "Week note hold time" card with − / + buttons in
  500 ms steps, disabled at 0.5 s and 3.0 s, showing the seconds value. No new localForage key.
- Tests: 3 added to `tests/unit/seed.test.js` (defaults, clamping both ends, idempotent merge)
  and 2 source checks to `tests/unit/notes.test.js` (settings row wiring, grid uses the same
  clamp). `npm test --silent` → 7 files, 208 tests passed. `bash init.sh` → `[OK]`.

**Remaining for feature 12:** device-only checks (AC-8 to AC-11, marker half of AC-14,
dictation/polish UI half of AC-15). No source work remains.

## Round 2 — feature 12 Week tab notes UI

- `src/components/WeekTab.jsx` now owns the note gesture and surfaces:
  - long-press on a filled cell with **no brush selected** waits `settings.longPressMs`
    (default 500), resolves the whole same-category run through `categoryRunAt`, refuses an
    overlapping range with one line, opens the viewer through `noteAt`, or opens an empty
    editor for a fresh run.
  - cell pointer handlers cancel on up/leave/cancel; the inner grid sets `touch-action: none`
    and the gesture calls `preventDefault`, so the `overflow-auto` container cannot scroll
    during a hold. With a brush or eraser selected the handlers return immediately and paint
    is unchanged.
  - editor: trimmed text required to Save, `addNote`/`updateNote` with `new Date().toISOString()`,
    explicit armed Delete via the existing `useArmed`, error codes mapped to one line.
  - viewer: text only, no audio/play control, Edit and armed Delete.
  - marker dot on the first cell of each note range, including a cell that is now empty.
  - dictation button calls `dictationSupported`/`startDictation`, passes the transcript
    through `cleanDictation`, disables on denial/unsupported and shows one line; no audio is
    stored or exported.
  - Polish button renders only when `aiEnabled` (AI on, provider not `none`, key present),
    calls `polishText` explicitly, leaves text unchanged on failure, and never saves on its
    own — the user reviews and taps Save.
  - `clear this week` keeps its `{ ...wk, cells: {} }` spread and now says notes are kept.
- `src/App.jsx` passes `settings`, `ai` and `aiEnabled` into `WeekTab` (no new store key).
- `tests/unit/notes.test.js`: 5 added source tests for the UI wiring (run selection, existing
  note, hold time + brush guard, `touch-action`/marker, cleaned dictation/polish gating, and
  the App props). `npm test --silent` → 7 files, 203 tests passed. `bash init.sh` → `[OK]`.

**Remaining for feature 12 after round 2:** the SettingsTab hold-time row (blocked on open
question 4, answered and built in round 3) and the device-only checks for AC-8 to AC-11, the
marker half of AC-14, and the dictation/polish UI half of AC-15.

## Round 1 — feature 12 core, data and dictation

- New pure `src/lib/notes.js`: `notesOf`, `categoryRunAt`, `noteAt`, `canPlaceNote`,
  `validateNote`, `addNote`, `updateNote`, `removeNote`, `cleanDictation`,
  `mergeImportedNotes`. Same 336-cell/48-slot grid, half-open `[start, end)` ranges, day-bounded
  runs, no `taskId`/`audio`/key field. Error codes: `range-invalid`, `empty-note`, `overlap`,
  `note-not-found`.
- `mergeImportedWeeks` now merges `notes` by id with the same rule as tasks/categories; old files
  with no notes import with none and no new field.
- `DEFAULT_SETTINGS.longPressMs = 500`; `mergeSettings` gives it to existing installs.
- New `src/lib/dictation.js` (native `Dictation` plugin or web SpeechRecognition, text only) and
  `src/lib/notePolish.js` (explicit, opt-in, `polish-disabled` on the default path).
- Android: `RECORD_AUDIO` added as the only new permission; new `DictationPlugin.java` using the
  platform `SpeechRecognizer` with a first-use permission request; registered before
  `super.onCreate()`.
- `clear this week` now writes `{ ...wk, cells: {} }`, so notes survive.
- Tests: new `tests/unit/notes.test.js` (36 tests) covering AC-2–7, AC-13, the export/envelope
  source checks, the clear-week spread and the manifest/MainActivity half of AC-15.
  `npm test --silent` → 7 files, 198 tests passed. `bash init.sh` → `[OK]`.

**Remaining for feature 12:** WeekTab long-press gesture/edit/view/marker (AC-8, AC-9, AC-10,
AC-11, marker half of AC-14), SettingsTab hold-time row (blocked on the range answer), the
dictation/polish UI, and the device-only checks.

## Earlier round — feature 11 implemented (awaiting review)

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
