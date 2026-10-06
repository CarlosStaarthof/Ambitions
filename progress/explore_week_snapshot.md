# Explore — approved-week immutability / task-deletion survival

**Question:** What exactly would have to change for an "approved" (locked) week to survive
the later deletion of a task, so that the locked week renders identically forever?

## Answer

Rendering a cell needs only **two** task properties — `name` (title text + 3-letter code) and
`color` — but rendering the *Week screen* identically also needs, per snapshotted task,
`categoryId` plus that category's `protected` flag (the Ambition/Committed split is derived by
filtering the **live** `tasks` array, not the cells), and `target` if Balance's "Ambition plans
this week" card is to look the same. Nothing about `weeks` is migrated today (`useStore` loads
the key raw, `normalizeModel` never sees it), extra fields on a week object survive
export/import for free, and "absent = not approved" needs no backfill — so a per-week
`approved` flag plus snapshot can be added with **no migration of existing data at all**,
provided three write paths change. The catch: a snapshot used only as a *fallback for missing
tasks* would not make the week immutable — a plain rename or recolour of a surviving task
already rewrites every past week's grid — so the snapshot must take **precedence over** the
live task, not stand behind it.

## Evidence

### 1. Every task property the grid reads when painting a cell

`src/components/WeekTab.jsx:116` resolves the reference:
`const id = weekCells[...]; const t = id ? taskById(id) : null;`
(`taskById` = `tasks.find((t) => t.id === id)`, `src/components/WeekTab.jsx:31`).

| Read | Line | Property needed |
|---|---|---|
| truthiness of `t` gates the today/now tint | `WeekTab.jsx:120` | — (existence only) |
| `title={t ? name + " · " + slotLabel(s) : …}` | `WeekTab.jsx:122` | `name` |
| `background: t ? t.color : tint` | `WeekTab.jsx:129` | `color` |
| `{isStart && … codeFor(t.name)}` | `WeekTab.jsx:135` | `name` (via `codeFor`, `src/lib/time.js:9-14`, which reads nothing but the name) |
| `isStart` compares the previous cell's id | `WeekTab.jsx:116` | none — raw cell-id comparison, so block-start detection needs no task at all |

**Per-cell minimum is therefore `{ name, color }`.** Nothing else — no category, no target, no
`weekKey` — is touched while painting the 336 cells.

The rest of the Week screen is not cell-local:
- `WeekTab.jsx:32` `weekStatsOf(weekCells, tasks, categories)` feeds the three cards at `WeekTab.jsx:83-85` (Ambition / Committed / Free) — needs `categoryId` + `category.protected`.
- `WeekTab.jsx:41,45-49` (`inThisWeek`, `visibleCategories`, `catTasks`) and `:148,152-173` are the brush picker — needs `categoryId`, `weekKey`, `name`, `color`, `category.name`, `category.protected`. That is UI for *editing*, not for rendering the record.

### 2. Everything else that consumes `weeks` and resolves task ids

**`mergeDay` (`src/lib/time.js:23-30`) needs nothing.** It reads only cell values and returns
`{ taskId, start, end }`; a missing task is simply an id that does not resolve. Its only caller
is `src/components/BalanceTab.jsx:28`.

**`weekStatsOf` (`src/lib/time.js:32-43`) is the load-bearing one.** Note the asymmetry:
- `time.js:33-34` — `counts` / `hoursOf` are keyed off the **cell values**, so they already work for an orphan id.
- `time.js:35` — `protectedIds` comes from `categories.filter((c) => c.protected)`.
- `time.js:36-37` — `ambitionH` and `committedH` are built by iterating **`tasks`** and summing `hoursOf(t.id)`. An orphan cell lands in **neither** sum.
- `time.js:38-39` — `filled = Object.keys(weekCells).length`, `freeH = (336 - filled) * 0.5`. An orphan cell **does** still reduce Free.
- `time.js:41` — `byCategory` also iterates `tasks`, so orphans vanish from it (only used by tests, `tests/unit/time.test.js:172-173`).

Consequence when a cell's task is gone from `tasks`: **its hours disappear from both Ambition
and Committed while still consuming Free**, so `ambition + committed + free < 168` — a direct
violation of `specs/domain-model.md:53-55` (rules 1-2). Ambition-vs-Committed is derived from
the task's **category**, so a snapshot carrying only name+colour leaves the stat cards silently
wrong.

Helpfully, `weekStatsOf` takes `tasks` and `categories` **as arguments**, so it needs **no
signature change**: a caller that passes an "effective tasks/categories for this week"
(snapshot-resolved) array gets correct numbers with zero edits to `src/lib/time.js`.

**`src/components/BalanceTab.jsx` resolves against live `tasks` in six places:**
- `:14-15` — same `weekCells` + `weekStatsOf`; cards rendered at `:40-42`.
- `:16` `taskById`, used at `:28` in the AI prompt as `(taskById(b.taskId) || {}).name || "?"` — already defensive; an orphan renders as `?` in the coach prompt.
- `:17-18` — `protectedIds` / `ambitionTasks` from live `categories`/`tasks`; drives "Ambition plans this week" (`:47-55`), reading `t.target`, `t.color`, `t.name`.
- `:19` — `taskHoursData = tasks.map(… hoursOf(t.id) …)` for the "Hours by task" chart: **an orphan cell contributes no bar**, so a deleted task's hours vanish from the chart even while its cells are painted.
- `:29` — the targets line of the prompt, reading `t.target`.

Nothing else reads `weeks`. Full consumer list (`grep -rni weeks src/`): `App.jsx:87-88` (prop
drilling), `WeekTab`, `BalanceTab`, `TasksTab` (writes only), `DataTab:19,31,50,52`
(export/import), `SettingsTab:198` (passes through to `DataTab`), `storage.js:11` (legacy
instance copy list), `useStore.js:40,77,98`, `seed.js:88-103` (`backfillOpenWeeks`, read-only).

### 3. Current stored shape, and how `approved` + snapshot could be added

Stored shape is exactly `{ [isoMonday]: { cells: { "<day>-<slot>": taskId } } }`
(`specs/domain-model.md:26-30`), and **there is no weeks migration anywhere**:

- `src/lib/useStore.js:40` loads the key; `:77` does `setWeeks(w || {})` — raw, no normalisation, and no `saveKey("weeks", …)` on load (contrast `:69-73`, where tasks/categories are normalised *and* re-saved).
- `src/lib/seed.js:52-83` `normalizeModel(tasks, categories)` never receives `weeks`, so it cannot break on new week fields. `backfillOpenWeeks` (`seed.js:88-103`) only *reads* weeks, defensively (`seed.js:94`).
- Export passes `weeks` through verbatim: `src/components/DataTab.jsx:19` — `{ version: 5, exportedAt, tasks, categories, questions, weeks, reflections, vision }`. **Any extra field on a week object is exported and re-imported for free**; no envelope change is needed for round-tripping.
- Import validates only `typeof p.weeks !== "object"` (`DataTab.jsx:31`) and then replaces wholesale (`DataTab.jsx:52` `setWeeksP(pendingImport.weeks)`) with no week normalisation.

**What a migration would have to do: nothing, if "absent `approved` = not approved."** No
approved weeks exist today (`grep -rni "approved|locked|snapshot|frozen" src/ tests/` finds
none), so no historical week needs a backfilled snapshot — the snapshot can be written at
approval time only. A lazy read (`!!weeks[k].approved`) avoids a load-time rewrite of the
`weeks` key entirely, which matters because `weeks` is the irreplaceable data.

Hard constraints on *where* the data may live:
- **Do not add a new top-level localForage key.** `tests/unit/reminders.test.js:286-287` asserts `useStore` reads/writes *exactly* seven keys: `categories, questions, reflections, settings, tasks, vision, weeks`. A `weekLocks` key fails that test.
- **Bumping the export version breaks a test.** `tests/unit/reminders.test.js:275` asserts the payload line matches `/version:\s*5\b/`. Adding fields inside `weeks` needs no bump; bumping to 6 requires editing that assertion.
- **Snapshot tasks must not be merged into the live `tasks` array.** If they were, they would reappear in the brush picker (`WeekTab.jsx:45-49`), the Tasks tab (`TasksTab.jsx:87`), and Balance's chart and plans (`BalanceTab.jsx:19,47`) — and `normalizeModel`'s orphan re-homing (`seed.js:76-80`) would drag deleted categories back as a "Basic" catch-all.
- Existing reads of `weeks[k]` already tolerate extra fields (`WeekTab.jsx:30`, `BalanceTab.jsx:14`, `seed.js:94`, and `TasksTab.jsx:54`'s `for…in` over `prev[k].cells`).

### 4. What writes to a past week today — i.e. what a lock must prevent

There is **no date guard anywhere**. Week navigation is unbounded (`WeekTab.jsx:74,79`), and
every writer below happily rewrites an arbitrarily old week:

1. `src/components/WeekTab.jsx:68` `applyBrush` — the only cell writer (paint *and* erase), called from `:123,124,125` (mousedown / drag-enter / click). It **preserves** sibling week fields: `{ ...wk, cells }`.
2. `src/components/WeekTab.jsx:177` "clear this week" — `setWeeksP((p) => ({ ...p, [weekKey]: { cells: {} } }))`. This **replaces the whole week object**, so it would silently destroy an `approved` flag and its snapshot. This line must change even if the lock gate lives elsewhere.
3. `src/components/TasksTab.jsx:52-55` `clearTaskIdsFromWeeks(ids)` — iterates **every** week key and strips cells holding the deleted ids. Called by `deleteTask` (`:57-60`, trash icon at `:120`) and `deleteCategory` (`:77-82`, which deletes all of that category's tasks first). **This is the mechanism that destroys history today**, and the behaviour is currently a stated rule: `specs/domain-model.md:23` — "Deleting a task also clears it from every week's cells."
4. `src/components/DataTab.jsx:52` import — wholesale replacement of all weeks. A per-week lock cannot meaningfully guard this (it is an explicit full restore), and an older export simply carries no approved flags.
5. `src/components/TasksTab.jsx:43` `updateTask` — **does not write `weeks`, yet retroactively changes what every past week renders**, because the grid reads live `name`/`color` (`WeekTab.jsx:122,129,135`). Rename and recolour are live handlers (`TasksTab.jsx:107` and `:105`). Same for the Balance chart (`BalanceTab.jsx:19`).
6. Nothing else. No background job, no reaper, no retention sweep exists (`grep -rni "prune|reap|stale|retention" src/` → one unrelated comment at `src/lib/ai.js:125`), and `useStore.js:77` does not write on load.

A lock must therefore gate (1), (2), (3) and the category-delete path; and immutability
additionally requires that (5) cannot reach an approved week — which only a *precedence*
snapshot achieves, not a fallback one.

### 5. The collision with "Open tasks disappear from the list after 14 days"

A reaper that removes an Open task from `tasks` **without** calling `clearTaskIdsFromWeeks`
produces exactly the orphan state analysed in §2: cells still paint (if a snapshot supplies
name+colour) but `weekStatsOf` (`time.js:36-37`) drops the hours from both Ambition and
Committed while `filled` still counts them (`time.js:38`), and the Balance chart loses the bar
(`BalanceTab.jsx:19`). Such a reaper therefore depends on snapshot-precedence resolution being
in place for **every** week the task was painted in — not only approved ones — or on the reaper
only being allowed to remove tasks whose weeks are all approved/snapshotted.

## Caveats / what I could not determine

- **No device state.** `adb` is not on PATH; the SDK copy at `C:\Users\User\AppData\Local\Android\Sdk\platform-tools\adb.exe` reports "List of devices attached" with no entries. I could **not** confirm what the real stored `weeks` object looks like on the phone — in particular whether any week object already carries fields beyond `cells` (from an old build or a hand-edited import). Everything in §3 is what the *code* implies, not what the device holds.
- `CLAUDE.md` still documents the export envelope as `version: 4`; the code is `version: 5` with a `vision` field (`DataTab.jsx:19`). Treat the code as truth.
- `src/lib/storage.js:11` `KEYS` omits `vision`, so the one-time legacy `my-time` copy never brought vision data across. Unrelated to weeks; noted only so it is not mistaken for a weeks problem.
- I did not evaluate where an approval action or its UI should live, nor how approval should interact with **future** weeks (nothing stops painting those either) — out of scope per the brief.
- Whether Balance must also freeze for an approved week is a product decision I did not assume either way; its surface is wider than the grid (chart ordering at `BalanceTab.jsx:19`, target bars at `:48` reading live `t.target`).
