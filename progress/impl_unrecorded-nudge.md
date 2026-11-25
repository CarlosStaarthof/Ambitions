# Implementation — feature 20 unrecorded-time nudge

**Spec:** `specs/features/020-unrecorded-nudge.md` (approved)
**Status:** `in_review` (not marked done; awaiting review/owner)
**Branch:** changes left uncommitted for Hermes.

## What shipped

- `src/lib/nudge.js` (new, pure) — `normalizeUnrecorded`, `nudgeGapText`,
  `lastRecordedBlockEnd`, `unrecordedNudge`. Reads stored `weeks` only; no React, DOM,
  Capacitor or storage import.
- `src/lib/reminders.js` — `notificationIdFor` accepts an optional third `key`; with two
  arguments the frozen reflection ids are unchanged.
- `src/lib/useStore.js` — `DEFAULT_SETTINGS.unrecorded = { enabled: false, gapMinutes: 60,
  lastNudgedGapStart: null, lastNudgedAt: null }`; normalized on load after
  `mergeSettings` and on every `setSettingsP` write.
- `src/components/SettingsTab.jsx` — Notifications card gains an **Unrecorded time**
  toggle (same permission-at-intent flow as the other sources), a 1 h / 1.5 h / 2 h gap
  select disabled while off, and copy explaining one nudge per gap and the reset.
- `src/App.jsx` — the nudge entry is merged into the plan before
  `filterQuietOccurrences`; the gap marker is persisted only when the entry survives the
  quiet filter and was not already marked. While a scheduled nudge is still ahead, the
  same entry stays in the plan so reconciliation cannot cancel it.
- `tests/unit/unrecordedNudge.test.js` — 23 new tests covering AC-1..AC-13.
- `feature_list.json` — feature 20 `pending` → `in_review`, spec path already present.

## Design notes

- **Gap detection.** `lastRecordedBlockEnd` scans every stored week's cells, converts
  each `${dayIdx}-${slot}` back to a local start, keeps the latest start at or before
  `now` (so a currently filled block counts), and returns its end. Scanning stored weeks
  instead of a fixed lookback keeps the gap marker stable after days of silence.
- **Threshold.** The nudge is due at `lastRecordedEnd + gapMinutes`. If that moment is in
  the future it is scheduled then; if it has passed (or nothing was ever recorded) it is
  scheduled one minute after `now`.
- **One nudge per gap.** `lastNudgedGapStart` is the stable gap marker (`"never"` when no
  block exists). A matching marker with a future `lastNudgedAt` returns the same id/time
  (`alreadyMarked: true`); once that time passes it returns `null`. Recording a block
  moves the marker and therefore permits exactly one new nudge for the next gap.
- **Quiet hours.** A silenced nudge is not marked, so it can fire after the window. This
  matches feature 19's "suppress means do not schedule" rule.

## Acceptance criteria

| AC | Where satisfied | Test |
|---|---|---|
| AC-1 | `DEFAULT_SETTINGS.unrecorded`; key list unchanged | `unrecordedNudge.test.js` "ships off…", "fills the defaults…", "still reads and writes exactly the eight…" |
| AC-2 | `normalizeUnrecorded` | "falls back to the defaults…", "accepts exactly the three gaps…", "only treats true as enabled…" |
| AC-3 | `nudgeGapText` | "adapts to the configured gap" |
| AC-4 | `lastRecordedBlockEnd` across day/week | "finds a block later the same day", "…previous day", "…previous week" |
| AC-5 | current block + future ignored | "uses the block containing now…", "ignores cells painted in the future" |
| AC-6 | disabled → null | "does nothing while switched off" |
| AC-7 | threshold scheduling + id | "schedules the nudge exactly one gap…", "fires straight away when the gap is already longer…" |
| AC-8 | no data → immediate, `"never"` | "fires once when nothing has ever been recorded" |
| AC-9 | one per gap | "keeps the very same nudge while it is still in the future", "goes quiet for that gap once its scheduled time has passed" |
| AC-10 | recording changes the id | "starts a new nudge when a later block is recorded" |
| AC-11 | quiet filter + body text | "is dropped inside the window and kept outside it"; body assertions in AC-7/8 tests |
| AC-12 | `App.jsx` wiring | "wires the nudge into the App plan before quiet-hours filtering" (source assertion; components are not rendered in this repo's tests) |
| AC-13 | purity + export untouched | "keeps the pure module free of React, DOM, Capacitor and storage", "leaves the export at version 6…" |

## Commands run

```text
npm test --silent
  14 test files passed, 320 tests passed, 0 failed, 0 skipped

bash init.sh
  -> no feature in progress
  [OK] build green, tests green, scope clean
```

## Device-only / deferred

- Actual delivery with the app backgrounded is still a device check, as with every
  notification source; it is deferred to the end of the Notifications v2 goal.
- Features 21 (to-do start/end times + start alert, export v7) and 22 (08:00 morning
  digest) are still to build. The nudge state lives in `settings`, which is not exported,
  so this feature does not bump the export version.
