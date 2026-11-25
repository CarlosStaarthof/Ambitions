# 022 — Morning digest of open to-dos with no start time
**Feature id:** 22   **Status:** approved   **Depends on:** 11, 19, 21

## Purpose
The owner can capture to-dos but, unless one carries a start time, nothing brings them
back to mind on the day. This feature adds one optional local notification each morning
that lists the open wall to-dos which have no start time. It is the last Notifications v2
source, so it passes through the shared quiet-hours filter (feature 19) and the existing
data-change rescheduling, and it leaves the monthly reflection reminder unchanged.

## Owner's decisions
- The digest is **off by default**; every notification source is opt-in.
- The default time is **08:00 local**, editable as `HH:MM` in Settings. One digest per day
  at the next occurrence of that time: today while it is still strictly ahead, otherwise
  tomorrow.
- The digest lists **open** to-dos that have **no start time**. Done items, items with a
  valid start time, and an empty list of eligible items produce no notification. An item
  with only an end time has no start alert, so it stays in the digest.
- Quiet hours suppress the digest like every other notification (dropped, not moved).
- The permission is requested at the moment the digest toggle is switched on — the same
  moment-of-intent rule as the other sources — never at launch.
- The monthly reflection reminder, the unrecorded nudge and the to-do start alerts are
  untouched. Only `settings` changes, and `settings` is never exported, so the export
  envelope stays `version: 7` and no data migration is needed.

## User stories
- As the owner, I can switch on a morning digest and choose the time it arrives.
- As the owner, the digest names the open to-dos I have not given a time to.
- As the owner, ticking, deleting, adding or retiming a to-do changes what the next
  digest says without me opening Settings again.
- As the owner, no digest arrives during quiet hours.

## Data touched
- `settings` (existing localForage key) gains `digest: { enabled, time }`, with
  `time` a `"HH:MM"` local clock string.
- No new localForage key. `reminderWall` and `weeks` are read only, never written, by
  this feature.
- `DataTab` still exports `version: 7` with the same fields.

## Contract
```js
// src/lib/morningDigest.js — pure; imports only ./time, ./todoTimes and ./reminders
DIGEST_DEFAULT_TIME = "08:00"
DIGEST_TITLE = "Morning digest"

normalizeDigest(value) -> { enabled, time }
digestItems(items) -> [{ id, text }]          // open, no valid startTime, non-empty text
plannedMorningDigest(items, digest, from) -> [entry] | []
  // entry: { id, sourceId: "digest", at, title: DIGEST_TITLE, body }
```
- `normalizeDigest` is idempotent. Missing/nonsense input is
  `{ enabled: false, time: "08:00" }`; only `enabled === true` enables; a valid clock is
  zero-padded, an out-of-range clock is clamped, and a non-clock falls back to `08:00`.
- `plannedMorningDigest` returns `[]` when the digest is disabled or no item qualifies.
  Otherwise `at` is the next local occurrence of the configured time, built from local
  date parts so the wall-clock hour survives a DST transition.
- Each entry's `id` is `notificationIdFor("digest", at, key)` where the key encodes the
  occurrence and the listed items' ids and text, so an unchanged list keeps a stable id
  (reconciliation is a no-op) while adding, removing, retiming or editing a listed to-do
  produces a new id and the delivered body is refreshed.
- `body` lists every eligible to-do on its own line, prefixed `• `, in stored order, with
  text trimmed. Title is `Morning digest`.
- The entry goes through `filterQuietOccurrences` before `syncReminders`, exactly like the
  other sources, and App re-plans on every existing settings/wall change and on return to
  the foreground.

## UI states
- Settings → Notifications gains a **Morning digest** row below Unrecorded time: a toggle,
  a `type="time"` input (disabled while the digest is off), and one line saying it lists
  open to-dos with no start time and is skipped on days when there are none.
- Switching the toggle on requests notification permission once; denial leaves the toggle
  where it was and shows the existing blocked line.
- Browser: the toggle is disabled with the existing "needs the Android app" line; the time
  preference still saves and schedules nothing.

## Acceptance criteria
1. AC-1: `DEFAULT_SETTINGS.digest` is `{ enabled: false, time: "08:00" }`, `useStore` still
   reads and writes exactly the eight localForage keys, and `mergeSettings` gives settings
   written before this feature that object without erasing a stored `digest` value.
2. AC-2: `normalizeDigest` returns `{ enabled: false, time: "08:00" }` for `undefined`,
   `null` and a non-object; accepts only `enabled === true`; keeps `"07:05"`, turns
   `"7:05"` into `"07:05"`, `"25:00"` into `"23:00"` and `"nope"` into `"08:00"`; running
   it twice returns a deep-equal value.
3. AC-3: `digestItems` lists an open item without a start time, includes an item that has
   only an end time, and excludes a done item, an item with a valid start time, and an
   item whose trimmed text is empty; it trims the text it returns and does not mutate input.
4. AC-4: `plannedMorningDigest` returns `[]` for a disabled digest for any items, and `[]`
   for an enabled digest when no item qualifies.
5. AC-5: With `enabled: true`, time `08:00`, two eligible items and `from` at 07:00, it
   returns exactly one entry at 08:00 the same day, with title `Morning digest` and a body
   containing both trimmed texts on separate lines; with `from` at exactly 08:00 or later
   the entry is at 08:00 the next calendar day.
6. AC-6: Each entry's id is a positive integer in `1…2147483647`; it is identical across
   calls for unchanged items, differs from the next day's occurrence, and differs after a
   listed item is edited, added, removed or given a start time.
7. AC-7: `filterQuietOccurrences` drops a digest entry inside quiet hours and keeps one
   outside; `App` includes `plannedMorningDigest(reminderWall.items, settings.digest, now)`
   in the plan before the quiet-hours filter, and the sync effect still depends on
   `reminderWall` and `settings`.
8. AC-8: The Settings Notifications card exposes a Morning digest toggle and a `type="time"`
   input bound to `settings.digest`; enabling it requests permission exactly like the other
   sources and denial leaves the toggle off. (Device for the prompt.)
9. AC-9: The module is pure — no React, DOM, Capacitor, AI or storage import — and imports
   only `./time`, `./todoTimes` and `./reminders`.
10. AC-10: `DataTab` still writes `version: 7` with no `settings` field, `version: 4`, `5`
    and `6` files still import, no new permission or exact-alarm access is introduced, and
    the reflection reminder and to-do start alerts still appear in the same plan.

## Out of scope
- Any digest of timed to-dos, overdue items, or a body customised per category.
- A second notification channel, snooze, per-day skipping, a "send now" button, or moving a
  quiet-suppressed digest to the end of the window.
- Changes to the wall's categories, archive or ordering, and any change to the unrecorded
  nudge or reflection reminder behaviour.
- A load-time rewrite of stored settings: absent `digest` is filled by `mergeSettings` in
  memory, never by a migration write.

## Open questions
None. The owner's request fixes the toggle, the default 08:00 time, the editable time and
the "open to-dos with no time" content; the remaining values follow the existing sources.
