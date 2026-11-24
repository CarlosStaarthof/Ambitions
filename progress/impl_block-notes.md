# Implementation — feature 12 block-notes, round 1

**Spec:** `specs/features/012-block-notes.md` (approved, with owner rulings 2026-11-18).
**Branch:** `hermes/mwv4y4y9`. **Status:** `in_progress` — core/data/dictation done; UI remains.

## Built this round

### `src/lib/notes.js` (new, pure)

The whole note model, with the spec's exact contract:

- `WEEK_CELLS = 336`, `SLOTS_PER_DAY = 48`, `notesOf(week)`.
- `categoryRunAt(cells, tasks, index)` — maximal run of filled cells sharing the pressed
  cell's `categoryId`, bounded to that day. Stops at an empty cell, another category, an
  unresolvable task, or the day edge. `null` when the cell is empty/unresolvable.
- `noteAt(notes, index)`, `canPlaceNote(notes, start, end, ignoreId)`.
- `validateNote` / `addNote` / `updateNote` / `removeNote` with
  `range-invalid`, `empty-note`, `overlap`, `note-not-found`. Half-open `[start, end)`,
  trimmed text, `at` stored as both timestamps on create, inputs never mutated.
- `cleanDictation(text)` — pure, non-AI, idempotent: `uh`/`um`/`you know` as whole
  words/phrase, one immediately repeated word, whitespace collapse, trim.
- `mergeImportedNotes(stored, imported)` — file wins a shared id, stored entries the file
  omits survive, entries are never validated away.

### Data and import

- `src/lib/seed.js`: `mergeImportedWeeks` now merges `notes` by id per week alongside the
  existing cell merge, and adds no `notes` field when neither side has notes (v4/v5 files).
- `src/lib/useStore.js`: `DEFAULT_SETTINGS.longPressMs = 500`; `mergeSettings` already fills
  scalar defaults for existing installs. No new localForage key.
- `src/components/DataTab.jsx` needed no change: it already writes `version: 6` with
  `weeks` verbatim, and import already calls `mergeImportedWeeks`, which now carries notes.
- `src/components/WeekTab.jsx`: `clear this week` writes `{ ...wk, cells: {} }` so the week's
  `notes` is untouched (AC-14 source half).

### Dictation and optional polish

- `src/lib/dictation.js`: `dictationSupported`, `startDictation`, `cancelDictation`. Native
  path goes through the `Dictation` Capacitor plugin; web dev path uses browser
  `SpeechRecognition`. Returns `{ text }` or `{ error }`; never a blob, object URL, `data:`
  URI or file write.
- `src/lib/notePolish.js`: `polishText(text, ctx)` returns `polish-disabled` unless AI is on,
  the provider is not `none`, and a key is present in the passed `aiKeys` (memory only). No key
  is written anywhere.
- Android: `RECORD_AUDIO` is the only added permission (manifest), new
  `DictationPlugin.java` uses the platform `SpeechRecognizer`, requests permission on first
  use, maps the three error codes, and is registered in `MainActivity.onCreate` before
  `super.onCreate()`.

## Tests

New `tests/unit/notes.test.js` (36 tests): constants and `notesOf`; `categoryRunAt` day
boundary and stop conditions; `noteAt`/`canPlaceNote`; validate/add/update/remove including
non-mutation and every error code; `cleanDictation` AC-7 examples and idempotency;
`mergeImportedNotes`; notes through `mergeImportedWeeks` (shared week, file-only week,
stored-only week, v4/v5 no-notes file, idempotency); source checks for the data shape, the v6
export envelope, the clear-week spread, the audio-free dictation module, the single new
permission, and the plugin registration order.

- `npm test --silent` → 7 files, 198 tests, all pass.
- `bash init.sh` → `[OK] build green, tests green, scope clean` (in progress: 12).

## Round 2 — Week tab note UI

`src/components/WeekTab.jsx` now has the gesture and all note surfaces:

- Long-press on a filled cell with no brush selected holds for `settings.longPressMs`
  (fallback 500). It resolves the same-category run with `categoryRunAt`, opens the viewer
  when `noteAt` finds a note, refuses an overlapping range with one line, and otherwise opens
  the editor for that run.
- Pointer up/leave/cancel clears the hold. The inner grid uses `touch-action: none` and the
  gesture calls `preventDefault`, so the `overflow-auto` container does not scroll during a
  hold. A brush or eraser makes the handler return immediately, so painting is untouched.
- Editor: `addNote`/`updateNote` with an ISO `at`, Save disabled while the trimmed text is
  empty, error codes mapped to one line, explicit armed Delete (`useArmed`), no drag extend.
- Viewer: text only, Edit and armed Delete, no audio or play control.
- A marker dot renders on the first cell of every note range, including a cell that has been
  erased since the note was written.
- Dictation: `dictationSupported`/`startDictation`, transcript passed through
  `cleanDictation`, microphone disabled on denial/unsupported with one line. No audio is
  retained.
- Polish: button only when `aiEnabled`, explicit `polishText` call, text unchanged on failure,
  never saved automatically (user reviews, then Save).
- `clear this week` keeps `{ ...wk, cells: {} }` and now says notes are kept.

`src/App.jsx` passes `settings`, `ai` and `aiEnabled` to `WeekTab`.

Tests: 5 source tests added to `tests/unit/notes.test.js`. `npm test --silent` → 203 passed;
`bash init.sh` → `[OK] build green, tests green, scope clean`.

## Not done (next rounds)

- SettingsTab: hold-time row, **blocked on open question 4** (minimum/maximum of
  `longPressMs`). The range was not guessed.
- Device-only verification: AC-8, AC-9, AC-10, AC-11, marker half of AC-14, dictation/polish
  UI half of AC-15.

## Open question

`QUESTION: What minimum and maximum should settings.longPressMs have (it moves in 500 ms steps and defaults to 500)?`
