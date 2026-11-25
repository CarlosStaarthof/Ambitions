# Implementation — feature 22 `morning-digest`

Spec: `specs/features/022-morning-digest.md` (approved this round).

## What changed

- `src/lib/morningDigest.js` (new, pure; imports `./time`, `./todoTimes`,
  `./reminders`):
  - `normalizeDigest(value)` → `{ enabled, time }`, off at `08:00` by default; only
    `enabled === true` enables; clock padded/clamped/fallback through `normalizeClock`.
  - `digestItems(items)` → open items with no valid `startTime` and non-empty text.
    End-only items stay in the digest because their end time schedules nothing.
  - `plannedMorningDigest(items, digest, from)` → zero or one entry at the next local
    occurrence of the configured time. Body lists each item on its own `• ` line; the id
    is `notificationIdFor("digest", at, key)` where the key encodes the occurrence, the
    listed ids and the body, so an unchanged list keeps its id while an edit, addition,
    removal or start-time assignment replaces it and refreshes the delivered body.
- `src/lib/useStore.js`: `DEFAULT_SETTINGS.digest = { enabled: false, time: "08:00" }`;
  `normalizeDigest` applied on load (after `mergeSettings`) and on every `setSettingsP`
  write. Still exactly the same eight localForage keys.
- `src/App.jsx`: `plannedMorningDigest(reminderWall && reminderWall.items,
  settings.digest, now)` joins the plan after the to-do alerts and before
  `filterQuietOccurrences`. The existing effect already re-runs on `reminderWall` and
  `settings`, so wall edits and Settings changes re-plan; the existing
  `visibilitychange` listener covers app open/foreground.
- `src/components/SettingsTab.jsx`: Morning digest row under Unrecorded time — toggle
  (permission requested at the moment of enabling, denial leaves it off), `type="time"`
  input disabled while off, and one line of copy. Browser keeps the toggle disabled.

No change to `DataTab` (export stays `version: 7`, `settings` is not exported), the
Android manifest, the reflection reminder, the unrecorded nudge or the to-do start
alerts.

## Tests

`tests/unit/morningDigest.test.js` (15 tests) covers AC-1…AC-10: defaults and
`mergeSettings`, normalisation and idempotence, eligible-item filtering, disabled/empty
plans, today-vs-tomorrow and DST, stable/changing ids, quiet-hours filtering, App
wiring, the Settings controls, module purity, and the unchanged export/manifest.

## Gate

- `npm test --silent` → 16 files, 352 tests passed.
- `bash init.sh` → `[OK] build green, tests green, scope clean`.

## Remaining

- Reviewer approval for feature 22 (status left `in_review`; `done` is the leader's).
- Device checks accumulated across the goal: permission prompt on first enable, digest
  delivery with the app backgrounded, quiet-hours suppression, reboot rescheduling.
