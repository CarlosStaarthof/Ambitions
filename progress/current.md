# Current session

**Date:** 2026-11-25
**Goal (owner):** Ambitions — Notifications v2. In Settings > Notifications:
1. Unrecorded-time nudge: toggle, gap 1h default (1h/1.5h/2h), one nudge per gap,
   message adapts, resets when a block is recorded.
2. Quiet hours 23:00–07:00 editable, suppress all notifications.
3. To-dos get optional start and end time; start time schedules a local notification.
4. Morning digest 08:00 editable + toggle, listing open to-dos with no time.
Use Capacitor Local Notifications, reschedule on app open and data change, ask Android
13+ permission, keep the monthly reflection reminder, bump the export version if the
to-do schema changes.

**Work split (owner goal → features):**
- 19 `notifications-preferences` — **done** (round 1). Quiet hours + filtered plan +
  data-change rescheduling. Review: `progress/review_notifications-preferences.md`.
- 20 `unrecorded-nudge` — next (round 2). Spec to be written first.
- 21 `todo-times` — start/end on wall items, start alert, export v7.
- 22 `morning-digest` — open to-dos with no time, 08:00 editable + toggle.

Features 11, 12, 13 and 15 remain `in_review` (device checks pending). 14, 16 and 19
are `done`.

## Round 1 — notification preferences and quiet hours (feature 19, done)

- `src/lib/time.js`: `normalizeClock`, `minutesOfClock`, `normalizeQuietHours`,
  `inQuietHours` (pure, start inclusive / end exclusive, wrap-safe, disabled and
  `start === end` mean no window).
- `src/lib/reminders.js`: `filterQuietOccurrences(plan, quietHours)` — new array, order
  kept, input untouched. Module still imports only `./time`.
- `src/lib/useStore.js`: `DEFAULT_SETTINGS.quietHours = { enabled: true, start:
  "23:00", end: "07:00" }`; normalized on load and on every `setSettingsP` write.
- `src/components/SettingsTab.jsx`: card renamed Notifications; Quiet hours switch +
  two `type="time"` inputs; copy says all notifications are silenced in the window and
  it may cross midnight.
- `src/App.jsx`: plan filtered through `filterQuietOccurrences` before `syncReminders`;
  effect re-runs on `reminderWall`/`weeks` in addition to the existing deps.
- Tests: `tests/unit/quietHours.test.js` (20). Gate: `npm test --silent` → 13 files,
  297 tests; `bash init.sh` → `[OK]`.
- No stored-shape change beyond `settings`, so no export version bump (still `version:
  6`, `settings` never exported).

## Next round (planned)

- 20 `unrecorded-nudge`: write `specs/features/020-unrecorded-nudge.md`, then implement.
  Needs pure gap detection over `weeks` cells (30-min slots), a per-gap dedupe so one
  nudge fires per empty run and resets when a block is recorded, a settings group
  (`unrecorded: { enabled, gapMinutes }`) with default off and gap 60, and a
  `REMINDER_SOURCES` descriptor whose occurrences are derived from the current week
  cells. Route it through the existing quiet-hours filter and data-change rescheduling.
- Device checks accumulate for the end of the goal (delivery with app backgrounded).

## Still open from the earlier goal

- Feature 17 `app-language` remains blocked on the owner's language list and AI answer
  template. Do not guess either.
