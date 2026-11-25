# Impl — feature 21 `todo-times`

Spec: `specs/features/021-todo-times.md` (approved). Feature moved `pending` →
`in_review`; it was never marked `done`.

## What changed

- `src/lib/time.js` — `normalizeOptionalClock(value)`: valid `HH:MM` kept and zero-padded,
  anything else `null`. No new import.
- `src/lib/reminderWall.js` — imports `normalizeOptionalClock`; wall items may carry
  optional `startTime` / `endTime`. `normalizeReminderWall` keeps valid times and drops
  invalid ones; `addReminder` / `editReminder` accept both times and remove a key when it is
  cleared; new `hasTodoTime` and `todoTimeLabel` helpers.
- `src/lib/todoTimes.js` (new, pure) — `nextStartAt(startTime, from)` (today if strictly
  ahead, otherwise tomorrow, built from local parts); `plannedTodoAlerts(items, from)` (one
  entry per open timed item, id `notificationIdFor("todo:" + item.id, at, key)` where the key
  carries the occurrence instant and `updatedAt`, so a same-day time edit or a text edit
  re-schedules instead of leaving the old pending alarm; sorted by time). Imports only
  `./time` and `./reminders`.
- `src/components/ReminderWallTab.jsx` — optional Start/End `type="time"` inputs in the new
  and edit forms, cleared on add, prefilled on edit; saving a start time asks notification
  permission once at that moment (denial still saves); the post-it shows the time range.
- `src/components/TodoChartTab.jsx` — the chart card shows the time range.
- `src/App.jsx` — `plannedTodoAlerts(reminderWall.items, now)` is added to the plan before
  `filterQuietOccurrences` and before the nudge; the existing `reminderWall` dependency
  re-plans on every wall edit.
- `src/components/DataTab.jsx` — export envelope `version: 7` (was 6); same field list.
- Updated the existing version pins in `notes`, `tasks`, `reminders`, `reminderWall` and
  `unrecordedNudge` tests from 6 to 7 (assertion strengthened to the new, approved shape;
  no assertion removed). In `reminderWall.test.js` the "no notifications from the wall"
  source check now forbids scheduling calls rather than the permission import that this
  feature needs, per spec 021 AC-11.

## Tests

`tests/unit/todoTimes.test.js` (new, 17 tests) covers AC-1…AC-13: optional clock
normalisation, timed wall shape and add/edit/clear, labels, next-occurrence and DST wall
clock, one-plan-entry-per-open-timed-item, stable ids per item and day, quiet-hours drop,
App wiring, UI inputs/permission-at-intent, v7 export with older imports, and the unchanged
store-key/permission/AI surface.

## Gate

- `npm test --silent`: 15 files, **337 tests passed**, 0 failed, 0 skipped.
- `bash init.sh`: `npm run build` green, the same 337 tests green, last line
  **`[OK] build green, tests green, scope clean`**. No step skipped.

## Review repair

The first review found that the id hashed only item and calendar day: a same-day change
from 09:00 to 10:00 produced the same id, and `diffSchedule` left the 09:00 alarm pending.
The id now also encodes the occurrence instant and `updatedAt`; a text edit refreshes too.
Spec Contract/AC-8 amended with a findings note; the test now asserts that a same-day
time change and a text edit both produce new ids.

## Notes

- A start alert is re-derived, not stored: while a timed to-do stays open each sync plans
  the next local occurrence; ticking it done removes the entry and cancels it.
- The end time is display-only and schedules nothing. No new localForage key, no manifest
  or permission change, and no exact alarm.
