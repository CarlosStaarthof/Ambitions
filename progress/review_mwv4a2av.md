# Review — feature 11 `reminder-wall` (branch hermes/mwv4a2av)

**Verdict:** APPROVED

**Spec:** `specs/features/011-reminder-wall.md` (approved, incl. owner rulings 2026-11-18).
**Diff reviewed:** `c701d45..HEAD` (commit 4e8ce5e), 16 files. `git status` clean.

## Gate

- `npm test` → 6 files, 162 tests passed (22 new in `tests/unit/reminderWall.test.js`).
- `bash init.sh` → `[OK] build green, tests green, scope clean`; reported `in progress: 11 reminder-wall`.
  Nothing skipped; build ran.

## Claim verification

The impl report matches the diff. Every file in the diff is listed in `progress/impl_reminder-wall.md`.
No `android/**`, `tasks`, `weeks`, `seed.js` or notification code changed. Feature 12 was not
started (its `feature_list.json` status is still `spec_ready`; only the spec header was flipped, as instructed).
Pinned assertions in `reminders.test.js`, `tasks.test.js` and `seed.test.js` were updated to
version 6 and eight keys. Each still asserts the old values and adds the new one, so none was
weakened or deleted.

## Acceptance criteria

| AC | PASS/FAIL | Evidence |
|---|---|---|
| 1 | PASS | Eighth key read/normalised/written: `src/lib/useStore.js:46,75,94,117`. Seeding via `loadDecision` over all 8 reads (`useStore.js:53`; `tests/unit/seed.test.js:218,236,244`). Key-set pin updated: `tests/unit/reminders.test.js:284-288`. Source-read: `reminderWall.test.js:266-274`. |
| 2 | PASS (rendered half = device) | Module/view contain no time-block or settings writers: `reminderWall.test.js:277-287`. Wall is a separate store, so the Week brush picker cannot see its categories. |
| 3 | PASS | `reminderWall.test.js:19-55` (malformed inputs, trim/drop, single `uncategorized` only when needed, idempotent, non-mutating). Impl `reminderWall.js:46-103`. |
| 4 | PASS | `reminderWall.test.js:60-80`; `reminderWall.js:121-134`. |
| 5 | PASS | Case-only rename `work`→`WORK` accepted, id/colour/items kept, `category-missing`, `name-empty`, `name-duplicate`: `reminderWall.test.js:83-108`. Impl `reminderWall.js:136-153` (duplicate check excludes self). |
| 6 | PASS | Active and archived items moved to `uncategorized`, count unchanged, `category-not-empty`, empty-category delete, `category-missing`: `reminderWall.test.js:111-137`; `reminderWall.js:155-173`. |
| 7 | PASS | `reminderWall.test.js:142-158`; `reminderWall.js:175-182`. |
| 8 | PASS | All four error codes plus id/createdAt/doneAt preservation: `reminderWall.test.js:161-186`; `reminderWall.js:184-196`. |
| 9 | PASS | `markDone` sets `doneAt`/`updatedAt`; second call returns an unchanged wall with `error` undefined; unknown id → `reminder-not-found`: `reminderWall.test.js:189-201`. The "appears in archive, not in active" half is covered by AC-10's list tests and the filter in `reminderWall.js:105-115`. |
| 10 | PASS | Newest-first ordering, stable ties, new arrays, `categoryUsage` counts both: `reminderWall.test.js:204-217`. |
| 11 | PASS (Device) | Not unit-testable. Source: `ReminderWallTab.jsx:197-239` has post-its tinted by category colour, an All filter plus a button per category, and Edit and Done controls. |
| 12 | PASS (Device) | Archive branch `ReminderWallTab.jsx:105-127` has text, category name and done date, and no edit/untick/delete control. Three separate empty-state lines: `:109`, `:213-216` (`No reminders on the wall.` / `No reminders in this category.`). |
| 13 | PASS (Device) | Add/rename show inline errors via `COPY` (`:16-24`, `:178`, `:225`). Delete uses `useArmed` and its armed copy gives the count (`:158-164`). Uncategorized with items is disabled with a reason (`:137,160,173-175`). With no category the new-reminder form is not rendered (`:178`); edit with a missing category returns `category-missing`. No `window.confirm` (asserted at `reminderWall.test.js:286`). |
| 14 | PASS | Envelope `version: 6` plus `reminderWall`: `DataTab.jsx:20`, tests at `reminderWall.test.js:290-298` and `tasks.test.js:417-420`. Merge tests: file wins a shared id and stored omissions are kept (`:222-243`), absent/null field leaves the stored wall intact (`:246-250`), round-trip with `doneAt` and idempotency (`:253-264`). Import calls the merge then normalises: `DataTab.jsx:53`. An older export is accepted: the import gate (`DataTab.jsx:31`) checks only `tasks` and `weeks`. |
| 15 | PASS | Source-read: no `callAI`, `fetch(`, `@capacitor`, `notify` or settings writers in the lib or view (`reminderWall.test.js:277-287`). Manual read of `ReminderWallTab.jsx` confirms it. |

## Checkpoints

- [x] C1.1 init.sh `[OK]`
- [x] C1.2 every AC maps to a test, or to a spec-declared device-only item (11–13, rendered half of 2)
- [x] C1.3 no test deleted, skipped or weakened (diffs reviewed)
- [x] C1.4 new pure logic in `src/lib/` has unit tests
- [x] C2.1 exactly one feature `in_progress` (11)
- [x] C2.2 every touched file is listed in the impl report
- [x] C2.3 scope: only the wall, the key, the envelope, the menu and the pinned tests
- [x] C2.4 no unrelated fixes
- [x] C3.1 the component never touches localForage
- [x] C3.2 uses `setReminderWallP`
- [x] C3.3 `reminderWall.js` is pure (asserted by test)
- [x] C3.4 n/a, no native access
- [x] C4.1 JS/JSX only
- [x] C4.2 `card`, `inputCls`, `selectCls`, `btnPrimary` and `btnGhost` are reused from `ui.js`
- [x] C4.3 lucide icons
- [x] C4.4 category delete uses `useArmed`
- [x] C4.5 ids come from `uid()` (`ReminderWallTab.jsx:51,72`)
- [x] C5.1 the export version is bumped to 6. `normalizeModel` is for tasks and categories, and the spec puts wall repair in `normalizeReminderWall`
- [x] C5.2 no rewrite migration, per the spec. Absence means empty, and the in-memory repair is tested (AC-3)
- [x] C5.3 no "Never touch" item changed
- [x] C5.4 no secrets involved
- [x] C6.1 week grid untouched
- [x] C6.2 Ambition category untouched
- [x] C6.3 no AI surface
- [x] C6.4 no network
- [x] C7.1 web-only, so `npm run build` inside init.sh is enough. C7.2/C7.3 n/a

## Required changes

None.

## Observations (non-blocking)

1. The implementer edited `specs/011-*.md` and `specs/012-*.md` (status `draft`→`approved`). HERMES.md §3
   keeps `specs/**` outside the implementer lane, but the task text explicitly instructed it
   ("mark both approved"). The change is one header word in each file. Hermes' lane check may still
   flag it; it is the orchestrator's call.
2. The AC-2 independence claim is only a source-read check plus the architectural separation. That is
   what the spec's Verification section prescribes, and the rendered half is device-only.
3. `ReminderWallTab` has no component tests (repo has none). A device check of AC-11–13 is still owed
   before the owner signs off.
4. The `Uncategorized` row can be renamed. The spec is silent and nothing breaks, because the id is what matters.
5. Feature 12 remains `spec_ready` in `feature_list.json` while its spec header says `approved`. That
   follows the status vocabulary and is not a defect.
