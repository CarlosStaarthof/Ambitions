# 012 — Block notes on the Plan & Balance week grid

**Feature id:** 12   **Status:** draft   **Depends on:** none (coordinates with 8 and 11
through the shared `weeks` and export shapes; see *Out of scope* and *Open questions*)

## Purpose

A painted cell records only *which task* occupied a half hour. What happened, what was
decided, or a spoken note about that time has nowhere to live. This feature lets the user
long-press one block, or several adjacent blocks, and attach one note — written text, a
voice recording, or both. Long-pressing those blocks later shows the text or plays the
recording. Notes are part of the week, so they travel in the existing JSON export and must
survive import.

## Owner's decisions

### B1. A note is anchored to a contiguous time range, not to a task id.

A note stores `start` and `end` half-hour indices in its week. Renaming, recolouring or
retiring the task, or painting a different task over a cell, does not move or delete the
note. Tradeoff: a note can outlive the block it was written on and appear over a different
task; the week grid is the record of the time, so time is the stable anchor.

### B2. One note per time range; overlap is refused.

The wall resolves a long-press through one deterministic note. Creating or extending a
selection that overlaps an existing note is refused with one line, so the user must open,
edit or delete the existing note first. Tradeoff: covering a larger range after the fact
means deleting and recreating the note; an imported file that already contains overlaps is
still preserved, and `noteAt` picks the first note in array order.

### B3. Selection is contiguous filled cells, and may cross midnight — but not the week.

A long-press selects the whole task block under the finger. Dragging over further adjacent
blocks extends the range; every cell between the anchor and the last block must be filled,
or the selection is refused. The range may run from Monday 23:30 into Tuesday 00:00, but
never from Sunday into the next week. Tradeoff: no note over an empty half hour and no
rectangular multi-day selection; both keep the anchor unambiguous.

### B4. Notes live inside `weeks`; no new localForage key.

A week object gains an optional `notes` array next to `cells`. `weeks` is already exported
and already merge-protected on import, so notes ride the existing vehicle. Tradeoff: the
week object's shape grows, the import merge must learn about notes, and the export version
moves to 6.

### B5. Voice is compressed at capture, capped at two minutes.

Android records AAC in an MP4 container at 32 kbps mono through a small hand-written
`VoiceRecorderPlugin`; the web development build uses `MediaRecorder` with Opus at 32 kbps.
Recording auto-stops at exactly 120 000 ms. The clip is stored as a base64 data URI plus its
mime type and duration — never a blob or object URL. Tradeoff: about 0.5 MB of audio per
two-minute note before base64, a larger JSON export, and lossy audio; no transcoding,
trimming or waveform editing.

### B6. `clear this week` clears blocks, not notes.

The control keeps its meaning as a schedule clear and writes `{ ...wk, cells: {} }`, leaving
`notes` untouched. A note whose cells were erased stays anchored to its time range and keeps
its marker on the first cell, which is now empty. Tradeoff: the grid can show a note marker
over an empty row; the alternative — silently deleting user content — is worse. The control's
copy says notes are kept.

### B7. Editing replaces; deleting is explicit and armed.

Editing can change text, record a new clip over the old one, remove the clip, or both. A note
must keep at least one of text or audio. Deleting a note is a two-tap `useArmed` action.
Tradeoff: replacing a voice clip loses the old one with no undo, matching every other
single-value field in the app.

### B8. Nothing but the note is stored.

There is no transcription, no AI summary, no automatic title, no notification, and no
link between a note and a task id. Tradeoff: text search and speech-to-text are later,
separate features.

## User stories

- As a user, I can long-press one block and write a note, record a voice note, or both.
- As a user, I can long-press a block and drag over adjacent blocks to attach one note to
  the whole stretch.
- As a user, I can long-press a block later, read the text and play the recording.
- As a user, I can edit or delete a note without changing the week's painted cells.
- As a user, my notes survive exporting and importing my JSON backup.
- As a user, clearing a week does not destroy the notes I wrote about it.

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
    text?,        // trimmed, non-empty when present
    audio?,       // { mime, dataUrl, durationMs }
    createdAt,
    updatedAt
  }]
}
```

`start`/`end` use the same half-hour grid as `cells`: `index = day * 48 + slot`, day 0–6 =
Mon–Sun, slot 0–47. A note covers every index in `[start, end)`. Absence of `notes`, or an
empty array, means no notes. A note stores no `taskId`.

**Export:** the envelope field list does not change; `weeks` already carries the notes.
Because the stored week shape changes, `DataTab` writes `version: 6` (if feature 11 has
already bumped 5→6, it stays 6 — never 7). A v4 or v5 file without notes imports with none
and no error.

**Import:** `mergeImportedWeeks` continues to merge cells slot by slot and now also merges
`notes` by id. File wins a shared id; stored notes the file omits survive; a week only in
storage keeps its notes; a week only in the file imports its notes even if its `cells` is
empty. Merging the same file twice is deep-equal.

**No load-time rewrite of `weeks`.** Absence is unambiguous, and writing `weeks` during load
is forbidden by the data-safety rules in feature 7. No `normalizeModel` change is needed;
the only shape gate is the import merge.

**No changes** to `tasks`, time-block `categories`, `questions`, `reflections`, `vision`,
`settings`, or notification scheduling.

## Contract

### `src/lib/notes.js` — pure, no React, no DOM, no storage

```js
MAX_VOICE_MS = 120000
WEEK_CELLS = 336

notesOf(week) → Note[]                       // [] when the week has no notes
blockBoundsAt(cells, index) → { start, end } | null
// The maximal run of the same non-empty task id containing `index`, in global indices.
// null when `index` is empty.

selectionRange(cells, anchorIndex, focusIndex) → { start, end } | null
// Normalises the two endpoints to their blocks and returns the whole range only when every
// index between them is filled. null on an empty endpoint or any empty cell in between.
// May cross midnight; never leaves 0…335.

noteAt(notes, index) → Note | null
canPlaceNote(notes, start, end, ignoreId) → boolean
validateNote(note) → error | null
addNote(notes, note) → { notes, error }
updateNote(notes, id, patch, at) → { notes, error }
removeNote(notes, id) → Note[]
mergeImportedNotes(stored, imported) → Note[]
```

**Error codes** (the component maps each to copy; tests assert the code):

- `range-invalid` — start/end outside `0…336`, or `start >= end`.
- `empty-note` — no non-empty trimmed `text` and no `audio`.
- `overlap` — the range intersects a different note.
- `voice-invalid` — audio without `mime` or a `data:` URL.
- `voice-too-long` — `audio.durationMs > MAX_VOICE_MS` on a new or edited note.
- `note-not-found` — the id is not in the array.

`addNote` trims `text` and omits it when empty. `updateNote` may replace or remove `audio`
and text, preserves `id`, `start`, `end` and `createdAt`, and sets `updatedAt` to the
supplied `at`. `removeNote` is idempotent. None of these mutate their inputs.
`mergeImportedNotes` does not validate away entries: a stored or imported note with a valid
id is kept, so a backup never silently loses content.

### `src/lib/audio.js` — the impure wrapper

```js
audioSupported() → boolean
startVoice() → "granted" | "denied" | "unsupported"
stopVoice()  → Promise<{ dataUrl, mime, durationMs }>   // auto-stops at MAX_VOICE_MS
cancelVoice() → Promise<void>
```

On Android this calls `VoiceRecorderPlugin` (MediaRecorder, MPEG_4/AAC, mono, 32 kbps,
`setMaxDuration(120000)`); in a desktop browser it uses `MediaRecorder` with
`audio/webm;codecs=opus` at 32 kbps. If capture is unavailable or the permission is denied,
`startVoice` returns the sentinel and the UI disables the voice control; text notes keep
working. Nothing here throws into the screen, and no blob or object URL is persisted.

### `android/`

- `android/app/src/main/AndroidManifest.xml` gains `android.permission.RECORD_AUDIO` and no
  other permission.
- New `android/app/src/main/java/com/carlos/ambitions/VoiceRecorderPlugin.java`, registered
  in `MainActivity.onCreate` **before** `super.onCreate()`.
- No third-party dependency is added.

### `mergeImportedWeeks` in `src/lib/seed.js`

For each week key it merges `cells` as today and sets `notes` to
`mergeImportedNotes(notesOf(storedWeek), notesOf(importedWeek))` when either side has notes.
Every other sibling field keeps today's behaviour: the imported week wins when both exist.
Feature 8 owns any change to how `approved` or a snapshot merges.

### Components

- `src/components/WeekTab.jsx` gains the long-press/selection gesture, the note editor and
  viewer, a note marker on the first cell of each note range, and the `clear this week`
  spread fix. A short tap and the existing paint drag behave exactly as before.
- `src/components/DataTab.jsx` bumps the envelope to `version: 6`; import keeps calling
  `mergeImportedWeeks`, which now includes notes.

## UI states

- **Empty:** a week with no notes renders exactly as today. Long-press still selects a block
  and opens an empty editor with Save disabled until text exists or a voice clip is recorded.
- **Loading:** the existing app-level `loading…` screen; the grid does not render early.
- **Error:** a refused selection (gap, non-adjacent, overlap) shows one line and opens no
  editor. Microphone denied or unsupported disables the record control with one line; a
  recording failure leaves the editor open and text usable. A failed store read uses the
  existing storage-error screen.
- **Success:** a saved note shows a small marker at the start of its range. Long-pressing any
  cell in the range opens the viewer; text is shown and a play control appears only when
  audio exists; playback never autoplays and stops when the viewer closes.
- **Gesture vs brush:** with a paint brush or eraser selected, touch paints at touch-down as
  today and the note gesture does not fire; with no brush selected, the ~500 ms long-press
  and drag select a note range. The grid uses `touch-action: none` so a note drag never
  scrolls the `overflow-auto` container.
- **Clear week:** the armed action clears `cells` only and leaves every note marker in place;
  its copy says notes are kept.
- **AI disabled:** no AI surface, no provider call, no key read. Every behaviour above is
  identical with AI off, which is the shipping default.

## Acceptance criteria

1. AC-1: Notes are stored only under `weeks[weekKey].notes` as objects
   `{ id, start, end, text?, audio?, createdAt, updatedAt }`, with `start` inclusive, `end`
   exclusive, `0 <= start < end <= 336`, no `taskId`, and `audio` as
   `{ mime, dataUrl, durationMs }`. No new localForage key is added; absence of `notes`
   means no notes.
2. AC-2: `blockBoundsAt(cells, index)` returns the maximal run of the same non-empty task id
   containing `index` in global indices, including a run that crosses midnight from day 0
   slot 47 into day 1 slot 0, and returns `null` for an empty index.
3. AC-3: `selectionRange(cells, anchor, focus)` returns the full range between the two
   blocks when every cell in it is filled, including two adjacent blocks with different task
   ids and a range that crosses midnight; it returns `null` when either endpoint is empty or
   any index between them is empty, and never returns a range outside `0…335`.
4. AC-4: `canPlaceNote` is false for any range that intersects an existing note other than
   `ignoreId`; `addNote` returns `overlap` and an unchanged array in that case. With no
   overlap, `noteAt(notes, index)` returns exactly the note whose `[start, end)` contains
   `index`, and `null` outside every range. Imported overlaps are preserved and `noteAt`
   returns the first in array order.
5. AC-5: `addNote` trims text and omits an empty text field, returns `empty-note` when there
   is neither text nor audio, returns `range-invalid` outside `0…336` or when
   `start >= end`, returns `voice-invalid` when `audio` has no `mime` or its `dataUrl` is not
   a `data:` URL, stores the supplied `createdAt`/`updatedAt`, and returns new arrays and
   objects without mutating its inputs.
6. AC-6: `updateNote` changes text and/or audio, can remove the audio by supplying
   `audio: null`, rejects a result with neither text nor audio with `empty-note`, rejects an
   invalid clip with `voice-invalid`, rejects a range overlapping another note with `overlap`,
   sets `updatedAt` to the supplied `at`, preserves `id`, `start`, `end` and `createdAt`, and
   returns `note-not-found` for an unknown id.
7. AC-7: `removeNote(notes, id)` returns a new array without that note, leaves every other
   note deep-equal, does not mutate its input, and returns an array deep-equal to the input
   for an unknown id.
8. AC-8: `MAX_VOICE_MS` is 120000; `validateNote` accepts `durationMs` exactly 120000 and
   rejects a greater value with `voice-too-long`, and the recorder auto-stops at
   `MAX_VOICE_MS` so a recording made through the UI can never be longer. (Pure for the
   `validateNote`/`MAX_VOICE_MS` half; Device for the recorder auto-stop.)
9. AC-9: A ~500 ms long-press on a filled cell selects the whole block under the finger and
   opens the editor if that range has no note; dragging without lifting over further
   adjacent blocks extends the selection to the whole contiguous range and opens one editor
   on release. Releasing over an empty or non-adjacent cell shows one line and opens no
   editor. The long-press note gesture is available only when no paint brush or eraser is
   selected: with a brush selected, touch paints at touch-down exactly as today and no note
   gesture fires, so no note gesture ever changes a cell. A short tap with a brush selected
   paints exactly as before. During a long-press drag the grid must not scroll — the gesture
   uses `touch-action: none` and calls `preventDefault`, so the `overflow-auto` container
   stays put under the finger. (Device.)
10. AC-10: Long-pressing any cell in a range that already has a note opens the viewer, not a
    second editor. The viewer shows the text, shows a play control only when audio exists,
    never autoplays, stops playback on close, and shows a marker at the range start even when
    those cells are empty. (Device.)
11. AC-11: Saving a new note or editing an existing one shows the marker immediately;
    editing can replace the text, record a new clip over the old one, remove the clip, or
    both, and Save stays disabled while both text and audio are empty. Delete is a two-tap
    `useArmed` action that removes the note and frees its range. (Device.)
12. AC-12: The export envelope is `version: 6` and its field list is unchanged; exported
    `weeks` values carry `notes` verbatim, including audio data URIs; a v4 or v5 file without
    notes imports with no notes and no error. (Source plus a round-trip test.)
13. AC-13: `mergeImportedWeeks` merges notes by id: for a week both sides have, stored notes
    the file omits survive, the file wins a shared id, and imported notes survive even when
    the file's week has no `cells`; a week only in storage keeps its notes unchanged; running
    the merge twice returns a deep-equal result and never mutates either argument.
14. AC-14: `clear this week` writes `{ ...wk, cells: {} }`, so the week's `notes` is
    unchanged; erasing or repainting a cell inside a note's range leaves the note unchanged;
    a note whose cells are all erased still renders its marker and is still reachable by
    long-press. (Source for the spread; Device for the marker.)
15. AC-15: Voice capture is only through `src/lib/audio.js`, stores a compressed base64
    `data:` URI with its mime and duration in the note, never persists a blob or object URL,
    and adds `RECORD_AUDIO` as the only new Android permission with the plugin registered
    before `super.onCreate()`. Permission is requested on the first record; denial or an
    unsupported platform leaves text-only notes fully working with the voice control
    disabled and one line of copy, and the rest of the app unaffected. No AI call, no
    network request and no AI-gated control is added; with AI off every behaviour is
    identical.

## Verification

**Vitest can prove** (new `tests/unit/notes.test.js`, additions to
`tests/unit/seed.test.js`, and the export assertion in `tests/unit/reminders.test.js`):
AC-2 to AC-7, the `validateNote`/`MAX_VOICE_MS` half of AC-8, AC-12 (version/source half),
AC-13 and the source half of AC-14. These are pure functions of supplied cells, notes and
timestamps; none reads a real clock or the DOM.

**A source-reading test can prove:** AC-1 (no new key, no `taskId` in the note writer),
AC-12 (the envelope version and field list), AC-14 (the `{ ...wk, cells: {} }` write) and
the manifest/MainActivity half of AC-15.

**Only the device can confirm:** AC-9, AC-10, AC-11, the recorder auto-stop half of AC-8,
the marker and empty-cell half of AC-14, and the recording/permission half of AC-15. This
repo has no component or instrumentation tests; saying otherwise would be a false coverage
claim.

## Out of scope

- **Notes in Balance** — no note count, no note bar in “Hours by task”, no note text in the
  AI coach prompt. The AI coach is untouched.
- **Notes outside the Week grid** — no notes on Tasks, Vision, Guiding or Settings.
- **Speech-to-text, transcription, summaries, auto-titling, or any AI call.**
- **More than one voice clip per note**, audio trimming, waveforms, or re-encoding an
  imported clip.
- **Cross-week notes** (Sunday into the next Monday) and notes anchored to a task id.
- **Creating a note over empty cells.** A note may become empty later; creation requires
  filled blocks.
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
2. **Selection may cross midnight within the week (chosen).** Should it be limited to a
   single day for a simpler gesture?
3. **`clear this week` keeps notes (chosen).** Should the armed action clear notes too, with
   copy saying so?
4. **32 kbps mono is the chosen compression.** Is that quality acceptable given that voice
   notes travel inside the JSON backup and can grow an export by roughly 0.6 MB per
   two-minute note?
5. **Long-press notes only when no brush is selected (chosen).** Painting starts at
   touch-down when a brush is active, so one touch cannot both paint and start a note.
   Should note gestures require the brush to be deselected, or should painting instead wait
   for release? The alternative — the first touch paints and a long-press undoes it — is not
   chosen because it can visibly flash a painted cell.
