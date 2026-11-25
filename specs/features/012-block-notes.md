# 012 — Block notes on the Plan & Balance week grid

**Feature id:** 12   **Status:** approved   **Depends on:** none (coordinates with 8 and 11
through the shared `weeks` and export shapes; see *Out of scope* and *Open questions*)

## Purpose

A painted cell records only *which task* occupied a half hour. What happened, what was
decided, or a spoken note about that time has nowhere to live. This feature lets the user
long-press one block and attach one text note to the whole unbroken run of the same category
above and below it in that day — a sleep, a work shift. The note can be typed or dictated:
the phone's built-in speech-to-text turns speech into the note's text, followed by a simple
non-AI cleanup that removes fillers and repeated words. Optional AI polishing runs only when
the user has entered their own API key and turned AI on; non-AI is always the default.
Long-pressing those blocks later shows the note. Notes are part of the week, so they travel
in the existing JSON export and must survive import.

## Owner's decisions

### B1. A note is anchored to a contiguous time range, not to a task id.

A note stores `start` and `end` half-hour indices in its week. Renaming, recolouring or
retiring a task, or painting a different task over a cell, does not move or delete the note.
Tradeoff: a note can outlive the block it was written on and appear over a different task;
the week grid is the record of the time, so time is the stable anchor.

### B2. One note per time range; overlap is refused.

The grid resolves a long-press through one deterministic note. Creating a selection that
overlaps an existing note is refused with one line, so the user must open, edit or delete the
existing note first. Tradeoff: covering a larger range after the fact means deleting and
recreating the note; an imported file that already contains overlaps is still preserved, and
`noteAt` picks the first note in array order.

### B3. Selection is the unbroken run of one category within one day.

A long-press selects the whole unbroken run of the same category above and below the pressed
block in that day — such as a sleep or a work shift made of several tasks. The run stops at an
empty cell, at a cell whose task belongs to another category, at a cell that resolves to no
task, and at the day's edge. The note never crosses midnight, and there is no drag-to-extend
gesture. Tradeoff: a note cannot cover two categories or two days in one action; the user
creates one note per run. (Owner ruling 2.)

### B4. Notes live inside `weeks`; no new localForage key.

A week object gains an optional `notes` array next to `cells`. `weeks` is already exported
and already merge-protected on import, so notes ride the existing vehicle. Tradeoff: the
week object's shape grows, the import merge must learn about notes, and the export version
moves to 6.

### B5. Text only; dictation is transcribed by the phone and cleaned without AI.

No audio is recorded, stored, played or exported. The microphone control uses the phone's
built-in speech-to-text and inserts the transcript into the note's text field; the user can
edit it before saving. The transcript passes through a pure, non-AI `cleanDictation` that
removes fillers (such as "uh", "um" and "you know") and immediately repeated words before it
enters the field. Tradeoff: a recording cannot be replayed, and dictation needs a recognizer
the phone supports; the transcript is the only output. (Owner ruling 3.)

### B6. `clear this week` clears blocks, not notes.

The control keeps its meaning as a schedule clear and writes `{ ...wk, cells: {} }`, leaving
`notes` untouched. A note whose cells were erased stays anchored to its time range and keeps
its marker on the first cell, which is now empty. Tradeoff: the grid can show a note marker
over an empty row; the alternative — silently deleting user content — is worse. The control's
copy says notes are kept.

### B7. Editing replaces; deleting is explicit and armed.

Editing changes the note's text. A note must keep a non-empty trimmed text. Replacing the
text loses the old text with no undo, matching every other single-value field in the app.
Deleting a note is a two-tap `useArmed` action.

### B8. Nothing but the note text is stored.

There is no audio, no AI summary stored, no automatic title, no notification, and no link
between a note and a task id. Tradeoff: text search is a later, separate feature.

### B9. The long-press hold time is a user setting.

`settings.longPressMs` (milliseconds) defaults to `500` and changes in `500` ms steps. It is
stored under the existing `settings` key with the other preferences and is not week data.
The minimum and maximum are an open question; this spec does not guess them. Tradeoff: one
settings row and a value that must be clamped to a range the owner chooses. (Owner ruling 2.)

### B10. AI polish is opt-in and uses only the user's key.

The default path is the non-AI `cleanDictation`. A per-note "polish" action appears only when
the existing AI settings are on (`settings.ai.enabled` true, provider not `none`) and a key
is present in hardware-backed secure storage. It sends only the note text through the
existing AI transport, never runs automatically, and never replaces the local cleanup. The
key is stored only on the device and never written into `settings`, `weeks`, a note object or
an export. Tradeoff: AI polish can reword text, so it is a visible action the user chooses.
(Owner rulings 3 and 4.)

## User stories

- As a user, I can long-press one block and type or dictate a note for the whole unbroken run
  of its category in that day.
- As a user, I can long-press a block later and read the note.
- As a user, I can edit or delete a note without changing the week's painted cells.
- As a user, my notes survive exporting and importing my JSON backup.
- As a user, clearing a week does not destroy the notes I wrote about it.
- As a user, I can optionally polish a note with my own key; without a key every note stays
  local and non-AI.

## Data touched

**No new localForage key.** The existing `weeks` key gains one optional sibling field per
week:

```js
weeks[isoMonday] = {
  cells: { "<day>-<slot>": taskId },
  notes?: [{
    id,
    start,        // inclusive global half-hour index, 0…335
    end,          // exclusive global half-hour index, 1…336
    text,         // trimmed, non-empty; dictated text has already been cleaned
    createdAt,
    updatedAt
  }]
}
```

`start`/`end` use the same half-hour grid as `cells`: `index = day * 48 + slot`, day 0–6 =
Mon–Sun, slot 0–47. A note covers every index in `[start, end)`. Absence of `notes`, or an
empty array, means no notes. A note stores no `taskId`, no `audio` and no API key.

**Export:** the envelope field list does not change; `weeks` already carries the notes.
`DataTab` writes `version: 6` (feature 11 also moves 5→6, so it is never 7). A v4 or v5 file
without notes imports with none and no error. The envelope contains no provider key, no
`aiKeys` and no `secure` field; the key lives only in `secureStore.js` on the device.

**Import:** `mergeImportedWeeks` continues to merge cells slot by slot and now also merges
`notes` by id. File wins a shared id; stored notes the file omits survive; a week only in
storage keeps its notes; a week only in the file imports its notes even if its `cells` is
empty. Merging the same file twice is deep-equal.

**No load-time rewrite of `weeks`.** Absence is unambiguous, and writing `weeks` during load
is forbidden by the data-safety rules in feature 7. No `normalizeModel` change is needed;
the only shape gate is the import merge.

**No changes** to `tasks`, time-block `categories`, `questions`, `reflections`, `vision`,
`settings` shape beyond `longPressMs`, or notification scheduling.

## Contract

### `src/lib/notes.js` — pure, no React, no DOM, no storage

```js
WEEK_CELLS = 336
SLOTS_PER_DAY = 48

notesOf(week) → Note[]                       // [] when the week has no notes
categoryRunAt(cells, tasks, index) → { start, end } | null
// Resolves cells[index] to its task's categoryId. Returns the maximal run of filled cells
// whose tasks share that same categoryId, bounded to the day containing index
// (floor(index / 48) * 48 … +47, end exclusive). null when the cell is empty or its task
// cannot be resolved. Never crosses midnight.

noteAt(notes, index) → Note | null
canPlaceNote(notes, start, end, ignoreId) → boolean
validateNote(note) → error | null
addNote(notes, note) → { notes, error }
updateNote(notes, id, patch, at) → { notes, error }
removeNote(notes, id) → Note[]
cleanDictation(text) → string
// Pure, non-AI. Case-insensitive removal of the filler words "uh", "um" and the phrase
// "you know", removal of an immediately repeated word (keeps the first), collapse of runs
// of whitespace to one space, and trimming. Idempotent.
mergeImportedNotes(stored, imported) → Note[]
```

**Error codes** (the component maps each to copy; tests assert the code):

- `range-invalid` — start/end outside `0…336`, or `start >= end`.
- `empty-note` — the trimmed `text` is empty.
- `overlap` — the range intersects a different note.
- `note-not-found` — the id is not in the array.

`addNote` trims `text`, returns `empty-note` when it is empty, and stores the supplied `at`
as both `createdAt` and `updatedAt`. `updateNote` changes the text, preserves `id`, `start`,
`end` and `createdAt`, and sets `updatedAt` to the supplied `at`. `removeNote` is idempotent.
None of these mutate their inputs. `mergeImportedNotes` does not validate away entries: a
stored or imported note with a valid id is kept, so a backup never silently loses content.

### `src/lib/dictation.js` — the impure wrapper

```js
dictationSupported() → boolean
startDictation() → Promise<{ text } | { error }>
cancelDictation() → Promise<void>
```

`error` is one of `dictation-denied`, `dictation-unsupported` or `dictation-no-speech`. On
Android this calls a small hand-written `DictationPlugin` backed by the platform
`SpeechRecognizer`; the desktop dev build uses the browser `SpeechRecognition` when it
exists. It returns text and never retains audio: no blob, no object URL, no `data:` URI and
no file write. If the permission is denied or the platform is unsupported, the UI disables the
microphone and text notes keep working. Nothing here throws into the screen.

### `src/lib/notePolish.js` — the optional AI wrapper

```js
polishText(text, ctx) → Promise<{ text } | { error }>
```

It returns `polish-disabled` unless `ctx.settings.ai.enabled` is true, the provider is not
`none`, and `ctx.aiKeys[provider]` is non-empty. On success it uses the existing AI transport
and returns the rewritten text; the caller shows it for confirmation and never saves it
automatically. The key is read from memory only and is never written to a note, `weeks`,
`settings` or an export.

### `android/`

- `android/app/src/main/AndroidManifest.xml` gains `android.permission.RECORD_AUDIO` and no
  other permission.
- New `android/app/src/main/java/com/carlos/ambitions/DictationPlugin.java` using the
  platform `SpeechRecognizer`, registered in `MainActivity.onCreate` **before**
  `super.onCreate()`.
- No third-party dependency is added and no audio file is written.

### `mergeImportedWeeks` in `src/lib/seed.js`

For each week key it merges `cells` as today and sets `notes` to
`mergeImportedNotes(notesOf(storedWeek), notesOf(importedWeek))` when either side has notes.
Every other sibling field keeps today's behaviour: the imported week wins when both exist.
Feature 8 owns any change to how `approved` or a snapshot merges.

### `settings` and `useStore`

`DEFAULT_SETTINGS` gains `longPressMs: 500`. `mergeSettings` fills it for an existing
install that lacks it. `SettingsTab` changes it by ±500 ms. No new localForage key is added.

### Components

- `src/components/WeekTab.jsx` gains the long-press note gesture, the note editor and viewer,
  a note marker on the first cell of each note range, and the `clear this week` spread fix.
  A short tap and the existing paint drag behave exactly as before.
- `src/components/SettingsTab.jsx` gains the long-press hold-time row.
- `src/components/DataTab.jsx` bumps the envelope to `version: 6`; import keeps calling
  `mergeImportedWeeks`, which now includes notes.

## UI states

- **Empty:** a week with no notes renders exactly as today. Long-press on a filled cell opens
  an empty editor with Save disabled until the trimmed text is non-empty. Long-press on an
  empty cell shows one line and opens nothing.
- **Loading:** the existing app-level `loading…` screen; the grid does not render early.
- **Error:** a refused selection (empty cell, no resolvable category, overlap) shows one line
  and opens no editor. Dictation denied, unsupported or with no speech disables the
  microphone with one line; typed text keeps working. A polish failure leaves the text
  untouched and shows one line. A failed store read uses the existing storage-error screen.
- **Success:** a saved note shows a small marker at the start of its range. Long-pressing any
  cell in the range opens the viewer, which shows the text. It has no audio or play control
  because no audio exists.
- **Gesture vs brush:** holding a filled cell for `settings.longPressMs` (default 500 ms)
  selects its whole same-category run for that day and opens the editor, whether or not a
  paint brush or the eraser is selected; the tap that ends the hold does not paint, but a
  short tap with a brush still paints exactly as before. There is no drag extension. The grid
  allows vertical panning (`touch-action: pan-y`); a finger that moves before the hold
  completes cancels the gesture and scrolls normally, and scrolling is paused only while a
  recognised hold is in progress. (Owner rulings, 2026-11-24 and 2026-11-25 — see below.)
- **Dictation:** the microphone fills the text field with the cleaned transcript; the user
  edits it and saves. No audio is kept.
- **AI polish:** the polish control appears only when AI is on and a user key is stored; the
  default editor has no AI surface. Polishing is always an explicit per-note action.
- **Clear week:** the armed action clears `cells` only and leaves every note marker in place;
  its copy says notes are kept.
- **AI disabled:** no AI surface, no provider call, no key read. Every behaviour above is
  identical with AI off, which is the shipping default.

## Acceptance criteria

1. AC-1: Notes are stored only under `weeks[weekKey].notes` as objects
   `{ id, start, end, text, createdAt, updatedAt }`, with `start` inclusive, `end` exclusive,
   `0 <= start < end <= 336`, and `text` non-empty after trimming. No `taskId`, no `audio`
   field and no key field is stored; no new localForage key is added; absence of `notes`
   means no notes.
2. AC-2: `categoryRunAt(cells, tasks, index)` returns the maximal run of filled cells whose
   tasks share the same `categoryId` as the task in `index`, bounded to the day containing
   `index`: the run extends through adjacent blocks of different tasks in that category,
   stops at an empty cell, at another category, at a cell whose task cannot be resolved, or
   at the day's edge, and returns `null` when `index` is empty or its task cannot be
   resolved. At Monday slot 47 `end` is 48 and at Tuesday slot 0 `start` is 48, so no run
   crosses midnight.
3. AC-3: `canPlaceNote` is false for any range that intersects an existing note other than
   `ignoreId`; `addNote` returns `overlap` and an unchanged array in that case. With no
   overlap, `noteAt(notes, index)` returns exactly the note whose `[start, end)` contains
   `index`, and `null` outside every range. Imported overlaps are preserved and `noteAt`
   returns the first in array order.
4. AC-4: `addNote` trims text, returns `empty-note` when the trimmed text is empty, returns
   `range-invalid` outside `0…336` or when `start >= end`, stores the supplied `at` as both
   `createdAt` and `updatedAt`, and returns new arrays and objects without mutating its
   inputs.
5. AC-5: `updateNote` changes the text, rejects an empty trimmed text with `empty-note`,
   rejects a range overlapping another note with `overlap`, returns `note-not-found` for an
   unknown id, sets `updatedAt` to the supplied `at`, preserves `id`, `start`, `end` and
   `createdAt`, and does not mutate its inputs.
6. AC-6: `removeNote(notes, id)` returns a new array without that note, leaves every other
   note deep-equal, does not mutate its input, and returns an array deep-equal to the input
   for an unknown id.
7. AC-7: `cleanDictation` is a pure, non-AI function: `cleanDictation("um I I think you know
   this works")` returns `"I think this works"`; `cleanDictation("I think this works")`
   returns the same string unchanged (the no-op case); fillers are matched case-insensitively
   as whole words or the whole phrase `you know`; an immediately repeated word is reduced to
   one; runs of whitespace collapse to one space; and running it twice returns the same
   string.
8. AC-8: A long-press held on a filled cell for `settings.longPressMs` selects the whole
   same-category run above and below it within that day and opens the editor when that range
   has no note; the run stops at empty cells, other categories and the day's edge, so Monday
   23:30 and Tuesday 00:00 are separate runs; `settings.longPressMs` defaults to 500 and
   changes in 500 ms steps; no drag extends the selection. (Device.)
9. AC-9: The note gesture is always available, with or without a paint brush or eraser
   selected: holding a filled cell for the hold time opens its note, and only an already
   open note dialog suppresses the gesture. The click that ends a recognised hold does not
   paint, while a short tap with a brush selected paints exactly as before. The week grid
   scrolls vertically normally and never sets `touch-action: none` unconditionally. Scrolling
   is paused only while a recognised long-press hold is in progress, and the lock is released
   when the finger lifts or the hold is cancelled; a finger that moves before the hold time
   cancels the gesture and scrolls the grid. (Device for the feel; source for the scroll-lock
   state. Superseded by the owner ruling of 2026-11-25 below.)
10. AC-10: Long-pressing any cell in a range that already has a note opens the viewer, not a
    second editor. The viewer shows the text, has no audio or play control, and shows a
    marker at the range start even when those cells are empty. (Device.)
11. AC-11: Saving a new note or editing an existing one shows the marker immediately;
    editing changes only the text; Save stays disabled while the trimmed text is empty;
    Delete is a two-tap `useArmed` action that removes the note and frees its range. (Device.)
12. AC-12: The export envelope is `version: 6`; notes add no envelope field because `weeks`
    already carries them; exported `weeks` values carry `notes` verbatim; a v4 or v5 file
    without notes imports with no notes and no error; and a source-reading test proves the
    envelope contains no provider key, no `aiKeys` and no `secure` field. (Source plus a
    round-trip test.)
13. AC-13: `mergeImportedWeeks` merges notes by id: for a week both sides have, stored notes
    the file omits survive, the file wins a shared id, and imported notes survive even when
    the file's week has no `cells`; a week only in storage keeps its notes unchanged; running
    the merge twice returns a deep-equal result and never mutates either argument.
14. AC-14: `clear this week` writes `{ ...wk, cells: {} }`, so the week's `notes` is
    unchanged; erasing or repainting a cell inside a note's range leaves the note unchanged;
    a note whose cells are all erased still renders its marker and is still reachable by
    long-press. (Source for the spread; Device for the marker.)
15. AC-15: Dictation runs only through `src/lib/dictation.js`, which returns text and never
    stores or persists audio — no blob, object URL, `data:` URI or file write — and its
    transcript is passed through `cleanDictation` before it enters the text field. Dictation
    adds `RECORD_AUDIO` as the only new Android permission, registers the plugin before
    `super.onCreate()`, and requests the permission on the first use; denial or an
    unsupported platform leaves typed notes fully working with the microphone disabled and
    one line of copy. Optional AI polish is an explicit per-note action available only when
    `settings.ai.enabled` is true, the provider is not `none`, and a user key is present in
    secure storage; it never runs by default, and the key is never written to `settings`,
    `weeks`, a note or the export envelope. No AI call, no network request and no AI-gated
    control exists on the default path; with AI off every behaviour is identical. (Source for
    the persistence and key rules; Device for the UI half.)

## Verification

**Vitest can prove** (new `tests/unit/notes.test.js`, additions to
`tests/unit/seed.test.js`, and the export assertion in `tests/unit/reminders.test.js`):
AC-1 (shape half), AC-2 to AC-7, AC-12 (version and source half), AC-13, the source half of
AC-14 and the source half of AC-15. These are pure functions of supplied cells, tasks, notes,
text and timestamps; none reads a real clock or the DOM.

**A source-reading test can prove:** AC-1 (no new key, no `taskId`, no `audio` in the note
writer), AC-9 (the grid allows vertical panning, the scroll-lock state is set on a recognised
hold and cleared on lift/cancel, and a pre-hold move cancels rather than hijacks scrolling),
AC-12 (the envelope version, field list and absence of a key field), AC-14 (the
`{ ...wk, cells: {} }` write) and the manifest/MainActivity half of AC-15.

**Only the device can confirm:** AC-8, AC-9, AC-10, AC-11, the marker and empty-cell half of
AC-14, and the dictation/permission and AI-polish UI half of AC-15. This repo has no
component or instrumentation tests; saying otherwise would be a false coverage claim.

## Out of scope

- **Reading notes back in the user's own voice.** A future feature, not part of this one
  (owner ruling 4).
- **Storing audio, audio playback, more than one voice clip per note, trimming, waveforms or
  re-encoding.** Dictation returns text only; nothing audio-shaped is persisted.
- **Notes in Balance** — no note count, no note bar in “Hours by task”, no note text in the
  AI coach prompt. The AI coach is untouched.
- **Notes outside the Week grid** — no notes on Tasks, Vision, Guiding or Settings.
- **AI summaries, auto-titling, automatic polishing, or any AI call without the user's own
  key and an explicit per-note action.**
- **Selecting across categories or across midnight, and cross-week notes.** A note is one
  same-category run inside one day; imported data is preserved but creating such a note is
  not offered.
- **Creating a note over empty cells.** A note may become empty later; creation requires a
  resolved category run.
- **Notifications or alarms attached to notes.**
- **Search, tags, colours, or a notes list outside the grid.**
- **Changing the 336-cell week model, `weekStatsOf`, or any Balance arithmetic.**
- **iOS.** No `ios/` platform exists; the web fallback is only for `npm run dev`.
- **Coordinating with feature 8's week approval/snapshot.** Notes are a sibling field; if
  feature 8 lands first, this feature must preserve its fields with the same spread rule.
  No dependency is declared, but the two specs must not overwrite each other's week fields.

## Open questions

1. **Notes stay anchored to their time range after the cells are erased (chosen).** Should
   such a note instead move to an unassigned-notes list or be deleted when its last cell is
   gone?
2. **`clear this week` keeps notes (chosen).** Should the armed action clear notes too, with
   copy saying so?
3. ~~**Long-press notes only when no brush is selected (chosen).**~~ Superseded by the owner
   ruling of 2026-11-25: the note gesture always fires on a long hold, and painting waits for
   release on touch. The brush never has to be deselected.
4. **The hold-time range is not guessed (needs an answer).** `settings.longPressMs` defaults
   to 500 ms and moves in 500 ms steps. What are its minimum and maximum values?
5. **Polish is a manual per-note action (chosen).** Should optional AI polish ever run
   automatically with the user's key, or only when the user taps it on one note at a time?

## Owner rulings, 2026-11-18

These rulings override the earlier goal text and any conflicting sentence above.

1. **The error list and the acceptance criteria agree.** Every error code in the Contract has
   at least one acceptance criterion that triggers it. In this spec the codes are
   `range-invalid`, `empty-note`, `overlap` and `note-not-found`; they are covered by AC-4
   and AC-5 (and `overlap` also by AC-3). The voice-only codes are gone.
2. **Long-press hold time and selection.** The hold time is a user setting, default 0.5
   seconds, adjustable in steps of 0.5 seconds (`settings.longPressMs`, B9, AC-8). A
   long-press selects the whole unbroken run of the same category above and below the pressed
   block in that day — a sleep or a work shift — and the note belongs to that run. The
   drag-over-adjacent-blocks selection is removed (B3, AC-2, AC-8, AC-9).
3. **Dictation, not audio.** No audio is stored. Voice recordings are replaced by dictation:
   the phone's built-in speech-to-text turns speech into the note's text, followed by the
   non-AI `cleanDictation` that removes fillers such as "uh", "um" and "you know", and
   repeated words (B5, AC-7, AC-15). Optional AI polishing is used only if the user enters
   their own API key and turns it on; the default is always non-AI (B10, AC-15). The key is
   stored only on the device and is never included in exports (AC-12, AC-15). The
   `voice-invalid` case and the 2-minute audio cap are removed; the error list is
   `range-invalid`, `empty-note`, `overlap`, `note-not-found`.
4. **Reading notes back in the user's own voice is a future feature, out of scope.** It is
   listed under *Out of scope* and is not implemented by this feature.

## Owner ruling, 2026-11-24 — grid scrolling

The Plan & Balance week calendar must scroll vertically normally on the phone. Scrolling may
only be paused while a long-press hold on a block is actually in progress, and must resume
when the finger lifts or the hold is cancelled. The grid must not disable touch scrolling
with an unconditional `touch-action: none`. This supersedes the earlier touch-action wording
in *UI states — Gesture vs brush* and AC-9; the implementation applies the lock only while a
recognised hold is active and cancels the gesture when the finger moves first.

## Owner ruling, 2026-11-25 — the note gesture is independent of the brush

Reported: after selecting a task to paint, long-press on the calendar stopped opening a
note; switching to Balance and back restored it (the component remounted and lost the
brush). The owner restated the rule: *pressing the calendar for the hold time opens the
Note section*, with no brush condition.

So the note gesture always starts on a long hold, even with a paint brush or the eraser
selected; only an already open note dialog suppresses it. On touch, painting is committed
on release, and the release that ends a recognised hold is swallowed so it does not paint.
A short tap still paints or erases as before. This supersedes the `brush != null` guard,
the earlier AC-9 and Open question 3. Implemented and pinned by feature 015
(`specs/features/015-week-note-longpress.md`).
