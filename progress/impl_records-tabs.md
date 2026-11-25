# Implementation report — feature 23 `records-tabs`

**Status:** in_review (not self-approved)
**Spec:** `specs/features/023-records-tabs.md`
**Round:** 1 of 5 for this owner goal

## What the owner asked

Records should group its editing tabs under the names of the main sections they serve:
Tasks and Questions fall under **Plan & Balance**, and the old **Reminders** sub-tab is
called **To-Do's**. Vision Board was named as a future example, not added now.

## What changed

| File | Change |
|---|---|
| `src/App.jsx` | Records now has top-level `Plan & Balance` / `To-Do's` sub-tabs. `Tasks` and `Questions` moved under Plan & Balance; the reminder controls moved under To-Do's unchanged. `SubTabs` gained an optional `nested` flag that only dims/indents the inner bar. New local state `recordsSub` (default `plan`). |
| `specs/features/023-records-tabs.md` | New spec with the owner's decisions and six acceptance criteria. |
| `tests/unit/recordsTabs.test.js` | New source-read test: top-level order/labels, Tasks & Questions under Plan & Balance, Manage & Archive under To-Do's, menu/header unchanged, no storage surface, both inner bars marked nested. |
| `tests/unit/todoChart.test.js` | One assertion that pinned the old flat `Tasks / Questions / Reminders` array now asserts the new nested arrays; its intent (Records still reaches tasks, questions and reminder management) is unchanged. |
| `feature_list.json` | Feature 23 added, `in_review`, acceptance criteria filled from the spec. |

## What did not change

No localForage key, stored shape, settings default, export version, section id, menu
label, section header, component prop, or `android/` file. Tasks, Questions, Manage and
Archive are the same components with the same props; only the tab that reveals them
changed.

## Acceptance criteria → evidence

| AC | Evidence |
|---|---|
| AC-1 | `tests/unit/recordsTabs.test.js` "puts Plan & Balance and To-Do's at the top of Records" |
| AC-2 | same file, "keeps Tasks and Questions under Plan & Balance with the same components" |
| AC-3 | same file, "keeps Manage and Archive under To-Do's with the reminder controls reachable" |
| AC-4 | same file, "leaves the main menu and section headers unchanged" |
| AC-5 | same file, "touches no storage, export or Android surface from App"; `git diff` limited to the files above |
| AC-6 | `npm test --silent` → 18 files, 362 tests passed; `bash init.sh` → `[OK]` |

## Gate

- `npm test --silent`: 18 files, 362 tests passed.
- `bash init.sh`: `[OK]` (build + tests + scope clean).

## Device check still needed

Open Records and confirm the two levels read clearly on a 390 px viewport: the top bar
shows Plan & Balance and To-Do's, and the indented inner bar shows Tasks / Questions or
Manage / Archive. No other device behaviour is affected; this is a web-only change, so no
`cap:sync` is required.

## Remaining for this goal

- Reviewer approval for feature 23; then the leader may move it to `done`.
- The Vision Board Records sub-tab is deliberately deferred until it has a management
  surface to hold.
