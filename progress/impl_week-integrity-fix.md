# Implementation — feature 7 week-integrity-fix

**Spec:** specs/features/007-week-integrity-fix.md
**Status:** complete

Deleting a task no longer writes the `weeks` key. It retires the task, which is
reversible from a new collapsed **Retired** section. A failed storage read hard-stops the
app instead of re-seeding over real data. A cell whose id resolves to nothing is now
visible as a zinc `?` block instead of looking like empty time. No new localForage key,
no `weeks` shape change, no load-time rewrite of `weeks`, export still `version: 5`.

## Files created

- `src/lib/tasks.js` — the whole feature's decisions as pure functions: `isRetired`,
  `activeTasks`, `activeCategories`, `retiredTasks`, `retireTask`, `retireCategory`,
  `restoreTask`, `taskIndex`, `resolveCell`, `UNKNOWN_COLOR`. Imports `./time` only.
- `tests/unit/tasks.test.js` — 30 tests: the retire/restore transforms, cell resolution,
  and the source-reading structural guarantees (the pattern
  `tests/unit/reminders.test.js` § "what this feature did not change" already uses).
- `tests/unit/storage.test.js` — 4 tests with `vi.mock("localforage")` so the stubbed
  `getItem` can throw, proving `loadKey` no longer reports a failed read as "no data".

## Files modified

- `src/lib/time.js` — `weekStatsOf` now walks the cells through an id→task map instead of
  iterating `tasks`. Unknown cells count as Committed (domain rule 2) and are reported as
  `unknownH` / `unknownIds`. Signature unchanged; a duplicate id can no longer
  double-count; the three cards sum to exactly 168 in every case.
- `src/lib/storage.js` — `loadKey(key)` returns `{ ok, value }`. Swallowing the exception
  is the root cause of the re-seed, and the same swallow would let one paint overwrite the
  whole `weeks` key. `saveKey` unchanged. The call shape `loadKey("x")` / `saveKey("x")`
  in `useStore` is deliberately unchanged so the seven-key assertion still reads it.
- `src/lib/seed.js` — added `loadDecision(reads)` (fresh install vs. failed read) and
  `unretired`, so `normalizeModel` returns `ambition` and `open` active while carrying
  `retired` / `retiredAt` through untouched. Added the comment recording why a
  retired-but-present category never triggers the `Basic` re-home.
- `src/lib/useStore.js` — one seeding branch gated on `loadDecision(...).seed`; the old
  `!t || !t.length` and `!q || !q.length` tests are gone; `storageError` is returned from
  the hook and short-circuits the load **before** the secure-key migration, before any
  read reaches state and before any `saveKey`.
- `src/App.jsx` — storage-failure screen immediately after the `loading` return; the
  reminder reconciliation effect returns early in that state; `setWeeksP` is no longer
  passed to `TasksTab`; imports `card` from `lib/ui`.
- `src/components/TasksTab.jsx` — `clearTaskIdsFromWeeks` and the `setWeeksP` prop
  **deleted**. `deleteTask` → `removeTask` (`retireTask`) behind
  `arm("delTask" + t.id, …)`; `deleteCategory` → `removeCategory` (`retireCategory`).
  Lists render `activeCategories` / `activeTasks`. New collapsed **Retired** section
  driven by `retiredTasks`, one unarmed restore control per row calling `restoreTask` and
  persisting both returned arrays. Armed copy and footer copy state the new semantics.
- `src/components/WeekTab.jsx` — the grid resolves every cell with `taskIndex(tasks)` +
  `resolveCell` over **all** tasks; picker, chips and counts use the active lists; tints
  paint only on `kind === "empty"`; `weekStatsOf` still gets the full arrays so a retired
  task keeps counting. `codeFor` import dropped (the code now comes from `resolveCell`).
- `src/components/BalanceTab.jsx` — `ambitionTasks` from `activeTasks`; one aggregate
  `Unknown` bar (`#52525b`) appended to "Hours by task" when `unknownH > 0`.
- `tests/unit/time.test.js` — 6 new tests for AC-1 to AC-5 plus the diagnostics list.
- `tests/unit/seed.test.js` — 13 new tests: `loadDecision`, retirement passthrough and
  idempotency, the retired-category re-home case, the structural categories, and the
  import halves of AC-39 / AC-43.

**Not touched on purpose:** `tests/unit/reminders.test.js` (AC-37 requires its existing
assertion to pass unmodified — it does), `src/components/DataTab.jsx` (envelope stays
`version: 5`; the new fields ride inside `tasks`), anything under `android/`.

## Acceptance criteria

| AC | Where it is satisfied | Test that proves it |
|----|-----------------------|---------------------|
| AC-1 | `src/lib/time.js:37` | `tests/unit/time.test.js` → "always splits the finite week into exactly 168 hours" (empty, all-resolvable, mixed, all-336-unknown) |
| AC-2 | `src/lib/time.js:54` | `tests/unit/time.test.js` → "counts a cell whose task cannot be resolved as Committed, never as Ambition" |
| AC-3 | `src/lib/time.js:59` | `tests/unit/time.test.js` → "lets an unresolvable cell consume free time like any other" (`fmtHM` → `167:30`) |
| AC-4 | `src/lib/time.js:42` (the map holds every task, retired included) | `tests/unit/time.test.js` → "counts a retired task exactly like an active one" |
| AC-5 | `src/lib/time.js:42` (first entry wins per id) | `tests/unit/time.test.js` → "counts a cell once even when two tasks share an id" |
| AC-6 | `src/lib/tasks.js:93` `resolveCell` | `tests/unit/tasks.test.js` → "tells empty, a task, and an id that is in no task apart" |
| AC-7 | `src/components/WeekTab.jsx:122-150` | **device check** — see below. Wiring only: `tests/unit/tasks.test.js` → "wires every editing surface to the active lists and the grid to all tasks" |
| AC-8 | `src/components/WeekTab.jsx:133` (`tint = filledCell ? null : …`) | **device check** — see below. Wiring asserted in the same test |
| AC-9 | `src/components/WeekTab.jsx:72` `applyBrush` (unchanged) | **device check** — see below |
| AC-10 | `src/components/BalanceTab.jsx:25` | **device check** — see below. The `unknownH > 0` push is asserted in "wires every editing surface…" |
| AC-11 | `src/lib/tasks.js:44` `retireTask` | `tests/unit/tasks.test.js` → "keeps the task, flags it, and stores the supplied timestamp verbatim" |
| AC-12 | `src/lib/tasks.js:51` `retireCategory` | `tests/unit/tasks.test.js` → "retires a category together with every task in it, and nothing else" |
| AC-13 | `src/components/TasksTab.jsx` (no `setWeeksP`, no `weeks`), `src/App.jsx:108` | `tests/unit/tasks.test.js` → "leaves the Tasks tab no route to the weeks key at all" (comments and string literals stripped, so prose about weeks cannot hide code) |
| AC-14 | Structural: no Tasks-tab path to `weeks` (AC-13) | **device check** — see below |
| AC-15 | Structural: no sweep at all; picker uses `activeTasks` | **device check** — see below |
| AC-16 | `src/lib/tasks.js:24-25`; surfaces at `TasksTab.jsx:104-105`, `WeekTab.jsx:35-37,52-56,167`, `BalanceTab.jsx:21` | Pure halves: `tests/unit/tasks.test.js` → "drops retired tasks and categories from the active lists, keeping order". The four rendered surfaces are **device** (wiring asserted in "wires every editing surface…") |
| AC-17 | `src/components/TasksTab.jsx:139-142` | `tests/unit/tasks.test.js` → "arms both removal controls and introduces no window.confirm" (also proves no purge control and that restore is unarmed). The 4s arming *behaviour* is `useArmed` reused verbatim — **device** |
| AC-18 | `src/components/TasksTab.jsx:11-12,114,188` | `tests/unit/tasks.test.js` → "states the new semantics in the Tasks tab copy" |
| AC-19 | `src/components/TasksTab.jsx:82`, `WeekTab.jsx:66` (both still `tasks.map`) | `tests/unit/tasks.test.js` → "never hands a new task the colour of a retired one" |
| AC-20 | `src/lib/tasks.js:31` `retiredTasks` | `tests/unit/tasks.test.js` → "lists only retired tasks, most recently retired first" + "puts a retired task with no timestamp last, in its original order" + "keeps the original order for two tasks retired at the same instant" |
| AC-21 | `src/lib/tasks.js:62` `restoreTask` (keys deleted, not falsified) | `tests/unit/tasks.test.js` → "removes the flags rather than setting them false, restoring the exact stored shape" |
| AC-22 | `src/lib/tasks.js:72-76` | `tests/unit/tasks.test.js` → "un-retires the task's own category, leaving other retired categories alone" |
| AC-23 | `src/lib/tasks.js:62` | `tests/unit/tasks.test.js` → "is idempotent, and is a no-op for a task that is not retired" |
| AC-24 | `src/lib/tasks.js:66` (early return) | `tests/unit/tasks.test.js` → "throws nothing and changes nothing for an id it has never seen" |
| AC-25 | `src/components/TasksTab.jsx:166-186` | **device check** — see below |
| AC-26 | `src/components/TasksTab.jsx:168,179` | **device check** — see below |
| AC-27 | `src/components/TasksTab.jsx:71-75` | **device check** — see below. Stored shape is AC-21 / AC-22 |
| AC-28 | Structural: AC-13 (nothing in this tab can write `weeks`) | **device check** — see below |
| AC-29 | `src/lib/storage.js:31-38` | `tests/unit/storage.test.js` → "returns ok:true with the stored value", "returns ok:true with a null value for a key that was never written", "returns ok:false when the read throws instead of pretending there is no data" |
| AC-30 | `src/lib/seed.js:64` `loadDecision` | `tests/unit/seed.test.js` → "seeds only when every read succeeded and every value is empty" |
| AC-31 | `src/lib/seed.js:67` | `tests/unit/seed.test.js` → "does not seed when any one key still has content" (first case is the reported incident's shape) |
| AC-32 | `src/lib/seed.js:66` | `tests/unit/seed.test.js` → "reports a storage error, and never seeds, when any read failed" + "never reports both a fresh install and a storage error" |
| AC-33 | `src/lib/useStore.js:75-86` | `tests/unit/tasks.test.js` → "has exactly one seeding branch, gated on the freshness decision" (asserts the old `!t.length` / `!q.length` tests are gone and every `SEED_*` line sits inside the `if (seed)` block) |
| AC-34 | `src/lib/useStore.js:80-85` (`saveKey("tasks", [])` stays empty) | **device check** — see below |
| AC-35 | `src/lib/useStore.js:50-51`, `src/App.jsx:53,66-74` | `tests/unit/tasks.test.js` → "returns from the load path before any write when a read failed" (guard precedes every `saveKey`, effect skips, exact copy). The rendered screen is **device** |
| AC-36 | `src/lib/useStore.js:109` | `tests/unit/tasks.test.js` → "writes the weeks key from setWeeksP and nowhere else" |
| AC-37 | `src/lib/useStore.js:38-44,76-84,106-112` — call shape unchanged, no new key | `tests/unit/reminders.test.js` → "reads and writes exactly the seven localForage keys that existed before", **unmodified and passing** |
| AC-38 | `src/lib/tasks.js:1` | `tests/unit/tasks.test.js` → "keeps the task module pure" |
| AC-39 | No backfill anywhere; absence means active | `tests/unit/seed.test.js` → "adds no retirement field to data written before this feature"; `tests/unit/tasks.test.js` → "treats data written before this feature as entirely active" + "adds no load-time backfill of the retirement flags" |
| AC-40 | `src/lib/seed.js:87-99` (tasks pass through untouched) | `tests/unit/seed.test.js` → "carries retired and retiredAt through untouched" + "is idempotent over data containing retired entries" |
| AC-41 | `src/lib/seed.js:114` (retired categories are still in `ids`) | `tests/unit/seed.test.js` → "does not re-home a task whose category exists but is retired" |
| AC-42 | `src/lib/seed.js:105,109` `unretired` (defined at `:73`) | `tests/unit/seed.test.js` → "returns the structural categories active, Ambition first and Open last" |
| AC-43 | `src/components/DataTab.jsx:19` unchanged; flags ride inside `tasks` | `tests/unit/tasks.test.js` → "leaves the export envelope at version 5 with the same field list"; `tests/unit/seed.test.js` → "imports a v4 file, a pre-feature v5 file and a post-feature v5 file correctly". The end-to-end file round trip is **device** |
| AC-44 | No AI surface added | `tests/unit/tasks.test.js` → "adds no AI surface anywhere" |
| AC-45 | Nothing under `android/` touched | **device check** — see below. `git status -- android/` is byte-identical to the state at session start (all of it predates this feature) |

## Verification output

```
=== Ambitions verification gate ===
-> dependencies present
-> npm run build
-> npm test

 RUN  v2.1.9 C:/Users/User/Documents/Ambitions

 ✓ tests/unit/storage.test.js (4 tests) 56ms
 ✓ tests/unit/seed.test.js (26 tests) 37ms
 ✓ tests/unit/time.test.js (36 tests) 42ms
 ✓ tests/unit/tasks.test.js (30 tests) 67ms
 ✓ tests/unit/reminders.test.js (31 tests) 57ms

 Test Files  5 passed (5)
      Tests  127 passed (127)

-> in progress: 7 week-integrity-fix

[OK] build green, tests green, scope clean
```

No test was deleted, skipped or weakened. `tests/unit/reminders.test.js` was not edited.

## Needs checking on the device

This repo has **no component tests and none were added**, so every criterion that asserts
rendered output is unproven until it is looked at on the phone. Nothing below is covered
by Vitest; where a test exists it proves the wiring underneath, not the pixels.

- **AC-7** — an unknown cell paints solid `#52525b`, shows `?` on the first cell of a run,
  and its title reads `Unknown task · HH:MM`, while an empty cell in the same row stays
  unpainted with only the time. Check at 390px wide.
- **AC-8** — on the current week, an unknown cell inside today's column still reads
  `#52525b`: the today / current-row / current-slot tints must not paint over it.
- **AC-9** — an unknown cell is repairable in place: pick a task, tap the cell, it becomes
  that task; the eraser clears it.
- **AC-10** — Balance's "Hours by task" shows exactly one `Unknown` bar in `#52525b` on a
  week with unknown cells, and none on a clean week.
- **AC-14** — the regression that matters: page back to a week holding 8 cells of a task,
  note its Ambition / Committed / Free, remove the task in the Tasks tab, come back. The
  8 blocks, their name, their colour and the three cards must be identical.
- **AC-15** — the same blocks in the current and future weeks stay painted, can be erased
  or painted over, and the removed task is gone from the brush picker.
- **AC-16 (four surfaces)** — a removed task appears in none of: the Tasks list, the Week
  brush picker, the Week category chip count, Balance's "Ambition plans this week".
- **AC-17 (arming)** — the first tap on the trash icon only turns it red; the second, within
  4 seconds, removes the task; after 4 seconds the first tap must be repeated.
- **AC-25 / AC-26 / AC-27** — the Retired section: collapsed by default, absent entirely
  when nothing is retired, newest first, name + colour + the category it returns to, and
  two taps from noticing a mistake to fixing it. After restore the task is back in its
  category, in the picker and in the chip count with its original name, colour, target and
  week scoping, and a category removed with it is visible again.
- **AC-28** — walk a full delete → restore cycle and confirm a past week renders identically
  at all three points.
- **AC-34** — an install whose stored `tasks` is empty while other keys have content must
  launch with an empty task list and no seed task on any category.
- **AC-35 (the screen)** — per the spec's own instruction, temporarily make `loadKey` throw
  for one key in a debug build, confirm the failure screen with no tabs, confirm nothing on
  disk changed, then revert before review.
- **AC-45** — nothing here reaches the phone until `npm run cap:sync` **and** an Android
  rebuild and reinstall. A web-only `npm run build` leaves the installed APK on the old,
  data-losing behaviour. **No file under `android/` was changed by this feature**, but the
  fix is web code inside the WebView, so the sync and rebuild are still required. The
  **user** runs the install — nothing here ran `adb` at all.

## Deviations from the spec

None. Two readings worth naming explicitly, both taken from the spec's own contract:

1. **"Hours by task" still charts every task with hours in the shown week, retired
   included, plus the `Unknown` bar.** The spec's *Components* section specifies exactly
   two BalanceTab changes — `ambitionTasks` from `activeTasks`, and the `Unknown` bar — and
   AC-16 enumerates the four surfaces a removed task must vanish from; the chart is not one
   of them. Keeping it means the chart and the three cards agree about what a recorded week
   held, which is the point of the feature. "Ambition plans this week" *is* filtered,
   because a plan is about what to do next.
2. **Questions are no longer re-seeded on their own.** AC-33 requires a single seeding
   branch on one boolean, which folds the old `!q || !q.length` test into the freshness
   gate. A user who has deleted every question now keeps an empty list instead of silently
   getting the seven seed questions back — the same rule AC-34 demands for tasks.

## Notes for the reviewer

- **The regression barrier is an absence.** `TasksTab.jsx` has no `setWeeksP`, no `weeks`
  identifier and no `saveKey`, and `App.jsx` no longer passes the setter. The test that
  proves it strips comments and quoted strings first, because AC-18's copy legitimately
  contains the word "weeks" in prose. After this feature the only writers of `weeks` in the
  whole app are `WeekTab`'s `applyBrush`, its "clear this week", and import — all through
  `setWeeksP`.
- **`storageError` is enforced structurally, not by guarding the setters.** `App` early-returns
  before any tab renders, so no component can reach a setter in that state; `useStore`
  returns before the secure-key migration, before any read reaches state and before any
  `saveKey`. I deliberately did **not** add a `if (storageError) return` inside each `P`
  setter: it would be unreachable code that no test in this repo can exercise. If you would
  rather have the belt and braces, say so and it is four lines.
- **`loadDecision` treats a malformed read set as a storage error** (`{}`, `null`, or a
  missing entry → `{ seed: false, storageError: true }`). The spec does not name that case;
  refusing to write is the fail-safe direction and keeps "never both true" trivially valid.
- **`retiredAt` is compared as a string.** ISO-8601 UTC strings sort lexicographically,
  which is why the spec stores the value verbatim. A hand-edited import with a non-ISO
  string would sort oddly but cannot throw, and an entry with no `retiredAt` sorts last.
- **`taskIndex` and `weekStatsOf` both resolve a duplicated id to the first entry.** That is
  what makes AC-5 hold; it also means a duplicate id can never double-count a cell.
- **Restoring a retired category is per task, by design** (spec *Out of scope*). Restoring
  one task un-retires the category; its siblings stay retired until each is restored. The
  test "round-trips a retired category's whole group back to the stored shape" shows the
  two-step path back to a byte-identical array.
- **Left alone deliberately, recorded in `progress/current.md`:** `VisionTab.jsx:23` builds
  its ambition-link dropdown from the raw `tasks` array, so a retired ambition task would
  still be offered there. It is not in the spec's *Components* list and feature 6 deletes
  that control outright (`specs/domain-model.md` § Vision: there is no link to an Ambition
  task). One line (`activeTasks(tasks)`) if feature 6 slips.
- **`WeekTab`'s "clear this week" still writes `{ cells: {} }`** rather than
  `{ ...wk, cells: {} }`. Explicitly out of scope here and already recorded against feature
  8; this feature adds no sibling field to a week object, so nothing was made worse.
- **No migration was added, and none may be.** Absence of `retired` already means active,
  so a load-time pass would be a pure rewrite of the two keys for no gain. `normalizeModel`
  has an idempotency test over data containing retired entries, per `docs/conventions.md`.
