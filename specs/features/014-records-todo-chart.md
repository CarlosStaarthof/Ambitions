# 014 — Records and To-Do's Chart split

**Feature id:** 14   **Status:** approved   **Depends on:** 11

## Purpose

The wall currently mixes two jobs in one "Reminders" menu: a glanceable board the user
opens to see what is still open and tick it off, and the backend work of creating
categories and reminders. Splitting them lets the daily view stay calm and visual while
all editing lives in one management area. The To-Do's Chart must also show *when* each
item was first captured, so the board reads as a record of commitments, not an undated
list.

## Owner's decisions

### D1. Rename the two menu entries.

`Task & Questions` becomes **Records**; `Reminders` becomes **To-Do's Chart**. Section ids
stay `tasks` and `reminders` so no stored state or deep link breaks. Tradeoff: the ids no
longer match the labels, but changing them buys nothing.

### D2. To-Do's Chart is read + tick done only.

It renders the open post-its and the done archive. Its only mutating control is ticking an
item done; there is no create, edit, delete or category control. Tradeoff: a mistaken
reminder is fixed in Records, one menu away.

### D3. Records owns all reminder management.

Records keeps its existing Tasks and Questions sub-tabs and gains a Reminders sub-tab that
holds every backend control the old wall had: category create/rename/delete, reminder
create/edit, and permanent delete (open and archive). Tradeoff: management is no longer
reachable from the board itself.

### D4. Every open post-it carries its original creation date.

`createdAt` already exists on wall items, so no shape change. A reminder written before the
field existed shows `Added date unknown`; nothing is backfilled or rewritten on load.
Tradeoff: legacy items look less useful, but the record is never invented.

### D5. No data or export change.

No new localForage key, no new stored field, export stays `version: 6`. The split is a
component/routing change over the existing `reminderWall` value.

## User stories

- As a user, I open To-Do's Chart to see all open items, grouped and coloured, each stamped
  with the day it was created, and tick one done.
- As a user, I open Records when I need to add a reminder, rename a category, edit text or
  delete something.
- As a user, I can still see done items, read-only, with both their created and done dates.

## Data touched

Reads and writes only the existing `reminderWall` key through `setReminderWallP`:

```js
reminderWall = { categories: [{ id, name, color }], items: [{ id, categoryId, text, createdAt, updatedAt, doneAt? }] }
```

No change to `tasks`, time-block `categories`, `weeks`, `reflections`, `vision` or
`settings`. No new localForage key. Export envelope unchanged (`version: 6`).

## Contract

### `src/lib/reminderWall.js` (additive, pure)

```js
createdDate(iso) → "YYYY-MM-DD" | null
// The local calendar day an item was captured, or null for a missing/unparseable value.
// Never throws, never mutates. Used by the chart so the stamp is testable.
```

Everything else in the module is unchanged.

### Components

- `src/components/TodoChartTab.jsx` — new. Receives `reminderWall`, `setReminderWallP`,
  `view` (`"open"` | `"done"`). Renders a summary count, open post-its grouped by
  category with a per-item `Added <date>` stamp and one **Done** control, or the read-only
  done archive. Imports no create/edit/delete/category helper.
- `src/components/ReminderWallTab.jsx` — unchanged behaviour; now mounted by Records.
- `src/App.jsx` — section labels `tasks → Records`, `reminders → To-Do's Chart`; Records
  sub-tabs `Tasks | Questions | Reminders`; To-Do's Chart sub-tabs `Open | Done`.
- `src/components/AppMenu.jsx` — the two labels above; icons unchanged.

## UI states

- **Empty (open):** one card, "Nothing to do. Add reminders in Records." No grid.
- **Empty (done):** one card, "Nothing done yet."
- **Open:** summary card with open/done counts, then one category group per category that
  holds an open item, each post-it tinted by its category.
- **Done:** read-only cards showing category, text, `Added <date>` and `Done <date>`.
- **Error:** existing app-level storage-error screen; ticking a missing id changes nothing.
- **AI off:** identical; the chart reads no AI setting, key or network.

## Acceptance criteria

1. AC-1: `AppMenu` shows the label `Records` for the `tasks` item and `To-Do's Chart` for
   the `reminders` item, and no menu item reads `Task & Questions` or exactly `Reminders`.
2. AC-2: `App`'s `SECTION_LABEL` maps `tasks` to `Records` and `reminders` to
   `To-Do's Chart`, so the header matches the menu.
3. AC-3: The Records section renders three sub-tabs — Tasks, Questions, Reminders — and the
   Tasks and Questions sub-tabs still render `TasksTab` and `GuidingTab` respectively.
4. AC-4: The Records Reminders sub-tab mounts `ReminderWallTab` with both its `wall` and
   `archive` views reachable, so category create/rename/delete, reminder create/edit and
   permanent delete (open and archived) are all available there.
5. AC-5: The To-Do's Chart section mounts `TodoChartTab`; its sub-tabs are `Open` and
   `Done`.
6. AC-6: `TodoChartTab` renders every open reminder with one **Done** control and no
   other mutating control; it imports none of `addCategory`, `renameCategory`,
   `deleteCategory`, `addReminder`, `editReminder`, `deleteReminder`, and uses no
   `useArmed` and no `window.confirm`.
7. AC-7: Each open post-it displays the item's original creation date derived from
   `createdAt`, and an item whose `createdAt` is missing or unparseable renders
   `Added date unknown` without adding the field to stored data.
8. AC-8: Ticking **Done** calls `markDone` and persists through `setReminderWallP`; the item
   leaves the Open view and appears in the Done view, and no category or other item
   changes.
9. AC-9: The Done view is read-only: it shows the item's category, text and both its
   created and done dates, with no edit or delete control.
10. AC-10: `createdDate` returns `YYYY-MM-DD` for a valid timestamp, `null` for
    `undefined`, `null`, `""`, a non-string and an unparseable string, and never throws.
11. AC-11: No new localForage key is created and the export envelope stays `version: 6`
    with the same field list; the only writer remains `setReminderWallP`.
12. AC-12: The chart reads no AI setting or key, makes no network request, and is identical
    with AI off — the shipping default.

## Out of scope

- New reminder features (due dates, repeat rules, notifications, priorities, search).
- Reordering, drag-and-drop or manual column layout.
- Editing, un-ticking or deleting anything from the To-Do's Chart.
- Any change to the wall's stored shape, its categories, or the export envelope.
- Moving Tasks or Questions into their own top-level menus.

## Open questions

1. Should the Done archive ever be editable (untick) or is read-only permanent? (Chosen:
   read-only; deletion stays in Records.)
2. Should Records also expose Week/Balance backend settings later, or only the reminder
   backend for now? (This feature adds only the reminder sub-tab.)
