# Review — fix of review mwv4y4y9 (feature 12 block-notes), branch hermes/mwv5rncm

**Verdict:** APPROVED

Owner ruling (long-press default 500 ms, max 3000 ms) was applied before judging. It was already
correct in the base (`LONG_PRESS_MIN/MAX/STEP = 500/3000/500`, `DEFAULT_SETTINGS.longPressMs = 500`)
and this round does not touch it. No new scope was added.

## Gate
- Fast-forward merge verified: `origin/hermes/mwv4y4y9` (3245703) is an ancestor of HEAD.
- `npm test` -> 8 files, 215 tests passed (was 208).
- `bash init.sh` -> `[OK] build green, tests green, scope clean` (in progress: 12). Nothing skipped.
- Independent brute force over every 1-6 token string from {um, uh, you, know, I, think, the, UM, Know}:
  0 non-idempotent outputs of `cleanDictation`.

## Diff vs. claim
`git diff 3245703..HEAD` touches exactly 4 files: `progress/current.md`, `src/lib/notes.js`,
`tests/unit/notes.test.js`, `tests/unit/notePolish.test.js` (new). No `specs/**`, no
`feature_list.json`, no other source change. This matches the report in `progress/current.md`.

## Required changes from review_mwv4y4y9 — status
| # | Result | Evidence |
|---|---|---|
| 1 `cleanDictation` idempotent + test | PASS | `src/lib/notes.js:118-128` loops filler removal, "you know" removal, repeat collapse and whitespace until output is stable. Test `tests/unit/notes.test.js:196-201` asserts `cleanDictation(once) === once` for `"you you know know"` and `"um um you you know know"`. AC-7 examples at `notes.test.js:176-193` still pass. |
| 2 `polishText` tests | PASS | New `tests/unit/notePolish.test.js`: `polish-disabled` when AI off (`:20`), provider `none` (`:26`), key missing/blank (`:32`), blank text (`:39`); each asserts `callAI` not called. Success path mocks only `../../src/lib/ai.js` `callAI` (`:5-6`), asserts `{ text: "Clean note." }`, only key `text`, no secret in `JSON.stringify(result)`, key present only in the call context (`:49-67`). Extra: `polish-failed` on reject / empty answer (`:69-74`). |

## Acceptance criteria (feature 12, re-walked for the changed ones)
| AC | PASS/FAIL | Evidence |
|---|---|---|
| AC-7 `cleanDictation` idempotent | PASS | `notes.js:118-128`; `notes.test.js:190-201`; brute force 0 failures |
| AC-15 polish gating / key never persisted | PASS (source) / Device | `notePolish.test.js:19-74`; UI half remains device-only per spec |
| AC-1..6, 12, 13 | PASS (unchanged) | covered in `review_mwv4y4y9.md`; tests still green |
| AC-8..11, 14 marker | Device | unchanged; need owner's on-device check after `npm run cap:sync` and rebuild |

## CHECKPOINTS
- [x] C1.1 init prints `[OK]`.
- [x] C1.2 AC-7 idempotence and AC-15 polish gating now have tests that prove them.
- [x] C1.3 No test deleted, skipped or weakened (diff only adds tests).
- [x] C1.4 `notePolish.js` now has unit tests (success and failure).
- [x] C2.1 Exactly one feature `in_progress` (12).
- [x] C2.2 Touched files match the report; nothing out of scope.
- [x] C3 / C4 / C5 / C6 unchanged from the previous review; no layering, storage-key or never-touch violations.
- [x] C5.4 Test confirms the key is not in `polishText`'s return value.
- [x] C7.2 Android sync/rebuild still needed by the owner for device checks (unchanged).

## Required changes
None.

## Observations (non-blocking)
- `dictation.js` still has no web-path unit test (no `SpeechRecognition` -> `dictation-unsupported`); optional.
- The `feature_list.json` 11 `in_review` change noted last time is unchanged and still for the leader to confirm.
