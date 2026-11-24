# Impl — week-grid scrolling fix and permanent reminder deletion (2026-11-24)

Round 1 of 5 for the owner's two-part goal. Neither feature is marked `done`.

## 1. Week grid scroll fix (feature 12)

Bug: the Week grid set `touch-action: none` and called `preventDefault()` on every cell
pointer-down, so the Plan & Balance calendar could not be scrolled vertically at all.

Changed `src/components/WeekTab.jsx`:

- The grid style is now `touchAction: scrollLocked ? "none" : "pan-y"` — vertical scrolling is
  the normal state, and nothing disables it unconditionally.
- New `scrollLocked` state. `clearHold()` always sets it to `false`; the hold timer sets it to
  `true` only when a long-press is recognised. Pointer up/cancel/leave clear it, and a window
  `pointerup`/`pointercancel` listener clears it even when the editor overlay takes the event.
- `handleCellPointerDown` no longer calls `preventDefault` and records the touch start.
- New `handleCellPointerMove` cancels the hold once the finger moves more than
  `HOLD_CANCEL_PX` (8 px), so a swipe scrolls normally instead of becoming a note gesture.
- Brush/eraser touch-down behaviour is unchanged.
- Supersedes the old AC-9 wording; `specs/features/012-block-notes.md` now carries the owner
  ruling (2026-11-24) and the amended AC-9 / UI-state sentence.

Tests (`tests/unit/notes.test.js`):

- Replaced the old test that required `touch-action: none` with a stronger one: no
  unconditional `touch-action: none`, the dynamic `scrollLocked ? "none" : "pan-y"` state,
  `setScrollLocked(true/false)`, and all pointer release handlers wired to `clearHold`.
- New test: the pointer-down handler calls no `preventDefault`, and a pre-hold move
  (`HOLD_CANCEL_PX` / `Math.hypot`) cancels the gesture.

## 2. Permanent reminder deletion (feature 11)

Owner asked for reminders to be deletable, permanently, from the wall and the archive, after
a confirmation step; categories unaffected; deleted reminders never appear in exports again.

Changed `src/lib/reminderWall.js`:

- New pure `deleteReminder(wall, id)` returning `{ wall, error }`. It removes the item whether
  active or archived, keeps categories and every other item deep-equal, never mutates the
  input, and returns `reminder-not-found` for an unknown id.

Changed `src/components/ReminderWallTab.jsx`:

- Both the wall post-it and the archive card now have a `Delete` control behind the two-tap
  `useArmed` confirmation (`arm("rmDel"+id, …)`), no `window.confirm`.
- `removeItem` writes the new wall through `setReminderWallP`, so the deleted reminder is
  gone from the store and therefore from every later export.
- A `reminder-not-found` line is shown if a delete races a stale item.

Spec `specs/features/011-reminder-wall.md`:

- New owner ruling dated 2026-11-24, new AC-16, `deleteReminder` in the Contract,
  `reminder-not-found` extended to delete, A5 and open question 4 updated, the old
  "deleting reminders is out of scope" bullet removed, and Verification updated.

Tests (`tests/unit/reminderWall.test.js`):

- `deleteReminder` on an active and an archived reminder; categories and other items intact;
  non-mutating; unknown id returns `reminder-not-found`; deleted ids absent from
  `activeReminders`/`archivedReminders`/`categoryUsage`.
- A simulated v6 export of the wall contains no trace of the deleted reminder.
- Source test: delete is imported and wired from both the wall and the archive, twice armed,
  with no `window.confirm`.

## Gate

- `npm test --silent` → 8 files, 219 tests passed.
- `bash init.sh` → `[OK] build green, tests green, scope clean` (in progress: 12 block-notes).

## Still outstanding

- Device checks for the scroll feel (AC-9), the rendered delete/confirmation half of AC-16,
  and the pre-existing device-only feature 11/12 checks. No source work is known to remain.
- Feature 11 stays `in_review`; feature 12 stays `in_progress`; only the leader may close them.
