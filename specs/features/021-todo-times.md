# 021 — Optional start and end time on a to-do, with a start alert
**Feature id:** 21   **Status:** approved   **Depends on:** 11, 19

## Purpose
A wall to-do records what to do but not when. This feature adds an optional local start
and end clock time to each to-do (never required) and schedules a local notification at
the start time of every open timed to-do. It is the third Notifications v2 source: it
passes through the shared quiet-hours filter (feature 19) and the existing data-change
rescheduling. Because the wall item shape gains two fields, the export version moves from
6 to 7.

## Owner's decisions
- Start and end are **optional** clock times, `HH:MM` on the device's local wall clock.
  They are never required, may be cleared, and are stored only when valid.
- A to-do with a **start time** and not yet done gets one notification at the next local
  occurrence of that start time: today when the time is still strictly ahead, otherwise
  tomorrow. The schedule is re-derived on every sync, so while the to-do stays open each
  new day plans that day's occurrence, and marking it done cancels it.
- The **end time never schedules anything**; it is part of the to-do's visible time range.
- Quiet hours suppress a start alert exactly like every other notification (dropped, not
  moved), and a done or untimed to-do contributes nothing.
- Assigning a start time is the opt-in. On device the notification permission is requested
  at that moment — the same moment-of-intent rule as the Settings toggles — never at
  launch and never a second time unprompted.
- The monthly reflection reminder, the unrecorded nudge and the eight localForage keys are
  untouched. No exact alarm is introduced.
- The export envelope becomes **version 7**. Older `version: 4`, `5` and `6` files still
  import; a to-do without the new fields is an untimed to-do.

## User stories
- As the owner, I can give a to-do a start and end time, or leave both empty.
- As the owner, when the start time arrives for an open to-do, I get one notification
  with the to-do's text.
- As the owner, clearing a start time or ticking the to-do stops its alert.
- As the owner, no to-do alert arrives during quiet hours.

## Data touched
- `reminderWall.items[]` gains optional `startTime` and `endTime`, each a `"HH:MM"`
  string. Absent means the to-do has no time on that side; the keys are removed when a
  time is cleared, not stored as `null`.
- No new localForage key. `settings` is unchanged.
- `DataTab` exports `version: 7` with the same fields.

## Contract
```js
// src/lib/time.js — still imports only ./seed
normalizeOptionalClock(value) -> "HH:MM" | null   // valid clock kept, anything else null

// src/lib/reminderWall.js — pure; still imports only ./time
addReminder(wall, { id, categoryId, text, at, startTime, endTime }) -> { wall, error }
editReminder(wall, id, { categoryId, text, at, startTime, endTime }) -> { wall, error }
  // valid times are stored; absent, blank or invalid times are omitted (an edit clears
  // that key). Every other field and error code is unchanged.
hasTodoTime(item) -> boolean                      // startTime or endTime present
todoTimeLabel(item) -> string                     // "09:00–10:00" | "from 09:00" | "until 17:00" | ""

// src/lib/todoTimes.js — pure; imports only ./time and ./reminders
nextStartAt(startTime, from) -> Date | null
plannedTodoAlerts(items, from) -> [{ id, sourceId: "todo", at, title, body }]
```
- `normalizeReminderWall` normalizes both times on load and after import, keeps valid
  values, drops invalid ones, and stays idempotent and non-mutating.
- `nextStartAt` builds the local wall-clock time from supplied date parts (so it survives
  a DST transition); a time at or before `from` moves to the next calendar day; an
  invalid or missing time returns `null`.
- `plannedTodoAlerts` returns at most one entry per open item with a valid start time.
  Its `id` is `notificationIdFor("todo:" + item.id, at, key)`, where the key encodes the
  occurrence instant and the item's `updatedAt`. It is therefore stable for unchanged
  item data, differs between items and days, and changes when the start time or the text
  changes — otherwise a same-day time edit would keep an id already pending and the
  old alarm would survive. Done items and items without a start time are excluded.
  Title is `To-do starts now`; body is the trimmed to-do text.
- The alert goes through `filterQuietOccurrences` before `syncReminders`, exactly like the
  other sources.

## UI states
- The new-reminder card gains two optional `type="time"` inputs, **Start** and **End**,
  below the category selector; both start empty.
- The edit form gains the same two inputs, pre-filled from the item; clearing an input and
  saving removes that time.
- Wall post-its and To-Do's Chart cards show the time range when either time is set.
- With a start time set on device and permission not yet granted, the permission is
  requested once; denial still saves the to-do and the time, and simply schedules nothing.
- Browser: times save as data, and no notification is scheduled.

## Acceptance criteria
1. AC-1: `normalizeOptionalClock` returns `"07:05"` for `"7:05"`, `"23:59"` for `"23:59"`,
   and `null` for `""`, `null`, `undefined`, `"25:00"`, `"12:60"` and a non-clock string;
   it is idempotent and `time.js` gains no import.
2. AC-2: `normalizeReminderWall` preserves valid `startTime`/`endTime`, drops invalid
   values without dropping the item, leaves an item with neither field without those keys,
   and returns a deep-equal wall when run twice over timed data; it does not mutate input.
3. AC-3: `addReminder` stores supplied valid times; omits keys for absent, blank or invalid
   times; and still returns `text-empty` and `category-missing` unchanged. It does not
   mutate its input.
4. AC-4: `editReminder` can set, change and clear either time: a valid value replaces it, a
   blank or invalid value removes the key, `createdAt`, `doneAt`, `id` and the other time
   are preserved, and the existing error codes are unchanged.
5. AC-5: `hasTodoTime` is true when either time is valid and false otherwise;
   `todoTimeLabel` yields `"09:00–10:00"` for both, `"from 09:00"` for start only,
   `"until 17:00"` for end only, and `""` for neither.
6. AC-6: `nextStartAt("09:00", 08:00 same day)` is 09:00 that day; with `from` at exactly
   09:00 or later it is 09:00 the next calendar day; an invalid time returns `null`.
7. AC-7: `plannedTodoAlerts` returns exactly one entry per open item with a start time,
   excludes done items and items without a start time, and returns entries sorted by `at`.
8. AC-8: Two open items with different ids starting at the same time get different ids; the
   same item, day and start time gets the same id across calls and runs; a different start
   time on the same day, a text edit, and the next day's occurrence each get a different
   id. Every id is a positive integer in range.
9. AC-9: Each entry's title is `To-do starts now` and its body is the trimmed item text;
   `filterQuietOccurrences` drops an entry inside quiet hours and keeps one outside.
10. AC-10: `App` includes `plannedTodoAlerts(reminderWall, now)` in the plan before the
    quiet-hours filter and before the nudge is merged, and the sync effect still depends on
    `reminderWall`, so editing a to-do or its time re-plans; ticking it done removes its
    entry.
11. AC-11: The new-reminder and edit forms expose both optional time inputs and save them
    through the wall helpers; a to-do with a start time requests notification permission on
    device when saved if it is not already granted; wall post-its and chart cards render the
    time range. (Device for the permission and rendering.)
12. AC-12: `DataTab` writes `version: 7`; `version: 4`, `5` and `6` files still import; a
    wall round trip preserves `startTime`/`endTime`, and an imported to-do lacking them is
    untimed.
13. AC-13: `useStore` still reads and writes exactly the eight existing localForage keys,
    no new permission or manifest entry is added, no exact-alarm access is introduced, and
    no AI provider or key is read by any part of this feature.

## Out of scope
- The morning digest of untimed open to-dos (feature 22) and any toggle for start alerts:
  setting a start time is the opt-in.
- Due dates, repeat rules, all-day to-dos, snooze or "remind me in N minutes", notification
  actions, custom sounds, and moving a quiet-suppressed alert to the end of the window.
- Any change to the wall's categories, ordering, archive or deletion behaviour, and any
  change to the reflection or unrecorded-nudge sources.
- A migration rewrite on load: absent time keys already mean "no time".

## Findings from round 3, amended 2026-11-25
The review found that the original id `notificationIdFor("todo:" + item.id, at)` hashed
only the item and the calendar day. Reconciliation only re-schedules an entry whose id is
absent from the pending set, so editing 09:00 to 10:00 on the same day would leave the
09:00 alarm pending and never fire at 10:00. That contradicts AC-10 and the owner's
"re-derived on every sync" decision, so the key now also encodes the occurrence instant
and `updatedAt`; a text edit consequently refreshes the delivered body in the same pass.
AC-8 is amended and the tests cover the same-day time change.

## Open questions
None. The owner's request fixes the behaviour; the daily re-plan of an open timed to-do is
the direct consequence of "reschedule on app open and on data change" plus a time-only
to-do.
