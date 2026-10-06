# Review — feature 7 week-integrity-fix

**Verdict:** APPROVED
**Spec:** specs/features/007-week-integrity-fix.md
**init:** green — `[OK] build green, tests green, scope clean`, 5 files / 127 tests passed (re-run by the reviewer, not taken from the report)

## The three things that mattered most

**1. No delete can reach `weeks`. Verified independently of the report.**

- `src/components/TasksTab.jsx` — grepped: no `setWeeksP`, no `saveKey`, no `lib/storage`
  import, no `clearTaskIdsFromWeeks`, and no `weeks` identifier in code (the word survives
  only in prose at `:12` and `:188`). The committed version at `HEAD:src/components/TasksTab.jsx:40-43`
  and `:60-65` did both the purge and the global sweep; both functions are gone, replaced by
  `removeTask` (`:67-69` → `retireTask`) and `removeCategory` (`:96-100` → `retireCategory`).
- `src/App.jsx:108` passes only `tasks, categories, setTasksP, setCategoriesP` to `TasksTab`.
- Every writer of `weeks` in the whole tree: `src/lib/useStore.js:109` (`setWeeksP`) is the
  only `saveKey("weeks", …)`. `setWeeksP` is handed to exactly two components —
  `src/App.jsx:100` (`WeekTab`) and `src/components/SettingsTab.jsx:204` (`DataTab`) — and is
  called from `WeekTab.jsx:75` (`applyBrush`), `WeekTab.jsx:190` ("clear this week") and
  `DataTab.jsx:52` (import confirm). None of the three is reachable from retiring a task or a
  category. The bug is fixed structurally, not by a guard.

**2. The re-seed guard hard-stops and cannot write.** `src/lib/useStore.js:50-51` computes
`loadDecision(...)` from all seven reads and returns before the secure-key migration, before
any `setX(...)` of read data and before every `saveKey` (asserted positionally in
`tests/unit/tasks.test.js:325`). Seeding is one branch gated on `seed`
(`useStore.js:75-77`); a fresh install (all seven `ok:true`, all seven empty) still seeds
(`tests/unit/seed.test.js:222`), and the incident's shape — `tasks` empty with a non-empty
`weeks` — does not (`tests/unit/seed.test.js:228`, first case).

**3. `loadKey`'s new `{ ok, value }` has exactly one caller and it was fully updated.**
Grep across `src/` and `tests/`: only `src/lib/useStore.js:38-44`. Every consumer reads
`.value` (`:56, :80, :82, :85, :88, :89, :90, :97`) — no bare `t`/`q`/`w` survives, so
nothing silently reads `undefined`.

**Pins intact.** `tests/unit/reminders.test.js` mtime is 2026-09-16 (untouched; every other
touched file is stamped 2026-09-29 00:22–00:34) and its seven-key assertion at `:284-287` and
`version: 5` assertion at `:273-278` both pass unmodified. `src/components/DataTab.jsx:19`
still exports `version: 5` with the same field list.

## Acceptance criteria

| AC | Verdict | Evidence |
|----|---------|----------|
| AC-1 | PASS | `tests/unit/time.test.js:191` asserts the 168 sum for all four required shapes: empty, all-resolvable (`fullWeek("a1")`), mixed, and 336 unresolvable ids |
| AC-2 | PASS | `tests/unit/time.test.js:205` — unknown hours land in `committedH` (1.5 = 0.5 work + 1.0 unknown), `ambitionH` stays 0.5, `unknownH` is 1, and 0 on a clean/empty week. Implementation `src/lib/time.js:54` |
| AC-3 | PASS | `tests/unit/time.test.js:217` — `freeH` 167.5 and `fmtHM` `"167:30"` |
| AC-4 | PASS | `tests/unit/time.test.js:225` — retired ambition task, 2 cells → `ambitionH` 1, `unknownH` 0, `byCategory.ambition` 1, sum 168. `taskIndex`/`byId` is built from all tasks (`src/lib/time.js:43`) |
| AC-5 | PASS | `tests/unit/time.test.js:236` — duplicate id yields 0.5, not 1; `src/lib/time.js:43` first-entry-wins |
| AC-6 | PASS | `tests/unit/tasks.test.js:187` covers empty (`undefined` and `""`), an active task, a **retired** task (still `kind:"task"` with real name/colour), and an unknown id returning `{kind:"unknown", name:"Unknown task", color:"#52525b", code:"?"}` |
| AC-7 | DEVICE | Declared device-only by the spec. Wiring is right and asserted: `src/components/WeekTab.jsx:127` resolves, `:142` paints `cell.color`, `:148` prints `cell.code` only when `isStart` (`:129`), `:135` titles `${cell.name} · ${slotLabel(s)}` for filled and the bare time for empty. Listed under "Needs checking on the device"; no pixel claim made |
| AC-8 | DEVICE | `src/components/WeekTab.jsx:133` — `tint = filledCell ? null : …`, asserted as wiring at `tests/unit/tasks.test.js:357`. Rendering is device-only and declared so |
| AC-9 | DEVICE | `applyBrush` (`WeekTab.jsx:72-76`) is untouched and keys on the cell, not on the old task, so an unknown cell is paintable/erasable. Device-only and declared |
| AC-10 | DEVICE | `src/components/BalanceTab.jsx:25` pushes one `Unknown` bar in `UNKNOWN_COLOR` iff `unknownH > 0`; asserted as source at `tests/unit/tasks.test.js:361`. The rendered chart is device-only and declared |
| AC-11 | PASS | `tests/unit/tasks.test.js:56` — same length, flag + verbatim `retiredAt`, all siblings deep-equal, input array and objects unmutated |
| AC-12 | PASS | `tests/unit/tasks.test.js:75` — category and both of its tasks flagged with one `at`, nothing removed from either array, other categories/tasks deep-equal, no mutation |
| AC-13 | PASS | `tests/unit/tasks.test.js:228` strips comments and quoted strings before asserting no `setWeeksP`, no `\bweeks\b`, no `clearTaskIdsFromWeeks`, no `lib/storage`, and that the `<TasksTab` line in `App.jsx` carries no `setWeeksP`. Confirmed by hand against the file and against `HEAD` |
| AC-14 | DEVICE | Structural half holds (AC-13): no Tasks-tab path to `weeks` exists, and `WeekTab.jsx:39` passes the **full** arrays to `weekStatsOf`, so the three cards cannot move when a task is retired. The rendered past week is device-only and declared |
| AC-15 | DEVICE | Same structure; picker/chips read `liveTasks` (`WeekTab.jsx:36, 53, 56, 167`). Device-only and declared |
| AC-16 | PASS (helpers) / DEVICE (4 surfaces) | `tests/unit/tasks.test.js:33` proves both helpers filter and preserve order. Surfaces wired at `TasksTab.jsx:104-105`, `WeekTab.jsx:52-57, 167`, `BalanceTab.jsx:21`, asserted as source at `tests/unit/tasks.test.js:345-367`. Rendered output correctly declared device-only |
| AC-17 | PASS (wiring) / DEVICE (arming) | `TasksTab.jsx:139` `arm("delTask" + t.id, …)` uses the same `useArmed()` instance (`:48`) as the category control (`:114`), and `src/lib/useArmed.js:7` is a 4000 ms window. `tests/unit/tasks.test.js:281` pins both `arm(` calls, the unarmed restore, the absence of `arm("restore`, the absence of any `tasks.filter(`/`categories.filter(` purge, and no `window.confirm` in any of nine components |
| AC-18 | PASS | `tests/unit/tasks.test.js:299` pins the exact armed label `"Tap again to remove — past weeks keep it"` on both `title` and `aria-label` (`TasksTab.jsx:140-141`), that the armed category label claims no week clearing, and the footer sentence at `TasksTab.jsx:188` |
| AC-19 | PASS | `tests/unit/tasks.test.js:315` — `nextColor` over a list containing a retired colour skips it, plus source pins on `TasksTab.jsx:82` and `WeekTab.jsx:66` and a negative pin on `nextColor(activeTasks` |
| AC-20 | PASS | `tests/unit/tasks.test.js:95` (newest first), `:105` (no-timestamp last, original order), `:115` (stable for a tie) |
| AC-21 | PASS | `tests/unit/tasks.test.js:126` — `"retired" in`/`"retiredAt" in` both false, deep-equal to the pre-delete object including `weekKey`, siblings untouched, input unmutated. `src/lib/tasks.js:69` destructures the keys away rather than falsifying them |
| AC-22 | PASS | `tests/unit/tasks.test.js:143` — own category un-retired and deep-equal to its original, an unrelated retired category stays retired, the sibling task stays retired |
| AC-23 | PASS | `tests/unit/tasks.test.js:156` — second call deep-equal, and a no-op for a task that is not retired |
| AC-24 | PASS | `tests/unit/tasks.test.js:167` — unknown id returns inputs deep-equal and `restoreTask(undefined, undefined, "x")` throws nothing (`src/lib/tasks.js:66` early return) |
| AC-25 | DEVICE | `TasksTab.jsx:166-186` — rendered only when `retired.length > 0`, collapsed by `showRetired` default `false` (`:43`), each row shows colour swatch, name, `categoryNameOf(t.categoryId)` (spanning retired categories, `:52`) and one restore control. Device-only and declared |
| AC-26 | DEVICE | Two taps: `:168` toggle, `:179` unarmed restore. Device-only and declared |
| AC-27 | DEVICE | `:71-75` persists both arrays through `setTasksP`/`setCategoriesP`; stored shape proven by AC-21/AC-22. Device-only and declared |
| AC-28 | DEVICE | Structurally guaranteed by AC-13 — nothing in this tab can write `weeks`. Device-only and declared |
| AC-29 | PASS | `tests/unit/storage.test.js:30` (`ok:true` + value), `:36` (absent key → `ok:true, value:null`), `:42` (throwing read → `ok:false, value:null`, with other keys still readable in the same session), `:55`. Uses `vi.mock("localforage")` as the spec required. `src/lib/storage.js:36-39` |
| AC-30 | PASS | `tests/unit/seed.test.js:222` — `null`, `undefined`, `[]`, `{}` and `""` all count as empty |
| AC-31 | PASS | `tests/unit/seed.test.js:228` — the incident shape first, then one case per key |
| AC-32 | PASS | `tests/unit/seed.test.js:240` — a failed read for each of the seven keys, and `:249` proves the two flags are never both true |
| AC-33 | PASS | `tests/unit/tasks.test.js:253` — `loadDecision({` present, `!t \|\| !t.length` and `!q \|\| !q.length` both absent, and every non-import `SEED_*` line proven to sit between `if (seed) {` and `} else {` (`useStore.js:75-78`) |
| AC-34 | DEVICE | `useStore.js:78-85`: with content elsewhere the seed branch cannot fire, `normalizeModel([]…)` yields `[]` and `saveKey("tasks", [])` keeps it empty. Device-only and declared |
| AC-35 | PASS (no-write half) / DEVICE (screen) | `tests/unit/tasks.test.js:325` proves the `readFailed` guard precedes the first `saveKey` line, that `App.jsx` skips the reminder effect (`if (loading \|\| storageError) return;`, `App.jsx:53`), that the failure return (`App.jsx:66`) sits after the `loading` return (`App.jsx:61`), and pins the exact copy. The rendered screen is declared device-only |
| AC-36 | PASS | `tests/unit/tasks.test.js:242` — exactly one `saveKey("weeks"` line in `useStore.js` and it is `setWeeksP` (`:109`); no `saveKey` in WeekTab/TasksTab/BalanceTab/DataTab. Confirmed by an independent repo-wide grep |
| AC-37 | PASS | `tests/unit/reminders.test.js:284-287` passes unmodified (file mtime 2026-09-16, 13 days before this work); `loadKey`/`saveKey` literals in `useStore.js` are still exactly the seven keys |
| AC-38 | PASS | `tests/unit/tasks.test.js:274` — the only import is `./time`, and no react/localforage/@capacitor/document/window/saveKey/loadKey token appears. Confirmed by reading `src/lib/tasks.js` |
| AC-39 | PASS | `tests/unit/seed.test.js:189` (pre-feature data gains no `retired` anywhere) plus `tests/unit/tasks.test.js:41` and `:269` (`useStore.js` contains no `retired` token at all, so no load-time backfill exists) |
| AC-40 | PASS | `tests/unit/seed.test.js:137` (flags carried verbatim on tasks and categories) and `:152` (the mandatory idempotency test over retired data) |
| AC-41 | PASS | `tests/unit/seed.test.js:165` — task keeps `categoryId: "old"`, no `basic` category created. `src/lib/seed.js:114` builds `ids` from all categories, retired included |
| AC-42 | PASS | `tests/unit/seed.test.js:174` — `retired` stripped from both structural categories, Ambition first, Open last, every category active. `src/lib/seed.js:73, 105, 109` |
| AC-43 | PASS (envelope + import) / DEVICE (file round trip) | `tests/unit/tasks.test.js:370` pins `version: 5` and the field list against the untouched `DataTab.jsx:19`; `tests/unit/seed.test.js:198` imports a v4 file, a pre-feature v5 file (both fully active) and a post-feature v5 file (task still retired and still listed by `retiredTasks`) |
| AC-44 | PASS | `tests/unit/tasks.test.js:377` — no AI token in `tasks.js` or `TasksTab.jsx`. Reviewed from the diff: the three touched components add no AI call, prompt or AI-gated control; `BalanceTab`'s AI block is still behind the pre-existing `aiEnabled`, and `DEFAULT_SETTINGS.ai.enabled` is still `false` |
| AC-45 | DEVICE | Independently verified: `find android -newermt 2026-09-20` returns nothing — no file under `android/` was touched by this feature (all `android/` diff noise predates the session). The report states plainly that `npm run cap:sync` plus an Android rebuild and reinstall are required and that the user runs the install; nothing here ran `adb` |

45/45 accounted for: 31 proven by passing Vitest tests, 14 device-only exactly as the spec's
Verification section declares (AC-7, 8, 9, 10, 14, 15, 25, 26, 27, 28, 34, 45 in full; the
four surfaces of AC-16, the arming of AC-17, the screen of AC-35, the file round trip of
AC-43 in part). **No criterion claims a test for a rendered result.** Every device row in the
implementer's own table says "device check" and the report opens its device section with
"This repo has **no component tests and none were added**… where a test exists it proves the
wiring underneath, not the pixels." That is the honest framing this feature required.

## The two flagged deviations — judged

**1. "Hours by task" still charts retired tasks plus an `Unknown` bar. Accepted.**
It is what the spec's *Components* section asks for verbatim — "`ambitionTasks` from
`activeTasks`; 'Hours by task' appends one `Unknown` bar when `unknownH > 0`" — and AC-16
enumerates four surfaces, none of which is the chart. It is also the only self-consistent
reading: the chart is fed by `hoursOf` from the same `weekStatsOf` call that produces the
three cards (`BalanceTab.jsx:16`), so filtering retired tasks out of it would make the bars
stop summing to Ambition + Committed and reintroduce exactly the "stops adding up" defect
this feature exists to kill (spec Purpose, decision 4). "Ambition plans this week" *is*
filtered (`BalanceTab.jsx:21`), which is the right cut: a plan is forward-looking, a chart of
a recorded week is not.

**2. AC-33's single branch drops the standalone questions re-seed. Accepted.**
Not a deviation from the spec at all — AC-33 names the `!q || !q.length` test and requires it
gone, and AC-34 establishes the same rule for tasks. The consequence is bounded and
recoverable: an empty question list is not a dead end, because "Edit questions" → "Add
question" is always reachable (`src/components/GuidingTab.jsx:83`). Worth one line in the
release note, nothing more.

## Checkpoints

- C1.1 [x] `./init.ps1` printed `[OK]` on a reviewer re-run (127 tests, 5 files).
- C1.2 [x] Every criterion the spec declares provable names a passing test; the 14 the spec
  declares device-only are listed as such in the report with no coverage implied.
- C1.3 [x] No test deleted, skipped or weakened. `reminders.test.js` untouched (mtime
  2026-09-16) and still 31 passing; test count rose 78 → 127.
- C1.4 [x] All new pure logic (`src/lib/tasks.js`, `loadDecision`, the `weekStatsOf` rewrite)
  has unit tests; `src/lib/tasks.js` is 100% covered by name across `tasks.test.js`.
- C2.1 [x] `init.ps1` reports exactly one in-progress feature: `7 week-integrity-fix`.
- C2.2 [x] Timestamp sweep of the whole tree finds exactly the declared set changed during
  the implementer's window (00:22–00:34): `App.jsx`, `BalanceTab.jsx`, `TasksTab.jsx`,
  `WeekTab.jsx`, `seed.js`, `storage.js`, `tasks.js`, `time.js`, `useStore.js`, and the four
  test files. Nothing undeclared.
- C2.3 [x] No file outside the spec's *Components* + `src/lib/` contract was touched. The
  spec (00:15), `specs/domain-model.md` (00:16) and `feature_list.json` (00:21) all predate
  the implementer's first code edit — it changed no spec, doc or status file.
- C2.4 [x] No opportunistic fix crept in. The three defects it found in passing — `VisionTab`'s
  raw-`tasks` dropdown, `WeekTab.jsx:190`'s `{ cells: {} }`, `DataTab.jsx:31`'s import
  laxity — were left alone and recorded instead. That is the correct call for all three.
- C3.1 [x] No component imports `storage.js` or `localforage`; the only importer is
  `useStore.js:2` (grep-verified).
- C3.2 [x] Every new write goes through a `P` setter: `setTasksP` (`TasksTab.jsx:68`),
  `setTasksP` + `setCategoriesP` (`:73-74`, `:98-99`). No raw `setTasks`/`setCategories`
  outside `useStore.js`.
- C3.3 [x] `src/lib/tasks.js` imports only `./time` and touches no React, DOM or storage
  (AC-38 test). `time.js` and `seed.js` stayed pure.
- C3.4 [x] No native access added.
- C4.1 [x] JS + JSX throughout, no annotations.
- C4.2 [x] Retired section reuses `card`; rows reuse the existing swatch/label idiom; no
  re-derived class strings. `flex-1 min-w-0 truncate` on the one new flexible label
  (`TasksTab.jsx:177`) with `shrink-0` siblings — the overflow rule is respected.
- C4.3 [x] New icons `RotateCcw`, `ChevronRight`, `ChevronDown` from `lucide-react`; the
  `Unknown` bar reuses the existing `recharts`/`TIP` chart untouched.
- C4.4 [x] Both removal controls are two-tap `useArmed`; restore is deliberately unarmed
  (destroys nothing, per spec decision 2); no `window.confirm` anywhere (AC-17 test).
- C4.5 [x] No new entity ids introduced; `uid()` still used for new tasks and categories.
- C5.1 [x] with reason — the stored change is additive-optional (`retired?`, `retiredAt?`),
  `normalizeModel` was extended to carry it and to force-activate the structural categories
  (`seed.js:73, 105, 109`), and the export `version` deliberately stays 5. The spec's
  decision 5 forbids a bump *and* a migration, because absence of the flag already means
  active on every install; AC-43 proves a v4 file and a pre-feature v5 file still import with
  everything active.
- C5.2 [x] with reason — no migration is required, and the "works on old data" property is
  tested rather than asserted: `seed.test.js:189` (pre-feature arrays gain nothing),
  `tasks.test.js:41` and `:269` (no load-time backfill exists), `seed.test.js:152` (the
  mandatory idempotency test over retired data), `seed.test.js:228` (the damaged install's
  actual on-disk shape no longer triggers the seed). This feature's equivalent of a migration
  is the freshness guard, and that is the best-tested part of the diff.
- C5.3 [x] The localForage instance name `"ambitions"` (`storage.js:5`), the legacy `my-time`
  fallback, `appId`, and the `ambition` id + `protected: true` flag are all untouched; AC-42
  now actively defends the Ambition category against being hidden.
- C5.4 [x] No secret path touched. `useStore.js:114` still strips `ai.keys` before any write,
  `mergeSettings` still drops it (`seed.js:168`), and the export field list is unchanged.
- C6.1 [x] The finite week is now *more* true than before: AC-1's four cases prove
  Ambition + Committed + Free is exactly 168:00 even when no cell resolves.
- C6.2 [x] Ambition stays first, protected and undeletable (`TasksTab.jsx:111-112` renders no
  remove control for a protected category; AC-42 keeps it active through every load).
- C6.3 [x] No AI surface added, nothing AI-gated, default still `enabled: false` /
  `provider: none` (AC-44).
- C6.4 [x] No network call added; nothing leaves the device.
- C7.1 [x] Web-only change, `npm run build` green.
- C7.2 [x] with reason — no file under `android/` changed (verified), but the report states
  explicitly that the fix lives in the WebView and needs `npm run cap:sync` plus an Android
  rebuild and reinstall before the phone stops losing data, and that the user runs the
  install. That warning is the most operationally important line in the report: **until the
  APK is rebuilt, the installed app still destroys past weeks on every task delete.**
- C7.3 [x] No new plugin.

## Required changes

None.

## Observations (non-blocking)

1. `src/components/VisionTab.jsx:23` still builds its ambition-link dropdown from the raw
   `tasks` array, so a retired ambition task is still offered there. This is outside the
   spec's *Components* list and outside AC-16's four surfaces, it cannot touch `weeks` or
   `tasks` (VisionTab receives neither setter), and `specs/domain-model.md` § Vision says
   there is no link to an Ambition task at all — feature 6 deletes the control. The
   implementer disclosed it in both the report and `progress/current.md`. It is, however, a
   live divergence from the domain model's "disappears from every list, picker and count", so
   if feature 6 slips, the one-line `activeTasks(tasks)` fix should be picked up rather than
   forgotten. `VisionTab.jsx:79` rendering a retired task's name on an already-linked card is
   correct and should be left alone.
2. `restoreTask` un-retires the task's own category even when the task itself was not
   retired. Unreachable through the UI (a retired category is never rendered, so nothing can
   be added to one) and it is the fail-safe direction, but it is the one branch of AC-23's
   "changes nothing else" that no test exercises. Worth a line if a hand-edited import ever
   becomes a supported path.
3. `BalanceTab.jsx:25` appends a bar literally named `Unknown`; a real task called "Unknown"
   would render two identically named bars. Cosmetic, and only on a week that already has
   orphaned cells.
4. `tests/unit/tasks.test.js:231`'s `\bweeks\b` guard is case-sensitive and relies on the
   footer copy capitalising "Weeks" (`TasksTab.jsx:188`). The assertion is right; it is just
   one lowercase edit away from a confusing red. Adding `/i` and excluding JSX text would
   make the barrier sturdier.
5. `useStore.js:84` still rewrites `tasks` and `categories` on every non-seed load (existing
   behaviour, not introduced here). It is safe today because `normalizeModel` is idempotent
   and proven so, but it is the same class of load-time write that caused the incident, and
   guarding it on "did anything actually change" would cost little.
6. The report's offer of a belt-and-braces `if (storageError) return` inside each `P` setter
   should be declined, as it proposes: `App.jsx:66` makes those lines unreachable, and
   unreachable code no test in this repo can exercise is a liability, not a safeguard.
