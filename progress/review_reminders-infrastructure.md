# Review — feature 3 reminders-infrastructure

**Verdict:** APPROVED
**Spec:** specs/features/003-reminders-infrastructure.md
**init:** green (`[OK]`, 3 files / 76 tests, run by the reviewer at 18:42)

## Scope check (done first, because the tree is dirty)

The working tree carries a large body of uncommitted work predating this feature. I
scoped the review by modification time rather than by `git diff`. Files written after
17:00 on 2026-09-16, excluding build output:

| file | mtime | in scope? |
|---|---|---|
| `specs/domain-model.md` | 18:27:54 | **not this feature** — predates `feature_list.json` → `in_progress` (18:35:07); spec-writer's session |
| `specs/features/003-…md` | 18:29:51 | same — implementer did not edit its own contract |
| `package.json`, `package-lock.json` | 18:35 | declared |
| `src/lib/reminders.js`, `src/lib/notify.js` | 18:35 | declared (new) |
| `src/lib/seed.js`, `src/lib/useStore.js`, `src/App.jsx`, `src/components/SettingsTab.jsx` | 18:36 | declared |
| `android/app/src/main/AndroidManifest.xml` | 18:36 | declared |
| `tests/unit/reminders.test.js` | 18:37 | declared (new) |
| `android/{app/capacitor.build.gradle,capacitor.settings.gradle,app/src/main/assets/**,app/src/main/res/xml/config.xml}` | 18:37:55 | `npm run cap:sync` output; content verified as nothing but the plugin wiring |
| `feature_list.json`, `progress/*` | 18:35–18:41 | harness |

Nothing Vision Board was touched (`src/components/VisionTab.jsx` 2026-08-25 18:59).
`DataTab.jsx` untouched (2026-08-25 19:00). No `.java` touched (all three 2026-08-24).
Nothing on the `AGENTS.md` § Never touch list moved. No scope violation.

`package-lock.json` shows one new entry, `@capacitor/local-notifications@6.1.3` at
`package-lock.json:1735`, with a peer dep only and **no transitive tree** — the other
additions in that diff (vitest and friends) are the harness's own 2026-09-14 work, not
this feature's.

## Acceptance criteria

| AC | Verdict | Evidence |
|----|---------|----------|
| AC-1 | PASS | `package.json:18` `"@capacitor/local-notifications": "^6.1.3"`; resolved 6.1.3 with peer `@capacitor/core ^6.0.0` (`package-lock.json:1735-1743`) — same Capacitor 6 line as the installed core. I ran `./init.ps1` myself: `[OK]`. |
| AC-2 | PASS | `android/app/src/main/AndroidManifest.xml:46` declares `POST_NOTIFICATIONS`. The only other additions to that file are `:51` and `:52`, both `tools:node="remove"`, plus the `xmlns:tools` declaration at `:3` they require. No other `uses-permission` in the file beyond the pre-existing `INTERNET` at `:42`. See the note below on `RECEIVE_BOOT_COMPLETED` / `WAKE_LOCK`. |
| AC-3 | PASS | **Verified independently, not taken on trust.** `android/app/build/intermediates/merged_manifests/debug/processDebugManifest/AndroidManifest.xml` (mtime 18:39, i.e. built *after* the source manifest's 18:36, so it reflects the current source): `grep -c EXACT_ALARM` → `0`; the full permission set is `INTERNET`, `POST_NOTIFICATIONS`, `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`. The library's own manifest, `node_modules/@capacitor/local-notifications/android/src/main/AndroidManifest.xml`, declares exactly `RECEIVE_BOOT_COMPLETED`, `WAKE_LOCK`, `POST_NOTIFICATIONS` and no exact-alarm permission — so the implementer's claim that the two `tools:node="remove"` guards matched nothing is true. |
| AC-4 | PASS | `ls -l android/app/src/main/java/com/carlos/ambitions/` — `MainActivity.java`, `SecureStorePlugin.java`, `FileSaverPlugin.java`, all mtime 2026-08-24, none in today's modified set. `MainActivity.onCreate` still registers only `SecureStorePlugin` and `FileSaverPlugin`. The library's three receivers (`TimedNotificationPublisher`, `NotificationDismissReceiver`, `LocalNotificationRestoreReceiver`) arrive by manifest merge, not by app code. |
| AC-5 | DEVICE | Spec-declared device-only. Listed honestly under "Needs checking on the device"; no test is claimed for it. `cap:sync` ran (the two generated gradle files carry the plugin), but the user still rebuilds and installs. |
| AC-6 | PASS | `tests/unit/reminders.test.js:26` — `reflectionOccurrences(new Date(2026,8,16), 1, …)[0]` equals `new Date(2026,8,27,19,0,0,0)`, with `REFLECTION_HOUR` pinned to 19 in the same case. |
| AC-7 | PASS | `tests/unit/reminders.test.js:33` — 2027-02-25 and 2028-02-26, both 19:00, derived from `reviewWindowStartOf` (`src/lib/reminders.js:15`) anchoring on `new Date(y, m+1, 0).getDate()` rather than a table. |
| AC-8 | PASS | `tests/unit/reminders.test.js:100` asserts length `6 × sources`, every entry `> from`, and strict ascent. The off half is `:109` — `enabled:false`, empty `reminders`, empty settings and `null` settings all return `[]`. |
| AC-9 | PASS | `tests/unit/reminders.test.js:70` — a fully answered 2026-09 is skipped, the list is still length 6, and a whitespace-only answer does not count. `:83` proves `_ai` alone leaves the month unanswered. Lookup in `monthAnswered` (`src/lib/reminders.js:27-32`) is keyed by question id, so `_ai` structurally cannot match. |
| AC-10 | PASS | `tests/unit/reminders.test.js:47` — 24 occurrences from each of three different `from` dates, every one asserted at local hour 19, minute 0, second 0. Occurrences are constructed from local calendar parts (`src/lib/reminders.js:47`), which is what makes the wall clock survive a DST shift. See the observation below on the second DST case. |
| AC-11 | PASS | `tests/unit/reminders.test.js:154` — same source + same day equal across calls and across times-of-day within the day; different day and different source both differ. |
| AC-12 | PASS | `tests/unit/reminders.test.js:168` — 24 months × 2 sources, `new Set(ids).size === ids.length`, every id an integer in `[1, 2147483647]`. |
| AC-13 | PASS | `tests/unit/reminders.test.js:192` — pending equal to plan gives empty `toCancel` and `toSchedule`, and re-running gives the same. |
| AC-14 | PASS | `tests/unit/reminders.test.js:208` — disabling the source and re-planning cancels exactly the six ids and schedules nothing; `:216` proves a stale id is cancelled while wanted ones are left alone. |
| AC-15 | PASS | `tests/unit/reminders.test.js:133` — a synthetic `vision-add` descriptor passed in `sources` is planned with 6 entries alongside the reflection source, and enabling only the new one excludes the old. `plannedReminders` (`src/lib/reminders.js:76-87`) iterates its argument and names no source. |
| AC-16 | PASS | `src/lib/seed.js:114` `mergeSettings`, called on load at `src/lib/useStore.js:86`; `DEFAULT_SETTINGS.reminders` at `useStore.js:20`. Tests: `:226` (pre-feature settings gain `reflection.enabled === false`), `:239` (stored `reflection:{enabled:true}` survives a later-added source, which also appears), `:248` (idempotent over four stored shapes, merged twice and three times). |
| AC-17 | PASS | `tests/unit/reminders.test.js:274` reads `DataTab.jsx` and asserts the payload line is `version: 5` with no `settings` and no `reminders`. `src/components/DataTab.jsx` is untouched by this feature (mtime 2026-08-25 19:00); its v4 path is unchanged — `pendingImport.vision \|\| {}` at `DataTab.jsx:51`. The v4-import half has no new test, but it is a no-change criterion and the file is provably unchanged. |
| AC-18 | PASS | `tests/unit/reminders.test.js:283` parses every `loadKey(`/`saveKey(` literal in `useStore.js` and asserts the set is exactly the seven pre-existing keys. `notify.js` and `reminders.js` import no storage module. |
| AC-19 | DEVICE | Spec-declared device-only, listed honestly. The readable half holds: `requestNotifyPermission` has exactly one call site in the app, `src/components/SettingsTab.jsx:33`, inside the `on === true` branch of `toggle`. Nothing calls it at launch. |
| AC-20 | DEVICE | Spec-declared device-only, listed honestly. Readable half: `SettingsTab.jsx:35-36` returns before `write()` when the result is not `granted`, so the controlled checkbox re-renders unchecked, and `blocked` renders one line at `:62`. No second request on that tap. |
| AC-21 | PASS | Return-value half: `tests/unit/reminders.test.js:304` — under node, `notifySupported()` is `false`, `notifyPermission()` resolves `"denied"`, `pendingReminders()` `[]`, `syncReminders(plan)` and `syncReminders(null)` both `{scheduled:0,cancelled:0}` and neither throws. UI half (spec allows reviewer-read): `SettingsTab.jsx:51` `disabled={!supported}` and `:61` "Reminders need the Android app." `syncReminders` also returns early when permission is not granted (`notify.js:57`) and its whole body is inside `try/catch` (`notify.js:56-76`). |
| AC-22 | PASS | `SettingsTab.jsx:64-66` — "Delivery is best-effort — battery optimisation can delay a reminder or drop it altogether. To make that less likely, set Settings → Apps → Ambitions → Battery → Unrestricted." Grep for notification copy across `src/components/` and `src/App.jsx` returns only `SettingsTab.jsx`; no other string promises delivery. |
| AC-23 | PASS | `grep -rn "addListener" src/` returns nothing — the app subscribes to no notification event, so no stored state or computed value can originate from one. `syncReminders` returns counts and writes nothing. The only writer of reminder state is `store.setSettingsP` from a user tap (`SettingsTab.jsx:25-28`). |
| AC-24 | DEVICE | Spec-declared device-only, listed honestly. The diff half is covered by AC-14's test. |
| AC-25 | DEVICE | Spec-declared device-only, listed honestly. `notify.js:71` passes `allowWhileIdle: false`, pinned by the test at `:296`. |
| AC-26 | DEVICE | Spec-declared device-only, listed honestly. One channel id `reminders`, name "Reminders" (`notify.js:43-48`). |
| AC-27 | DEVICE | Spec-declared device-only, listed honestly. `LocalNotificationRestoreReceiver` is present in the merged manifest (I confirmed it — my first single-line grep missed it because the element spans lines; it is there with `BOOT_COMPLETED` / `LOCKED_BOOT_COMPLETED` / `QUICKBOOT_POWERON`). |
| AC-28 | DEVICE | Spec-declared device-only, listed honestly. No custom intent, no deep link. |

Device-only criteria were listed under "Needs checking on the device" in
`progress/impl_reminders-infrastructure.md` with the explicit sentence "No test in this
repo covers them and none of the tests above should be read as covering them." No test
coverage is claimed for any of the seven. That is the honest statement this repo
requires, and it is also correct — I checked each one against the test file.

## Checkpoints

- C1.1 [x] — I ran `./init.ps1`: build green, 76 tests in 3 files, `[OK]`.
- C1.2 [x] — every non-device criterion names a test above; the seven device-only ones
  were pre-declared as such by the spec's own Verification section.
- C1.3 [x] — `tests/unit/seed.test.js` and `tests/unit/time.test.js` both still carry
  their 2026-09-14 16:21 mtimes; `grep -rn "\.skip|\.todo|xit(" tests/` returns nothing.
  Count went 45 → 76, all additions.
- C1.4 [x] — `src/lib/reminders.js` is entirely covered by `tests/unit/reminders.test.js`;
  `notify.js` is covered as far as an impure wrapper can be (the off-device returns).
- C2.1 [x] — `feature_list.json:35` is the only `in_progress`; `init` confirms.
- C2.2 [x] — with one nit: the `npm run cap:sync` outputs (`android/app/capacitor.build.gradle`,
  `android/capacitor.settings.gradle`, `android/app/src/main/assets/**`,
  `android/app/src/main/res/xml/config.xml`) are not itemised in the report's file list,
  though the report does state cap:sync was run and names what it added. I diffed those
  two gradle files: they contain nothing but `:capacitor-local-notifications` wiring.
  Itemise generated files next time.
- C2.3 [x] — mtime scan above; nothing outside the declared set moved after the feature
  started at 18:35.
- C2.4 [x] — no drive-by fixes; `seed.js`'s only change is the new `mergeSettings` export.
- C3.1 [x] — `grep -rn "localforage|from \"../lib/storage\"" src/components/ src/App.jsx`
  returns nothing.
- C3.2 [x] — `grep -rn "setTasks\(|setWeeks\(|setSettings\(|setReflections\(|setVision\("
  across `src/components/` and `src/App.jsx` returns nothing. `SettingsTab.jsx:25` writes
  through `store.setSettingsP` with the updater form.
- C3.3 [x] — `tests/unit/reminders.test.js:289` pins `reminders.js`'s import list to
  exactly `["./time"]` and asserts no `@capacitor` and no storage reference. There is no
  bare `new Date()` or `Date.now()` in the module — `from` is always supplied, which is
  what makes AC-10 testable at all.
- C3.4 [x] — the plugin is reached only through `src/lib/notify.js`; no component imports
  `@capacitor/local-notifications`.
- C4.1 [x] — JS/JSX only, no annotations.
- C4.2 [x] — `card` reused from `ui.js` (`SettingsTab.jsx:42`); the checkbox markup is the
  same `h-4 w-4 accent-amber-500` as the existing AI toggle at `:115`. The title span
  carries `min-w-0` and the checkbox `shrink-0`, per the overflow rule.
- C4.3 [x] — `Bell` from `lucide-react`. No chart added.
- C4.4 [x] — not applicable: the feature adds no destructive action. No `window.confirm`
  anywhere in the diff.
- C4.5 [x] — not applicable: no new entity ids. Reminder keys are source ids from the
  registry, which is the spec's stated extension point.
- C5.1 [x] — the stored `settings` shape changed and gained a migration (`mergeSettings`).
  The export `version` deliberately stays at 5 because the export does not carry
  `settings` at all — AC-17 requires exactly that, and `DataTab.jsx` is untouched.
- C5.2 [x] — `tests/unit/reminders.test.js:226`, `:239`, `:248`; the idempotency case runs
  the merge two and three times over four stored shapes, including a pre-feature one.
- C5.3 [x] — `storage.js` (instance name `ambitions`), `capacitor.config.json` (`appId`),
  the `ambition` category id and its `protected` flag are all untouched; none appear in
  today's modified set.
- C5.4 [x] — `mergeSettings` strips `ai.keys` (`seed.js:130`) and
  `tests/unit/reminders.test.js:257` proves a plaintext key cannot survive the merge.
  The feature persists only `{enabled: bool}` per source.
- C6.1 [x] — grid untouched.
- C6.2 [x] — category model untouched.
- C6.3 [x] — the Reminders card contains no AI surface: no `callAI`, no prompt, no key,
  and it renders identically with AI off. Reminder text is the fixed `source.body`.
- C6.4 [x] — local notifications make no network call; no new egress.
- C7.1 [ ] — not applicable, and correctly so: this feature touches `android/`, so a web
  build is *not* enough. C7.2 is the one that applies.
- C7.2 [x] — `npm run cap:sync` was run and the report says plainly that nothing reaches
  the phone until the user rebuilds and reinstalls. The implementer ran no `adb` command.
- C7.3 [x] — not applicable: no hand-written plugin was added. `@capacitor/local-notifications`
  self-registers via the generated `capacitor.plugins.json`, and `MainActivity.onCreate`
  is correctly left alone (AC-4 requires it).

## Required changes

None.

## Observations (non-blocking)

1. **The merged permission set gains `WAKE_LOCK`, which the spec did not anticipate.**
   The spec's rationale (lines 47-50) names `RECEIVE_BOOT_COMPLETED` as the expected
   library contribution but not `WAKE_LOCK`. Both come from
   `node_modules/@capacitor/local-notifications/android/src/main/AndroidManifest.xml:17-18`,
   not from the app manifest, so AC-2 (scoped to "that file") and AC-3 (exact-alarm only)
   both pass as written. Worth knowing before the Play listing: both are normal
   install-time permissions with no declaration form, unlike the exact-alarm pair. Not a
   defect, and not something the implementer could avoid without a third `tools:node="remove"`
   that would break the library's boot restore.

2. **The second DST test is close to vacuous.** `tests/unit/reminders.test.js:65`,
   `expect(offsets.size).toBeGreaterThanOrEqual(1)`, can never fail. Its own comment says
   as much and is honest about it, and the load-bearing assertion for AC-10 is the
   `getHours() === 19` check at `:66` and `:53` combined with construction from local
   calendar parts at `src/lib/reminders.js:47`. I am counting AC-10 as proven by those,
   not by the offset line. A `TZ=Europe/Dublin` fixture would make the criterion provable
   on any machine rather than only on one in a DST zone — a reasonable future tightening,
   not a blocker.

3. **"Blocked" copy fires on a dismissed dialog too.** `SettingsTab.jsx:36` sets `blocked`
   whenever the result is not `granted`, including `"prompt"` (user swiped the dialog
   away). The user then reads "Notifications are blocked for Ambitions" when they are
   merely unanswered. Cosmetic, one line, and arguably the safer default; noting it so
   the device pass for AC-20 can judge it.

4. **`notificationIdFor` is a stored contract in disguise**, as the implementer flagged.
   The id is derived, but it is the only link between today's plan and a notification the
   OS accepted last month, so changing `hash32` would orphan every pending notification on
   every installed device. `tests/unit/reminders.test.js:162` pins determinism. Agreed
   with the implementer: treat any change to it as a migration. Feature 6 should also heed
   the note that `diffSchedule` keys only on `(source, day)` — two occurrences from one
   source on one day would collide.

5. **The deviation of putting `mergeSettings` in `seed.js` rather than inline in
   `useStore.js` is the right call**, and matches `docs/conventions.md` § Migrations
   ("extend `normalizeModel()` *or add a sibling*"). Inline in a React hook it would have
   been untestable, and AC-16 demands a test. Behaviour matches the spec's description.

6. **Keeping the two no-op `tools:node="remove"` guards** costs two build warnings and
   buys protection against a future plugin bump silently adding an exact-alarm permission
   — the exact failure that would surface only at Play upload. I would keep them. The
   spec's conditional phrasing permits either choice; the implementer disclosed both the
   deviation and its cost.

7. **The spec and `specs/domain-model.md` were modified today at 18:27 and 18:29**, six
   minutes before the implementer moved feature 3 to `in_progress` at 18:35. I checked
   this specifically: those are the spec-writer's edits, not the implementer rewriting its
   own contract mid-build.
