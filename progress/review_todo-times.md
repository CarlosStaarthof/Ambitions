**Verdict:** APPROVED

Feature 21 `todo-times`, reviewed against `specs/features/021-todo-times.md` (approved, amended with
"Findings from round 3"), `CHECKPOINTS.md` and the uncommitted diff. The earlier blocker (a same-day
start-time edit left the old alarm pending) is **closed**. Every other AC was already passing.

## Re-review of the earlier Required change 1: closed

- `src/lib/todoTimes.js:40-42`: the id is now
  `notificationIdFor("todo:" + item.id, at, `${at.toISOString()}|${item.updatedAt || ""}`)`.
  The key carries the occurrence instant, so a same-day 09:00 → 10:00 change, or a move to another
  time tomorrow, produces a new id. It also carries `updatedAt`, so a text edit refreshes the
  delivered body. Both inputs are deterministic, so unchanged data keeps the same id across calls
  and runs and `diffSchedule` stays a no-op for it. The item id is still part of the source string,
  so two items at 09:00 do not collide. The id is still a `hash32` value (positive, at most 2147483647).
- `tests/unit/todoTimes.test.js:157-182` (AC-8) asserts:
  - stability across calls (08:00 vs 08:30);
  - different ids between items and between days;
  - **a same-day start-time change gives a different id (:172-173)**;
  - **a text edit with a new `updatedAt` gives a different id (:174-175)**;
  - the integer and range checks.

  The old two-argument pin is gone, and the replacement asserts the intended property. Nothing was weakened.
- Spec: the Contract line (`specs/features/021-todo-times.md:67`) and AC-8 are amended. `## Findings from round 3`
  (`:136-143`) records the reason, which is the findings → amended spec loop HERMES.md §6 asks for.
- Clearing a time or ticking done still cancels the alarm, because the id leaves the plan.

## Gate (rerun for this verdict)

- `npm test --silent`: 15 files, **337 passed**, 0 failed, 0 skipped.
- `bash init.sh`: build green, same 337 tests green, "no feature in progress", last line
  `[OK] build green, tests green, scope clean`. No step skipped.
- `git status` matches the files in `progress/impl_todo-times.md`. There is no `android/`, `package.json`
  or lockfile change. No new localForage key. No test deleted or skipped.

## Acceptance criteria

| AC | Result | Evidence |
|---|---|---|
| 1 | PASS | `src/lib/time.js:109-115`; `tests/unit/todoTimes.test.js:25-39` covers `"7:05"`, `"23:59"`, `""`, null, undefined, `"25:00"`, `"12:60"`, `"nope"` and idempotence. A source-read check pins `time.js` to its single `./seed` import. |
| 2 | PASS | `reminderWall.js:87-93`; test `todoTimes.test.js:43-60` covers keep, drop without dropping the item, no keys on untimed items, `toEqual` on a second run, and no input mutation. |
| 3 | PASS | `reminderWall.js:220-238` (`withTimes`, `addReminder`); test `:62-77`. Errors `text-empty` and `category-missing` are unchanged, and the input is not mutated. |
| 4 | PASS | `reminderWall.js:240-254`; test `:80-97` covers set, change, clear, `createdAt` and `id` preserved, and the archived error unchanged. Gap: no test changes one time while keeping the other. The UI always passes both, so this is non-blocking. |
| 5 | PASS | `reminderWall.js:256-269`; test `:100-110` covers all four labels and `hasTodoTime`. |
| 6 | PASS | `todoTimes.js:14-25`; tests `:114-141` cover before, exactly at, and after the time, invalid input, and the spring-forward day. |
| 7 | PASS | `todoTimes.js:33-50`; test `:144-157` covers one entry per open timed item, done, untimed and invalid-time items excluded, and the sort. |
| 8 | PASS | `todoTimes.js:40-42`; test `:157-182` covers item, day, same-day time change, text edit, stability and range. |
| 9 | PASS | `todoTimes.js:7,43-45`; test `:185-192` covers title, trimmed body, quiet drop and keep. |
| 10 | PASS | `App.jsx:64-67` adds the todo alerts before `filterQuietOccurrences` and before the nudge merge. The effect still depends on `reminderWall` (`App.jsx:87`). Wiring is pinned by source-read regexes (`todoTimes.test.js:195-201`). A time change now produces a new id, so the OS re-plans. Done and cleared items are cancelled. |
| 11 | PASS (code); device check pending | `ReminderWallTab.jsx` has four `type="time"` inputs (counted by the test). The times pass through the add and edit helpers. `ensureNotifyPermission` runs only when a start time is saved, checks first, and swallows errors so the item still saves. Post-it and chart both render `todoTimeLabel`. The spec marks the permission prompt and rendering as device-verified. |
| 12 | PASS | `DataTab.jsx:21` writes `version: 7`. Old v4/5/6 wall data goes through `normalizeReminderWall`. `mergeImportedReminderWall` normalizes, so times round-trip. Test `:215-227`. The v4/5/6 loop only exercises `normalizeReminderWall`, which is non-blocking. |
| 13 | PASS | Test `:230-241` pins the eight store keys, no exact-alarm or AI strings in the touched files, and no alarm permissions in the manifest. The `android/` diff is empty, and `notify.js` is untouched (`allowWhileIdle:false`). |

## Required changes

None.

## Checkpoints

- [x] C1.1 `init.sh` prints `[OK]`.
- [x] C1.2 Every AC has a test. AC-8 now covers the same-day time edit and the text edit.
- [x] C1.3 Version pins went 6→7, which the spec requires. The wall source check went from forbidding `notify` to forbidding `LocalNotifications|syncReminders|schedule(|cancel(|@capacitor`. It still asserts the intended property (the view cannot schedule) and loosens only the permission import this feature needs.
- [x] C1.4 `todoTimes.js` and the new `time.js` and `reminderWall.js` helpers have success and failure tests.
- [x] C2.1 Only feature 21 is `in_review`. The `feature_list.json` diff is status plus a review path.
- [x] C2.2 Files touched match the impl report.
- [x] C2.3 Nothing outside scope changed.
- [x] C2.4 No stray fixes.
- [x] C3.1 No component touches localForage.
- [x] C3.2 The wall still goes through `setReminderWallP`.
- [x] C3.3 `todoTimes.js` imports only `./time` and `./reminders`. `reminderWall.js` imports only `./time`.
- [x] C3.4 `ReminderWallTab` calls the `lib/notify` wrapper, not a plugin.
- [x] C4.1 JS and JSX only.
- [x] C4.2 `inputCls` is reused.
- [x] C4.3 No new icons or charts.
- [x] C4.4 No new destructive action.
- [x] C4.5 No new entities.
- [x] C5.1 `normalizeReminderWall` is extended and the export is bumped to v7.
- [x] C5.2 Absent keys mean untimed, and the spec rules out a migration rewrite. Old wall shapes are tested through `normalizeReminderWall`.
- [x] C5.3 Nothing from the "Never touch" list changed.
- [x] C5.4 No secrets.
- [x] C6.1–C6.4 Untouched. There is no AI surface and no data leaves the device.
- [x] C7.1 Web-only change. `android/` is untouched, so no cap sync is needed.
- [x] C7.2 N/A.
- [x] C7.3 N/A, no plugin added.

## Observations (non-blocking)

- Device checks remain: the permission prompt when a start time is first saved, and delivery at the
  start time with the app backgrounded. If the user grants permission after the save, the sync only
  happens on the next wall change or `visibilitychange` back to visible. Confirm on device.
- `addItem` and `commitEdit` call `ensureNotifyPermission` without `await`. That is intended, and errors
  are swallowed inside its try/catch.
- Because the id now includes `updatedAt`, any edit of an open timed item (even a category change)
  re-schedules its alarm. That is harmless: one cancel and one schedule.
- The AC-12 and AC-13 tests are largely source-read regexes. They are acceptable for wiring.
