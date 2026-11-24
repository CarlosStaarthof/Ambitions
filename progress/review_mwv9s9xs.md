# Review — mwv9s9xs (feature 13, vision-board-text)

**Verdict:** APPROVED

Branch `hermes/mwv9s9xs`, commit 6382bbb. The contract is the task text, plus
`specs/features/013-vision-board-text.md` (written by the implementer in this commit; see
Observation 1). I checked `progress/impl_vision-board-text.md` against `git diff HEAD~1`. The report matches the diff.

## Gate
- `bash init.sh`: `[OK] build green, tests green, scope clean`. 9 files, 233 tests passed,
  including `tests/unit/vision.test.js` (14 tests). One feature `in_progress` (13). Nothing was skipped.
  (`./init.sh` is not executable in this checkout, so I ran it through `bash`.)
- `git status`: clean tree.
- Files touched: `src/App.jsx`, `src/components/VisionTab.jsx`, `src/lib/useStore.js`,
  `src/lib/vision.js` (new), `tests/unit/vision.test.js` (new), `feature_list.json`,
  `specs/features/013-…`, `specs/domain-model.md`, `progress/*`. All are on the vision-board
  topic, and all are listed in the impl report except the `domain-model.md` wording tweak (Observation 2).

## Task requirements
| Owner request | PASS/FAIL | Evidence |
|---|---|---|
| Break each box's link to an ambition task | PASS | `VisionTab.jsx` no longer imports `Link2`/`selectCls` and has no `tasks`/`categories` props or `<select>`; `App.jsx:122` passes only `vision` and `setVisionP`. `grep taskId src` only matches the migration in `src/lib/vision.js`. |
| Open text field, max 250–300 chars, linked to nothing | PASS | `VisionTab.jsx` textarea has `maxLength={VISION_TEXT_MAX}` (280) and clamps in `onChange`; a live `n/280` counter sits under it. |
| Year switcher recognises the current year, with a "today"-style button like Plan & Balance | PASS | `VisionTab.jsx` `currentYear = new Date().getFullYear()`, and `year !== currentYear && <button … setYear(currentYear)>This year</button>`. This mirrors `WeekTab.jsx:240` (`!isThisWeek && … Today`). |
| Tidy the "What 2026 looks like" header: count beside the title, Add image on the right | PASS | `VisionTab.jsx` header row: title and `{done}/{items.length} reached` in one `flex items-baseline` group, and the Add image button in a `shrink-0` block on the right. |
| Remove the KB-of-images readout | PASS | `humanSize`/`dataUrlBytes` imports and the readout are gone; the footer copy no longer mentions size. |

## Acceptance criteria (spec 013)
| AC | PASS/FAIL | Evidence |
|---|---|---|
| AC-1 no task link in VisionTab; App passes only vision/setVisionP | PASS | `vision.test.js` "no longer links a picture to an ambition task" (regexes for `taskId`, `Link2`, `ambitionTasks`, and the exact `<VisionTab …/>` line). Confirmed in the diff. |
| AC-2 textarea with `maxLength` and live `/280` counter | PASS | `vision.test.js` "uses a bounded textarea with a live counter". Code at `VisionTab.jsx` (textarea + counter div). |
| AC-3 `clampVisionText` 281→280, 280 unchanged, non-strings → "" | PASS | `vision.test.js` "truncates past the limit…" and "returns an empty string for non-strings". Values asserted. |
| AC-4 `normalizeVisionItem` drops taskId, keeps the rest, idempotent | PASS | `vision.test.js` "drops taskId and keeps every other field" (`toEqual`, no mutation of the input, second run equal). |
| AC-5 `normalizeVision` keeps year keys, clamps, drops taskId, preserves non-array, idempotent | PASS | `vision.test.js` "keeps every year, drops taskId, clamps captions and is idempotent" and "preserves a non-array year value…". |
| AC-6 `useStore` loads vision via `normalizeVision` | PASS | `useStore.js:98` `setVision(normalizeVision(vis.value))`; the test asserts that line. No key added. |
| AC-7 title kept, count in the same row, Add image on the right | PASS (weak test) | The code is correct. The test only checks that the three strings exist; it does not assert their placement. See Observation 3. |
| AC-8 no image-size readout | PASS | `vision.test.js` "shows no image-size readout" (no `humanSize`/`dataUrlBytes`/KB/MB). |
| AC-9 "This year" button only off the current year | PASS | `vision.test.js` "offers a This year jump only outside the current year". |
| AC-10 new image has `caption: ""` and no `taskId` | PASS | `VisionTab.jsx` `addFiles` object has no `taskId`; the test asserts `caption: ""`, and AC-1's test asserts no `taskId` anywhere in the file. |
| AC-11 tests and build green | PASS | See Gate. |

## Checkpoints
- [x] C1.1 gate prints `[OK]`.
- [x] C1.2 every AC maps to a test (AC-7 weakly, see Observation 3).
- [x] C1.3 no test was deleted or weakened; the diff only adds `vision.test.js`.
- [x] C1.4 new `src/lib/vision.js` has unit tests, with success and failure cases.
- [x] C2.1 exactly one feature `in_progress` (13). Feature 12 was moved to `in_review` so the gate allows this.
- [x] C2.2 touched files are listed in the impl report (the `domain-model.md` tweak is not, Observation 2).
- [x] C2.3 / C2.4 no unrelated change.
- [x] C3.1 / C3.2 the component writes only through `setVisionP`. C3.3 `vision.js` is pure.
- [x] C3.4 N/A (no native access).
- [x] C4.1–C4.5 JS/JSX; `card`/`btnPrimary` reused from `ui.js`; lucide icons; `useArmed` kept for delete; `uid()` kept.
- [x] C5.1 the stored shape is unchanged in kind. `taskId` is removed and `caption` is clamped in memory on load. There is no export-version bump, and it is justified: the envelope shape did not change, and old exports still load through `normalizeVision`. See Observation 4.
- [x] C5.2 migration written and tested (`normalizeVision` tests).
- [x] C5.3 nothing from the "Never touch" list was changed.
- [x] C5.4 no secrets.
- [x] C6.1–C6.4 unaffected.
- [x] C7.1 web-only; `npm run build` is enough. No `android/` change.

## Required changes
None.

## Observations (non-blocking)
1. Lane: the implementer authored `specs/features/013-…`, edited `specs/domain-model.md` and added the feature
   to `feature_list.json`. HERMES §3 puts `specs/**` in the spec-writer's lane. The task text gave no spec, and
   the earlier approved branches (e.g. mwv7eca8) set the same precedent, so I did not block. The owner should
   confirm spec 013's wording (280 cap, `This year` label) before moving the feature to `done`.
2. `specs/domain-model.md` was edited (caption wording) but is not named in the impl report.
3. The AC-7 and AC-10 tests are source-regex checks, which is the repo's convention (no component tests). They would not catch a layout regression
   (e.g. Add image moving back below the title). A 390 px device check of the header and the two-column
   cards is still owed, and the impl report says so.
4. `DataTab` import does not run `normalizeVision`, so an imported legacy backup keeps `taskId` in
   storage until the next app load. It is harmless, because nothing reads it and the next load strips it. Consider normalising on import later.
5. `init.sh` has no executable bit in this checkout (`Permission denied` via `./init.sh`); pre-existing.
