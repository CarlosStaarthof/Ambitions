# Implementation — feature 11 `reminder-wall`

**Spec:** `specs/features/011-reminder-wall.md` (approved, including the 2026-11-18 owner
rulings). **Status:** implemented, awaiting reviewer. Feature 12 not started.

## What changed

| File | Change |
|---|---|
| `src/lib/reminderWall.js` | New pure module: constants, `emptyReminderWall`, `normalizeReminderWall`, `activeReminders`, `archivedReminders`, `categoryUsage`, `addCategory`, `renameCategory`, `deleteCategory`, `addReminder`, `editReminder`, `markDone`, `mergeImportedReminderWall`. |
| `src/lib/useStore.js` | Eighth read/write key `reminderWall`; normalized on load; `setReminderWallP` exposed; seeding still needs all eight reads to succeed and be empty. |
| `src/components/DataTab.jsx` | Export envelope `version: 6` with `reminderWall`; import merges by id then normalizes (omitted fields survive). |
| `src/components/SettingsTab.jsx` | Passes the wall slice and setter to `DataTab`. |
| `src/components/ReminderWallTab.jsx` | New Wall/Archive leaf view: post-its coloured by category, create/edit/tick done, category add/rename/armed delete, filter, empty states. |
| `src/App.jsx` | New `reminders` section id, header label, Wall/Archive sub-tab switch. |
| `src/components/AppMenu.jsx` | One new `Reminders` menu item (`StickyNote`). |
| `tests/unit/reminderWall.test.js` | New tests for AC-1 (source), AC-2 (independence), AC-3–AC-10, AC-14 (merge/source), AC-15 (source). |
| `tests/unit/reminders.test.js` | Pinned export/key assertions updated to version 6 and the eight-key set (not deleted or weakened). |
| `tests/unit/tasks.test.js` | Pinned envelope assertions updated to version 6; field list keeps every old field and appends `reminderWall`. |
| `tests/unit/seed.test.js` | `loadDecision` fixtures include `reminderWall`; a wall with content and a failed wall read both behave like any other key. |
| `feature_list.json` | Feature 11 `in_progress`; specs 011 and 012 marked `approved`. |
| `specs/features/011-reminder-wall.md`, `012-block-notes.md` | Status changed `draft` → `approved` by owner instruction. |

## Acceptance criterion evidence

- AC-1: `tests/unit/reminders.test.js` eight-key pin; `tests/unit/reminderWall.test.js`
  source-read for `loadKey`/`saveKey`/`setReminderWallP`; `seed.test.js` load decision.
- AC-2 / AC-15: source-read test on the pure module and the view: no time-block setters,
  no notifications, no AI, no network.
- AC-3 to AC-10: `reminderWall.test.js` per-function tests, including idempotency,
  non-mutation, the `uncategorized` reassignment, and the idempotent `markDone`.
- AC-14: merge tests (file wins shared id, stored omissions kept, v4/v5 without the field,
  round-trip and idempotency) plus the envelope source-read.
- AC-11, AC-12, AC-13 and the rendered half of AC-2: **device only** — this repo has no
  component tests, so no unit test claims them.

## Gate

```
npm test --silent  → 6 files, 162 tests passed
bash init.sh       → see the run recorded in progress/current.md
```

No open question blocks the feature; all five spec questions already carry the owner's
chosen answer.
