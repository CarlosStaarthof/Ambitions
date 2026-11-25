# Review — feature 14 `records-todo-chart` (branch hermes/mww2v497)

**Verdict:** APPROVED

**Contract:** the task text (rename Reminders → To-Do's Chart as a visual, mark-done-only board;
rename "Task & Questions" → Records, which owns reminder/category management; each To-Do
shows the date it was created), plus `specs/features/014-records-todo-chart.md`.

## Gate

`bash init.sh` run by the reviewer: build green, 10 test files / 253 tests passed
(`todoChart.test.js`: 20), `-> in progress: 14 records-todo-chart`,
`[OK] build green, tests green, scope clean`. Nothing skipped. `git status` is clean.

## Diff vs claim

`git diff 278b9a7..HEAD` touches 10 files, all listed in `progress/impl_records-todo-chart.md`:
`AppMenu.jsx`, `App.jsx`, `TodoChartTab.jsx` (new), `ReminderWallTab.jsx`, `reminderWall.js`
(additive helpers), `todoChart.test.js` (new), spec, `feature_list.json`, progress files.
`useStore.js`, `DataTab.jsx` and the export are untouched. The report matches the diff.

## Acceptance criteria

| AC | Result | Evidence |
|---|---|---|
| 1 menu labels | PASS | `AppMenu.jsx:7-8`; test `todoChart.test.js` "renames the two menu entries" (also asserts no `Task & Questions` and no `label: "Reminders"`) |
| 2 header labels | PASS | `App.jsx:19` `SECTION_LABEL`; test "labels the headers to match the menu" |
| 3 Records sub-tabs | PASS | `App.jsx:111-114` Tasks/Questions/Reminders, `TasksTab`/`GuidingTab` lines unchanged; test "routes Records…" asserts the tab array literal |
| 4 Reminders sub-tab mounts wall with wall+archive | PASS | `App.jsx:115-120` nested Manage/Archive `SubTabs` → `<ReminderWallTab view={recordsReminderSub}>`; component's CRUD/armed-delete unchanged (diff only adds stamp). Test asserts the `taskSub === "reminders"` branch and `<ReminderWallTab ` (source-level) |
| 5 To-Do's Chart mounts + Open/Done | PASS | `App.jsx:123-128`; test "routes To-Do's Chart…" |
| 6 only Done control | PASS | `TodoChartTab.jsx` imports only `chartGroups, chartSummary, createdDate, markDone`; single `<button>` at the Done control; test "offers only a done control…" asserts no management helper, no `useArmed`/`window.confirm` |
| 7 creation stamp / "Added date unknown", nothing stored | PASS | `TodoChartTab.jsx:13-18`, `createdDate` (`reminderWall.js:101-108`) — no write path; tests "stamps each item…" and "derives creation stamps through createdDate" |
| 8 tick persists, moves item, others unchanged | PASS (see obs. 1) | `TodoChartTab.jsx:25-28` `markDone` → `setReminderWallP`; behavioural tests "moves exactly the ticked item…" and "changes nothing when the id is not on the wall" |
| 9 Done view read-only with both dates | PASS | `TodoChartTab.jsx:46-66` (category, text, `Added`, `Done`; no buttons); test "keeps the done view read-only…" |
| 10 `createdDate` | PASS | `reminderWall.js:101`; tests for valid, `undefined/null/""/"  "/42/{}/"not a date"` |
| 11 no new key / export unchanged | PASS | `useStore.js`, `DataTab.jsx` not in diff; test "adds no key…" |
| 12 no AI / network | PASS | `TodoChartTab.jsx` has no AI/fetch/storage reference; same test asserts it |

## CHECKPOINTS

- [x] C1.1 gate `[OK]` — run above.
- [x] C1.2 every AC has a named test (AC-4/5/6/9 are source-read contracts; no component test harness exists in this repo, disclosed in the report).
- [x] C1.3 no test deleted/skipped/weakened — diff only adds tests.
- [x] C1.4 new pure logic (`createdDate`, `chartGroups`, `chartSummary`) has unit tests incl. failure/empty cases.
- [x] C2.1 one `in_progress` (14); 13 moved to `in_review` citing its approved review.
- [x] C2.2 files listed in impl report.
- [x] C2.3 / C2.4 nothing outside scope; the `ReminderWallTab` stamp is within the "creation date" ask and disclosed.
- [x] C3.1 no localForage in components. [x] C3.2 uses `setReminderWallP`. [x] C3.3 `reminderWall.js` stays pure. [x] C3.4 n/a.
- [x] C4.1 JS/JSX. [x] C4.2 `card` from `lib/ui`. [x] C4.3 lucide icons. [x] C4.4 no new destructive action (existing `useArmed` delete kept in Records). [x] C4.5 no new ids.
- [x] C5.1–C5.4 no stored-shape change, export untouched, "Never touch" list untouched, no secrets.
- [x] C6.1–C6.4 week, Ambition category, AI-off, no-data-leaves-device untouched.
- [x] C7.1 web-only; `npm run build` is sufficient. No `android/` change.

## Required changes

None.

## Observations (non-blocking)

1. AC-8's "persists through `setReminderWallP`" is only pinned by the source regex `markDone\(reminderWall, id`, not by asserting the `setReminderWallP` call; the pure `markDone` behaviour is tested properly. Consider a component/render test harness in a later feature.
2. The task says Records "will handle all the back-end setting for each tab". The spec deliberately limits this feature to the Reminders sub-tab (spec Open question 2). Week/Balance/Vision backend settings remain where they are; the owner should confirm that is the intended scope.
3. Process: the implementer authored `specs/features/014-…md` and `feature_list.json` in this branch (spec-writer lane under HERMES.md §3). The task text said to treat it as the spec, and prior features followed the same pattern, so not blocking, but the owner should know the spec was not independently written.
4. Device-only checks remain unverified here: 390 px layout of the board and Records nested switch.
