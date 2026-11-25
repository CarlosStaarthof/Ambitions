# Implementation — feature 19 notification preferences and quiet hours

**Spec:** `specs/features/019-notifications-preferences.md` (approved)
**Status:** `in_progress` (not marked done; awaiting review)
**Branch:** work left uncommitted for Hermes.

## Files created / modified

- `src/lib/time.js` — added `normalizeClock`, `minutesOfClock`, `normalizeQuietHours`, `inQuietHours`; no new imports.
- `src/lib/reminders.js` — added `inQuietHours` to the existing `./time` import and exported `filterQuietOccurrences`.
- `src/lib/useStore.js` — `DEFAULT_SETTINGS.quietHours`, normalize on load after `mergeSettings`, normalize in `setSettingsP` before every save.
- `src/components/SettingsTab.jsx` — card renamed Notifications; Quiet hours switch plus two `type="time"` inputs and copy.
- `src/App.jsx` — filters the planned reminders through `filterQuietOccurrences`; effect re-runs on `reminderWall`/`weeks`.
- `tests/unit/quietHours.test.js` — 20 new tests covering AC-1 through AC-8.
- `progress/impl_notifications-preferences.md` — this report.

`feature_list.json` and `specs/**` were not touched.

## Acceptance criteria

| AC | Where satisfied | Test that proves it |
|---|---|---|
| AC-1 | `DEFAULT_SETTINGS.quietHours` in `useStore.js`; key list unchanged | `quietHours.test.js` "ships enabled, 23:00 to 07:00"; existing `reminders.test.js` "reads and writes exactly the eight localForage keys" |
| AC-2 | `normalizeQuietHours` defaults / pass-through | `quietHours.test.js` "falls back to the defaults…" and "preserves a valid stored window" |
| AC-3 | `normalizeClock` clamp + fallback, `normalizeQuietHours` enabled rule | `quietHours.test.js` "treats a missing enabled…", "zero-pads, clamps and repairs…", "returns the same value when run twice" |
| AC-4 | `minutesOfClock` | `quietHours.test.js` "converts midnight…" and "returns null for malformed…" |
| AC-5 | `inQuietHours` same-day and midnight-crossing branches | `quietHours.test.js` "includes the start minute…" and "handles a window that crosses midnight" |
| AC-6 | `inQuietHours` disabled / empty / invalid-date guards | `quietHours.test.js` "is false when disabled, empty or given an invalid date" |
| AC-7 | `filterQuietOccurrences` | `quietHours.test.js` "drops exactly the in-window entries…", "returns a new array…", "keeps every entry when quiet hours are off", "handles an absent plan" |
| AC-8 | `mergeSettings` fills/preserves; `useStore` normalizes merged value | `quietHours.test.js` "fills the defaults…", "is idempotent", "repairs an invalid stored clock…" |
| AC-9 | `App.jsx` builds and filters the plan before `syncReminders` | Verified by build + source inspection (components are not unit-tested in this repo) |
| AC-10 | `App.jsx` effect deps `reminderWall`, `weeks` plus existing deps; visibility handler rebuilds | Verified by source inspection; existing reminder tests stay green |
| AC-11 | `time.js` has no import; `reminders.js` still imports only `./time` | Existing `reminders.test.js` "keeps the pure schedule module free of Capacitor and storage" |
| AC-12 | No export/version or storage-key change; existing tests green | Existing `reminders.test.js` envelope and key-list tests; full suite 297 passed |

## Commands run

```text
npm test --silent
  13 test files passed, 297 tests passed, 0 failed

bash init.sh
  -> in progress: 19 notifications-preferences
  [OK] build green, tests green, scope clean
```

## Device-only checks

None required for this feature. Quiet hours are a stored preference and the pure
filter/wiring are covered off-device. The existing notification delivery checks from
feature 3 still apply to actual delivery.

## Deviations from the spec

None.

## Notes for the reviewer

- `filterQuietOccurrences` is applied to a freshly derived plan on every sync run,
  including the `visibilitychange` foreground return, so a plan cannot go stale while
  the app sits in the background.
- Quiet-hours time inputs are disabled only when the switch is off; they remain editable
  on web where reminder delivery is unsupported, as the spec requires.
- `setSettingsP` normalizes `quietHours` on every write, so an invalid clock chosen or
  stored by older data is repaired before persistence.
- Follow-up (already scoped to later features, not this one): features 20–22 register
  their sources in `REMINDER_SOURCES`; the existing filter in `App.jsx` will suppress
  them without further changes.
