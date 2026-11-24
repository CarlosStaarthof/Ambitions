# Review — branch hermes/mwv3gmgd (review fixes for specs 011 and 012)

**Verdict:** CHANGES_REQUESTED

The four required changes from `progress/review_mwv2i4pq.md` were addressed correctly. But the
task says the owner's /steer rulings override the goal text and must be recorded in specs 011
and 012 under "Owner rulings, 2026-11-18". None of them were applied. Rulings 2, 3 and 4 are
absent. Ruling 3 explicitly orders the removal of things the diff has just extended (see
Required change 2).

## Gate

`bash init.sh`: build green, 5 test files / 140 tests passed, "no feature in progress",
`[OK] build green, tests green, scope clean`. Nothing skipped. The gate does not exercise specs.

## Claim vs diff

HEAD 9d0688b changes 3 files: `progress/current.md`, `specs/features/011-reminder-wall.md`
and `specs/features/012-block-notes.md`. No code, tests, `feature_list.json` or `android/`
change, so the "no implementation" part is met. The merge of `origin/hermes/mwv2i4pq` was a
fast-forward (HEAD~1 is 9b3f0f6). `git status` is clean.
`progress/current.md` does not mention the owner rulings at all.

`grep -n -i "owner rulings|dictation|api key|own voice|same category"` over both specs finds
nothing. `voice-invalid`, `voice-too-long` and `MAX_VOICE_MS` are still in 012 (lines 133,
160-161, 175, 250, 255, 261-264, 307).

## Review-fix items (from review_mwv2i4pq.md)

| Item | PASS/FAIL | Evidence |
|---|---|---|
| RC1 `markDone` idempotent vs `reminder-archived` | PASS | 011:159-165 (error list now says edit only), 011:253-257 (AC-9 asserts one outcome: wall unchanged, `error: undefined`) |
| RC2 `category-missing` / `reminder-not-found` in ACs, case-only rename | PASS | 011:233-238 (AC-5), 011:241 (AC-6), 011:248-252 (AC-8), 011:253-257 (AC-9) |
| RC3 `voice-invalid` AC and AC-8 split | PASS as a fix, but superseded by ruling 3 | 012:250, 255, 261-264, 307-318 |
| RC4 long-press vs brush, `touch-action` | PASS as a fix, but must be redone for ruling 2 | 012:220-223, 270-277, 351-355 |
| Obs 2 stray self-reference | PASS | 011:18-20 |

## Owner rulings (override the goal text)

| Ruling | PASS/FAIL | Evidence |
|---|---|---|
| Section "Owner rulings, 2026-11-18" recorded in 011 and 012 | FAIL | not present in either file |
| (1) Items 1 and 2: error list and ACs agree | PASS | 011 error list vs AC-5…AC-9; every code in the list now has a failing-case AC (checked `name-empty`, `name-duplicate`, `category-missing`, `category-not-empty`, `text-empty`, `reminder-not-found`, `reminder-archived`). This was done without being recorded as a ruling. |
| (2) Hold time is a user setting, default 0.5 s, steps of 0.5 s; long-press selects the whole unbroken same-category run above and below within that day; the note belongs to that run | FAIL | 012:270-277 (AC-9) still has a fixed "~500 ms" and "adjacent blocks … contiguous range" drag selection; no setting, no same-category run rule |
| (3) No audio stored; dictation with non-AI filler/repeat cleanup; optional AI polish only with the user's own on-device key, never exported; remove voice-invalid and the 2-minute cap | FAIL | 012 still specifies stored audio (`audio`, `dataUrl`, `mime`, `durationMs`), `startVoice`/`stopVoice` (012:175), `MAX_VOICE_MS = 120000` (012:133), `voice-invalid` and `voice-too-long` (012:160-161), and ACs 5, 6 and 8. The diff extended `voice-invalid` instead of removing it. |
| (4) Reading notes back in the user's own voice recorded as a future feature, out of scope | FAIL | not mentioned in 012's Out of scope list |

## Acceptance criteria

The goal is "address every required change; do not add new scope", plus the owner rulings. The
ACs of 011 are consistent after the fixes (AC-5 to AC-9 PASS). The ACs of 012 that the
rulings invalidate cannot be approved.

| AC | PASS/FAIL | Evidence |
|---|---|---|
| 011 AC-1…AC-4, 7, 10–15 | PASS (unchanged from the previous review) | unchanged by this diff |
| 011 AC-5, 6, 8, 9 | PASS | 011:233-257 |
| 012 AC-1…4, 7, 10–15 | PASS | unchanged apart from audio references that ruling 3 will change (AC-10 mentions play control; AC-15 covers microphone permission and plugin, which ruling 3 removes or replaces) |
| 012 AC-5, 6 | FAIL | 012:247-259 still require `voice-invalid` and audio |
| 012 AC-8 | FAIL | 012:261-264 requires the 2-minute cap that ruling 3 removes |
| 012 AC-9 | FAIL | 012:270-277 contradicts ruling 2 (fixed hold, contiguous drag instead of same-category run, no setting) |

## CHECKPOINTS (spec-only change)

- [x] C1.1 Gate `[OK]`.
- [x] C1.3 No test was deleted or weakened.
- [x] C2.2–C2.4 Only specs and `progress/current.md` changed.
- [ ] C5.4 / C6 The owner ruling that the API key is stored only on device and never exported
      is not in the spec. Without it, an implementer could put the key into the export
      envelope. Not satisfied.
- [ ] C6.3 The "AI off is identical" rule must now describe the default non-AI cleanup. Not
      updated.
- [x] Others: unchanged from the previous review.

## Required changes

1. `specs/features/011-reminder-wall.md` (end of file) and `specs/features/012-block-notes.md`
   (end of file): add a section `## Owner rulings, 2026-11-18` in each, recording the rulings
   that apply to that spec. 011 gets ruling (1). 012 gets rulings (1) where relevant, (2), (3)
   and (4).
2. `specs/features/012-block-notes.md:133, 160-161, 175, 250, 255, 261-264, 307-318` — apply
   ruling 3. Remove stored audio (`audio`, `dataUrl`, `mime`, `durationMs`), `MAX_VOICE_MS`,
   `voice-invalid`, `voice-too-long`, `startVoice`/`stopVoice`, and the audio parts of
   AC-5, AC-6, AC-8, AC-10 and AC-15. Replace them with: dictation through the phone's
   built-in speech-to-text into the note text; a pure, non-AI cleanup function that removes
   fillers (uh, um, you know) and repeated words, with its own testable AC (success and
   failure/no-op case); optional AI polish only when the user has entered their own API key
   and turned it on, with non-AI as the default; the key stored only on the device and never
   in an export (testable by a source-reading AC on the export envelope). Fix the
   microphone/plugin criterion (AC-15) and the Verification section to match. If the 15-AC
   count changes, keep the spec at 5–15 ACs.
3. `specs/features/012-block-notes.md:220-223, 270-277, 351-355` — apply ruling 2. The hold
   time is a user setting, default 0.5 s, adjustable in 0.5 s steps (say where it is stored
   and its minimum and maximum, or raise them as an open question; do not guess). A long-press
   selects the whole unbroken run of the same category above and below the pressed block in
   that day, such as a sleep or work shift, and the note belongs to that run. Replace the
   "drag over adjacent blocks" selection logic and the matching pure function (AC-3/AC-4) so
   the range is derived from category continuity, and keep the brush rule from the previous
   fix. Make sure the AC states the day-boundary behaviour.
4. `specs/features/012-block-notes.md` Out of scope: add "reading notes back in the user's own
   voice" as a future feature (ruling 4).
5. `progress/current.md`: record that the rulings were applied, and stop for owner approval.
   (This is a non-blocking tidy-up if it is not in the reviewer's remit. It is listed only
   because the report currently describes the work as complete.)

## Observations (non-blocking)

1. The fixes made by this round (RC1–RC4) are of good quality, and the case-only-rename and
   idempotent `markDone` wording are testable as written.
2. The goal text's rulings mention "specs 011 and 012" together. Only ruling (1) concerns
   011; the others touch 012 alone. 011 needs only the ruling record, not new behaviour.
3. Ruling 3 shrinks 012 substantially (no data URLs, no export-size open question 4, no
   Android recorder plugin). Open question 4 (32 kbps) should be removed along with it.
4. `init.sh` has no execute bit (pre-existing, unrelated).
