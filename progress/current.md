# Current session

**Date:** 2026-11-25
**Goal (owner):** Ambitions — Notifications v2. In Settings > Notifications:
1. Unrecorded-time nudge: toggle, gap 1h default (1h/1.5h/2h), one nudge per gap,
   message adapts, resets when a block is recorded.
2. Quiet hours 23:00–07:00 editable, suppress all notifications.
3. To-dos get optional start and end time; start time schedules a local notification.
4. Morning digest 08:00 editable + toggle, listing open to-dos with no time.
Use Capacitor Local Notifications, reschedule on app open and data change, ask Android
13+ permission, keep the monthly reflection reminder, bump the export version if the
to-do schema changes.

**Work split (owner goal → features):**
- 19 `notifications-preferences` — **done** (round 1). Quiet hours + filtered plan +
  data-change rescheduling. Review: `progress/review_notifications-preferences.md`.
- 20 `unrecorded-nudge` — **in_review** (round 2, approved by reviewer).
- 21 `todo-times` — **in_review** (round 3, reviewer APPROVED, device checks pending).
  Start/end on wall items, start alert, export v7. Review:
  `progress/review_todo-times.md`.
- 22 `morning-digest` — **in_review** (round 4). Open to-dos with no start time, 08:00
  editable + toggle, quiet-filtered. Spec `specs/features/022-morning-digest.md`; report
  `progress/impl_morning-digest.md`.

Features 11, 12, 13 and 15 remain `in_review` (device checks pending). 14, 16 and 19
are `done`.

## Round 1 — notification preferences and quiet hours (feature 19, done)

- `src/lib/time.js`: `normalizeClock`, `minutesOfClock`, `normalizeQuietHours`,
  `inQuietHours` (pure, start inclusive / end exclusive, wrap-safe, disabled and
  `start === end` mean no window).
- `src/lib/reminders.js`: `filterQuietOccurrences(plan, quietHours)` — new array, order
  kept, input untouched. Module still imports only `./time`.
- `src/lib/useStore.js`: `DEFAULT_SETTINGS.quietHours = { enabled: true, start:
  "23:00", end: "07:00" }`; normalized on load and on every `setSettingsP` write.
- `src/components/SettingsTab.jsx`: card renamed Notifications; Quiet hours switch +
  two `type="time"` inputs; copy says all notifications are silenced in the window and
  it may cross midnight.
- `src/App.jsx`: plan filtered through `filterQuietOccurrences` before `syncReminders`;
  effect re-runs on `reminderWall`/`weeks` in addition to the existing deps.
- Tests: `tests/unit/quietHours.test.js` (20). Gate: `npm test --silent` → 13 files,
  297 tests; `bash init.sh` → `[OK]`.
- No stored-shape change beyond `settings`, so no export version bump (still `version:
  6`, `settings` never exported).

## Round 2 — unrecorded-time nudge (feature 20, in_review)

- Spec `specs/features/020-unrecorded-nudge.md` written and approved by the owner's
  four requests; implementation report `progress/impl_unrecorded-nudge.md`.
- `src/lib/nudge.js`: pure `normalizeUnrecorded`, `nudgeGapText`,
  `lastRecordedBlockEnd`, `unrecordedNudge`; scans stored weeks for the latest painted
  30-min block and schedules the nudge at `lastRecordedEnd + gap` (or immediately when
  overdue / never recorded).
- One nudge per gap via `settings.unrecorded.lastNudgedGapStart` + `lastNudgedAt`;
  recording a block moves the marker. A nudge silenced by quiet hours is not marked.
- `notificationIdFor(source, at, key?)` keeps frozen reflection ids; the nudge ids key
  on the gap marker.
- Settings → Notifications: Unrecorded time toggle, 1 h / 1.5 h / 2 h select, copy.
- `App.jsx` merges the nudge into the plan before `filterQuietOccurrences` and
  persists the marker only when it survives the quiet filter.
- Tests: `tests/unit/unrecordedNudge.test.js` (23). Gate: 14 files, 320 tests;
  `bash init.sh` → `[OK]`.
- No export version bump: only `settings` changed and it is not exported.

## Round 3 — optional to-do times and start alert (feature 21, in_review)

- Spec `specs/features/021-todo-times.md`; report `progress/impl_todo-times.md`.
- `src/lib/time.js`: `normalizeOptionalClock` (valid `HH:MM`, else `null`).
- `src/lib/reminderWall.js`: optional `startTime`/`endTime` on wall items; add/edit set,
  change and clear them; `hasTodoTime`, `todoTimeLabel`; load normalisation keeps valid
  times and drops invalid ones.
- `src/lib/todoTimes.js` (new, pure): `nextStartAt` (today if strictly ahead, else
  tomorrow; local parts survive DST) and `plannedTodoAlerts` (one entry per open timed
  item, id from `notificationIdFor("todo:" + id, at)`, sorted).
- ReminderWallTab: optional Start/End inputs in the new and edit forms; permission asked
  at the moment a start time is saved; post-it shows the range. TodoChart card shows it.
- `App.jsx`: todo alerts join the plan before `filterQuietOccurrences` (and before the
  nudge); the existing `reminderWall` dep re-plans on wall edits.
- `DataTab.jsx`: export envelope `version: 7`, same fields. Existing version-pin tests
  updated to 7. The wall test that forbade any notification import now forbids scheduling
  calls only — the view must ask permission, App still owns scheduling.
- Tests: `tests/unit/todoTimes.test.js` (17). Gate: 15 files, 337 tests;
  `bash init.sh` → `[OK]`. Reviewer required one fix: the alert id now also encodes the
  occurrence and `updatedAt`, so a same-day start-time or text edit re-schedules instead
  of leaving the old alarm pending; spec AC-8 amended, re-review APPROVED.

## Round 4 — morning digest (feature 22, in_review)

- Spec `specs/features/022-morning-digest.md`; report
  `progress/impl_morning-digest.md`.
- `src/lib/morningDigest.js` (new, pure): `normalizeDigest`, `digestItems`,
  `plannedMorningDigest`. One entry at the next local occurrence of the configured time;
  body lists each open untimed to-do; id encodes the occurrence and listed content so an
  edited list replaces the pending alarm instead of leaving a stale body.
- `DEFAULT_SETTINGS.digest = { enabled: false, time: "08:00" }`; normalised on load and
  on every settings write. Still eight localForage keys.
- Settings → Notifications: Morning digest toggle (permission at intent), editable time,
  copy. `App` merges the digest into the plan before quiet hours.
- Tests: `tests/unit/morningDigest.test.js` (15). Gate: 16 files, 352 tests;
  `bash init.sh` → `[OK]`.
- No export bump: only `settings` changed and it is never exported.

## Next round (planned)

- Review feature 22 and the accumulated device checks for 20, 21 and 22. No new
  Notifications v2 source remains.
- Device checks accumulate for the end of the goal (delivery with app backgrounded,
  permission prompt when a start time is first set or the digest/nudge is enabled).

## Still open from the earlier goal

- Feature 17 `app-language` remains blocked on the owner's language list and AI answer
  template. Do not guess either.

## New owner goal (2026-11-25) — main menu order (feature 18)

**Goal:** drawer order becomes Plan & Balance, To-Do's Chart, Vision Board, Records,
Settings.

- Spec `specs/features/018-menu-order.md` (was referenced by `feature_list.json` but
  missing); report `progress/impl_menu-order.md`.
- `src/components/AppMenu.jsx`: reordered `ITEMS` only. Labels, ids, icons and every
  other component unchanged. No stored shape, key or export version touched.
- `tests/unit/menuOrder.test.js` (4) asserts the order, one occurrence per label, the
  unchanged ids and the unchanged header-label mapping in `App.jsx`.
- Status `pending` → `in_review`. Gate: `npm test --silent` → 17 files, 356 tests;
  `bash init.sh` → `[OK]`.
- Remaining: reviewer approval; then the leader marks feature 18 `done`. Web-only change,
  so no `cap:sync` and no device check beyond opening the drawer.

## New owner goal (2026-11-25) — Records groups tabs by section (feature 23, round 1 of 5)

**Goal:** Records contains information about the other tabs; its sub-tabs are named after
the section they serve. Tasks and Questions fall under **Plan & Balance**, and the old
**Reminders** sub-tab becomes **To-Do's**. Vision Board is named as a future example.

- Spec `specs/features/023-records-tabs.md`; report `progress/impl_records-tabs.md`.
- `src/App.jsx`: Records top-level tabs `Plan & Balance` / `To-Do's`; `Tasks` and
  `Questions` nested under Plan & Balance; `Manage` / `Archive` nested under To-Do's with
  `ReminderWallTab` unchanged. `SubTabs` gained an optional `nested` flag (dims/indents
  the inner bar only). New local state `recordsSub` (default `plan`).
- `tests/unit/recordsTabs.test.js` (6) asserts the arrays, mounts, unchanged menu/header
  labels, no storage surface and both nested bars. `tests/unit/todoChart.test.js` updated
  where it pinned the old flat `Tasks / Questions / Reminders` array; intent unchanged.
- Status `pending` → `in_review`. Gate: `npm test --silent` → 18 files, 362 tests;
  `bash init.sh` → `[OK]`.
- Remaining: reviewer approval; then the leader marks feature 23 `done`. Web-only change,
  so no `cap:sync`; device check is only reading the two tab levels at 390 px.
- Deferred: a Vision Board sub-tab inside Records, until it has a management surface.

