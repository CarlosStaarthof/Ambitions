# Review — feature 16 `todo-undo-window`

**Verdict:** APPROVED

## Gate

`bash init.sh` run by the reviewer: build green, `vitest run` 12 files / 277 tests passed
(`todoUndoWindow.test.js` 15 tests), `-> in progress: 16 todo-undo-window`,
last line `[OK] build green, tests green, scope clean`. Nothing was skipped.

## Diff vs. the report

`git status`: modified `feature_list.json`, `progress/current.md`, `src/App.jsx`,
`src/components/TodoChartTab.jsx`, `src/lib/reminderWall.js`; new
`progress/impl_todo-undo-window.md`, `specs/features/016-todo-undo-window.md`,
`tests/unit/todoUndoWindow.test.js`. This matches the report's list exactly (the spec and
feature_list are harness files). No existing test file changed (`git diff HEAD -- tests` is
empty). `feature_list.json` has exactly one `in_progress` (id 16, line 259); feature 15
moved to `in_review` (harness change, allowed).

## Acceptance criteria

| AC | Result | Evidence |
|---|---|---|
| AC-1 | PASS | `src/lib/reminderWall.js:250` `UNDO_WINDOW_MS = 24*60*60*1000`; test `todoUndoWindow.test.js:19-22` asserts `86400000`. |
| AC-2 | PASS | strict `<` at `reminderWall.js:264-265`; tests `:27-33` (1 h, 24h-1ms true; 24h, 24h+1ms false) and `:36-39` (no `doneAt`). |
| AC-3 | PASS | `isObject` + `timeMs` NaN guards `:253-265`; test `:42-61` covers undefined/null/string/number/array/`{}`/bad & blank & null `doneAt`/bad/undefined/null/number `now`, asserts no throw + false; non-mutation `:64-69`. |
| AC-4 | PASS | `timeMs` handles `Date` and non-blank string `:253-257`; test `:72-83` compares both forms inside and at the boundary. |
| AC-5 | PASS | `reminderWall.js:283-284` destructures `doneAt` out, sets `updatedAt: now`; wall cloned via `cloneWall`. Test `:88-117` checks `"doneAt" in item === false`, `updatedAt`, other fields/items/categories equal, input unchanged, and `activeReminders` membership. |
| AC-6 | PASS | `:281` expired -> `"undo-expired"`; tests `:120-136` (boundary, +1 ms, wall deep-equal, still in `archivedReminders`) and `:139-144` (unparseable `doneAt`). |
| AC-7 | PASS | `:277` `reminder-not-found`, `:280` `not-archived`; test `:147-159`, wall deep-equal and input unmutated. |
| AC-8 | PASS | test `:162-189`: markDone -> reopen -> markDone, new `doneAt`, `canUndoReminder` true >24 h after the first `doneAt`, false at new +24 h; `activeReminders` checked after reopen. |
| AC-9 | PASS | test `:192-199`: second reopen -> `not-archived`, wall equals first output. |
| AC-10 | PASS | `TodoChartTab.jsx:3` imports; guard `:63` `canUndoReminder(it, nowDate)`; handler `:30-33` `reopenReminder(...)` then `setReminderWallP(r.wall)`; `Undo closed` `:73`; no `useArmed`/`window.confirm`/`deleteReminder`/management import. Source-contract test `:203-214`. |
| AC-11 | PASS | `App.jsx:126` `now={now}`; `now` is the ticking state (`App.jsx:40`). Test `:217-220`. |
| AC-12 | PASS | No change to `normalizeReminderWall`, `useStore.js`, export, or keys (diff touches none); test `:224-238` asserts `doneAt` preserved, no `undoUntil`, no delete in Done view. |

## Contract details checked

- `canUndoReminder`: object check, parseable `doneAt` and `now`, `now - doneAt < UNDO_WINDOW_MS`; pure, no mutation.
- `reopenReminder`: error codes exact; every error returns the cloned (deep-equal) wall; `doneAt` removed by destructuring (not null); `updatedAt` set only when `now` supplied. Input never mutated (`cloneWall` copies items).
- Done view falls back to `new Date()` when `now` is not a `Date` (`TodoChartTab.jsx:20`). Legacy item with no `doneAt` shows `Undo closed`, never an Undo button.
- The structural test in `reminderWall.test.js` forbidding the word `window` in the lib still passes (comments reworded).

## Checkpoints

- [x] C1.1 `init.sh` prints `[OK]` (POSIX equivalent of `init.ps1`; run above).
- [x] C1.2 Every AC has a named test (table above).
- [x] C1.3 No test deleted/skipped/weakened — tests diff is empty for existing files.
- [x] C1.4 New pure logic in `src/lib/` has unit tests (success and failure paths).
- [x] C2.1 Exactly one `in_progress` (16).
- [x] C2.2 Touched files all listed in the impl report.
- [x] C2.3 Nothing outside scope changed.
- [x] C2.4 No unrelated fixes.
- [x] C3.1 Component does not touch localForage; uses prop `setReminderWallP`.
- [x] C3.2 Uses the `P` setter (`TodoChartTab.jsx:32`).
- [x] C3.3 Helpers pure — no React/DOM/storage added.
- [x] C3.4 N/A, no native access.
- [x] C4.1 JS/JSX only.
- [x] C4.2 Uses `card` from `ui.js`; the small Undo button class string is local, consistent with neighbouring Done button (non-blocking, see observations).
- [x] C4.3 Icon `Undo2` from `lucide-react`.
- [x] C4.4 Undo is non-destructive (spec D4), so no `useArmed`; permanent delete untouched.
- [x] C4.5 No new entity ids.
- [x] C5.1 No stored shape change, so no `normalizeModel`/version bump needed.
- [x] C5.2 No migration needed (`doneAt` already stored; shape unchanged).
- [x] C5.3 No "Never touch" item modified.
- [x] C5.4 No secrets involved.
- [x] C6.1 Week grid untouched.
- [x] C6.2 Ambition category untouched.
- [x] C6.3 No AI surface added.
- [x] C6.4 No network/data egress added.
- [x] C7.1 Web-only change; `npm run build` green. No `android/` change, so no `cap:sync` or plugin registration needed.

## Required changes

None.

## Observations (non-blocking)

1. Spec contract says the handler calls `reopenReminder(reminderWall, id, new Date())`;
   `TodoChartTab.jsx:31` passes `new Date().toISOString()`. The reasoning (keep `updatedAt` a
   string like every other wall timestamp, survives `normalizeReminderWall`) is sound and the
   function accepts both, and AC-10 only requires "the current time". But the report's
   "Deviations: None" should have noted this; the source-contract test pins the ISO form.
2. In `reopenReminder`, the `now === undefined ? rest : ...` branch (`reminderWall.js:284`) is
   unreachable: with `now` undefined, `canUndoReminder` is false so the call returns
   `undo-expired` first. Harmless; matches the spec's "when `now` is supplied" wording only
   vacuously.
3. The rendered Undo button layout (wrapping next to the Done date on a narrow viewport) is
   not covered by any test; needs a visual check on the device.
4. The Undo button class string is inline rather than from `ui.js` (`btnGhost`); acceptable
   for a compact pill but worth unifying if more such buttons appear.

APPROVED
