# Review — branch hermes/mwv2i4pq (specs 011 reminder-wall and 012 block-notes)

**Verdict:** CHANGES_REQUESTED

The task was "specs only, no implementation, then stop for owner approval". The scope is
clean and both specs are strong, but they contain contract contradictions and untested error
codes that would leave the implementer guessing. The fixes are small and listed below.

## Gate

`./init.sh` is not executable (`Permission denied`), so I ran `bash init.sh`.
Result: build green, 5 test files / 140 tests passed, "no feature in progress",
`[OK] build green, tests green, scope clean`. Nothing was skipped.
The gate does not exercise specs. It only proves that no code regressed.

## Claim vs diff

Commit f161091 touches 4 files: `specs/features/011-reminder-wall.md`,
`specs/features/012-block-notes.md`, `feature_list.json` (entries 11 and 12 added as
`spec_ready`, valid JSON, nothing else changed) and `progress/current.md`.
No `src/`, `tests/` or `android/` file changed, so the "no implementation" requirement is
met. Both specs have 15 numbered ACs, owner decisions (A1–A9, B1–B8), out-of-scope lists and
open questions. `git status` is clean.

Facts I checked against the code, which the specs get right:
- The store has 7 keys today (`useStore.js:38-44`), so `reminderWall` is the eighth.
- The envelope is `version: 5` (`DataTab.jsx:19`) and the pinning test is
  `reminders.test.js:274-286`.
- `WeekTab.jsx:190` writes `{ cells: {} }` with no spread, so "clear this week" would
  destroy notes. Spec 012 B6/AC-14 correctly requires fixing it.
- `mergeImportedWeeks` (`seed.js:150`) knows only cells.
- `MainActivity.java:13-15` registers plugins before `super.onCreate()`.
- `PALETTE` and `nextColor` exist (`seed.js:4`, `time.js:65`).

## Acceptance criteria

"PASS" means the criterion is specific, testable and consistent with the contract. Both specs
say honestly that the UI ACs are device-only, because the repo has no component tests.

### 011 reminder-wall

| AC | Result | Evidence |
|---|---|---|
| 1 | PASS | 011:208-213; key set verified against `useStore.js:38-44` and `reminders.test.js:283-286` |
| 2 | PASS | 011:214-217 |
| 3 | PASS | 011:218-222 |
| 4 | PASS (minor) | 011:223-226. `nextColor` falls back to a random colour after the 12-colour palette, so "first palette colour" is only deterministic for the first 12 categories. |
| 5 | FAIL | 011:227-229. It does not say whether a case-only rename ("work" to "Work") collides with the category itself. `category-missing` for an unknown id is not covered. |
| 6 | FAIL | 011:230-234. Delete of an unknown id (`category-missing`) is not covered. |
| 7 | PASS | 011:235-238 |
| 8 | PASS | 011:239-242 |
| 9 | FAIL | 011:243-245 contradicts 011:160-164. See Required change 1. `reminder-not-found` also has no AC. |
| 10 | PASS | 011:246-249 |
| 11 | PASS (device) | 011:250-252. The category filter is not in the task text; see Observations. |
| 12 | PASS (device) | 011:253-257 |
| 13 | PASS (device) | 011:258-262 |
| 14 | PASS | 011:263-267. It is explicitly an open question (OQ2), so it is not silent scope creep. |
| 15 | PASS | 011:268-271, source-reading test |

### 012 block-notes

| AC | Result | Evidence |
|---|---|---|
| 1 | PASS | 012:230-234 |
| 2 | PASS | 012:235-236 |
| 3 | PASS (minor) | 012:237-240. "Never outside 0…335" is stated for indices, but the returned `end` is exclusive and goes up to 336. |
| 4 | PASS | 012:241-246 |
| 5 | FAIL | 012:247-249. The `voice-invalid` code (012:159) has no AC. |
| 6 | PASS | 012:250-254 |
| 7 | PASS | 012:255-257 |
| 8 | FAIL | 012:258-260. The recorder auto-stop half is not Vitest-provable, yet 012:294-296 lists AC-8 as Vitest-provable. It is missing from the device-only list. |
| 9 | FAIL | 012:261-266. "Long-press changes no cell" conflicts with the existing `onMouseDown` paint at `WeekTab.jsx:136`, which paints at touch-down when a brush is active. The spec never says how the gesture and the brush coexist. |
| 10 | PASS (device) | 012:267-271 |
| 11 | PASS (device) | 012:272-275 |
| 12 | PASS (minor) | 012:276-279. "Field list is unchanged" is ambiguous once 011 adds `reminderWall` to the envelope. |
| 13 | PASS | 012:280-284. Checked against `seed.js:150-162`: the current code would drop stored notes for a stored week with no `cells`, and the spec's rule covers that case. |
| 14 | PASS | 012:285-288 |
| 15 | PASS | 012:289-294; plugin ordering matches `MainActivity.java:13-15` |

## CHECKPOINTS (applied to a spec-only change)

- [x] C1.1 Gate is `[OK]` (`bash init.sh`).
- [ ] C1.2 Not yet applicable (no implementation). Every AC has a named proof route in the Verification sections, except the gaps listed in Required changes 2 and 3.
- [x] C1.3 No test was deleted or weakened. No tests changed.
- [x] C1.4 N/A, no code.
- [x] C2.1 No feature is `in_progress`. 11 and 12 are `spec_ready`.
- [x] C2.2 / C2.3 / C2.4 Only specs, `feature_list.json` and `progress/current.md` changed. No code was touched.
- [x] C3.1–C3.4 Both specs respect the layering: pure `src/lib/reminderWall.js` and `notes.js`, native access via `src/lib/audio.js`, and the `P` setters.
- [x] C4.4 / C4.5 The specs use `useArmed` and `uid()`.
- [x] C5.1 Both bump the export version to 6 and extend the import merge.
- [x] C5.2 Specs state that absence of the key or field means empty, so there is no load-time rewrite. This is consistent with feature 7.
- [x] C5.3 Nothing on the "never touch" list is changed.
- [x] C5.4 No secrets are involved.
- [x] C6.1 The 336-cell week is kept (012 out-of-scope list).
- [x] C6.3 Both specs state that AI-off behaviour is identical and add no AI surface.
- [x] C6.4 No network is added.
- [x] C7.2 / C7.3 Spec 012 requires the plugin to be registered before `super.onCreate()`. The device rebuild and `cap:sync` need are implied. The spec should state them (Observation 6).

## Required changes

1. `specs/features/011-reminder-wall.md:160-164` vs `:243-245` (AC-9). The error list says
   `reminder-archived` covers "edit **or re-tick**" a reminder that has `doneAt`. The contract
   and AC-9 say `markDone` is idempotent, so a second call "changes nothing". These
   contradict each other. State which one applies: either a second `markDone` returns
   `{ wall unchanged, error: undefined }`, or it returns `reminder-archived`. Then reword
   the error code line and AC-9 so a test can assert exactly one outcome.
2. `specs/features/011-reminder-wall.md:227-234, 243-245`. The error codes
   `category-missing` (for `renameCategory` and `deleteCategory` with an unknown id) and
   `reminder-not-found` (for `markDone` and `editReminder` with an unknown id) are in the
   contract but in no AC. Add them to AC-5, AC-6, AC-8 and AC-9, or drop them from the
   contract. Also state in AC-5 whether renaming a category to a different-case version of
   its own name is allowed, i.e. whether the duplicate check excludes the category itself.
3. `specs/features/012-block-notes.md:247-249` (AC-5) and `:159`. `voice-invalid` (audio
   without `mime` or a `data:` URL) is in no AC. Add it to AC-5 or AC-8 with a failing case.
   In the same place, fix the Verification section at `:294-296`. The "recorder auto-stops at
   `MAX_VOICE_MS`" half of AC-8 cannot be proved by Vitest. List it under "Only the device can
   confirm", or split AC-8 into a pure half and a device half.
4. `specs/features/012-block-notes.md:261-266` (AC-9) and the UI states. Say how long-press
   coexists with the paint brush. Today `onMouseDown` paints immediately when a brush is
   selected (`WeekTab.jsx:136, 74-75`), so "the long-press changes no cell" is false whenever
   a brush is active. This is a product decision, so either decide it or add an open
   question. The options are: long-press only acts when no brush is selected, or painting is
   deferred until release, or the first touch paints and the long-press undoes it. Also state
   that the touch drag must not scroll the grid, because it sits in an `overflow-auto`
   container.

## Observations (non-blocking)

1. Feature A's task text did not ask for backup export. 011 A7 adds it with an
   export-version bump, but it is flagged as open question 2 and is justified by C5.1, so I
   accepted it. The wall's category filter (AC-11) and the `uncategorized` fallback category
   (A6) are mild extras. The fallback is derived from "every reminder must belong to one
   category". The owner should confirm the filter is wanted.
2. 011 A1 contains a stray self-reference: "(`specs/features/011-reminder-wall.md` is the
   whole feature)". Delete it.
3. Both specs bump the envelope to version 6 and both edit the pinning test at
   `reminders.test.js:274-286`. 012 handles the order ("stays 6, never 7"). Still, 012 AC-12's
   "field list is unchanged" will read oddly if 011 lands first. Say "unchanged by this
   feature".
4. Specs are 318 and 337 lines, against the harness guidance of about 200. Both have exactly
   15 ACs, so I did not block on length. Splitting 012 into a notes-data phase and a voice
   phase would be a safer implementer run.
5. `feature_list.json` entries 11 and 12 have `"acceptance": []`, while done features 3 and 7
   carry their ACs. `progress/current.md` says this is deliberate, to be filled after
   approval.
6. The lane table lists `progress/spec_*.md` for spec-writers, but no such report exists.
   `progress/current.md` (outside the spec-writer lane) carries the summary instead. Spec
   012 should also state that the `android/` changes need `npm run cap:sync`, a rebuild and
   the user's install (C7.2).
7. 011 AC-4 "first palette colour not already used" is deterministic only for the first 12
   categories. `UNCATEGORIZED_COLOR` `#64748b` is already in `PALETTE`.
8. `init.sh` has no execute bit. This is pre-existing and unrelated.
