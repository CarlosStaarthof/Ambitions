# 020 — Unrecorded-time nudge
**Feature id:** 20   **Status:** approved   **Depends on:** 3, 19

## Purpose
The calendar only asks for time after the fact; nothing notices when a whole stretch of
the day goes unpainted. This feature adds one optional local notification that fires once
when the user has left a chosen gap (1 h, 1.5 h or 2 h) with no recorded 30-minute block,
and resets as soon as a block is recorded. It is the first Notifications v2 source after
the shared quiet-hours layer (feature 19), so it must pass through that filter and the
existing data-change rescheduling.

## Owner's decisions
- The nudge is **off by default**; reminders are always opt-in.
- The gap is **60 minutes by default**, chosen from exactly `60`, `90`, `120`.
- The message is `You haven't recorded anything for the past hour` for 60 minutes,
  `… for the past 1.5 hours` for 90 and `… for the past 2 hours` for 120.
- **One nudge per gap**: after a nudge, no second nudge for the same gap. The gap is
  reset by recording any block; the next gap may nudge again.
- Quiet hours (feature 19) suppress the nudge like every other notification; a suppressed
  nudge is not marked as sent, so it can fire once the window ends.
- The monthly reflection reminder is untouched. No export version bump: this changes
  `settings` only, and `settings` is never exported.

## User stories
- As the owner, I can switch on an unrecorded-time nudge and pick how long a blank
  stretch must be before it fires.
- As the owner, I am not nagged twice for the same blank stretch.
- As the owner, painting a block immediately clears the nudge state.

## Data touched
- `settings` (existing localForage key) gains
  `unrecorded: { enabled, gapMinutes, lastNudgedGapStart, lastNudgedAt }`.
- `lastNudgedGapStart` is a stable gap marker (ISO end of the last recorded block, or
  `"never"`), `lastNudgedAt` is the ISO time the nudge was scheduled for.
- No new localForage key; `weeks` is read only, never written, by this feature.

## Contract
```js
// src/lib/nudge.js — pure; imports only ./seed, ./time and ./reminders
NUDGE_GAP_OPTIONS = [60, 90, 120]
NUDGE_GAP_DEFAULT = 60
normalizeUnrecorded(value) -> { enabled, gapMinutes, lastNudgedGapStart, lastNudgedAt }
nudgeGapText(60|90|120) -> "hour" | "1.5 hours" | "2 hours"
lastRecordedBlockEnd(now, weeks) -> Date | null
unrecordedNudge(now, weeks, unrecorded) -> { entry, gapKey, alreadyMarked } | null

// src/lib/reminders.js
notificationIdFor(sourceId, at, key?) -> positive 31-bit integer
```
- `normalizeUnrecorded` is idempotent: missing/nonsense input is `{ enabled: false,
  gapMinutes: 60, lastNudgedGapStart: null, lastNudgedAt: null }`; an unsupported gap
  falls back to 60; only `enabled === true` enables.
- `lastRecordedBlockEnd` walks backwards from the 30-minute block containing `now`
  (Monday-first cells, `${dayIndex}-${slot}` inside `weeks[monday].cells`), across day and
  week boundaries, and returns the end of the latest block that has a cell. It returns
  `null` when no block is found within a bounded lookback.
- `unrecordedNudge` returns `null` when disabled, or when the same gap was already nudged
  and its scheduled time has passed. Otherwise its `entry` is `{ id, sourceId:
  "unrecorded", at, title, body }`; `at` is `lastRecordedEnd + gapMinutes`, or one minute
  after `now` when that moment is already past or no block exists.
- The entry's `id` derives from `("unrecorded", gapKey)`, so the same gap keeps the same
  id and a new gap gets a new one.
- `notificationIdFor` with a third `key` hashes `sourceId|key`; called with two arguments
  it is unchanged, so existing reflection ids keep their frozen values.

## UI states
- Settings → Notifications gains an **Unrecorded time** row under the reminder sources:
  a toggle (permission requested on switching it on, exactly like the other sources), a
  gap select (`1 hour`, `1.5 hours`, `2 hours`) disabled while the nudge is off, and one
  line explaining it fires once per gap and resets when a block is recorded.
- On a browser the toggle is disabled with the existing "needs the Android app" line; the
  gap select stores the preference but schedules nothing.

## Acceptance criteria
1. AC-1: `DEFAULT_SETTINGS.unrecorded` is `{ enabled: false, gapMinutes: 60,
   lastNudgedGapStart: null, lastNudgedAt: null }`, `useStore` still reads and writes
   exactly the eight localForage keys, and `mergeSettings` gives settings written before
   this feature that object without erasing a stored value.
2. AC-2: `normalizeUnrecorded` returns the defaults for `undefined`, `null` and a
   non-object, accepts only `60`, `90`, `120` (anything else becomes `60`), treats a
   missing `enabled` as off, and returns a deep-equal value when run twice.
3. AC-3: `nudgeGapText(60) === "hour"`, `nudgeGapText(90) === "1.5 hours"`,
   `nudgeGapText(120) === "2 hours"`; an unsupported value reads as the 60-minute text.
4. AC-4: `lastRecordedBlockEnd` finds a filled block in the same day, and finds one in the
   previous day and the previous week when the current day/week are empty (a Sunday
   23:30 block seen from Monday 00:30).
5. AC-5: `lastRecordedBlockEnd` returns the end of the **current** block when the block
   containing `now` is filled, and ignores cells painted in future blocks.
6. AC-6: With the nudge disabled `unrecordedNudge` returns `null` for any data.
7. AC-7: With a block ending at 10:00, a 60-minute gap and `now` at 10:10, the entry's
   `at` is 11:00 and its `id` equals `notificationIdFor("unrecorded", <at>, <gapKey>)`;
   with `now` at 11:30 the entry's `at` is at most one minute after `now`.
8. AC-8: With no recorded block at all the nudge is due immediately (`at` > `now` and no
   later than one minute after it) and its `gapKey` is `"never"`.
9. AC-9: One nudge per gap: an unrecorded state already carrying the same `gapKey` and a
   future `lastNudgedAt` returns the **same** id and `at` with `alreadyMarked: true`; the
   same state with `lastNudgedAt` at or before `now` returns `null`.
10. AC-10: Recording a block that changes the gap marker makes `unrecordedNudge` return a
    new entry with a different id, so the previous nudge is no longer part of the plan.
11. AC-11: Passing the nudge entry through `filterQuietOccurrences` drops it inside quiet
    hours and keeps it outside; the message body uses the configured gap text.
12. AC-12: `App` adds the nudge entry to the plan before quiet-hours filtering, persists
    `lastNudgedGapStart`/`lastNudgedAt` only when the entry survived filtering and was not
    already marked, and re-runs the sync effect on the existing settings/weeks dependencies.
13. AC-13: The new module is pure — no React, DOM, Capacitor or storage import — and the
    export envelope stays `version: 6` with no `settings` field.

## Out of scope
- To-do start/end times and their alerts (feature 21) and the morning digest (feature 22).
- Nudging while the app stays open with no data change, per-day snoozing, custom gap
  values, a second reminder channel, or any change to the Android manifest.
- Marking a nudge delivered by the OS: state advances when it is scheduled, and one
  scheduled nudge is not retried if the OS drops it (delivery is best-effort).

## Open questions
None. The owner's four requests set every value above.
