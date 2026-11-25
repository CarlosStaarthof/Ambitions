# Review — feature 23 records-tabs

**Verdict:** APPROVED

Reviewed: branch `hermes/mwwq1ex7`, HEAD `60cc653`, spec `specs/features/023-records-tabs.md`,
owner task text in the commit message, `CHECKPOINTS.md`, `AGENTS.md` lane rules.

## Gate

| Command | Result |
|---|---|
| `npm test --silent` | 18 test files passed, **362 tests passed**, 0 failed, 0 skipped |
| `bash init.sh` | build green, 18 files / **362 tests passed**, "no feature in progress", last line `[OK] build green, tests green, scope clean`. Nothing skipped. |
| `git status --short` after both | clean (no output) |

Note: `init.sh` reports "no feature in progress" because feature 23 is `in_review`, which is
correct per the status vocabulary (C2.1 holds: zero `in_progress`).

## Claim vs diff

`git show --stat HEAD` touches 7 files. The impl report (`progress/impl_records-tabs.md`)
lists 5 of them (App.jsx, spec, recordsTabs.test.js, todoChart.test.js, feature_list.json).

| File in diff | Disclosed? | Verified |
|---|---|---|
| `src/App.jsx` (+13/-9) | yes | Records regrouped (`App.jsx:140-153`); `SubTabs` gains `nested = false` (`App.jsx:24-28`); `recordsSub` state (`App.jsx:39`). Default rendering unchanged when `nested` is false: the non-nested class string is `"px-3 py-2 -mb-px border-b-2 text-sm "`, same classes as before (only ordering of the string differs). |
| `tests/unit/recordsTabs.test.js` (new, 6 tests) | yes | see AC table |
| `tests/unit/todoChart.test.js` | yes | see "Test integrity" below |
| `feature_list.json` | yes | entry 23 added as `in_review`; AC text matches the spec |
| `specs/features/023-records-tabs.md` | yes | see Observation 1 |
| `progress/current.md` | **not listed** in the report | Round-1 live-state note; minor (Observation 2) |
| `progress/impl_records-tabs.md` | is the report itself | n/a |

Not touched (verified with `git show --stat HEAD`, which lists no such path):
`src/components/AppMenu.jsx`, anything under `src/lib/`, `src/components/`, `android/`,
`capacitor.config.json`, settings defaults, export/normalize code. `src/App.jsx` has no
`localforage|saveKey|loadKey|version:` strings. `taskSub` / `setTaskSub` appear only in
`App.jsx`; no other file depends on the old `"reminders"` sub-tab id.

Props for the mounted components are byte-identical to the removed lines:
`TasksTab` (`App.jsx:144`), `GuidingTab` (`App.jsx:145`), `ReminderWallTab` (`App.jsx:151`).
Only the wrapping fragment and indentation moved.

### Test integrity (todoChart.test.js)

Old assertions (feature 14, `routes Records to tasks, questions and reminder management`):
- contains the flat array `[["tasks","Tasks"],["guiding","Questions"],["reminders","Reminders"]]`
- matches `taskSub === "reminders" &&`
- matches `<ReminderWallTab `

New assertions (`todoChart.test.js:~136-139`):
- contains `[["tasks","Tasks"],["guiding","Questions"]]`
- matches `recordsSub === "todos" &&`
- still matches `<ReminderWallTab `

The intent (Records still reaches tasks, questions and reminder management) is preserved:
the same test still requires the Tasks/Questions array and the ReminderWallTab mount, and the
reminders gate is swapped to its new equivalent. The test is not skipped or loosened beyond
what the spec-mandated restructuring demands, and the full set of the new structure is pinned
independently in `recordsTabs.test.js`. No test was deleted or skipped (362 total, up by the 6
new tests; no `.skip`/`.todo` added).

## Acceptance criteria

| AC | Result | Evidence |
|---|---|---|
| AC-1 top-level order `plan`/`todos`; no `Reminders`/`Tasks`/`Questions` top tab | PASS | `App.jsx:140` is exactly `tabs={[["plan", "Plan & Balance"], ["todos", "To-Do's"]]}`. Test: `recordsTabs.test.js` "puts Plan & Balance and To-Do's at the top of Records" asserts the whole `<SubTabs …/>` literal (exact order and labels) and `not.toContain('["reminders", "Reminders"]')`. |
| AC-2 Tasks, Questions under `plan`, same components/props | PASS | `App.jsx:141-146`: `recordsSub === "plan"` gate, nested array `[["tasks","Tasks"],["guiding","Questions"]]` (`:143`), `TasksTab` (`:144`), `GuidingTab` (`:145`). Test: "keeps Tasks and Questions under Plan & Balance with the same components" (exact nested literal, `recordsSub === "plan" &&`, `<TasksTab tasks={store.tasks}`, `<GuidingTab questions={store.questions}`). The test checks only prop prefixes; I verified full prop equality against the diff myself. |
| AC-3 Manage/Archive under `todos`, `ReminderWallTab` same props | PASS | `App.jsx:148-153`; nested array `[["wall","Manage"],["archive","Archive"]]` (`:150`); `ReminderWallTab` with the full prop literal (`:151`), `view={recordsReminderSub}`. Test: "keeps Manage and Archive under To-Do's with the reminder controls reachable" asserts the full literal of both lines. |
| AC-4 AppMenu and `SECTION_LABEL` unchanged | PASS | `AppMenu.jsx` not in the diff; `{ id: "tasks", label: "Records"` at `AppMenu.jsx:9`; `SECTION_LABEL` line `App.jsx:22` unchanged (no diff hunk touches it). Test: "leaves the main menu and section headers unchanged" (menu `Records`, `To-Do's Chart`; `tasks: "Records"`, `reminders: "To-Do's Chart"`). Pre-existing `todoChart.test.js` and `menuOrder.test.js` also pass. |
| AC-5 no storage/key/default/export change; only App.jsx, tests, docs touched | PASS | Diff file list above: only `src/App.jsx` in source. Test: "touches no storage, export or Android surface from App" (weak by itself, since it only greps App.jsx, but the diff review confirms the claim). `feature_list.json`, spec and `progress/*` are the docs/harness files. |
| AC-6 `npm test --silent` passes incl. source-read test | PASS | 18 files / 362 tests green, run by me; `recordsTabs.test.js` 6 tests green. |

Additional (spec "Contract"): `SubTabs` `nested` flag only dims/indents (`App.jsx:26`,
`:28`), and "marks both inner tab bars as nested" asserts exactly two ` nested />` usages.
`recordsSub` defaults to `"plan"` (`App.jsx:39`) as specified.

Owner task text check: "Task, Question fall under Plan & Balance" -> yes; "Reminders will
be called To-Do's" -> yes (`App.jsx:140`); "Vision Board (not yet, as an example)" -> not
added, correct; "Records menu will contain information about the other tabs" -> the Records
top tabs are named after Plan & Balance / To-Do's, matching the spec's reading of the ask.

## CHECKPOINTS walk

- [x] C1.1 `init.sh` prints `[OK] build green, tests green, scope clean` (run by me; the POSIX equivalent of `init.ps1`).
- [x] C1.2 Each AC maps to a named test (table above). AC-5's test is thin but is backed by the diff review.
- [x] C1.3 No test deleted/skipped; the one `todoChart.test.js` edit preserves intent (section above).
- [x] C1.4 No new pure logic in `src/lib/`; N/A.
- [x] C2.1 Zero features `in_progress` (feature 23 `in_review`).
- [x] C2.2 Every touched file listed in the impl report, except `progress/current.md` (harness scratchpad; minor, Observation 2).
- [x] C2.3 Nothing outside scope changed in source; only `src/App.jsx` among source files.
- [x] C2.4 No unrelated fix; the only extras are the `nested` styling flag, which the spec explicitly allows.
- [x] C3.1 No direct localForage access added; App still uses `store.*`.
- [x] C3.2 No state-setter change; only local UI state added (`recordsSub`).
- [x] C3.3 `src/lib/` untouched.
- [x] C3.4 No native access added.
- [x] C4.1 JS/JSX only, no TS annotations.
- [x] C4.2 Existing class strings reused; `nested` adds two small variants inside `SubTabs`, same file/pattern.
- [x] C4.3 No icons/charts added.
- [x] C4.4 No destructive actions added or changed; the `ReminderWallTab` internals are untouched.
- [x] C4.5 No new entities / ids.
- [x] C5.1 No stored shape changed; no `normalizeModel` change or version bump needed.
- [x] C5.2 No migration needed; no data change.
- [x] C5.3 "Never touch" list untouched (storage instance name, appId, Ambition category).
- [x] C5.4 No key/token surface touched.
- [x] C6.1 Week grid untouched.
- [x] C6.2 Ambition category untouched.
- [x] C6.3 AI gating untouched; `GuidingTab` still receives `aiEnabled`/`ai` as before.
- [x] C6.4 No network change.
- [x] C7.1 Web-only; `npm run build` is run inside `init.sh`, green.
- [x] C7.2 No `android/` change; impl report says no `cap:sync` is required.
- [x] C7.3 No plugin added; N/A.

## Required changes

None.

## Observations (non-blocking)

1. **Lane: the spec was authored in the implementer's commit.** `specs/features/023-records-tabs.md`
   and the `feature_list.json` entry arrive in the same commit (`60cc653`) as the code and tests,
   written by the same round. Under HERMES.md §3 the implementer may not change `specs/**`, and
   the spec-writer should not implement. The task framing here calls the spec "approved", and
   the repository's own history shows the same pattern for feature 18 (`81848dd`), so I judge
   the content (not the process) against the contract and found no scope or logic problem. The
   leader/owner should confirm the spec was approved before the code, since I cannot verify that
   from git alone. If the orchestrator's lane check is strict, this is the one item that could
   reject the phase; it is not a code defect.
2. `progress/current.md` was edited but is not named in the impl report's "What changed" table.
   Trivial; list it next time.
3. Tests are string-literal source reads, so a harmless reformat of `App.jsx` (for example
   wrapping a long line) would fail them. The AC-2 test also asserts only the prop-name prefix
   for `TasksTab`/`GuidingTab`, so a changed prop later would go unnoticed. The AC-5 test
   (`not.toMatch(/version:/)`) is a weak proxy. All acceptable for the spec's stated AC-6
   (source-read test), but a render test of Records would be more durable if the project
   ever gets a DOM test environment.
4. UI risk not covered by automated tests: two stacked tab bars at 390 px. The impl report
   already flags the device check (Records -> both levels readable). The inner bar uses
   `text-xs` and `border-zinc-900` (nearly invisible against a dark background); worth a
   quick visual look.
5. `taskSub` state name is now slightly misleading (it governs Tasks/Questions only) and
   `recordsReminderSub` could be renamed `todosSub`. Cosmetic only; do not change without a
   reason since tests pin these identifiers.
