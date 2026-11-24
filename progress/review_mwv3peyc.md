# Review — branch hermes/mwv3peyc (owner rulings recorded in specs 011 and 012)

**Verdict:** APPROVED

All five required changes from `progress/review_mwv3gmgd.md` are met. The owner rulings are
recorded in both specs under "Owner rulings, 2026-11-18" and applied to 012's body.
The work is spec-only.

## Gate

`bash init.sh`: build green, 5 test files / 140 tests passed, "no feature in progress",
`[OK] build green, tests green, scope clean`. Nothing skipped. The gate does not exercise specs.

## Claim vs diff

HEAD c5fef35 (`git diff HEAD~1 --stat`) changes 4 files: `feature_list.json` (012 title/why
only; status stays `spec_ready`), `progress/current.md`, `specs/features/011-reminder-wall.md`
(+17) and `specs/features/012-block-notes.md`. No `src/`, `tests/` or `android/` change, so
"no implementation" holds. `git status` is clean. `progress/current.md` states the work is
stopped for owner approval.

## Required changes from the previous review

| RC | PASS/FAIL | Evidence |
|---|---|---|
| 1. `## Owner rulings, 2026-11-18` in 011 and 012 | PASS | 011:327-342; 012:408-430 (end of file in both) |
| 2. Ruling 3 applied: no audio, dictation, non-AI cleanup, opt-in AI, key on device only | PASS | `grep` for `voice-invalid`, `voice-too-long`, `MAX_VOICE_MS`, `dataUrl`, `durationMs`, `startVoice`, `kbps` finds none in 012. Remaining "audio" hits are only negations (012:53, 76, 128, 199, 222, 256, 264, 276, 320, 339, 371). Dictation: B5 and `dictation.js` (012:~190-200). `cleanDictation`: contract and AC-7. Polish: B10, `notePolish.js` and AC-15. Key: AC-12 source test (no `aiKeys` or `secure` in the envelope) and AC-15. |
| 3. Ruling 2 applied | PASS | B3 and B9. `categoryRunAt` replaces the drag selection (012 Contract). AC-2 states the day boundary (Mon slot 47 end 48, Tue slot 0 start 48). AC-8 covers `longPressMs` default 500 and 500 ms steps. AC-9 keeps the brush and `touch-action: none` rule. The range is raised as open question 4, not guessed. |
| 4. Ruling 4 in Out of scope | PASS | 012:~367 "Reading notes back in the user's own voice" |
| 5. `progress/current.md` updated, stop for approval | PASS | `progress/current.md` diff: "Stopped for owner approval of specs 011 and 012. No implementation." |

## Owner rulings

| Ruling | PASS/FAIL | Evidence |
|---|---|---|
| (1) Error list and ACs agree | PASS | 011: every code (`name-empty`, `name-duplicate`, `category-missing`, `category-not-empty`, `text-empty`, `reminder-not-found`, `reminder-archived`) has a failing-case AC (AC-4 to AC-9). The mapping is in 011:333-336. 012: `range-invalid` and `empty-note` in AC-4, `overlap` in AC-3 and AC-5, `note-not-found` in AC-5. |
| (2) Hold time setting, same-category run | PASS | see RC 3 |
| (3) Dictation, no audio, optional AI, key on device | PASS | see RC 2. Voice-invalid case and 2-minute cap are gone. |
| (4) Voice playback is future, out of scope | PASS | see RC 4 |

## Acceptance criteria

Both specs have exactly 15 ACs (within 5-15). Each is independently testable, with
Vitest/source-reading vs device split declared in each Verification section.

| AC | PASS/FAIL | Evidence |
|---|---|---|
| 011 AC-1…AC-15 | PASS | the only 011 change is the appended rulings block; AC text unchanged and consistent with the Contract error list (011:153-165, 216-282) |
| 012 AC-1 | PASS | shape with no `taskId`, `audio` or key field (012:274-278) |
| 012 AC-2 | PASS | `categoryRunAt`, with day-boundary examples |
| 012 AC-3 | PASS | `canPlaceNote`, `overlap`, `noteAt` |
| 012 AC-4 | PASS | `addNote` codes and non-mutation |
| 012 AC-5 | PASS | `updateNote`, including `note-not-found` |
| 012 AC-6 | PASS | `removeNote` |
| 012 AC-7 | PASS | `cleanDictation`: concrete success example, no-op case, idempotence |
| 012 AC-8 | PASS (Device) | hold setting, run selection, day edge |
| 012 AC-9 | PASS (Device) | brush vs note, `touch-action: none` |
| 012 AC-10 | PASS (Device) | viewer, no audio control |
| 012 AC-11 | PASS (Device) | save, edit, armed delete |
| 012 AC-12 | PASS | `version: 6`, v4/v5 import, source test that the envelope has no key (current `DataTab.jsx:19` writes `version: 5`, so the bump is a future-implementation item) |
| 012 AC-13 | PASS | `mergeImportedWeeks` by id, idempotent |
| 012 AC-14 | PASS | `{ ...wk, cells: {} }`; marker on the device |
| 012 AC-15 | PASS | dictation, permission, plugin order, polish gating, key never persisted |

## CHECKPOINTS (spec-only change)

- [x] C1.1 Gate `[OK]`.
- [x] C1.3 No test deleted or weakened.
- [x] C2.2-C2.4 Only specs, `progress/current.md` and the descriptive text of 012 in `feature_list.json` changed; no code.
- [x] C5.4 / C6 Key stored only on the device and never exported: AC-12 and AC-15.
- [x] C6.3 AI off is identical: the default non-AI cleanup is described (UI states, AC-15).
- [x] Others: unchanged from the previous review.

## Required changes

None.

## Observations (non-blocking)

1. Open question 4 (the hold-time minimum and maximum) is still open and must be answered by
   the owner before implementation. This is correct: the spec does not guess.
2. Dictation depends on a hand-written `DictationPlugin` and `RECORD_AUDIO`. The owner should
   confirm this is acceptable before approving, since it is the one new Android permission.
3. 012 is long (about 430 lines against the ~200-line aim), though it stays within the 15-AC
   rule. Splitting it into notes + dictation phases is an option for the owner.
4. The `feature_list.json` edit is descriptive only (title and why for 012); status is unchanged.
5. `init.sh` has no execute bit (pre-existing, unrelated).
