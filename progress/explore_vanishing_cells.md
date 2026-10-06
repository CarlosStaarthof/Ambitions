# Explore — vanishing cells in past weeks

**Question:** What code paths can cause a cell that was previously painted in a past week to stop rendering — either by removing the entry from `weeks[...].cells`, or by leaving a `taskId` that no longer resolves to a task?

## Answer

There are exactly **four** writers to the `weeks` key and **one** writer that can orphan
week cells without touching `weeks` at all. Two mechanisms match the report:

1. **`deleteTask` destroys the cell records in every week, past included, on a single
   unconfirmed tap** (`src/components/TasksTab.jsx:120` → `:57` → `:52`). `clearTaskIdsFromWeeks`
   is **not scoped to any week** — it loops `for (const k in prev)` over the whole store.
   This is **unrecoverable**: the entries are removed from `weeks` and persisted immediately.
2. **The first-run re-seed in `useStore` can fire on an existing install and overwrite the
   real task list with `SEED_TASKS`, orphaning every cell painted with a `uid()` id**
   (`src/lib/useStore.js:63-66`). Here the `weeks` records **survive on disk** — positions and
   shapes are recoverable, names are not. This path produces the exact reported picture: some
   blocks still coloured (seed ids `t1`…`t8`), others now blank holes, across all weeks.

`normalizeModel` and `backfillOpenWeeks` **cannot** blank a painted cell — neither ever
filters `tasks` nor rewrites `task.id`, and `backfillOpenWeeks` never writes `weeks`.

An orphaned cell renders **pixel-identical to an empty cell** — same transparent background,
no label, tooltip showing only the time (`src/components/WeekTab.jsx:116-136`). There is
no "unknown task" state anywhere in the UI.

**The three stat cards tell the two causes apart** — see *Diagnostic* below.

---

## Evidence

### P1 — `deleteTask`: destroys, all weeks, one tap, no confirm ← prime suspect

- `src/components/TasksTab.jsx:52-55` — the sweep is global, not week-scoped:
  ```js
  function clearTaskIdsFromWeeks(ids) {
    const drop = new Set(ids);
    setWeeksP((prev) => { const n = {}; for (const k in prev) { const cells = {}; for (const c in prev[k].cells) if (!drop.has(prev[k].cells[c])) cells[c] = prev[k].cells[c]; n[k] = { ...prev[k], cells }; } return n; });
  }
  ```
  `for (const k in prev)` = every week key ever written. There is no `weekKey` parameter and no
  caller passes one.
- `src/components/TasksTab.jsx:57-60` — `deleteTask` calls it with the single id.
- `src/components/TasksTab.jsx:120` — the trigger has **no `useArmed` guard**:
  ```jsx
  <button onClick={() => deleteTask(t.id)} aria-label="Delete task" className="shrink-0 p-1 -mr-1 text-zinc-600 hover:text-red-400"><Trash2 size={15} /></button>
  ```
  Compare the *category* delete at `:96` (`arm("delCat" + cat.id, …)`) and "clear this week" at
  `src/components/WeekTab.jsx:177` (`arm("clearWeek", …)`) — both two-tap. The per-task delete is
  the one destructive action in the app that skips the convention in `CLAUDE.md`. It is a 15px
  icon at the right edge of a dense row, immediately after a free-text input, on a touch target
  of ~23px including padding.
- `src/lib/useStore.js:98` — `setWeeksP` persists synchronously inside the updater:
  `saveKey("weeks", n)`. No undo, no tombstone, no prior copy.
- **Past weeks: yes, all of them. Reachable from normal UI: yes, one tap, no confirmation.
  Destroys or orphans: DESTROYS — the record is gone from `weeks`.**

### P2 — `deleteCategory`: destroys, all weeks, two taps

- `src/components/TasksTab.jsx:77-82` — collects every task id in the category, deletes the
  tasks, then `clearTaskIdsFromWeeks(ids)` → same global sweep as P1.
- `src/components/TasksTab.jsx:96` — armed (two-tap), but the confirm label is just
  `"delete category?"`. It does not say that every task in it and every cell those tasks ever
  occupied, in every week, go with it.
- **Past weeks: yes. Reachable: yes, deliberate two-tap. DESTROYS.**

### P3 — "clear this week": destroys, the *displayed* week only

- `src/components/WeekTab.jsx:177` — `setWeeksP((p) => ({ ...p, [weekKey]: { cells: {} } }))`.
  `weekKey` is the week currently on screen (`:29`), which is a **past** week whenever the user
  has paged back with the `ChevronLeft` button (`:74`).
- Note it replaces the whole week object rather than spreading it (`{ cells: {} }`, not
  `{ ...wk, cells: {} }`) — any future per-week field would be dropped too.
- **Past weeks: yes, whichever one is on screen. Reachable: yes, two-tap. DESTROYS.**
- *Signature mismatch:* this empties a whole week at once. It does not leave scattered holes,
  so it does not explain "tasks disappeared leaving visible empty spaces" unless entire weeks
  are blank.

### P4 — Import: wholesale replacement of `weeks`

- `src/components/DataTab.jsx:52` — `setWeeksP(pendingImport.weeks)`. **No merge.** Every week
  in the store is replaced by the file's set, so any week painted *after* the imported file was
  exported is destroyed.
- `src/components/DataTab.jsx:19` — export always ships `tasks` and `weeks` from the same
  snapshot, so a file is normally self-consistent and import does **not** orphan. A
  hand-edited or truncated file whose `tasks` omits ids present in `weeks` would orphan
  (cells survive, render blank).
- `src/components/DataTab.jsx:31` — validation is only `Array.isArray(p.tasks) && typeof p.weeks === "object"`; a file with `weeks: {}` passes and wipes everything on Confirm.
- **Past weeks: yes. Reachable: yes, two-step with a count shown in the confirm text
  (`:50`) — the most clearly-signposted of the four. DESTROYS newer weeks.**

### P5 — First-run re-seed on an existing install: orphans every non-seed cell

- `src/lib/useStore.js:63-66`:
  ```js
  if (!t || !t.length) {
    setTasks(SEED_TASKS); setCategories(SEED_CATEGORIES);
    saveKey("tasks", SEED_TASKS); saveKey("categories", SEED_CATEGORIES);
  }
  ```
- `src/lib/storage.js:31` — `loadKey` **swallows every exception and returns `null`**:
  `export async function loadKey(key) { try { await ensureMigrated(); return await store.getItem(key); } catch { return null; } }`
  A transient IndexedDB read failure on the `tasks` key is therefore indistinguishable from a
  fresh install.
- `src/lib/useStore.js:37-43` — `tasks` and `weeks` are **separate awaited reads**. `weeks` has
  no seeding branch at all: `:77` is just `setWeeks(w || {})`. So `tasks` can be replaced while
  `weeks` is left fully intact.
- The overwrite is **persisted on the same line** (`saveKey("tasks", SEED_TASKS)`), so the real
  task list is gone from disk, not merely from memory.
- Consequence: `SEED_TASKS` use the fixed ids `t1`…`t8` (`src/lib/seed.js:26-35`), while every
  user-created task gets `uid()` (`src/lib/time.js:4`). Cells painted with `t1`…`t8` keep
  resolving — to the *seed* names and colours — and every cell painted with a `uid()` task
  becomes an orphan and goes blank.
- **Past weeks: yes, all of them simultaneously. Reachable from normal UI: not by intent — it
  fires on app start after a storage read failure, or after the user has deleted every task.
  ORPHANS: the `weeks` records are still on disk and still contain the original task ids.**
- This is the only path whose symptom is *partial* holes appearing all at once across history
  without the user having deleted anything, which is what was reported.

### `normalizeModel` — cannot orphan a cell

- `src/lib/seed.js:57-63` — maps tasks; `const { category, ...rest } = t` drops only the legacy
  `category` field. `id` is preserved.
- `src/lib/seed.js:76-80` — re-homes a task whose category is missing:
  `{ ...t, categoryId: "basic" }`. Again `id` preserved.
- It never calls `.filter()` on `tasks` and never touches `weeks`.
- **Verdict: no. It can silently collapse the user's categories into a synthetic "Basic" (and
  `src/lib/useStore.js:73` persists that), which corrupts the Ambition-vs-Committed split in
  Balance — but every cell keeps rendering because ids are intact.**

### `backfillOpenWeeks` — cannot hide a painted cell

- `src/lib/seed.js:88-103` — only *adds* `weekKey` to Open tasks (`{ ...t, weekKey: firstUse[t.id] || fallbackWeekKey }`). It reads `weeks` but never writes it, and returns only `{ tasks, changed }`.
- `src/components/WeekTab.jsx:31` + `:116` — cell colour is resolved with
  `taskById = (id) => tasks.find((t) => t.id === id)` over the **full** task list.
- `src/components/WeekTab.jsx:41` — `inThisWeek` is applied only at `:46`, `:49` and `:154`,
  i.e. the category chips and the brush picker. Never to the grid.
- **Verdict: no. A one-off scoped to week A still paints its cells in week B.** It does remove
  the task from other weeks' *picker*, which can look like "my task vanished" while its cells
  are perfectly fine — worth ruling out with the user.

### P7 — An orphaned cell is visually identical to an empty cell

`src/components/WeekTab.jsx:116-135`:

- `:116` — `const id = weekCells[\`${d}-${s}\`]; const t = id ? taskById(id) : null;` → `undefined` when the id no longer resolves.
- `:120` — `const tint = t ? null : isNowCell ? … : null;` — an orphan is given the
  **empty-cell** tint treatment (today/now highlights paint straight over it).
- `:129` — `background: t ? t.color : tint || "transparent"`.
- `:122` — `title={t ? \`${t.name} · ${slotLabel(s)}\` : slotLabel(s)}` → tooltip shows only the time.
- `:135` — `{isStart && …}` with `isStart = t && …` → no 3-letter code drawn.
- **Yes, it renders blank, and it is indistinguishable from an empty cell in colour, label,
  tooltip and click behaviour.** Nothing in the app renders an unresolved id, except:
- `src/components/BalanceTab.jsx:28` — the coach prompt writes `(taskById(b.taskId) || {}).name || "?"`.
  An orphan appears as `?` there. That is the only surface where one is visible, and only if AI
  is enabled (off by default, `src/lib/useStore.js:19`).

### Complete list of `weeks` writers

`src/components/WeekTab.jsx:68` (`applyBrush`, current week only, non-destructive except the
intended erase), `src/components/WeekTab.jsx:177` (P3), `src/components/TasksTab.jsx:54` (P1+P2),
`src/components/DataTab.jsx:52` (P4). No retention, pruning, or age-based cleanup exists
anywhere — verified by grep for `Object.keys(weeks`, `prune`, `retention`, `older`. `src/lib/storage.js`
has no `removeItem`/`clear` on the app store; the legacy `my-time` instance is read-only
(`storage.js:9-10`).

---

## Diagnostic — which mechanism was it? (decides recoverability)

`src/lib/time.js:32-43` counts the two quantities from **different sources**:

- `:38-39` — `filled = Object.keys(weekCells).length; freeH = (CELLS - filled) * 0.5;` — counts
  raw cell keys, so an orphan **does** consume Free time.
- `:36-37` — `ambitionH` / `committedH` iterate `tasks`, so an orphan contributes to **neither**.

Therefore, on any affected past week, reading the three cards at `src/components/WeekTab.jsx:83-85`:

| Reading | Meaning | Recoverable? |
|---|---|---|
| Ambition + Committed + Free **== 168:00** | cells were removed from `weeks` (P1–P4) | **No.** The record is gone. Only a JSON export predating the loss can restore it. |
| Ambition + Committed + Free **< 168:00** | cells are still in `weeks` with unresolvable ids (P5) | **Yes** — the deficit in hours equals the orphaned time. Positions and block shapes are intact on disk; task names are not. |

## Caveats / what I could not determine

- **No device was connected**, so I could not check which of these actually happened.
  `C:\Users\User\AppData\Local\Android\Sdk\platform-tools\adb.exe devices -l` returned an empty
  list. Everything above is what the code permits, not what the device did.
- The decisive on-device check, when a device is available: dump the app's IndexedDB
  (`/data/data/com.carlos.ambitions/app_webview/Default/IndexedDB/`) and compare the set of
  values in `weeks[*].cells` against the ids in `tasks`. Any id present in the former and
  absent from the latter is a recoverable orphan. The 168-hour sum test above gives the same
  answer without adb and should be tried first.
- I found no export file on disk to compare against (`~/Downloads/ambitions-*.json`,
  `~/Downloads/my-time-*.json`, repo root — none present). If the user has an export anywhere,
  diffing its `weeks` against the live store would identify the lost cells exactly.
- **Secondary, lower-confidence path I could not rule out:** `setTasksP` takes a plain value
  derived from the stale `tasks` prop (`src/lib/useStore.js:95`, used at
  `src/components/TasksTab.jsx:58`) while `clearTaskIdsFromWeeks` uses a functional updater
  (`:54`). If two deletes land in one React batch, the second `setTasksP` is computed from the
  pre-first-delete array and **resurrects** the first task — but its cells have already been
  swept from every week. Symptom: task still listed, all of its history gone everywhere. Needs
  both taps inside a single batch, so I rate this unlikely, but it is the only combination that
  yields "task present, cells empty".
- I did not verify whether an Android WebView IndexedDB read can in practice fail transiently
  on this device; P5's trigger is plausible but unproven. What *is* proven is that if such a
  read fails, `loadKey` reports it as "no data" and the app re-seeds and persists over the
  original (`storage.js:31`, `useStore.js:63-66`).
- I was asked about cells that stop rendering, and answered that. I did not investigate the
  `categories` re-home corruption at `seed.js:76-80` / `useStore.js:73` beyond confirming it
  cannot blank a cell — it can still silently move every task into "Basic", which is a separate
  data-integrity problem worth its own look.
