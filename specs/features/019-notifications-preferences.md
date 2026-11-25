# 019 — Notification preferences and quiet hours
**Feature id:** 19   **Status:** approved   **Depends on:** 3

## Purpose
Notifications v2 adds three new notification sources (an unrecorded-time nudge, a
to-do start alert and a morning digest) beside the existing monthly reflection. All of
them must obey one quiet window and must be re-planned whenever the data behind them
changes. This feature adds that shared layer: the quiet-hours setting, the pure filter
that suppresses any planned notification inside the window, and the data-change
rescheduling hook. Without it the new sources would deliver overnight and would keep a
stale plan after the user edits a to-do or paints a week.

## Owner's decisions
- Quiet hours default to **23:00–07:00**, local device time. Both ends are editable.
- The window may cross midnight; the start minute is included, the end minute is not.
- Quiet hours start **enabled**; the owner can switch them off.
- Suppression means **do not schedule**: a notification that falls in the window is
  dropped from the plan, not moved to the end of the window.
- The monthly reflection reminder stays; nothing about its 19:00 occurrences or its
  settings toggle changes.
- No export version bump: this feature stores preferences only, and `settings` is not
  part of the export envelope.

## User stories
- As the owner, I can set quiet hours so no notification arrives while I sleep.
- As the owner, I want the plan rebuilt when I change a to-do, a week or a setting, so a
  notification reflects the current data rather than what was true at launch.

## Data touched
- `settings` (existing localForage key) gains `quietHours: { enabled, start, end }`.
- No new localForage key; no change to `tasks`, `weeks`, `reminderWall` or reflections.
- `DEFAULT_SETTINGS.quietHours` is `{ enabled: true, start: "23:00", end: "07:00" }`.

## Contract
```js
// src/lib/time.js — pure time helpers, no new imports
normalizeClock(value, fallback) -> "HH:MM"      // malformed -> fallback, out-of-range clamped
minutesOfClock("HH:MM") -> integer | null       // 00:00..23:59 -> 0..1439
normalizeQuietHours(value) -> { enabled, start, end }
inQuietHours(at, quietHours) -> boolean

// src/lib/reminders.js — pure, still imports only ./time
filterQuietOccurrences(plan, quietHours) -> plan[]  // new array, input untouched
```
- `normalizeQuietHours` treats a missing/invalid object as the defaults, a missing
  `enabled` as `true`, and any value other than `false` as enabled. It is idempotent.
- `inQuietHours` is `false` when quiet hours are disabled, when `start === end`, or when
  `at` is not a valid date. Otherwise for `start < end` it is `start <= at < end`; for a
  window crossing midnight it is `at >= start || at < end`.
- `filterQuietOccurrences` keeps plan entries whose `at` is outside the window, in order.

## UI states
- Settings shows a **Notifications** card containing the reminder source toggles (as
  before) and a Quiet hours row: an on/off switch plus two `type="time"` inputs.
- Times render zero-padded; editing one persists through `setSettingsP`.
- The copy states that all notifications are silenced in the window and that it may
  cross midnight. On a browser the reminder toggles stay disabled as they do today;
  the quiet-hours fields remain editable because they store a preference only.

## Acceptance criteria
1. AC-1: `DEFAULT_SETTINGS.quietHours` equals `{ enabled: true, start: "23:00", end: "07:00" }`, and `useStore` still reads and writes exactly the eight localForage keys `categories`, `questions`, `reflections`, `reminderWall`, `settings`, `tasks`, `vision`, `weeks`.
2. AC-2: `normalizeQuietHours(undefined)`, `normalizeQuietHours(null)` and `normalizeQuietHours("nonsense")` all return the defaults; `normalizeQuietHours` preserves `{ enabled: false, start: "22:15", end: "06:30" }` unchanged.
3. AC-3: `normalizeQuietHours` maps a missing `enabled` to `true`, keeps `enabled: false`, zero-pads `"7:05"` to `"07:05"`, clamps an out-of-range clock (`"25:70"` to `"23:59"`) and falls back on a non-numeric clock; running it twice returns a deep-equal value.
4. AC-4: `minutesOfClock("23:00") === 1380`, `minutesOfClock("00:00") === 0`, and `minutesOfClock("nope") === null`.
5. AC-5: For a normal window `08:00–17:00`, `inQuietHours` is true at `08:00` and `16:59`, false at `07:59` and `17:00`. For the default wrap window `23:00–07:00`, it is true at `23:00`, `00:00` and `06:59`, and false at `07:00` and `22:59`.
6. AC-6: `inQuietHours` returns false when quiet hours are disabled, when `start === end`, and when `at` is an invalid date.
7. AC-7: `filterQuietOccurrences` drops exactly the entries inside the window, keeps outside entries in their original order, and returns a new array without mutating the input; with quiet hours disabled it keeps every entry.
8. AC-8: `mergeSettings(DEFAULT_SETTINGS, stored)` gives settings written before this feature a `quietHours` object with the defaults, preserves a stored valid `quietHours` object, and is idempotent; `useStore` normalizes the merged value with `normalizeQuietHours` on load so a stored invalid clock is repaired in memory.
9. AC-9: `App` builds `filterQuietOccurrences(plannedReminders(...), settings.quietHours)` and passes that filtered plan to `syncReminders`, so a source occurrence inside the window is not scheduled while the default 19:00 reflection still is.
10. AC-10: The App sync effect re-runs when `reminderWall`, `weeks`, `settings`, `reflections`, `questions`, `loading` or `storageError` changes, and on return to the foreground; `syncReminders` receives the filtered plan on every run.
11. AC-11: The new helpers are pure: `time.js` gains no import, `reminders.js` still imports only `./time`, and no module here imports React, the DOM, Capacitor or storage.
12. AC-12: The export envelope stays `version: 6` with the same field list (no `settings` field), a `version: 4`, `5` or `6` file still imports, and every existing reminder/reflection test stays green. New unit tests cover AC-1 through AC-8.

## Out of scope
- The unrecorded-time nudge (feature 20), to-do start/end times and start alerts
  (feature 21), and the morning digest (feature 22).
- Per-source quiet windows, notification actions/grouping, custom sounds, exact alarms,
  a changed permission flow, or moving a suppressed notification later.
- Any change to the reminder channel name or the Android manifest.

## Open questions
None. The four owner requests are recorded above as binding decisions.
