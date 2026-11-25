# Review — feature 20 `unrecorded-nudge`

**Verdict:** APPROVED

Spec: `specs/features/020-unrecorded-nudge.md` (approved). Report: `progress/impl_unrecorded-nudge.md`.
The report matches the diff. Changed files: `src/lib/nudge.js` (new), `src/lib/reminders.js`,
`src/lib/useStore.js`, `src/components/SettingsTab.jsx`, `src/App.jsx`,
`tests/unit/unrecordedNudge.test.js` (new), plus `feature_list.json` (feature 20 `pending` →
`in_review`, the only semantic change) and `progress/current.md`. Nothing under `specs/**` was
edited by the implementer. No other feature was touched.

## Gate

- `npm test --silent`: **14 test files passed, 320 tests passed, 0 failed, 0 skipped**
  (`tests/unit/unrecordedNudge.test.js`: 23 tests).
- `bash init.sh`: "no feature in progress", the same 14 files / 320 tests, last line
  **`[OK] build green, tests green, scope clean`**. No step reported as skipped.

## Acceptance criteria

| AC | Result | Evidence |
|---|---|---|
| AC-1 defaults, 8 keys, merge | PASS | `useStore.js:30` `DEFAULT_SETTINGS.unrecorded`; load normalisation `useStore.js:116-120`. Tests "ships off…", "fills the defaults for settings stored before…" (also idempotent merge), "still reads and writes exactly the eight localForage keys". `mergeSettings` (`seed.js:219-238`) is untouched and already merges one level deep, so a stored value is not erased. |
| AC-2 normalize | PASS | `nudge.js:15-24`. Tests "falls back to the defaults for nonsense" (undefined/null/string/number/array), "accepts exactly the three gaps…", "only treats true as enabled and is idempotent". |
| AC-3 text | PASS | `nudge.js:26-30`. Test "adapts to the configured gap" (60/90/120/15). |
| AC-4 across day/week | PASS | `nudge.js:38-65`. Tests "later the same day", "previous day", "previous week (Sunday 23:30 seen from Monday)". |
| AC-5 current block, no future | PASS | `nudge.js:55` (`ms > t` skipped). Tests "uses the block containing now…", "ignores cells painted in the future". |
| AC-6 disabled → null | PASS | `nudge.js:79`. Test "does nothing while switched off". |
| AC-7 at / id / catch-up | PASS | `nudge.js:92-93`, `planEntry` `:66-73`. Tests "schedules the nudge exactly one gap after…" (at 11:00, id equals `notificationIdFor("unrecorded", at, gapKey)`, body) and "fires straight away when the gap is already longer…". |
| AC-8 never recorded | PASS | `nudge.js:84-85`. Test "fires once when nothing has ever been recorded" (`gapKey === "never"`, at in (now, now+1min], 90-min body). |
| AC-9 one per gap | PASS | `nudge.js:87-91`. Tests "keeps the very same nudge while it is still in the future" (same id and at, `alreadyMarked`) and "goes quiet for that gap once its scheduled time has passed". |
| AC-10 reset | PASS | Test "starts a new nudge when a later block is recorded" (different id, at 12:00). |
| AC-11 quiet hours | PASS | Test "is dropped inside the window and kept outside it"; body text asserted in the AC-7/8 tests. The filter uses the entry's `at`, not `now` (`App.jsx:63`). |
| AC-12 App wiring | PASS (see obs. 1) | `App.jsx:61-79`: the nudge is added to the plan before `filterQuietOccurrences`; the marker is written only if `!nudge.alreadyMarked` and `plan.some(id match)`; the dependency array (`App.jsx:81`) is unchanged and already includes `settings` and `weeks`. Test "wires the nudge into the App plan…" is a source-regex check, since components are not rendered in this repo's tests. |
| AC-13 purity, export | PASS | `nudge.js` imports only `./seed` and `./reminders`. Tests "keeps the pure module free of React, DOM, Capacitor and storage" and "leaves the export at version 6 without settings". `DataTab.jsx` is untouched. |

## Extra correctness checks (the lead's list)

- **(a) A scheduled nudge cancelled by the settings write that follows it: no bug.**
  Sync 1 schedules the entry, then writes the marker. The write changes `settings`, which re-runs the
  effect. Sync 2 sees the same `gapKey` and a future `lastNudgedAt`, takes `nudge.js:87-91` and returns
  the same id and `at` with `alreadyMarked: true`. The entry stays in the plan, so `diffSchedule`
  cancels nothing, and no second write happens, so there is no loop. Recording a block moves the
  `gapKey` and the old id leaves the plan, so it is cancelled (AC-10). Switching the nudge off yields
  `null` and cancels the pending entry.
- **(b) Quiet hours: correct.** Filtering is by the entry's `at`. A silenced nudge is not marked, so a
  later sync outside the window schedules it at `now + 1 min`. A nudge due inside the window is dropped.
- **(c) Boundaries: correct.** Local starts are built with `new Date(y, m-1, d+dayIdx, h, min)` from the
  Monday key, so month, year and DST rollovers are handled by `Date`. Slot and day ranges are validated.
  Future cells are skipped and the block containing `now` counts.
- **(d) One nudge per gap: correct.** Same marker with a passed `lastNudgedAt` gives `null`. A new
  marker gives one new nudge, and each gap key maps to a stable id.
- **(e) Frozen ids and export: unchanged.** `reminders.js:108-111`: with `key == null` the hashed string
  is exactly `${sourceId}|${isoDate(at)}`, as before. The existing reflection call site
  (`reminders.js:83`) passes two arguments. The export stays `version: 6` and does not carry `settings`.
- **(f) Purity and storage keys.** There is no new localForage key. The `useStore.js` diff only changes
  the `settings` payload.

## CHECKPOINTS

- [x] C1.1 init gate `[OK]` (POSIX `init.sh`; `init.ps1` is the Windows twin)
- [x] C1.2 every AC names a test (AC-12 is regex-level, see obs. 1)
- [x] C1.3 no test deleted, skipped or weakened (`git diff` shows only additions in `tests/`)
- [x] C1.4 new pure logic has unit tests
- [x] C2.1 one feature `in_progress`/`in_review`
- [x] C2.2 touched files are all in the report (it omits only `progress/current.md`, a scratch file)
- [x] C2.3, C2.4 scope clean
- [x] C3.1 no component touches localForage
- [x] C3.2 `setSettingsP` is used
- [x] C3.3 lib stayed pure
- [x] C3.4 not applicable (no new native access)
- [x] C4.1, C4.2 (`card`, `selectCls`), C4.3 (no new icons)
- [x] C4.4, C4.5 not applicable
- [x] C5.1 the change is `settings` only, which is not exported, so no version bump
- [x] C5.2 a pre-feature settings object is covered by the merge test
- [x] C5.3 none of the "never touch" items were touched
- [x] C5.4 no secret is involved
- [x] C6.1–C6.4 unaffected
- [x] C7.1 web-only; no `android/` changes, so no `cap:sync` is needed. Delivery on device is deferred,
  as the report says.

## Required changes

None.

## Observations (non-blocking)

1. **AC-12 test is shallow.** It regex-matches `App.jsx` source and does not prove "mark only if it
   survived filtering and was not already marked". A later cleanup could extract the decision into a pure
   function in `nudge.js` and test it. I reasoned through the sequence above and it holds.
2. **Spec deviation, in the better direction.** The spec says `lastRecordedBlockEnd` returns `null` after a
   "bounded lookback". The implementation scans every stored week (`nudge.js:38-65`). This keeps the gap
   marker stable after long silences, so the nudge does not re-fire on every open after a lookback window
   expires. The report states why. Consider amending the spec text under a "Findings" note. The cost is a
   full scan of the stored weeks on each sync, which is trivial at this data size.
3. **Changing the gap setting while a nudge is pending.** The marker has the same `gapKey`, so the old
   `at` and id are kept. The re-derived body text changes, but the OS keeps the already scheduled
   notification with the old text. If the old nudge has already fired, changing the gap does not fire
   another one for that gap. This is consistent with "one nudge per gap", but it may surprise the user.
4. **Quiet hours changed after marking.** If the user turns quiet hours on after a nudge was marked but
   before it fires, the entry drops out of the plan and is cancelled. The marker still says "sent", so it
   will not retry. This is a rare edge case and fits the spec's best-effort wording.
5. **Marker written before delivery is confirmed.** `syncReminders` can be a no-op, for example with
   permission revoked after enabling. The marker is still written. The spec lists this as out of scope.
6. **`feature_list.json` diff noise.** Unrelated entries had `\uXXXX` escapes rewritten as literal
   characters. The parsed JSON is identical except for feature 20's status, but the diff is hard to read.
   Avoid re-serialising the file next time.
7. The Settings gap labels are an inline ternary (`SettingsTab.jsx:~127`) rather than derived from
   `nudgeGapText`. This is cosmetic and the strings are correct.
