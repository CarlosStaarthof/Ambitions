# Review — mwv7eca8 (week-grid scroll fix + permanent reminder deletion)

**Verdict:** APPROVED

Branch `hermes/mwv7eca8`, commit 61b3f3c. The contract is the task text. Diff checked against
`progress/impl_scroll-and-reminder-delete.md`; the report matches the diff.

## Gate
- `npm test --silent`: 8 files, 219 tests passed.
- `bash init.sh`: `[OK] build green, tests green, scope clean` (one feature in progress: 12). Nothing was skipped.
- `git status`: clean tree. Files changed outside `progress/`: `src/components/WeekTab.jsx`,
  `src/components/ReminderWallTab.jsx`, `src/lib/reminderWall.js`, `tests/unit/notes.test.js`,
  `tests/unit/reminderWall.test.js`, `specs/features/011-…`, `specs/features/012-…`. All are in scope.

## Criteria (the task, plus spec 011 AC-16 and spec 012 AC-9 as amended)
| AC | PASS/FAIL | Evidence |
|---|---|---|
| S1 Vertical scrolling works normally; the grid does not disable touch scrolling | PASS | `WeekTab.jsx:254` style is `touchAction: scrollLocked ? "none" : "pan-y"`; the unconditional `"none"` is gone. `handleCellPointerDown` (`WeekTab.jsx:158-172`) no longer calls `preventDefault`. Tested at `notes.test.js:~330-340` (`not.toMatch(touchAction "none")`, dynamic expression) and `~342-348` (no `preventDefault` in the handler). |
| S2 Scrolling is paused only during a recognised long-press hold | PASS | `setScrollLocked(true)` only inside the hold timer callback (`WeekTab.jsx:~166`). `notes.test.js` asserts `setScrollLocked(true)`. |
| S3 Scrolling resumes on finger lift or cancelled hold | PASS | `clearHold()` always calls `setScrollLocked(false)` (`WeekTab.jsx:~126`). It is wired to `onPointerUp`/`onPointerCancel`/`onPointerLeave` on cells (`:~300-303`) and to window `pointerup`/`pointercancel` (`:~65-70`). A move over 8 px (`HOLD_CANCEL_PX`) cancels the hold (`handleCellPointerMove`). Tests assert the handler wiring, `HOLD_CANCEL_PX` and `Math.hypot`. |
| S4 Test for the scroll-lock state | PASS | `notes.test.js`, "allows vertical scrolling and locks it only while a hold is in progress" and "cancels the hold instead of hijacking a scroll gesture". These are source-reading tests, which is the repo's convention because it has no component tests. The spec labels the feel as a device check. |
| S5 Spec 012 note for the scroll fix | PASS | `012-block-notes.md`: new "Owner ruling, 2026-11-24 — grid scrolling" section, amended AC-9 and UI states, and the Verification text. |
| R1 Delete from the wall and from the archive after a confirmation step | PASS | `ReminderWallTab.jsx`: two buttons use `arm("rmDel"+id, …)`, one in the archive card and one on the wall post-it. There is no `window.confirm`. Tested by "arms a permanent delete control on both the wall and the archive", which counts exactly 2 arm sites. |
| R2 Deleting removes the reminder entirely: not archived, not in later exports | PASS | `reminderWall.js` `deleteReminder` filters the item out and never sets `doneAt`. The component writes through `setReminderWallP` (`useStore.js:121`), and `DataTab.jsx:20` exports from that state. Tests: "permanently deletes an active or archived reminder…" (absent from `activeReminders`/`archivedReminders`/`categoryUsage`) and "leaves no trace of a deleted reminder in a wall export". |
| R3 Categories unaffected | PASS | `deleteReminder` returns `w.categories` unchanged. The test asserts `categories` `toEqual(input.categories)`, including the empty-category case. |
| R4 Failure and immutability | PASS | Unknown id returns `reminder-not-found`; the input is not mutated (`toEqual(before)`). The message is mapped in `COPY` (`ReminderWallTab.jsx:19`). |
| R5 Spec 011 updated as an owner ruling dated 2026-11-24 with a new AC | PASS | `011-reminder-wall.md`: "Owner ruling, 2026-11-24" section, AC-16, Contract entry, updated A5, open question 4, Out of scope and Verification. |
| G Run `npm test` and `bash init.sh` | PASS | Both green, see Gate. |
| X No new scope | PASS | No new dependency, no storage-shape or export-version change, no `android/` change. |

## Checkpoints
- [x] C1.1 init prints `[OK]`.
- [x] C1.2 Each AC names a test (above). The rendered/device halves are declared as device checks in the spec.
- [x] C1.3 One old test was replaced by a stronger one (`touchAction "none"` → dynamic `pan-y`), as the owner ruling requires. No test was skipped or deleted otherwise.
- [x] C1.4 `deleteReminder` has a success test and a failure test.
- [x] C2.1 One feature in progress (12).
- [x] C2.2 Touched files are listed in the impl report.
- [x] C2.3, C2.4 No out-of-scope changes.
- [x] C3.1 Components use the store setter only.
- [x] C3.2 Uses `setReminderWallP`.
- [x] C3.3 `reminderWall.js` stays pure.
- [x] C3.4 n/a, no native access.
- [x] C4.1 JS/JSX only.
- [x] C4.2 Shared `ui.js` strings reused.
- [x] C4.3 `Trash2` from lucide-react.
- [x] C4.4 Two-tap `useArmed`, no `window.confirm`.
- [x] C4.5 No new entity ids.
- [x] C5.1 No stored-shape change, so no `version` bump.
- [x] C5.2 No migration needed.
- [x] C5.3 No "never touch" item changed.
- [x] C5.4 No secret is involved.
- [x] C6.1, C6.2 Week and Ambition category unchanged.
- [x] C6.3, C6.4 No AI or network change.
- [x] C7.1 Web-only, `npm run build` is enough. The user rebuilds to test on the phone.

## Required changes
None.

## Observations (non-blocking)
1. The scroll-lock tests read source text (regex). They prove the wiring, not the browser behaviour. The real feel on a phone is a device check, which the impl report states.
2. `touch-action` is read by the browser at touch start, so setting `"none"` after the 500 ms hold does not stop a pan that has already begun. This is acceptable: a pan that moves cancels the hold first, and the browser's `pointercancel` clears the lock. Worth confirming on the device.
3. Feature 12 stays `in_progress` and feature 11 stays `in_review`. Only the leader closes them.
