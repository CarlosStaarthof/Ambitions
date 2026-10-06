# 003 — Local notification infrastructure + monthly reflection reminder

**Feature id:** 3   **Status:** draft
**Depends on:** none. Feature 6 (`vision-board-windows`) depends on this.

## Purpose

The app has no notification capability whatsoever: no plugin in `package.json`, and
`android/app/src/main/AndroidManifest.xml` declares only `INTERNET`. Two features need
recurring local reminders — the monthly reflection nudge (built here) and the Vision
Board windows (feature 6). This builds the capability once, as a registry of pure
schedule functions plus one thin Capacitor wrapper, and proves it with its first
consumer. Without it, feature 6 has nothing to call and the monthly reflection is
something the user has to remember unaided.

## Decisions taken here (with reasons)

**Library, not a third hand-written plugin.** `SecureStorePlugin` and `FileSaverPlugin`
were hand-written because nothing official covers Keystore-wrapped key/value storage or
MediaStore writes to public Downloads. Notifications are the opposite case:
`@capacitor/local-notifications` is first-party, versioned in lockstep with the
`@capacitor/core` already in `dependencies`, and brings no third-party transitive tree —
so it does not violate the low-dependency posture, which is about avoiding sprawl, not
about avoiding the framework's own modules. Hand-rolling would mean writing
`AlarmManager` scheduling, a publish `BroadcastReceiver`, a boot receiver, channel
creation and the API 33 runtime permission in Java: several hundred lines whose only
failure mode — a notification that silently never arrives — is the one thing this repo
cannot unit-test. One first-party dependency buys all of it.

**No exact alarms, ever.** Every reminder this feature schedules is day-granularity and
tolerates minutes of drift, so `POST_NOTIFICATIONS` is the only permission added.
`USE_EXACT_ALARM` / `SCHEDULE_EXACT_ALARM` carry a Play Store declaration and rejection
risk and are out of scope. The wrapper must never pass `allowWhileIdle: true`. If the
library's own manifest contributes an exact-alarm permission, it is stripped in the app
manifest with `tools:node="remove"` — see AC-3, which is checked against the *merged*
manifest, not the source one.

**Permission is requested at the moment of intent, never at launch.** All reminders
default to off. The runtime request fires only when the user turns a reminder on in
Settings. Denial turns the toggle back off and shows one line of copy; nothing else in
the app changes and the request is never repeated unprompted. The app is fully usable
with notifications permanently denied — that is non-negotiable and is AC-20/AC-23.

**Schedules are re-derived, not remembered.** Android drops pending alarms on reboot,
force-stop, and clock changes. Rather than track that, the app recomputes the whole plan
from the current date on every load and every return to the foreground, and reconciles
it against the plugin's pending list via a pure diff. Reboot loss self-heals the next
time the app is opened, and the library's own boot-restore receiver (which needs only
the normal `RECEIVE_BOOT_COMPLETED` permission) covers the gap in between. The app adds
no receiver of its own.

**Nothing new is stored.** Only the on/off preference is persisted, in the existing
`settings` key. The schedule itself is derived; a stored copy of "what is scheduled"
could disagree with the OS after a reboot or a permission revocation and would then be a
lie.

**Delivery is best-effort and the copy says so.** Samsung One UI's background-usage
limits routinely kill scheduled work. The app does not request a battery-optimisation
exemption (that permission attracts the same Play scrutiny we are avoiding). It states
the limitation plainly in Settings and names the One UI path to fix it. No feature
behaviour may depend on a notification arriving.

## Data touched

**Read and written:** `settings` (existing localForage key) only.

`DEFAULT_SETTINGS` in `useStore.js` gains:

```js
reminders: { reflection: { enabled: false } }
```

**Migration:** the existing load-time merge in `useStore` already spreads
`DEFAULT_SETTINGS` under the stored object, so settings written before this feature gain
`reminders` on load with no new code path — but the merge is currently one level deep for
`ai` only and must be extended to merge `reminders` per-source the same way, so that a
stored `{ reminders: { reflection: { enabled: true } } }` does not lose a source added
later. It is idempotent by construction (AC-16).

**No new localForage key is created** (AC-18). **No export shape changes**: the export
envelope in `DataTab` does not include `settings`, so it stays at `version: 5` and gains
no field (AC-17). Reminder preferences are device-scoped — a notification permission and
a delivery schedule belong to a phone, not to a data backup.

## Contract

### `src/lib/reminders.js` — pure, framework-free, no Capacitor, no storage

This is the module feature 6 extends. It must import nothing outside `src/lib/time.js`.

```js
// Constants
export const REVIEW_WINDOW_DAYS = 4;   // last N calendar days of a month (domain rule)
export const REFLECTION_HOUR = 19;     // local hour reminders fire at
export const HORIZON = 6;              // future occurrences scheduled per source

// A reminder source descriptor. This is the whole extension point.
// {
//   id:          string, stable, used in the notification id hash
//   title:       string, notification title
//   body:        string, notification body
//   occurrences: (from: Date, count: number, ctx: object) => Date[]
// }
export const REMINDER_SOURCES = [ reflectionSource ];

// First day of the review window for the month containing `d`, at local midnight.
export function reviewWindowStartOf(d): Date

// Occurrences for the monthly reflection nudge.
// ctx: { reflections, questions }
export function reflectionOccurrences(from, count, ctx): Date[]

// Is this source switched on? Absent source or absent settings => false.
export function reminderEnabled(settings, sourceId): boolean

// The full plan. Pure function of its arguments — `from` is supplied, never `new Date()`.
export function plannedReminders(sources, settings, from, count, ctx):
  [{ id: number, sourceId: string, at: Date, title: string, body: string }]

// Stable positive 31-bit integer id. Same (sourceId, calendar day) => same id, always.
export function notificationIdFor(sourceId, at): number

// Reconciliation against what the OS already holds.
// pending: [{ id }] as returned by the wrapper
export function diffSchedule(pending, plan): { toCancel: number[], toSchedule: [...] }
```

`plannedReminders` returns exactly `count` future occurrences per **enabled** source,
strictly ascending, all strictly after `from`. Disabled sources contribute nothing.

**How feature 6 uses this:** add a descriptor to `REMINDER_SOURCES` and a default entry
to `DEFAULT_SETTINGS.reminders`. Nothing else. The wrapper, the sync loop, the
permission flow and the Settings list all iterate the registry, so a new source needs no
change to `notify.js`, `useStore.js`, or the per-source rendering in `SettingsTab.jsx`
(AC-14).

### `src/lib/notify.js` — the impure wrapper (mirrors `secureStore.js` / `io.js`)

```js
export function notifySupported(): boolean          // Capacitor.isNativePlatform()
export async function notifyPermission(): "granted" | "denied" | "prompt"
export async function requestNotifyPermission(): "granted" | "denied" | "prompt"
export async function pendingReminders(): [{ id: number, at: Date }]
export async function syncReminders(plan): { scheduled: number, cancelled: number }
```

`syncReminders` creates the `reminders` channel if needed, calls `diffSchedule` against
the live pending list, cancels and schedules the difference, and never throws. On web, or
when permission is not `granted`, every function is a safe no-op returning
`"denied"` / `[]` / `{ scheduled: 0, cancelled: 0 }`, so `npm run dev` keeps working.

### Wiring

`useStore` exposes `settings.reminders` and the existing `setSettingsP` is the only
writer. `App.jsx` runs the sync after the store finishes loading and again on
`visibilitychange` → visible. No new Capacitor dependency is added for lifecycle events.

### `android/`

`AndroidManifest.xml` gains `POST_NOTIFICATIONS` under the existing `<!-- Permissions -->`
comment, plus any `tools:node="remove"` needed for AC-3. No new Java file, no change to
`MainActivity`.

## UI states

A "Reminders" section in Settings, rendered from `REMINDER_SOURCES`, using `card` and the
existing control styles from `ui.js`.

- **Empty:** not applicable — the registry always has at least the reflection source.
- **Loading:** while the store is loading, the section does not render (the Settings tab
  already depends on `store.settings`). The permission state is read once on mount; until
  it resolves the toggle is rendered in its stored position and is not disabled — no
  spinner, because reading permission is instant on device and a no-op on web.
- **Error:** turning a reminder on when permission is denied leaves the toggle off and
  shows one line: notifications are blocked and can be re-enabled in the system app
  settings. A scheduling failure is swallowed and surfaces the same way — the app never
  shows a stack trace or a sentinel string.
- **Success:** the toggle is on; below the list, one line states delivery is best-effort
  and may be delayed or dropped by battery optimisation, naming the One UI path
  (Settings → Apps → Ambitions → Battery → Unrestricted).
- **Web / unsupported:** the toggles render disabled with one line saying reminders need
  the Android app.
- **AI disabled:** not applicable. **This feature touches no AI surface** — no prompt, no
  `callAI` call, no key. The Reminders section renders identically with AI off, which is
  the shipping default.

## Acceptance criteria

1. AC-1: `@capacitor/local-notifications` is listed in `dependencies` in `package.json` at a version range matching the installed Capacitor 6 line, and `./init.ps1` prints `[OK]` (build plus tests green) after installation.
2. AC-2: `android/app/src/main/AndroidManifest.xml` declares `android.permission.POST_NOTIFICATIONS`, and no other new permission is added to that file except a `tools:node="remove"` entry.
3. AC-3: After a debug build, the merged manifest under `android/app/build/intermediates/merged_manifests/` contains neither `android.permission.SCHEDULE_EXACT_ALARM` nor `android.permission.USE_EXACT_ALARM` — if the library contributes either, it is stripped with `tools:node="remove"` in the app manifest.
4. AC-4: No new `.java` file is added under `android/app/src/main/java/com/carlos/ambitions/`, and `MainActivity.java` is unchanged — the library supplies the receivers, the app registers none of its own.
5. AC-5: Nothing in this feature reaches the device until `npm run cap:sync` is run and the Android app is rebuilt and reinstalled; a web-only `npm run build` leaves the installed APK without `POST_NOTIFICATIONS` and without the notification channel.
6. AC-6: `reflectionOccurrences` with `from = 2026-09-16` returns a first occurrence of 2026-09-27 at 19:00 local — the first day of that month's last-4-day review window.
7. AC-7: The review-window anchor tracks month length: the occurrence for February 2027 is 2027-02-25 and for the leap February 2028 is 2028-02-26, both at 19:00 local.
8. AC-8: `plannedReminders(sources, settings, from, 6, ctx)` returns exactly 6 entries per enabled source, strictly ascending in time, every one strictly after `from`, and zero entries for a source whose `settings.reminders[id].enabled` is false or absent.
9. AC-9: A month whose reflections already contain a non-empty trimmed answer for every question in `questions` produces no occurrence; the returned list still has the requested count, extending into later months to make it up. The reserved `_ai` key is never counted as an answer.
10. AC-10: Every occurrence has local hour 19 and local minute 0 for all 24 consecutive months following any supplied `from`, including months containing a daylight-saving transition.
11. AC-11: `notificationIdFor` is deterministic — the same `sourceId` and the same calendar day always return the same integer, across separate calls and separate runs.
12. AC-12: Across all registered sources over a 24-month horizon, every generated notification id is unique and is an integer in the range 1 to 2147483647 inclusive.
13. AC-13: `diffSchedule` is idempotent — given a pending list that already equals the plan, both `toCancel` and `toSchedule` are empty.
14. AC-14: `diffSchedule` returns in `toCancel` every pending id absent from the plan, so disabling a source and re-planning yields a diff that cancels exactly that source's occurrences and schedules nothing.
15. AC-15: A synthetic source descriptor passed in the `sources` argument of `plannedReminders` is planned with no change to `plannedReminders` itself — registering a new recurring reminder requires only a descriptor plus a default entry in `DEFAULT_SETTINGS.reminders`.
16. AC-16: A `settings` object stored before this feature (no `reminders` key) loads with `reminders.reflection.enabled === false`; a stored object that has `reminders.reflection` but not a source added later loads with both present and the stored value preserved; running the load merge twice changes nothing.
17. AC-17: The export envelope is unchanged — still `version: 5`, still with no `settings` or `reminders` field — and a `version: 4` export still imports without error.
18. AC-18: No new localForage key is created; the set of keys read and written by `useStore` is exactly the seven that existed before.
19. AC-19: On a fresh install, no notification permission dialog appears at first launch or on any screen other than as the direct result of switching a reminder on in Settings. (Device.)
20. AC-20: Denying the permission leaves the toggle off, shows one line pointing at the system app settings, shows no second dialog on that tap, and leaves every other tab fully usable; relaunching the app does not re-prompt. (Device.)
21. AC-21: With permission denied, unsupported, or running in a desktop browser, `syncReminders` returns `{ scheduled: 0, cancelled: 0 }` and throws nothing, and the Settings section renders with disabled toggles and one line explaining reminders need the Android app.
22. AC-22: The Settings copy states that delivery is best-effort and may be delayed or dropped by battery optimisation, and names the One UI path to mark the app unrestricted. No copy anywhere promises or implies guaranteed delivery.
23. AC-23: With notifications never delivered — permission denied for the whole session — every other feature behaves identically; no stored state, window, or computed value anywhere in the app is produced by a notification firing.
24. AC-24: On device, switching the reflection reminder on and then inspecting pending notifications shows 6 entries at the expected dates; switching it off leaves zero pending entries for that source. (Device.)
25. AC-25: On device, a reminder scheduled a few minutes ahead arrives with the app backgrounded and the screen off, with no `SecurityException` and without the system ever asking for the "Alarms & reminders" special access. (Device.)
26. AC-26: On device, Android's notification settings for the app list a single channel named "Reminders". (Device.)
27. AC-27: On device, after a reboot with a reminder enabled, opening the app leaves the pending set equal to the freshly derived plan for the current date — past occurrences gone, the next 6 present. (Device.)
28. AC-28: On device, tapping a delivered reminder opens the app without crashing; it is not required to land on any particular section.

## Verification

**A Vitest unit test in `tests/unit/reminders.test.js` can prove:** AC-6, AC-7, AC-8,
AC-9, AC-10, AC-11, AC-12, AC-13, AC-14, AC-15, AC-16 (against `normalizeModel`/the
settings merge, with the idempotency half mandatory per `docs/conventions.md`), AC-17,
and the return-value half of AC-21. All of these are pure functions of a supplied `from`
date, which is exactly why the schedule logic lives in `src/lib/` — none of them wait for
a real calendar date to arrive.

**A reviewer can confirm by reading the diff:** AC-1, AC-2, AC-4, AC-18, AC-22, AC-23,
and the UI half of AC-21. AC-3 needs one debug build and a grep of the merged manifest —
mechanical, but not a unit test.

**Only a physical device can confirm:** AC-5, AC-19, AC-20, AC-24, AC-25, AC-26, AC-27,
AC-28. The permission dialog, actual delivery, channel registration and post-reboot
behaviour have no test double in this repo — there are no component tests and no
instrumentation tests, and pretending otherwise would be worse than the gap. AC-25 is
checked by temporarily pointing a source's `occurrences` at `now + 2 minutes`, running on
the Galaxy S22 with the app backgrounded and the screen off, and reverting before review.
AC-27 requires an actual reboot; a force-stop is not a substitute.

**Known unknown for the implementer, not a domain question:** whether the installed
version of `@capacitor/local-notifications` reaches `AlarmManager` by an exact path when
`allowWhileIdle` is false. AC-3 plus AC-25 together are the check. If the library turns
out to be unable to schedule at all without an exact-alarm permission, that is a finding
to escalate, not a licence to add the permission.

## Out of scope

- **Exact-alarm block-start reminders.** Notifying at the start of a scheduled grid cell
  needs `USE_EXACT_ALARM` / `SCHEDULE_EXACT_ALARM` and a Play declaration. It is listed
  as still open in `specs/domain-model.md` and stays there.
- **Everything belonging to feature 6.** The Vision Board add/review window gates, their
  reminder descriptors, their Settings entries and their migration are feature 6's spec.
  This feature ships the registry and one consumer, nothing vision-related.
- **iOS.** No `ios/` platform exists. The wrapper must not branch on iOS.
- **A user-configurable reminder time or day.** The hour is the `REFLECTION_HOUR`
  constant. No time picker.
- **Weekly or per-task reminders**, targets nagging, streaks, or any completion tracking —
  excluded by the product brief's non-goals.
- **Deep-linking a notification tap to a specific tab or month.** Tapping opens the app;
  routing it further is a later change.
- **Requesting a battery-optimisation exemption**, or any other special-access permission.
- **Notification actions, grouping, custom sounds, icons, or a quiet-hours setting.**
- **Any AI involvement.** Reminder text is a fixed string; nothing here calls a provider.

## Open questions

None that block implementation. Two product preferences the user may want to override
before or during the build, each a one-line change:

- `REFLECTION_HOUR = 19` and `HORIZON = 6` are chosen defaults, not domain rules. The
  review-window anchor itself *is* a domain rule (last 4 calendar days of a month,
  `specs/domain-model.md` § Vision Board windows) and is not up for change here.
- Skipping the reminder for a month whose questions are all already answered (AC-9) is a
  judgement call in the reflection source's `occurrences`. If the user would rather be
  reminded regardless, it is a deletion of one predicate and its test.
