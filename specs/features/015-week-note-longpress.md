# 015 — Long-press opens a week note even with a brush selected

**Feature id:** 15   **Status:** approved   **Depends on:** 12

## Purpose

The week note gesture (feature 12) refuses to start while a paint brush or the
eraser is selected (`if (brush != null || noteDlg) return;`). A selected brush
survives switching categories and is never cleared by the app, so after the user
picks a task the calendar silently stops responding to a long-press until they
leave and re-enter the Week tab. This breaks the rule the owner states: *pressing
the calendar for the configured hold time opens the Note section.* The gesture must
belong to the calendar, not to whichever brush happens to be armed.

## Owner's decisions

### D1. A long-press always opens the note.

A hold of `settings.longPressMs` on the week grid opens the Note section for the
pressed run regardless of whether a task or the eraser is selected. Only an already
open note dialog suppresses it. Tradeoff: on touch, painting is committed on tap
release (the existing `onClick` path) instead of touch-down, so the hold can be
recognised first; mouse drag painting is unchanged.

### D2. The tap that ends a hold must not paint.

When the hold fires, the trailing click/mousedown that the browser synthesises on
finger lift is swallowed. A short tap still paints exactly one cell; the next tap
after a hold behaves normally.

### D3. No data or setting change.

`settings.longPressMs` keeps its range and default. No stored shape, localForage
key, export envelope or note format changes. This is a component behaviour fix.

### D4. Copy matches the behaviour.

The Settings row no longer claims the gesture requires no brush selected.

## User stories

- As a user, after I pick a task to paint, I can still long-press a filled block and
  get its note without first finding a way to deselect the brush.
- As a user, a quick tap still paints or erases; a long hold opens the note and
  leaves the cell exactly as it was.

## Data touched

Reads `settings.longPressMs`; reads and writes `weeks` through `setWeeksP` exactly as
feature 12 does. No new field. No migration.

## Contract

- `src/components/WeekTab.jsx`
  - `handleCellPointerDown` starts the hold timer for any pointer when no note
    dialog is open. The `brush != null` early return is removed.
  - Firing the timer sets a `suppressTapRef` flag before opening the note.
  - `onMouseDown` / `onClick` / `onMouseEnter` painting call sites ignore the tap
    while `suppressTapRef` is set; `onClick` clears it after consuming it.
  - Touch/pen pointer-down does not paint through the mouse-compatibility
    `onMouseDown` path, so the hold can complete before any cell changes.
  - A brush change no longer cancels a pending hold.
- `src/components/SettingsTab.jsx` — the hold-time help text says a long-press works
  even with a brush selected and a short tap still paints.

## UI states

- **Hold on an empty cell:** one line "Long-press a filled block to add a note."; no
  cell changes.
- **Hold on a filled cell, brush selected:** editor (new range) or viewer (existing
  note) opens; the cell does not change.
- **Short tap with a brush:** paints exactly as before.
- **Short tap with the eraser:** clears exactly as before.
- **Hold cancelled by movement:** scrolls; no note and no paint from the gesture.
- **Note dialog open:** pointer-down is ignored.

## Acceptance criteria

1. AC-1: `handleCellPointerDown` in `src/components/WeekTab.jsx` has no
   `brush != null` guard; its only early return is the open note dialog (`noteDlg`),
   and the hold timer is still `setTimeout(..., holdMs)`.
2. AC-2: When the hold timer fires it sets a suppression flag before calling
   `openNoteAt`, so the release tap is distinguishable from a fresh tap.
3. AC-3: The click path that paints (`applyBrush`) consumes the suppression flag
   and paints nothing for the tap that ended a hold; the following tap paints
   normally.
4. AC-4: A short tap with a brush selected still paints one cell and a short tap
   with the eraser still clears it.
5. AC-5: A touch or pen pointer-down does not paint through the
   mouse-compatibility `onMouseDown` path, so a hold cannot change a cell before it
   opens the note.
6. AC-6: The hold time still comes from `clampLongPressMs(settings.longPressMs)`,
   defaults to 500 ms and is clamped to 500–3000 ms in 500 ms steps.
7. AC-7: Scrolling is unchanged: moving more than `HOLD_CANCEL_PX` cancels the hold,
   `touch-action` is `pan-y` except while a recognised hold is active, and the lock
   is released on lift or cancel.
8. AC-8: The Settings help text no longer says the gesture runs only when no brush
   is selected; it says a long-press opens the note even with a brush selected and
   a short tap still paints.
9. AC-9: No stored shape, localForage key, export envelope or setting changes; only
   `WeekTab.jsx` and `SettingsTab.jsx` source change (plus tests and docs).
10. AC-10 (Device): with a task selected, long-pressing a filled block opens the
    note and leaves the block unchanged; the next short tap paints that task.

## Out of scope

- Changing the hold-time range or step.
- Drag-to-extend note selection.
- Changing mouse drag painting.
- Changing AI polish or dictation.
- Any change to the note data model (still one note per same-category run).

## Owner ruling backing this spec

The owner asked, on 2026-11-25: *"user pressed X amount of second on the calendar
view = get a Note section"*, and reported that selecting a task disables the
gesture. This supersedes feature 12's AC-9 and the "Gesture vs brush" wording in
that spec's UI states.

## Open questions

None blocking. The chosen tradeoff (painting commits on release for touch) is the
only way one touch can both be a tap and the start of a hold.
