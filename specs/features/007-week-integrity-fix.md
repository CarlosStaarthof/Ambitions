# 007 — Stop past-week data loss

**Feature id:** 7   **Status:** draft
**Depends on:** none. Features 8 (`week-approval`) and, through it, 9 (`open-task-reaper`) depend on this.

## Purpose

Two confirmed code paths are destroying the user's calendar history on a live install, and
two further defects hide the damage. `deleteTask` sweeps the deleted task's cells out of
**every** week ever recorded, on a single unconfirmed tap, and persists it immediately
(`src/components/TasksTab.jsx:120` → `:57` → `:52-55`). The first-run seed fires whenever
`loadKey("tasks")` returns empty — which `src/lib/storage.js:31` also does for a *failed*
read — overwriting the real task list and orphaning every `uid()`-keyed cell
(`src/lib/useStore.js:63-66`). The loss is invisible because an orphaned cell renders
pixel-identical to an empty one (`src/components/WeekTab.jsx:116-136`) and because
`weekStatsOf` stops adding up (`src/lib/time.js:32-43`). `weeks` is the irreplaceable key:
it has no migration, no undo and no tombstone. Without this fix, ordinary use keeps eating
the record of what the user actually did, silently.

Evidence: `progress/explore_vanishing_cells.md`. Constraints: `progress/explore_week_snapshot.md`.
The rules this feature implements were confirmed by the user on 2026-09-29 and are now in
`specs/domain-model.md` (§ Entities → Task, and rule 2).

## Decisions taken here (with reasons)

### 1. Deleting a task stops touching `weeks` at all. It retires the task instead.

Of the three options weighed, this is option (b) with the name problem solved. It is now the
rule in `specs/domain-model.md` § Entities → Task.

- **(a) keep the global sweep behind a two-tap confirm** — rejected. The two-tap guard cuts
  the accident rate on a 15px icon in a dense row, but the outcome of a deliberate tap is
  still the permanent destruction of the one key that has no migration, no undo and no
  backup other than a JSON export the user may not have taken. A confirmation is not a
  substitute for not destroying data, and it leaves the reported incident's damage
  unreadable.
- **(b) leave past cells as orphans and render them as "unknown"** — better, but incomplete
  on its own: ids are `uid()` values, so an orphaned cell can never again be told what it
  held. The record survives as "half an hour was spent here on something", which is strictly
  better than nothing but still loses the name the user cared about.
- **(c) chosen: soft-retire the task.** Delete keeps the task in `tasks` with `retired: true`
  and removes it from every list, picker and count. Nothing in `weeks` is read, written or
  rewritten. Past weeks keep rendering the block with its real name and colour forever,
  because the id still resolves. The three stat cards keep adding up with no change of
  approach in `time.js`, because the task is still in the array being iterated. The user's
  stated intent — a recorded week is a record of what they actually did — is satisfied
  exactly, not approximately.

Retirement is deliberately *not* a snapshot. A rename still propagates to past weeks; making
a recorded week immutable is feature 8's job, and this feature leaves that design space
untouched.

The consequence accepted: blocks of a retired task in the **current** week stay painted and
can only be removed with the eraser or "clear this week". That is the correct trade. The week
on screen is the one place the user can see and fix cells; every other week is history, and a
delete control that reaches into history is the bug being fixed. Scoping the sweep to "this
week and later" was considered and rejected — it would keep a write path from the Tasks tab
into `weeks`, and the structural guarantee that no such path exists is the single most
valuable regression barrier here (AC-13).

### 2. Retirement is reversible: a retired task can be restored.

Confirmed in scope by the user on 2026-09-29. Because delete no longer destroys anything,
undo costs almost nothing: clearing the flag is enough, and the task comes back with its
original id, so every cell it ever occupied — which was never touched — simply keeps
resolving. A collapsed **Retired** section at the foot of the Tasks tab lists what was
removed, most recently first, and one control per row puts it back. Two taps from noticing
the mistake to fixing it (AC-26).

Restore is not armed. `useArmed` guards destructive actions; restore destroys nothing. It is
also the only safe direction of travel, so making it harder would be backwards.

Restoring a task also un-retires its category when that category was removed with it
(AC-22) — otherwise the task would come back into a hidden container and still be invisible,
which is the same class of silent failure this feature exists to kill.

There is deliberately **no** "delete forever" on a retired row. Purging the task from `tasks`
would orphan every cell it holds — exactly the bug being fixed — so the affordance is not
offered at all.

### 3. Orphans still exist, so an unresolvable cell becomes visible.

The user already has orphaned cells on disk from the re-seed incident, and a hand-edited or
truncated import can still produce them. A cell whose id resolves to nothing now paints a
neutral zinc block labelled `?` with the title "Unknown task". This is also the recovery path
for the damage already done: the positions and shapes are on disk, so the user can see what
was lost and paint over the zinc blocks with re-created tasks using the tools that already
exist. No bulk repair tool is added.

### 4. Unknown hours count as Committed, and the cards keep summing to 168:00.

`specs/domain-model.md` rule 1 says the week is 336 cells, and rule 2 now says in as many
words that a scheduled cell whose task cannot be resolved counts as **Committed** — it cannot
be shown to be Ambition — so Ambition + Committed + Free always equals 168:00. Ambition is
never inflated by a cell we cannot identify. `weekStatsOf` additionally returns `unknownH` so
surfaces that want to be explicit can be, but there are still exactly three cards.

### 5. No new storage, no new key, no migration, no version bump.

`retired` / `retiredAt` on a task and `retired` on a category are additive optional fields
whose absence is unambiguous: no task on any existing install is retired. So nothing needs
backfilling, `weeks` is never rewritten at load time, and the export stays `version: 5` (the
fields sit inside `tasks`, which the envelope already passes verbatim).

A seed marker in `settings` was considered and rejected. Its *presence* would be weak
evidence and its *absence* no evidence at all — every existing install lacks it — so a guard
trusting it would reproduce the same bug with a new signal. The freshness test used instead
needs nothing stored: an install is fresh only when all seven reads succeeded **and** all
seven values came back empty. In the reported incident `weeks` survived, so this guard would
have held.

### 6. A failed read makes the app refuse to write, loudly. (Confirmed: no read-only mode.)

`loadKey` swallowing exceptions is the root cause of the re-seed, and it opens a worse path
than re-seeding: if the `weeks` read fails and the user paints one cell, `setWeeksP` writes a
single-week object over the whole key and the entire history is gone. So `loadKey` now
reports whether the read succeeded, and a failed read puts the app into a hard stop — one
message, no tabs, no reachable setters, nothing written. Severe on purpose, and confirmed by
the user: a partly-read store is not safe to edit.

## Data touched

**localForage keys read:** all seven (`tasks`, `categories`, `questions`, `weeks`,
`reflections`, `vision`, `settings`) — the last five are read for the freshness test as well
as for their existing purposes. **No new key.** The set stays exactly the seven that
`tests/unit/reminders.test.js:284-287` pins.

**Keys written:** `tasks` and `categories` only, through the existing `setTasksP` /
`setCategoriesP`. **`weeks` is read-only to this feature** — after it, the only writers of
`weeks` in the whole app are the Week grid and import, both through `setWeeksP`.

**Stored shape change (additive, no migration):**

| shape | field | meaning |
|---|---|---|
| `tasks[]` | `retired?: true` | removed from every list, picker and count; still resolves for cells already painted. Absent = active. |
| `tasks[]` | `retiredAt?: string` | the ISO string supplied at retirement, stored verbatim. It orders the Retired list, newest first, so an accidental delete is the top row. |
| `categories[]` | `retired?: true` | the same, for a removed category. Absent = active. |

Restore removes both keys from the task rather than setting them to `false` / `null`, so a
restored task is byte-identical to its pre-deletion shape and no "was retired once" residue
accumulates (AC-21).

No migration is required, and none may be added: absence already means active, and a
load-time pass over `tasks`/`categories` to add the field would be a rewrite with no
benefit. `normalizeModel` must carry the fields through untouched (AC-40) and must not
re-home a task whose category is retired-but-present (AC-41).

**Export:** unchanged. Still `version: 5`, same field list. The new fields travel inside
`tasks` and round-trip for free.

**`weeks` shape:** unchanged. Nothing here adds a field to a week object or rewrites the key
at load time.

**Two doc tidies for the leader (not blocking implementation):** `specs/domain-model.md`
§ Entities → Task still prints the shape line as
`{ id, name, categoryId, color, target, weekKey? }` — it could gain `retired?, retiredAt?`;
and its retirement bullet could gain one clause saying a retired task can be restored, which
clears the flag. The prose rules it already carries are what this spec is written against.

## Contract

### `src/lib/storage.js`

```js
// The name stays `loadKey` on purpose: tests/unit/reminders.test.js greps this file's
// callers for loadKey/saveKey to prove the seven-key set, and renaming it would blind
// that assertion.
loadKey(key) → Promise<{ ok: boolean, value: any }>
// ok:false only when the underlying read threw. A key that is simply absent is
// { ok: true, value: null }.
saveKey(key, val) → Promise<void>            // unchanged
```

### `src/lib/seed.js`

```js
loadDecision(reads) → { seed: boolean, storageError: boolean }
// reads: { tasks, categories, questions, weeks, reflections, vision, settings },
//        each { ok, value } as returned by loadKey.
// storageError: any entry has ok === false.
// seed: every entry ok === true AND every value empty (null | undefined | [] | {} | "").
// seed and storageError are never both true.
```

### `src/lib/tasks.js` (new, pure — imports `./time` and nothing else)

```js
UNKNOWN_COLOR = "#52525b"                    // zinc-600

isRetired(entity) → boolean                  // entity && entity.retired === true
activeTasks(tasks) → Task[]                  // order preserved
activeCategories(categories) → Category[]    // order preserved
retiredTasks(tasks) → Task[]                 // newest retiredAt first; no retiredAt sorts last

retireTask(tasks, id, at) → Task[]           // same length; input never mutated
retireCategory(tasks, categories, categoryId, at) → { tasks, categories }
// retires the category and every task in it, with the same `at`. Removes nothing.
restoreTask(tasks, categories, id) → { tasks, categories }
// deletes `retired` and `retiredAt` from the task, and clears `retired` on its own
// category if that category is retired. Idempotent. Removes nothing. No mutation.

taskIndex(tasks) → Map<id, Task>             // built from ALL tasks, retired included
resolveCell(id, index) → { kind, name, color, code }
// kind "empty"   → { kind: "empty",   name: "",             color: null,          code: "" }
// kind "task"    → { kind: "task",    name: t.name,         color: t.color,       code: codeFor(t.name) }
// kind "unknown" → { kind: "unknown", name: "Unknown task", color: UNKNOWN_COLOR, code: "?" }
```

### `src/lib/time.js`

```js
weekStatsOf(weekCells, tasks, categories) → {
  counts, hoursOf, ambitionH, committedH, freeH, filled, byCategory, protectedIds,
  unknownH,        // 0.5 x cells whose id is in no task
  unknownIds       // those ids, sorted, for diagnostics
}
// Signature unchanged. Each cell id is resolved once through an id→task map, so a
// duplicate id in `tasks` cannot double-count. committedH includes unknownH.
// freeH is still (336 - filled) x 0.5, and filled still counts unknown cells.
```

### `src/lib/useStore.js`

```js
useStore() → { …existing, storageError: boolean }
// Seeds SEED_TASKS / SEED_CATEGORIES / SEED_QUESTIONS iff loadDecision(reads).seed.
// Writes nothing at all when storageError is true.
```

### Components

- `TasksTab` — loses the `setWeeksP` prop and the `clearTaskIdsFromWeeks` function.
  `deleteTask` → `retireTask`, behind `arm("delTask" + t.id, …)`. `deleteCategory` →
  `retireCategory`. Lists render `activeCategories(categories)` and `activeTasks(tasks)`.
  Gains a collapsed **Retired** section driven by `retiredTasks(tasks)`, whose restore
  control calls `restoreTask` and persists both returned arrays.
- `WeekTab` — the grid resolves cells with `taskIndex(tasks)` + `resolveCell` over **all**
  tasks; picker, chips and counts use `activeTasks` / `activeCategories`; tints paint only on
  `kind === "empty"`.
- `BalanceTab` — `ambitionTasks` from `activeTasks`; "Hours by task" appends one `Unknown`
  bar when `unknownH > 0`.
- `App` — early-returns the storage-failure screen after the existing `loading` return and
  skips the reminder reconciliation in that state; stops passing `setWeeksP` to `TasksTab`.

## UI states

- **Empty:** a genuinely fresh install seeds as it does today. A user who has removed every
  task sees each category's existing "No tasks yet." line, and no seed task ever returns.
  With nothing retired, the Retired section is not rendered at all — no empty header.
- **Loading:** unchanged — the existing `loading…` screen until all seven reads resolve.
- **Error:** any failed read shows one screen and nothing else: "Could not read your saved
  data. Nothing has been changed. Close the app and open it again." No tabs, no setters, no
  writes, no reminder reconciliation.
- **Success:** removing a task takes it out of the Tasks list and the brush picker in one
  two-tap action; every week that already held it still shows its blocks, name and colour. It
  is listed under Retired, newest first, and one tap on its restore control puts it back in
  its category. A cell whose task is genuinely unknown shows a zinc block marked `?`.
- **AI disabled:** unchanged and unaffected. This feature adds no AI surface, no prompt and
  no AI-gated control; with AI off (the shipping default) every behaviour above is identical.

## Acceptance criteria

1. AC-1: For any `weekCells`, `tasks` and `categories`, `weekStatsOf` returns `ambitionH + committedH + freeH === 168` exactly — proven for an empty week, a week whose every cell resolves to a task, a week mixing resolvable and unresolvable ids, and a week whose 336 cells all hold unresolvable ids.
2. AC-2: `weekStatsOf` puts the hours of cells whose id matches no task into `committedH` and never into `ambitionH`, and reports them separately as `unknownH` equal to 0.5 x the number of such cells; `unknownH` is 0 when every cell resolves.
3. AC-3: An unresolvable cell still consumes Free — `weekStatsOf` with one such cell in an otherwise empty week reports `freeH` 167.5, which the cards display as `167:30`.
4. AC-4: A task carrying `retired: true` is counted exactly like an active one — a retired task in the `ambition` category holding two cells contributes 1 hour to `ambitionH`, contributes nothing to `unknownH`, and still appears in `byCategory.ambition`.
5. AC-5: `weekStatsOf` counts each cell once even when `tasks` contains two entries with the same id — one cell holding that id yields `ambitionH` 0.5, not 1, and the AC-1 sum still holds.
6. AC-6: `resolveCell` returns `{ kind: "empty" }` for an absent cell id, `{ kind: "task", name, color, code }` for an id present in the index including a retired task, and `{ kind: "unknown", name: "Unknown task", color: "#52525b", code: "?" }` for an id that is in no task.
7. AC-7: On the Week grid a cell whose id matches no task paints solid `#52525b`, shows `?` on the first cell of the run, and its title reads `Unknown task · HH:MM`; an empty cell in the same row stays unpainted with only the time in its title. Checked at 390px wide. (Device.)
8. AC-8: The today, current-row and current-slot tints paint only on cells `resolveCell` calls `empty` — on the current week an unknown cell inside today's column still reads `#52525b`. (Device.)
9. AC-9: An unknown cell is repairable in place: selecting a task and tapping the cell replaces it with that task, and the eraser clears it. No new tool is required. (Device.)
10. AC-10: Balance's "Hours by task" chart shows one aggregate bar named `Unknown` coloured `#52525b` whenever the shown week's `unknownH` is above 0, and no such bar when it is 0. (Device.)
11. AC-11: `retireTask(tasks, id, at)` returns a new array of the same length in which that task has `retired: true` and `retiredAt` equal to the supplied `at` string stored verbatim, and every other element is deep-equal to its input; neither the input array nor any input object is mutated.
12. AC-12: `retireCategory(tasks, categories, categoryId, at)` marks that category `retired: true` and marks every task whose `categoryId` matches `retired: true` with the same `retiredAt`, removes no element from either array, and leaves tasks in other categories deep-equal to their input.
13. AC-13: `src/components/TasksTab.jsx` contains no reference to `setWeeksP` and no reference to the `weeks` key, and `src/App.jsx` passes no `setWeeksP` prop to `TasksTab` — there is no path from the Tasks tab to `weeks` at all.
14. AC-14: Regression: given a stored week from a past Monday holding 8 cells of task X, removing X in the Tasks tab leaves that week's cell map unchanged, the week still shows the 8 blocks with X's own name and colour, and its Ambition / Committed / Free read exactly as they did before the removal. (Device.)
15. AC-15: Blocks of a removed task in the current and future weeks are also left in place and keep the task's name and colour; they can be erased or painted over, and the removed task is no longer offered by the brush picker. (Device.)
16. AC-16: `activeTasks` excludes every task with `retired: true` and `activeCategories` excludes every category with `retired: true`, preserving order otherwise; consequently a removed task appears in none of the Tasks tab list, the Week brush picker, the Week category chip count, or Balance's "Ambition plans this week". (Pure for the two helpers; Device for the four surfaces.)
17. AC-17: The per-task trash control is a two-tap `useArmed` action with the same 4-second arming window as the category control above it — the first tap only changes the control's appearance, the second removes the task — and no `window.confirm` is introduced anywhere. (Device for the arming behaviour.)
18. AC-18: The Tasks tab states the new semantics: the armed trash control's `title` and `aria-label` read `Tap again to remove — past weeks keep it`, the armed category control's label does not claim that weeks are cleared, and the tab's footer copy contains one sentence saying that weeks already filled keep a removed task.
19. AC-19: A newly added task never takes the colour of a retired task — `nextColor` is still passed every colour in `tasks`, retired ones included.
20. AC-20: `retiredTasks(tasks)` returns exactly the tasks carrying `retired: true`, ordered by `retiredAt` with the most recently retired first, and places any retired task lacking `retiredAt` last in its original relative order.
21. AC-21: `restoreTask(tasks, categories, id)` returns the task with the `retired` and `retiredAt` keys **removed** — not set to `false` or `null` — so its stored shape is identical to what it was before the delete, including `name`, `color`, `target` and `weekKey`; every other task is deep-equal to its input and no input array or object is mutated.
22. AC-22: `restoreTask` also clears `retired` on the restored task's own category when that category is retired, so a task restored out of a removed category becomes visible again instead of returning into a hidden one; every other retired category stays retired.
23. AC-23: `restoreTask` is idempotent — calling it for an id that is not retired, or calling it a second time on its own output, returns arrays deep-equal to the first result and changes nothing else.
24. AC-24: `restoreTask` with an id present in neither array returns arrays deep-equal to its input and throws nothing.
25. AC-25: The Tasks tab renders a "Retired" section listing every retired task with its name, its colour and the category it would return to, collapsed by default, with one restore control per row; the section is not rendered at all when nothing is retired. (Device.)
26. AC-26: Recovering an accidental delete takes two taps — one to open the Retired section, one on that task's restore control. Restore is not armed, because it destroys nothing. (Device.)
27. AC-27: After a restore the task is back in its own category in the Tasks tab, in the Week brush picker and in that category's chip count, with its original name, colour, target and week scoping; if its category had been removed with it, that category is visible again too. (Device; the stored shape is AC-21 and AC-22.)
28. AC-28: Across a full delete-then-restore cycle no week's cell map changes at any point, and a past week that held the task renders identically before the delete, while it is retired, and after the restore. (Device; structurally guaranteed by AC-13.)
29. AC-29: `loadKey` resolves to `{ ok: true, value }` when the store read succeeds, with `value: null` for a key that is simply absent, and to `{ ok: false, value: null }` when the read throws.
30. AC-30: `loadDecision` returns `{ seed: true, storageError: false }` only when all seven reads report `ok: true` and every value is empty — `null`, `undefined`, `[]`, `{}` or `""`.
31. AC-31: `loadDecision` returns `seed: false` when all seven reads succeeded but any one value has content — in particular for `tasks` empty or null together with a non-empty `weeks`, which is the shape of the reported incident.
32. AC-32: `loadDecision` returns `{ seed: false, storageError: true }` when any read reports `ok: false`, even when every value read back empty.
33. AC-33: `useStore` seeds `SEED_TASKS`, `SEED_CATEGORIES` and `SEED_QUESTIONS` only when `loadDecision(reads).seed` is true — there is exactly one seeding branch, gated on that single boolean, and the old `!t || !t.length` and `!q || !q.length` tests are gone.
34. AC-34: An existing install whose stored `tasks` is empty while other keys have content launches with an empty task list, no seed task on any category, and a stored `tasks` that is still empty afterwards. (Device.)
35. AC-35: When `storageError` is true the app writes nothing and edits nothing — `App` renders only the failure message with no tab content and no reachable setter, no `saveKey` runs on the load path, and the reminder reconciliation is skipped; the message says the saved data could not be read, that nothing has been changed, and to close and reopen the app. (Device for the rendered screen.)
36. AC-36: No code path that runs during load writes the `weeks` key — `saveKey("weeks", …)` appears only inside `setWeeksP`.
37. AC-37: The set of localForage keys `useStore` reads and writes is still exactly `categories`, `questions`, `reflections`, `settings`, `tasks`, `vision`, `weeks`, and the existing assertion proving it in `tests/unit/reminders.test.js` passes unmodified.
38. AC-38: `src/lib/tasks.js` is pure — it imports nothing but `./time`, and contains no React, no DOM access and no storage access.
39. AC-39: `tasks` and `categories` arrays written before this feature, with no `retired` key anywhere, load with every task and category active, and no load-time pass adds, rewrites or backfills the field.
40. AC-40: `normalizeModel` preserves `retired` and `retiredAt` on tasks and `retired` on categories, and running it twice over data containing retired entries returns a deep-equal result.
41. AC-41: `normalizeModel` does not re-home a task whose category exists but is retired — the task keeps its `categoryId` and no `Basic` category is created.
42. AC-42: `normalizeModel` returns the `ambition` and `open` categories active: a stored `categories` carrying `retired: true` on either has that flag cleared, with Ambition still first and Open still last.
43. AC-43: The export envelope stays `version: 5` with the same field list; a file exported after this feature carries `retired` and `retiredAt` inside `tasks`, re-importing it restores those tasks as retired and still listed under Retired, and both a `version: 4` file and a pre-feature `version: 5` file still import with every task and category active.
44. AC-44: With AI off — `enabled: false` or `provider: "none"`, the shipping default — every behaviour above is identical and no AI surface appears anywhere; this feature adds no AI call, no prompt and no AI-gated control.
45. AC-45: No file under `android/` changes, and nothing here reaches the device until `npm run cap:sync` is run and the Android app is rebuilt and reinstalled; a web-only `npm run build` leaves the installed APK on the old, data-losing behaviour. (Device.)

## Verification

**A Vitest unit test can prove** (new `tests/unit/tasks.test.js`, plus additions to
`tests/unit/time.test.js` and `tests/unit/seed.test.js`): AC-1, AC-2, AC-3, AC-4, AC-5, AC-6,
AC-11, AC-12, AC-16 (the two helpers only), AC-19, AC-20, AC-21, AC-22, AC-23, AC-24, AC-30,
AC-31, AC-32, AC-39, AC-40 (idempotency is mandatory per `docs/conventions.md`), AC-41,
AC-42. All are pure functions of supplied arguments — including `retiredAt`, which is passed
in, never read from the clock — which is why every decision in this feature lives in
`src/lib/`.

AC-29 needs `vi.mock("localforage")` so the stubbed `getItem` can throw. `storage.js` is not
pure, but this is the exact line whose error-swallowing caused the incident, so the test is
required rather than optional.

**A source-reading Vitest test can prove** (the pattern `tests/unit/reminders.test.js` § "what
this feature did not change" already uses): AC-13, AC-18, AC-33, AC-36, AC-37, AC-38, and the
`version: 5` half of AC-43.

**Only the device can confirm — marked `(Device.)` above:** AC-7, AC-8, AC-9, AC-10, AC-14,
AC-15, the four UI surfaces in AC-16, the arming behaviour in AC-17, AC-25, AC-26, AC-27,
AC-28, AC-34, the rendered screen in AC-35, AC-45. This repo has no component tests and none
are being added, so **every criterion that asserts rendered output is device-only**: the
unknown-cell block, the tints, the Retired section and its restore control, the grid after a
delete and after a restore, the storage-failure screen. Claiming Vitest coverage for any of
them would be the same dishonesty that let an orphaned cell look empty. What *is* provable
without a device is everything behind those pixels — the resolution of a cell to
empty/task/unknown (AC-6), the arithmetic (AC-1 to AC-5), and every retire/restore transform
(AC-11, AC-12, AC-20 to AC-24) — which is why the components are required to hold no logic of
their own.

**Also reviewable from the diff:** AC-44, the copy in AC-18, the two-tap wiring in AC-17, the
absence of a purge control on a retired row, and the `weeks` half of AC-14 and AC-28 — if
`TasksTab` cannot reach `setWeeksP` (AC-13), no Tasks-tab action can alter any week.

**Check AC-35 on the device** by temporarily making `loadKey` throw for one key in a debug
build, confirming the failure screen and that no stored data changed, then reverting before
review.

## Out of scope

- **Week approval, locking, immutability and snapshots** — feature 8. This feature adds no
  field to a week object, no `approved` flag, no per-week task copy and no precedence
  resolution. Renaming or recolouring a task still changes how past weeks render; that is
  feature 8's problem and is deliberately left alone.
- **The 14-day Open-task reaper** — feature 9. Nothing here removes, ages out or sweeps any
  task automatically, and no retired task is ever purged by age.
- **UI changes for their own sake** — feature 10 owns full task names in cells and the Balance
  section order. The only visual changes here are the ones a lost cell needs in order to stop
  being invisible, the armed trash control, and the Retired section.
- **Permanently purging a retired task** ("delete forever" on a Retired row). It would orphan
  every cell the task holds, which is the bug this feature exists to fix, so the control is not
  offered.
- **Bulk restore, restoring a retired category as a unit, or a search/filter over the Retired
  list.** Restore is per task; a category comes back only as a side effect of restoring one of
  its tasks (AC-22). If the Retired list ever grows long enough to need filtering, that is a
  later, additive change.
- **A bulk repair tool for unknown cells** ("assign every unknown cell this week to task X").
  Painting over them with the existing brush already works; a bulk tool is new UI plus a new
  `weeks` write path, and is not needed to make the damage legible.
- **The `remove` control on the `Open` category.** It stays exactly as it is. The control is
  effectively a no-op for `open`: `normalizeModel` re-creates that category on the next load
  (`src/lib/seed.js:73-74`) and AC-42 keeps it active, so removing it retires its tasks and
  then the category reappears. Tidying that control belongs with feature 9, which reshapes
  Open tasks anyway.
- **Import hardening.** `src/components/DataTab.jsx:31` accepts a file whose `weeks` is `{}`
  and `:52` then replaces every week wholesale. That is a third data-loss path and deserves
  its own feature; it is not touched here.
- **"Clear this week" replacing the whole week object** (`src/components/WeekTab.jsx:177`
  writes `{ cells: {} }`, not `{ ...wk, cells: {} }`). Harmless while a week has no sibling
  fields, fatal the moment feature 8 adds one. Feature 8's spec already records it.
- **Encrypted or automatic backups** — feature 1.
- **Any change to the `weeks` stored shape, any load-time rewrite of `weeks`, and any new
  localForage key.**
- **Pruning retired tasks.** They accumulate forever, by design; that is what keeps the record
  readable.
- **Recovering the names already lost** in the re-seed incident. They are not on disk. The
  positions are, and this feature makes them visible so the user can repaint them.

## Open questions

**None.** All five questions from the first draft were answered by the user on 2026-09-29:
the domain-model amendments are confirmed and already applied (§ Entities → Task, rule 2);
the hard stop on a failed read stands, with no read-only mode; restore is in scope and is
specified above (decision 2, AC-20 to AC-28); and the `Open` category's remove control is
left as it is, with the reasoning recorded in *Out of scope*.

Two optional doc tidies for the leader are listed at the end of *Data touched*; neither blocks
implementation.
