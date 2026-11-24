# Review — feature 12 block-notes (branch hermes/mwv4y4y9)

**Verdict:** CHANGES_REQUESTED

Owner ruling of 2026-11-24 (default 500 ms, 500 ms steps, max 3000 ms) was applied before judging.
It is implemented correctly: `LONG_PRESS_MIN/MAX/STEP = 500/3000/500` and `clampLongPressMs`
(`src/lib/seed.js:196-208`) are used by both the grid (`WeekTab.jsx`, `holdMs`) and the
Settings row (`SettingsTab.jsx` `LongPressCard`). `DEFAULT_SETTINGS.longPressMs = 500`
(`src/lib/useStore.js:25`).

## Gate

- `npm test` -> 7 files, 208 tests passed.
- `bash init.sh` -> `[OK] build green, tests green, scope clean` (in progress: 12). Nothing skipped.
- Gate is green, but two spec/rule defects below block approval.

## Diff vs. claim

`git diff bc7e79c..HEAD` touches 16 files, all listed in or implied by `progress/impl_block-notes.md`.
No `specs/**` change. `feature_list.json` sets 12 `in_progress` (correct) and also moves 11
`in_progress` -> `in_review` (needed to keep init.sh's one-in-flight check green; see Observations).
`DataTab.jsx` is untouched and already wrote `version: 6` with `weeks` verbatim.

## Acceptance criteria

| AC | Result | Evidence |
|---|---|---|
| AC-1 shape / no taskId, audio, key | PASS | `notes.js:76-90` stores exactly id/start/end/text/createdAt/updatedAt; source test `notes.test.js:258`; no new localForage key (diff has none) |
| AC-2 `categoryRunAt` | PASS | `notes.js:25-50`; tests `notes.test.js:34-61` (stops at empty/other category/unresolvable, midnight) |
| AC-3 overlap / `noteAt` | PASS | `notes.js:52-61`; tests `notes.test.js:66-85,123` |
| AC-4 `addNote` | PASS | `notes.js:76-90`; tests `notes.test.js:102-128` |
| AC-5 `updateNote` | PASS | `notes.js:92-103`; tests `notes.test.js:137-157` |
| AC-6 `removeNote` | PASS | `notes.js:105-107`; tests `notes.test.js:160-172` |
| AC-7 `cleanDictation` | **FAIL** | Examples pass (`notes.test.js:176-193`), but "running it twice returns the same string" is false: `cleanDictation("you you know know")` -> `"you know"`, and a second pass -> `""`. A brute-force over 1-5 tokens drawn from {um, uh, you, know, I, think, the, UM, Know} found 112 non-idempotent inputs. The spec makes idempotence a stated property, and the only test (`notes.test.js:190`) checks one easy string. Cause: `notes.js:121-127` removes "you know" before collapsing repeats, and the repeat collapse can create a new "you know". |
| AC-8 long-press run / setting | PASS (source) / Device | `WeekTab.jsx` `handleCellPointerDown` + `openNoteAt` use `categoryRunAt` and `holdMs`; clamp tests `seed.test.js:392-398`; UI source tests `notes.test.js:305-360`. Device-only half is unverified here, as the spec states. |
| AC-9 brush gating / no scroll | PASS (source) / Device | `WeekTab.jsx` returns at `brush != null`, `touchAction: "none"`, `e.preventDefault()`; source test `notes.test.js:314-325`. Device-only. |
| AC-10 viewer | PASS (source) / Device | `openNoteAt` resolves `noteAt` first and opens `mode: "view"`; no audio control; marker uses `noteStarts` for erased cells |
| AC-11 save/edit/delete | PASS (source) / Device | Save disabled on empty trim; `useArmed` Delete (`note-<id>`); `writeNotes` |
| AC-12 export v6, no key, v4/v5 import | PASS | `DataTab.jsx:20` `version: 6`; source test `notes.test.js:265-271`; no-notes import `notes.test.js:240` |
| AC-13 `mergeImportedWeeks` notes | PASS | `seed.js:156-170`; tests `notes.test.js:220-252` (shared id, cells-less file week, stored-only week, idempotent, no mutation) |
| AC-14 clear week keeps notes | PASS (source) / Device | `WeekTab.jsx` `{ ...wk, cells: {} }`; source test `notes.test.js:273` |
| AC-15 dictation / permission / polish | **PARTIAL FAIL** | Source half is right: `dictation.js` has no blob/URL/file write; `RECORD_AUDIO` is the only added permission (`AndroidManifest.xml`); the plugin is registered before `super.onCreate()` (`MainActivity.java`, test `notes.test.js:293`); the key is never written to a note, `weeks`, `settings` or the export. **But** `polishText` (`src/lib/notePolish.js`) has no behavioural test at all. The spec's contract says it returns `polish-disabled` unless AI is on, the provider is not `none` and a key is present. The only test is a regex for `polishText(` in `WeekTab` (`notes.test.js:328`). That is a criterion without a test, and HERMES §7 requires a failure test for each new exported function. |

## CHECKPOINTS

- [x] C1.1 init prints `[OK]` (bash twin; `init.ps1` not runnable on Linux).
- [ ] C1.2 AC-7 (idempotence) and the AC-15 polish gating have no test that proves them.
- [x] C1.3 No test deleted, skipped or weakened (diff only adds tests).
- [ ] C1.4 `notePolish.js` is new logic with no unit test.
- [x] C2.1 Exactly one feature `in_progress` (12).
- [x] C2.2 Touched files match the impl report.
- [x] C2.3/C2.4 No out-of-scope behaviour found; no Balance/coach changes.
- [x] C3.1 No component touches localForage. WeekTab uses `setWeeksP`.
- [x] C3.2 `P` setters used (`setWeeksP`, `setSettingsP`).
- [x] C3.3 `notes.js` is pure. `seed.js` imports it with no cycle problem (build is green).
- [x] C3.4 Native access goes through `src/lib/dictation.js`.
- [x] C4.1-C4.5 JS/JSX; shared `ui.js` strings; lucide icons; `useArmed`; `uid()` for note ids.
- [x] C5.1 No `normalizeModel` change needed (spec: absence is unambiguous); export stays at v6.
- [x] C5.2 Older v4/v5 import tested; `mergeSettings` repairs a missing `longPressMs` (`seed.test.js`).
- [x] C5.3 Never-touch list untouched.
- [x] C5.4 The key stays in secure storage and memory (`aiKeys`) and is never serialized.
- [x] C6.1-C6.4 336 cells unchanged; Ambition untouched; the Polish control is gated on `aiEnabled`; no new network path by default.
- [x] C7.2 Touches `android/`; the user must run `npm run cap:sync` and rebuild. The impl report does not say so explicitly (minor).
- [x] C7.3 Plugin registered before `super.onCreate()`.

## Required changes

1. `src/lib/notes.js:121-127` (`cleanDictation`): make it truly idempotent. Repeat the
   filler-removal, repeat-collapse and whitespace steps until the output stops changing.
   Then `cleanDictation("you you know know")` must equal `cleanDictation` of its own output.
   Add a test in `tests/unit/notes.test.js` (near line 190) that asserts
   `cleanDictation(cleanDictation(x)) === cleanDictation(x)` for that input. Include at least
   one other filler/repeat interleaving, for example `"um um you you know know"`. Keep the AC-7
   examples passing.
2. `src/lib/notePolish.js`: add unit tests (`tests/unit/notes.test.js` or a new
   `tests/unit/notePolish.test.js`) that assert `polishText` returns
   `{ error: "polish-disabled" }` when AI is disabled, when the provider is `none`, when
   `aiKeys[provider]` is empty or missing, and when the text is blank. These cases need no
   network. Also cover one success path by mocking only the `callAI` transport (the
   `../src/lib/ai` module). Assert that it returns `{ text }` and that the key is passed
   only in the call context and is not present in the returned value.

## Observations (non-blocking)

- `feature_list.json` also changes feature 11 `in_progress` -> `in_review`. This is reasonable
  given the one-in-flight gate, but it is outside the literal task text; the leader should
  confirm it.
- `dictation.js` (`startDictation`/`cancelDictation`/`dictationSupported`) has no unit test.
  Mocking Capacitor is arguable, so this is acceptable given the spec's "Device" split.
  A cheap web-path test (no `SpeechRecognition` -> `dictation-unsupported`) would be welcome.
- `WeekTab.jsx` marks `noteStarts` by exact `start` only. It is correct per spec.
- Device-only ACs (8, 9, 10, 11, marker half of 14, UI half of 15) remain for the owner's
  on-device check after `npm run cap:sync` and a rebuild.
