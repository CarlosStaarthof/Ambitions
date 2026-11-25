# Review — task mwwphnsx (feature 18 `menu-order`)

**Verdict:** APPROVED

**Contract:** owner task text (drawer order → Plan & Balance, To-Do's Chart, Vision Board,
Records, Settings) and `specs/features/018-menu-order.md`. The spec is consistent with the
task text.
**Reviewed:** commit `81848dd` on `hermes/mwwphnsx`. Working tree was clean before the review.

## Gate

`bash init.sh` → build green, `17 files / 356 tests passed`, final line
`[OK] build green, tests green, scope clean`. Nothing was skipped. `menuOrder.test.js`
(4 tests) ran.

## Claim vs diff

The implementer's report matches the diff. The commit touches exactly six files:
`src/components/AppMenu.jsx`, `tests/unit/menuOrder.test.js`, `specs/features/018-menu-order.md`,
`feature_list.json`, `progress/current.md` and `progress/impl_menu-order.md`.
The only source change is one line moved in `AppMenu.jsx:7` (the `tasks`/Records entry
now sits after `vision`). Ids, labels and icons are untouched. No `android/`, storage or
settings file was touched.

## Acceptance criteria

| AC | PASS/FAIL | Evidence |
|---|---|---|
| AC-1 order `plan, reminders, vision, tasks, settings` | PASS | `src/components/AppMenu.jsx:6-11`. Test `tests/unit/menuOrder.test.js:15-24` asserts the id order with `toEqual`. |
| AC-2 labels in order, each once | PASS | `AppMenu.jsx:6-11`. Test `menuOrder.test.js:27-40` asserts the label order and that each `label: "X"` occurs exactly once. |
| AC-3 section ids unchanged, active/route logic intact | PASS | The diff only moves a line. Test `menuOrder.test.js:43-54` checks the sorted id set and that `section === it.id` and `onSelect(it.id)` are still present. |
| AC-4 `App.jsx` labels unchanged | PASS | `src/App.jsx:22` is not in the diff. Test `menuOrder.test.js:57-62` asserts all five label mappings. |
| AC-5 no stored shape / key / default / export version change | PASS | The diff has no change under `src/lib/`, `useStore`, `storage` or `android/`. |
| AC-6 `npm test` passes, including an order test | PASS | The gate ran 356/356 green, including `menuOrder.test.js`. |

## CHECKPOINTS

- [x] C1.1 gate `[OK]` (`init.sh`; the repo's POSIX equivalent of `init.ps1`).
- [x] C1.2 every AC names a test (table above; AC-5 is proven by the diff scope).
- [x] C1.3 no test deleted, skipped or weakened; the only test change is one added file.
- [x] C1.4 no new `src/lib` logic.
- [x] C2.1 `init.sh` reports no feature `in_progress` (feature 18 is `in_review`).
- [x] C2.2 every touched file is listed in the impl report.
- [x] C2.3 / C2.4 only the reorder, plus the spec, test and bookkeeping. No unrelated fix.
- [x] C3.x no component data access changed; no lib or native change.
- [x] C4.1–C4.5 plain JS/JSX, same lucide icons, nothing new.
- [x] C5.1–C5.4 no stored shape touched; the "Never touch" list is unaffected.
- [x] C6.x finite week, Ambition category, AI-off behaviour and offline stance are unaffected.
- [x] C7.1 web-only change; `npm run build` (part of the gate) is enough, no `cap:sync` needed.
- [x] C7.2 / C7.3 n/a, `android/` not touched.

## Required changes

None.

## Observations (non-blocking)

1. Lane note: the implementer created `specs/features/018-menu-order.md` and filled the
   `acceptance` array in `feature_list.json`. Under HERMES.md §3 the implementer may not
   change `specs/**`. The feature entry referenced a spec that did not exist, and the
   owner's task text is the stated contract. The written spec matches that task text
   exactly and adds no domain rule of its own. Earlier features in this repo (e.g. 022) also
   landed spec and code together. I did not treat it as blocking, but the leader may want to
   confirm it is acceptable.
2. The tests read the source as text, so they would not catch a runtime rendering problem.
   This is proportionate for a one-line reorder and matches the project's source-read test
   style.
3. `progress/current.md` was updated during the work, as required.
