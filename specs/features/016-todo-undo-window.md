# 016 — Undo a done to-do within 24 hours

**Feature id:** 16   **Status:** approved   **Depends on:** 11

## Purpose

Ticking a to-do moves it to the Done tab and, until now, that was a one-way door: an
accidental tap could only be repaired by deleting it. The owner asked for a safety net —
a done to-do can be returned to Open for 24 hours after it was marked done, and after
that it is permanent. If it is reopened and marked done again, the 24-hour window
restarts from the new done time.

## Owner's decisions

### D1. The window is 24 hours from `doneAt`, not from `createdAt`.

Only the moment the item landed in Done starts the countdown. An item that sat open for
a month is undoable for a full day after it is ticked.

### D2. Expiry is by the clock, never stored.

There is no `undoUntil` field. `doneAt` already exists on every archived item, so the
deadline is derived (`doneAt + 24 h`). This keeps the wall shape unchanged and means the
window cannot drift from the timestamp it is based on.

### D3. Re-doning restarts the window.

Reopening removes `doneAt`; ticking it done again stamps a fresh `doneAt`, so the new
24-hour window starts then. This falls out of the existing `markDone` path with no extra
bookkeeping.

### D4. Undo is not a destructive action.

It restores data, so it is a single tap like "Done" and does not use the two-tap
`useArmed()` confirm. Permanent delete still lives in Records and is unchanged.

## User stories

- As a user, I can tap Undo on a to-do I ticked a few minutes ago and have it back in
  Open, exactly as it was apart from being open again.
- As a user, once a day has passed I can still see the item in Done, but it offers no
  Undo; the fact is permanent.
- As a user, if I undo and then complete it again, I get another full day to change my
  mind.

## Data touched

Reads and writes the `reminderWall` key only, through `setReminderWallP`. The item keeps
its existing fields; `doneAt` is removed on undo and re-added by the next `markDone`.
No new field, no localForage key, no export-envelope change, no migration.

## Contract

`src/lib/reminderWall.js` (pure, no React/DOM/storage):

- `export const UNDO_WINDOW_MS = 24 * 60 * 60 * 1000`
- `canUndoReminder(item, now) -> boolean` — true only when `item` is an object with a
  parseable `doneAt` and `now` parses, and `now - doneAt < UNDO_WINDOW_MS`. `now` may
  be a `Date` or an ISO string. Never mutates.
- `reopenReminder(wall, id, now) -> { wall, error }`:
  - `error === undefined` when the item exists and `canUndoReminder` is true: the item
    is copied with the `doneAt` key **removed** (not `null`, not `false`) and
    `updatedAt` set to `now` when `now` is supplied; every other item is deep-equal.
  - `error === "reminder-not-found"` when no item has that id.
  - `error === "not-archived"` when the item exists but has no `doneAt`.
  - `error === "undo-expired"` when the window has closed (elapsed `>=` 24 h) or
    `doneAt` is present but unparseable.
  - On every error the returned wall is deep-equal to the input; the input is never
    mutated.

`src/components/TodoChartTab.jsx` (Done view):

- Accepts a `now` prop (a `Date`), falling back to `new Date()` when absent.
- For a done item where `canUndoReminder(it, now)` is true, renders an Undo control
  labelled `Undo`; tapping it calls `reopenReminder(reminderWall, id, new Date())` and,
  when there is no error, `setReminderWallP(result.wall)`.
- For an item past the window, renders no Undo control (a muted `Undo closed` line is
  allowed) and nothing can reopen it.
- Imports no management helper, does not delete, and uses no `useArmed`/`window.confirm`.

`src/App.jsx` passes its existing ticking `now` state to `TodoChartTab` so the control
appears/disappears without a reload.

## UI states

- **Done item, under 24 h:** the existing Done card plus an Undo button beside the Done
  date; text stays struck through until tapped.
- **Done item, 24 h or older:** the card is unchanged except it offers no Undo (shows
  `Undo closed`).
- **After tapping Undo:** the card leaves Done immediately and the item reappears in
  Open under its category, no longer struck through.
- **Empty Done tab:** unchanged empty state.
- **Legacy done item with no `doneAt`:** shown in Done, never undoable.

## Acceptance criteria

1. AC-1: `UNDO_WINDOW_MS` is exported and equals `86400000`.
2. AC-2: `canUndoReminder` returns true for a done item `now - doneAt` strictly less than
   24 h, and false at exactly 24 h, at 24 h + 1 ms, and for an open item with no
   `doneAt`.
3. AC-3: `canUndoReminder` returns false without throwing for a missing item, a
   malformed `doneAt`, a `now` that does not parse, and non-object inputs; it never
   mutates the item.
4. AC-4: `canUndoReminder` accepts both a `Date` and an ISO string as `now`, and both
   give the same answer for the same instant.
5. AC-5: `reopenReminder` on a done item inside the window returns `error: undefined`,
   removes the `doneAt` key from that item (`"doneAt" in item === false`), sets
   `updatedAt` to the supplied `now`, leaves every other field and every other item
   deep-equal, and does not mutate the input wall or item.
6. AC-6: `reopenReminder` returns `error: "undo-expired"` and an unchanged wall once
   `now - doneAt >= UNDO_WINDOW_MS`, and the item is still in the Done list.
7. AC-7: `reopenReminder` returns `error: "not-archived"` for an item present with no
   `doneAt`, and `error: "reminder-not-found"` for an absent id; both leave the wall
   deep-equal to its input.
8. AC-8: `markDone` -> `reopenReminder` -> `markDone` with a later `at` leaves the item
   done with the new `doneAt`, and `canUndoReminder(item, now)` is true for a `now`
   inside 24 h of that new `doneAt` even though more than 24 h passed since the first
   `doneAt`; the reopened state passes through `activeReminders`.
9. AC-9: Calling `reopenReminder` a second time on its own successful output returns
   `error: "not-archived"` and a wall deep-equal to that output.
10. AC-10: In the Done view, `TodoChartTab` renders the Undo control only when
    `canUndoReminder(it, now)` is true, and its click handler calls `reopenReminder`
    with the current time and persists through `setReminderWallP`; a source contract
    test proves the import, the guard and the persistence call.
11. AC-11: `App.jsx` passes `now={now}` to `TodoChartTab`, so the 24-hour boundary is
    evaluated against the app's ticking clock rather than a value frozen at mount.
12. AC-12: No stored shape, localForage key, export envelope or setting changes;
    `normalizeReminderWall` still preserves `doneAt`, no migration is added, and the
    Done view still does not delete.

## Out of scope

- Changing the 24-hour length or making it configurable.
- Undoing a permanent delete (feature 11's delete stays permanent).
- Editing a done item's text or category.
- Any notification, reminder or AI surface for the undo window.
- Reworking the Records archive view.

## Open questions

None blocking. 24 hours is fixed by the owner; only the start instant had to be defined
(D1), and `doneAt` already supplies it.
