# Impl — feature 14 `records-todo-chart` (round 1)

**Spec:** `specs/features/014-records-todo-chart.md`   **Branch round:** 1 of 5

## What changed

- `src/components/AppMenu.jsx` — labels: `tasks` → **Records**, `reminders` →
  **To-Do's Chart**. Section ids unchanged.
- `src/App.jsx` — `SECTION_LABEL` matches the menu; Records sub-tabs are `Tasks |
  Questions | Reminders`; the Records Reminders sub-tab mounts the existing
  `ReminderWallTab` with a nested `Manage | Archive` switch; the To-Do's Chart section
  mounts the new `TodoChartTab` with `Open | Done`. New `recordsReminderSub` state;
  `reminderSub` defaults to `open`.
- `src/components/TodoChartTab.jsx` (new) — visual board. Open view: open/done summary,
  post-its grouped by category, tinted by category colour, each with its text, an
  `Added <date>` stamp from `createdAt`, and a single **Done** control. Done view:
  read-only cards with category, text, created and done dates. No create/edit/delete or
  category helper is imported.
- `src/lib/reminderWall.js` — additive pure `createdDate(iso) → "YYYY-MM-DD" | null`.
  No other change to the wall shape or helpers.
- `tests/unit/todoChart.test.js` (new, 10 tests).
- `specs/features/014-records-todo-chart.md` (new), `feature_list.json` (14 added as
  `in_progress`; 13 moved to `in_review` citing its APPROVED review), `progress/current.md`.

## Acceptance criteria → evidence

| AC | Evidence |
|---|---|
| AC-1 menu labels | `todoChart.test.js` "renames the two menu entries" |
| AC-2 header labels | `todoChart.test.js` "labels the headers to match the menu" |
| AC-3 Records sub-tabs | `todoChart.test.js` "routes Records…" (source) |
| AC-4 reminder management stays in Records | same test reads `<ReminderWallTab>`; the unchanged component still offers categories/add/edit/armed delete, and both `wall`/`archive` views via the nested switch |
| AC-5 To-Do's Chart mounts + tabs | `todoChart.test.js` "routes To-Do's Chart…" |
| AC-6 only Done | `todoChart.test.js` "offers only a done control…" |
| AC-7 creation stamp | `createdDate` tests + "stamps each item…" |
| AC-8 tick persists / moves | `TodoChartTab` calls `markDone` then `setReminderWallP`; pure `markDone` behaviour is already pinned by feature 11 tests |
| AC-9 done read-only | `todoChart.test.js` "keeps the done view read-only…" |
| AC-10 `createdDate` | `createdDate` describe block |
| AC-11 no new key / export | "adds no key, no export change…" + unchanged `DataTab` |
| AC-12 no AI / network | same test |

## Gate

`npm test --silent` → 10 files, 243 tests passed. `bash init.sh` →
`[OK] build green, tests green, scope clean`, one `in_progress` feature (14).

## Remaining

- Device-only: the rendered chart at 390 px, the grouped layout and the Done transition
  (this repo has no component tests; saying otherwise would be false coverage).
- Later rounds can move additional per-tab backend settings into Records and refine the
  chart's visual grouping.
