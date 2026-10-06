# Implementation — feature 3 reminders-infrastructure

**Spec:** specs/features/003-reminders-infrastructure.md
**Status:** complete

## Files created

- `src/lib/reminders.js` — pure schedule registry: `REVIEW_WINDOW_DAYS`, `REFLECTION_HOUR`, `HORIZON`, `REMINDER_SOURCES`, `reviewWindowStartOf`, `reflectionOccurrences`, `reminderEnabled`, `plannedReminders`, `notificationIdFor`, `diffSchedule`. Imports only `./time`.
- `src/lib/notify.js` — the impure Capacitor wrapper: `notifySupported`, `notifyPermission`, `requestNotifyPermission`, `pendingReminders`, `syncReminders`. Safe no-op off device; never throws.
- `tests/unit/reminders.test.js` — 31 Vitest cases covering the schedule maths, the id hash, the diff, the settings merge, and the off-device wrapper returns.

## Files modified

- `package.json` / `package-lock.json` — added `@capacitor/local-notifications@^6.1.3` to `dependencies` (resolved 6.1.3; peer `@capacitor/core ^6.0.0`, installed core 6.2.1 — same Capacitor 6 line). One package added, no transitive tree. Capacitor, Vite (5.4.21) and Vitest (2.1.9) untouched.
- `src/lib/seed.js` — added `mergeSettings(defaults, stored)` as a sibling migration next to `normalizeModel`. Merges one level deeper than the old spread so a group-of-groups key (`reminders`) survives a later feature adding a second source; still strips `ai.keys`.
- `src/lib/useStore.js` — `DEFAULT_SETTINGS` gains `reminders: { reflection: { enabled: false } }`; the load-time settings merge now calls `mergeSettings`. No new localForage key, `setSettingsP` remains the only writer.
- `src/App.jsx` — one effect derives the plan from `REMINDER_SOURCES` + `settings` + today and calls `syncReminders`, after the store finishes loading and again on `visibilitychange` → visible. No new Capacitor dependency for lifecycle.
- `src/components/SettingsTab.jsx` — new `RemindersCard`, rendered from `REMINDER_SOURCES`, using `card` from `ui.js` and the existing checkbox style. Requests permission only on switch-on; writes through `store.setSettingsP`.
- `android/app/src/main/AndroidManifest.xml` — added the `tools` namespace, `POST_NOTIFICATIONS`, and `tools:node="remove"` guards for `SCHEDULE_EXACT_ALARM` / `USE_EXACT_ALARM`.
- `feature_list.json` — feature 3 → `in_progress`.
- `progress/current.md` — live session log.

Not touched, deliberately: any `.java`, `MainActivity.java`, the `DataTab` export envelope, `VisionTab.jsx` and anything else Vision Board (feature 6's scope).

## Acceptance criteria

| AC | Where it is satisfied | Test that proves it |
|----|-----------------------|---------------------|
| AC-1 | `package.json:18` `"@capacitor/local-notifications": "^6.1.3"` | `./init.ps1` → `[OK]` (see Verification output) |
| AC-2 | `android/app/src/main/AndroidManifest.xml:46` (`POST_NOTIFICATIONS`); lines 51–52 are the two `tools:node="remove"` entries and nothing else | reviewer reads the diff; merged-manifest grep below |
| AC-3 | Merged manifest `android/app/build/intermediates/merged_manifests/debug/processDebugManifest/AndroidManifest.xml` — `grep -c EXACT_ALARM` = 0. Full permission set: INTERNET, POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED, WAKE_LOCK | mechanical check, output below. **Finding:** 6.1.3 contributes *no* exact-alarm permission — gradle warns both remove-tags matched nothing. Kept anyway as a guard (see Notes). |
| AC-4 | No `.java` created or modified; the three files under `.../com/carlos/ambitions/` still carry their 2026-08-24 mtimes | reviewer reads the diff; merged manifest shows the library's own three receivers |
| AC-5 | `npm run cap:sync` was run (`Found 1 Capacitor plugin for android: @capacitor/local-notifications@6.1.3`) | **device** — see below; the user rebuilds and installs |
| AC-6 | `src/lib/reminders.js:15` `reviewWindowStartOf`, `:36` `reflectionOccurrences` | `tests/unit/reminders.test.js` → "nudges on 27 September 2026 at 19:00 when asked on the 16th" |
| AC-7 | `src/lib/reminders.js:15` (anchored to month end, not a table) | → "tracks month length: 25 February in a common year, 26 February in a leap year" |
| AC-8 | `src/lib/reminders.js:76` `plannedReminders` | → "returns exactly HORIZON future occurrences per enabled source, strictly ascending" and "plans nothing for a source that is switched off or absent from settings" |
| AC-9 | `src/lib/reminders.js:27` `monthAnswered` (lookup is by question id, so `_ai` can never match) | → "skips a month already answered in full and makes the count up later" and "never counts the reserved _ai key as an answer" |
| AC-10 | `src/lib/reminders.js:47` — occurrences are built from local calendar parts, so the wall clock survives a DST shift | → "stays at 19:00 local for 24 consecutive months, across daylight-saving changes" and "really does straddle a daylight-saving transition in a DST zone" (run zone here is Europe/Dublin, which shifts twice inside the span) |
| AC-11 | `src/lib/reminders.js:91` `hash32` + `:100` `notificationIdFor` (keyed on `sourceId` + `isoDate`) | → "gives the same source and calendar day the same id, every time" |
| AC-12 | `src/lib/reminders.js:91` — FNV-1a folded into 1…2147483647 | → "is unique and a positive 31-bit integer across every source over 24 months" (2 sources × 24 months) |
| AC-13 | `src/lib/reminders.js:107` `diffSchedule` | → "does nothing when the pending set already equals the plan" |
| AC-14 | `src/lib/reminders.js:107` | → "cancels every pending id the plan no longer wants" and "cancels a stale occurrence while keeping the ones still wanted" |
| AC-15 | `src/lib/reminders.js:76` iterates the `sources` argument and knows nothing about any particular source | → "plans a source it has never heard of, with no change to plannedReminders" |
| AC-16 | `src/lib/seed.js` `mergeSettings`, called from `src/lib/useStore.js` on load | → "gives settings stored before reminders existed a reflection entry, switched off", "keeps a stored source switched on while adding a source introduced later", "is idempotent — merging an already-merged object changes nothing" |
| AC-17 | `src/components/DataTab.jsx` unchanged — payload is still `{ version: 5, … }` with no `settings`/`reminders` | → "leaves the export envelope at version 5 with no settings or reminders field"; v4 imports still work because `vision` is read as `pendingImport.vision \|\| {}` (existing behaviour, covered by `tests/unit/seed.test.js` normalizeModel cases) |
| AC-18 | `src/lib/useStore.js` — still exactly `tasks`, `categories`, `questions`, `weeks`, `reflections`, `vision`, `settings` | → "reads and writes exactly the seven localForage keys that existed before" (parses every `loadKey`/`saveKey` literal in the file) |
| AC-19 | `src/lib/notify.js` `requestNotifyPermission` is called from exactly one place: `RemindersCard.toggle` in `SettingsTab.jsx`, only on switch-**on**. Nothing at launch. | **device** — no test double exists |
| AC-20 | `SettingsTab.jsx` `RemindersCard.toggle` — a non-granted result returns before `write()`, so the toggle stays off and `blocked` renders one line; no second request on that tap | **device** for the dialog behaviour; the no-write-on-denial path is readable in the diff |
| AC-21 | `src/lib/notify.js` — every function guards on `notifySupported()`; `syncReminders` also returns early when permission is not `granted`, and its whole body is wrapped so it cannot throw. UI half: `SettingsTab.jsx` disables the checkboxes and renders "Reminders need the Android app." when `!supported` | → "is a safe no-op in a desktop browser or under node" (return-value half); UI half by reading the diff |
| AC-22 | `SettingsTab.jsx` — "Delivery is best-effort — battery optimisation can delay a reminder or drop it altogether. To make that less likely, set Settings → Apps → Ambitions → Battery → Unrestricted." No other copy in the app mentions notifications. | reviewer reads the diff |
| AC-23 | Nothing subscribes to a notification event — there is no `addListener` anywhere in `src/`. The only writer of reminder state is `setSettingsP` from a user tap; `syncReminders` writes nothing and returns counts only. | reviewer reads the diff; → "never asks the plugin for an exact alarm" also pins the wrapper's shape |
| AC-24 | `syncReminders` + `plannedReminders(…, HORIZON=6, …)`; the off path plans zero and `diffSchedule` cancels all six | **device** — the diff half is proven by "cancels every pending id the plan no longer wants" |
| AC-25 | `src/lib/notify.js` passes `allowWhileIdle: false`; the plugin's `setExactIfPossible` checks `canScheduleExactAlarms()` on API 31+ and falls back to inexact `AlarmManager.set(RTC, …)` | **device** |
| AC-26 | `src/lib/notify.js` `ensureChannel()` — one channel, id `reminders`, name "Reminders", shared by every source | **device** |
| AC-27 | `App.jsx` re-derives and re-syncs on load and on return to foreground; the library's own `LocalNotificationRestoreReceiver` is in the merged manifest | **device** — requires a real reboot |
| AC-28 | Default tap behaviour; no custom intent, no deep link | **device** |

## Verification output

```
=== Ambitions verification gate ===
-> dependencies present
-> npm run build
-> npm test

 RUN  v2.1.9 C:/Users/User/Documents/Ambitions

 ✓ tests/unit/seed.test.js (15 tests) 24ms
 ✓ tests/unit/time.test.js (30 tests) 34ms
 ✓ tests/unit/reminders.test.js (31 tests) 52ms

 Test Files  3 passed (3)
      Tests  76 passed (76)

-> in progress: 3 reminders-infrastructure

[OK] build green, tests green, scope clean
```

AC-3, the merged-manifest check (not part of `init`):

```
> Task :app:processDebugMainManifest
AndroidManifest.xml:51 Warning: uses-permission#android.permission.SCHEDULE_EXACT_ALARM
  was tagged at AndroidManifest.xml:51 to remove other declarations but no other declaration present
AndroidManifest.xml:52 Warning: uses-permission#android.permission.USE_EXACT_ALARM
  was tagged at AndroidManifest.xml:52 to remove other declarations but no other declaration present
BUILD SUCCESSFUL in 1m 35s

$ grep -o 'android:name="android.permission.[A-Z_]*"' \
    android/app/build/intermediates/merged_manifests/debug/processDebugManifest/AndroidManifest.xml
android:name="android.permission.INTERNET"
android:name="android.permission.POST_NOTIFICATIONS"
android:name="android.permission.RECEIVE_BOOT_COMPLETED"
android:name="android.permission.WAKE_LOCK"

$ grep -c "EXACT_ALARM" .../merged_manifests/debug/processDebugManifest/AndroidManifest.xml
0
```

And the sync that makes it reachable:

```
√ Updating Android plugins in 4.71ms
[info] Found 1 Capacitor plugin for android:
       @capacitor/local-notifications@6.1.3
[info] Sync finished in 0.277s
```

## Needs checking on the device

`npm run cap:sync` has been run, so `android/` is up to date — but **nothing here reaches
the phone until the Android app is rebuilt and reinstalled, and the user runs that
install.** I ran no `adb` command of any kind.

Seven criteria are device-only. No test in this repo covers them and none of the tests
above should be read as covering them:

- **AC-19** — that no permission dialog appears at first launch, or anywhere other than as
  the direct result of switching a reminder on in Settings.
- **AC-20** — denying the permission: toggle stays off, one line of copy appears, no
  second dialog on that tap, every other tab still usable, and relaunching does not
  re-prompt.
- **AC-24** — switch the reflection reminder on, inspect pending notifications, expect 6
  entries on the 27th/28th-ish of the next six months at 19:00; switch it off and expect
  zero for that source.
- **AC-25** — schedule something a few minutes out (temporarily point a source's
  `occurrences` at `now + 2 min`), background the app, screen off, confirm it arrives with
  no `SecurityException` and no "Alarms & reminders" special-access prompt. Revert the
  temporary change before review.
- **AC-26** — Android's notification settings for the app list exactly one channel,
  "Reminders".
- **AC-27** — a real reboot (not a force-stop) with a reminder enabled; reopening the app
  must leave the pending set equal to the freshly derived plan.
- **AC-28** — tapping a delivered reminder opens the app without crashing.

Also unproven by any test, as always in this repo: how the Reminders card looks at 390px,
and that the checkbox is comfortable to hit. It reuses `card` and the same checkbox
markup as the existing AI toggle, so it should match, but that is an argument, not a test.

## Deviations from the spec

- **The `tools:node="remove"` entries were kept even though nothing needed removing.**
  The spec phrases them conditionally ("if the library's own manifest contributes an
  exact-alarm permission"). `@capacitor/local-notifications@6.1.3` contributes none, so
  strictly they could be deleted. I left them in as a guard against a future plugin bump
  quietly adding one — the failure mode the spec is trying to prevent is a Play Store
  declaration problem that nobody would notice until upload. The cost is two build
  warnings, quoted above. If the reviewer would rather have a clean build log, deleting
  both lines is safe today and AC-3 still passes.
- **`mergeSettings` lives in `seed.js`, not inline in `useStore.js`.** The spec says the
  existing merge "must be extended". Extending it in place would have left AC-16
  untestable — `useStore.js` is a React hook. `docs/conventions.md` § Migrations says a
  migration belongs in `seed.js` as a sibling of `normalizeModel` and must have an
  idempotency test, so it went there and `useStore` calls it. Behaviour is the spec's.
- **`mergeSettings` merges two levels deep generically**, rather than special-casing
  `reminders`. `ai` is unaffected (its values are all scalars), and it means feature 6
  needs no merge change at all.
- Nothing else. No export version change, no new storage key, no `.java`, no AI surface.

## Notes for the reviewer

- **The spec's "known unknown" is answered, by reading the plugin source rather than by
  guessing.** `LocalNotificationManager.setExactIfPossible()` checks
  `alarmManager.canScheduleExactAlarms()` on API 31+ and, when it is false, falls back to
  `setAndAllowWhileIdle` / plain `AlarmManager.set(RTC, …)`. So the library does **not**
  require an exact-alarm permission and does not throw without one. AC-25 on the S22 is
  still the confirmation, but there is no escalation to make.
- **`notificationIdFor` is a stored contract in disguise.** The id is derived, not
  persisted, but it is the only link between a plan computed today and a notification the
  OS accepted last month. Changing the hash would orphan every pending notification on
  every installed device (they would never be cancelled, and duplicates would pile up).
  There is a test pinning determinism; treat a change to `hash32` as a migration.
- **`diffSchedule` keys only on id, and the id encodes only (source, day).** Two reminders
  from the same source on the same calendar day would collide, and a change to
  `REFLECTION_HOUR` would *not* reschedule already-pending entries for those days. Both
  are fine under this spec — one occurrence per source per month, fixed hour — but feature
  6 should check it before adding a source that can fire twice in a day.
- **`reflectionOccurrences` has a hard iteration bound** (`count + 240`) rather than
  looping until it has enough. The "skip already-answered months" predicate could in
  principle reject everything; a hang in the store's load path is a worse bug than a short
  list.
- **With no questions on file, nothing counts as answered.** Otherwise "every question is
  answered" would be vacuously true and the reminder would silently switch itself off for
  a user who had deleted their questions. There is a test for it.
- **The sync effect in `App.jsx` depends on `reflections`,** so answering the last question
  of a month re-plans immediately and drops that month's nudge. `diffSchedule` makes the
  common case a no-op, so the extra runs cost one `getPending` call.
- `android/app/build/` is build output and is not committed; the AC-3 evidence above reads
  from it but adds nothing to the tree.
