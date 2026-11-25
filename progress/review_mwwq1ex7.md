# Review — task mwwq1ex7 (feature 23 records-tabs)

**Verdict:** APPROVED

Contract: the owner's task text (Records sub-tabs named after the main sections: Task and
Question fall under Plan & Balance, Reminders becomes To-Do's, Vision Board only an
example) plus `specs/features/023-records-tabs.md`. Branch `hermes/mwwq1ex7`, HEAD `31c1b66`.
Base for the diff: `c05424b`.

## Gate

| Command | Result |
|---|---|
| `npm test --silent` | 18 files, **362 tests passed**, 0 failed, 0 skipped |
| `bash init.sh` | build green, 362 tests passed, last line `[OK] build green, tests green, scope clean`. Nothing skipped. |
| `git status --short` | clean |

## Claim vs diff

`git diff c05424b..HEAD --stat`: 9 files. The code change is `src/App.jsx` (+13/-9) and two
test files. The rest is spec, `feature_list.json`, `progress/*`. All are disclosed in
`progress/impl_records-tabs.md`. No file under `android/`, `src/lib/`, `AppMenu.jsx` or any
tab component changed.

- `src/App.jsx:140-153`: Records top bar `[["plan","Plan & Balance"],["todos","To-Do's"]]`.
  Tasks and Questions are nested under `plan`. Manage and Archive are nested under `todos`.
  Props on `TasksTab`, `GuidingTab` and `ReminderWallTab` are identical to the old lines.
- `src/App.jsx:24-28`: `SubTabs` gets `nested = false`. The non-nested classes are
  unchanged: `text-sm`, `border-zinc-800`.
- `src/App.jsx:39-40`: new `recordsSub` state, default `plan`. `taskSub` is still used.
  No orphaned references to the removed `taskSub === "reminders"` branch (grep).
- This matches the owner's request: Task and Question under Plan & Balance, Reminders
  renamed To-Do's. Vision Board is not added, as the owner said ("not yet").

## Acceptance criteria

| AC | PASS/FAIL | Evidence |
|---|---|---|
| AC-1 top-level tabs order and labels, no Reminders/Tasks/Questions at top level | PASS | `tests/unit/recordsTabs.test.js:11-18` asserts the exact `SubTabs` line and that `["reminders", "Reminders"]` is absent. Code at `src/App.jsx:140`. |
| AC-2 Tasks/Questions under `plan`, same components and props | PASS | `recordsTabs.test.js:21-30`. Code at `src/App.jsx:143-146`. Props are byte-identical to the previous lines in the diff. |
| AC-3 Manage/Archive under `todos`, same `ReminderWallTab` props | PASS | `recordsTabs.test.js:33-42`, asserting the full `ReminderWallTab` line. Code at `src/App.jsx:150-151`. |
| AC-4 menu labels and `SECTION_LABEL` unchanged | PASS | `recordsTabs.test.js:45-51`. The diff does not touch `AppMenu.jsx`, and the `SECTION_LABEL` line is only context in the diff. |
| AC-5 no stored shape/key/settings/export change; only App.jsx, tests, docs | PASS | `recordsTabs.test.js:54-58`. `git diff --stat` confirms no `src/lib/`, `useStore` or `android/` change. |
| AC-6 `npm test` passes incl. source-read test | PASS | Gate above. `recordsTabs.test.js` has 6 tests, all passing. |

## CHECKPOINTS

- [x] C1.1 `init.sh` prints `[OK]`.
- [x] C1.2 Every AC maps to a named test (table above).
- [x] C1.3 Nothing deleted or skipped. One assertion in `todoChart.test.js:133-140` was
  updated from the old flat array to the new nested arrays. It still asserts that Records
  reaches tasks, questions and reminder management, so the intent is kept and the
  assertion is not weakened.
- [x] C1.4 No new `src/lib/` logic.
- [x] C2.1 Zero `in_progress` features; `init.sh` reports "no feature in progress".
- [x] C2.2 Every touched file is listed in `impl_records-tabs.md`.
- [x] C2.3 Nothing outside scope changed.
- [x] C2.4 No unrelated fixes.
- [x] C3.1-C3.4 No storage, setter, lib or native access touched.
- [x] C4.1 JSX only. C4.2-C4.5 N/A: no new Tailwind constants, icons, destructive actions
  or ids.
- [x] C5.1-C5.4 N/A: no stored shape change, and the "Never touch" items are untouched.
- [x] C6.1-C6.4 Unaffected. The AI-off state is whatever `GuidingTab` already renders.
- [x] C7.1 Web-only; `npm run build` (inside `init.sh`) is enough, no `cap:sync` needed.

## Required changes

None.

## Observations (non-blocking)

1. The tests are source-read string matches, so they are brittle to formatting. They do
   prove the contract the spec asks for, but nothing renders the component. The two-level
   bar at 390 px still needs a visual check by the owner, as the impl report says.
2. `feature_list.json` already has feature 23 as `done` (set by the leader in an earlier
   round, after `progress/review_records-tabs.md`). This review independently reaches the
   same verdict on the same code.
3. Opening a Task now costs one extra tap, and the label `To-Do's` differs from the main
   menu's `To-Do's Chart`. Both are tradeoffs the spec records as accepted.
