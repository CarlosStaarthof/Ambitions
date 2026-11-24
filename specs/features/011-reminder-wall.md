# 011 — Reminder wall: post-it reminders with their own categories

**Feature id:** 11   **Status:** approved   **Depends on:** none

## Purpose

The app can record what the user *did* (week cells) and what they *reflected on* (monthly
answers), but there is nowhere to keep a plain "remember this" item. This adds a wall of
post-its: user-owned reminder categories, reminders that must belong to exactly one of
those categories, and an archive for ticked-off reminders. The wall is deliberately
separate from the time-block categories and from the notification sources in Settings:
a wall reminder is captured context, not a calendar commitment and not a scheduled alarm.

## Owner's decisions

### A1. A new top-level section, not another Plan/Balance sub-tab.

The menu gains one item, **Reminders**, with two sub-tabs: **Wall** and **Archive**.
It is not folded into Tasks or Plan & Balance. Tradeoff: one more menu entry, but the wall
stays reachable in one tap and does not compete with the finite-week views.

### A2. Its own store, its own categories.

A new localForage key `reminderWall` stores `{ categories, items }`. These categories are
not the time-block `categories`, and a reminder is not a `task`. Tradeoff: one new key and
an eighth load read, but no wall action can repaint a week or change a Balance bucket.

### A3. No seed data.

A fresh install has an empty wall and no reminder categories. The first reminder requires
the user to create a category first. Tradeoff: one extra step on first use, but the wall
stays genuinely the user's own.

### A4. A post-it is text plus its category's colour.

A reminder has one multi-line text field and no per-reminder title or colour. The post-it
takes the colour of its category; colours are assigned from the existing palette when a
category is created and stay stable on rename. Tradeoff: less visual freedom, much less
UI and no colour picker.

### A5. Done is a one-tap move to an archive; deletion is separate and permanent.

Ticking a reminder sets `doneAt` and removes it from the wall immediately. The archive is
viewable and has no untick or edit control. A reminder — active or archived — can instead be
**permanently deleted** after a two-tap confirmation; deletion removes it from the wall
entirely, so it is never archived and never exported again. Tradeoff: an accidental tick has
no in-app undo, and a deleted reminder cannot be restored; both are deliberate. (Owner
ruling, 2026-11-24.) The archive is kept because the owner asked for done reminders to be
kept.

### A6. Deleting a category moves its reminders to `Uncategorized`; nothing is orphaned.

Every reminder must belong to one category. Deleting a user category reassigns all of its
reminders — active and archived — to a single fallback category with the fixed id
`uncategorized`, created on demand, then removes the category. Deleting `uncategorized`
itself while it holds reminders is refused. Tradeoff: a fallback category can appear that
the user did not create, but no reminder can ever point at a missing category and no
category becomes permanently undeletable because of its archive.

### A7. The wall is part of the JSON backup.

The export envelope becomes `version: 6` and gains one field, `reminderWall`. Import merges
it by id, like tasks and weeks. Tradeoff: a version bump and a merge helper, but a user who
restores their only backup gets their wall back instead of silently losing it.

### A8. Ordering is automatic.

The wall shows active reminders newest `createdAt` first; the archive shows done reminders
newest `doneAt` first. There is no drag-to-reorder. Tradeoff: predictable ordering, no
manual arrangement.

### A9. No notifications are attached to wall reminders.

The existing `settings.reminders` notification sources are untouched. Ticking a wall
reminder schedules and cancels nothing. Tradeoff: the word "reminder" here means a visible
post-it, not a buzz at a time.

## User stories

- As a user, I can create my own reminder categories and put a reminder on the wall under
  exactly one of them.
- As a user, I can edit a wall reminder's text or category, and tick it done when it is
  finished.
- As a user, I can open the archive and see every reminder I ticked done, with its category
  and the date it was archived.
- As a user, I can permanently delete a reminder from the wall or the archive after a
  confirmation step, without changing any category.
- As a user, I can delete or rename a category without any reminder losing its category.
- As a user, restoring my JSON backup restores my wall, categories included.

## Data touched

**New localForage key: `reminderWall`.**

```js
reminderWall = {
  categories: [{ id, name, color }],
  items: [{ id, categoryId, text, createdAt, updatedAt, doneAt? }]
}
```

- `id` comes from `uid()`; `color` from `nextColor` when the category is created.
- `createdAt` / `updatedAt` / `doneAt` are ISO strings supplied by the caller, never read
  from the clock inside a pure helper.
- `doneAt` absent = active; present = archived.
- `text` is trimmed and must be non-empty.
- Every item's `categoryId` resolves to a category in the same wall; `normalizeReminderWall`
  guarantees this on load and after import.

**Keys read and written:** `reminderWall` is added to the set `useStore` reads. The set
becomes `categories`, `questions`, `reflections`, `reminderWall`, `settings`, `tasks`,
`vision`, `weeks`. The existing test that pins the key set is updated to eight keys — it is
not deleted or weakened. Seeding still happens only when every read succeeded and every
value is empty.

**No changes** to `tasks`, time-block `categories`, `weeks`, `reflections`, `vision`, or
`settings`, including `settings.reminders`.

**Export:** `DataTab` writes `version: 6` and adds `reminderWall` to the envelope. A v4 or
v5 file without the field still imports; the stored wall is kept. Import merges before
saving so a file can never erase a stored category or reminder it omits.

**No migration rewrite:** absence of the key already means an empty wall, so nothing is
written on load. Shape repair is a pure function applied in memory and on import.

## Contract

### `src/lib/reminderWall.js` — pure, no React, no DOM, no storage

```js
UNCATEGORIZED_ID = "uncategorized"
UNCATEGORIZED_COLOR = "#64748b"

emptyReminderWall() → { categories: [], items: [] }
normalizeReminderWall(value) → { categories, items }
// Drops malformed entries, trims names/text, keeps valid data, and reassigns every item
// whose category is missing to one uncategorized category (creating it only if needed).
// Idempotent. Never mutates its input.

activeReminders(items)   → items with no doneAt, newest createdAt first
archivedReminders(items) → items with doneAt, newest doneAt first
categoryUsage(wall, categoryId) → number of items, active and archived

addCategory(wall, { id, name }) → { wall, error }
renameCategory(wall, id, name) → { wall, error }
deleteCategory(wall, id) → { wall, error }
addReminder(wall, { id, categoryId, text, at }) → { wall, error }
editReminder(wall, id, { categoryId, text, at }) → { wall, error }
markDone(wall, id, at) → { wall, error }
deleteReminder(wall, id) → { wall, error }
// Permanently removes the item by id, active or archived. Categories are untouched,
// including one left empty by the deletion. Unknown id → reminder-not-found.

mergeImportedReminderWall(stored, imported) → wall
// File wins a shared category/item id; stored entries the file omits are kept; then
// normalizeReminderWall runs. Idempotent and non-mutating.
```

**Error codes** (the component maps each to copy; tests assert the code):

- `name-empty` — a category name is empty after trimming.
- `name-duplicate` — another category already has that name, ignoring case.
- `category-missing` — the id is not in the wall.
- `category-not-empty` — trying to delete `uncategorized` while it still holds items.
- `text-empty` — reminder text is empty after trimming.
- `reminder-not-found` — the reminder id is not in the wall (edit, mark done or delete).
- `reminder-archived` — trying to **edit** a reminder that already has `doneAt`. It does not
  cover ticking it done again; see `markDone` below.

`deleteCategory` moves every item of a non-`uncategorized` category to
`UNCATEGORIZED_ID` (creating it if absent) and then removes the category. It never drops an
item. `markDone` is idempotent: a second call on an already-done reminder returns the wall
unchanged with `error: undefined`, and never `reminder-archived`.

### `src/lib/seed.js`

No change is required for the wall: `normalizeReminderWall` and
`mergeImportedReminderWall` both live in `reminderWall.js`, staying pure and exported for
tests. `seed.js` keeps its existing task/category/week import helpers unchanged.

### `src/lib/useStore.js`

```js
useStore() → { …, reminderWall, setReminderWallP }
setReminderWallP(valueOrUpdater)   // writes the key, like setSettingsP
```

`reminderWall` defaults to `emptyReminderWall()` when the key is absent. `normalizeReminderWall`
runs on the loaded value before it reaches React. A failed `reminderWall` read is a storage
error and takes the existing hard-stop path.

### `src/components/DataTab.jsx`

Export envelope: `{ version: 6, exportedAt, tasks, categories, questions, weeks,
reflections, vision, reminderWall }`. Import persists
`normalizeReminderWall(mergeImportedReminderWall(stored, file))` through `setReminderWallP`.

### Components

- `src/components/ReminderWallTab.jsx` — new leaf view. Receives `reminderWall`,
  `setReminderWallP`, and the active lists only.
- `src/App.jsx` — new section id `reminders`, header label, and the sub-tab switch.
- `src/components/AppMenu.jsx` — one new menu item, icon from `lucide-react`.

## UI states

- **Empty:** no categories → one card says the wall needs a category, with a create-category
  control. Categories but no active reminders → "No reminders on the wall." Archive with
  nothing done → "Nothing archived yet." No empty post-it grid.
- **Loading:** the existing app-level `loading…` screen; the section does not render early.
- **Error:** a failed read uses the existing storage-error screen. Form validation is inline,
  one line beside the field, using the error-code copy; no alert, no `window.confirm`.
- **Success:** new reminders appear on the wall under their category, coloured by it. Tick
  done removes the post-it and adds it to Archive with its category and done date. Editing
  updates the post-it in place. Delete is a two-tap `useArmed` action available on a wall
  post-it and on an archive entry; confirming removes the reminder entirely and no category
  changes.
- **Category management:** add, rename, and delete in one card. Delete is armed with
  `useArmed`; its copy says how many reminders will move to Uncategorized. Deleting
  Uncategorized while it holds reminders is disabled with a one-line reason.
- **AI disabled:** no AI surface, no provider call, no key read. The section is identical
  with AI off, which is the shipping default.

## Acceptance criteria

1. AC-1: A new localForage key `reminderWall` stores exactly `{ categories, items }`.
   `useStore` reads it as the eighth key, seeds only when all eight reads succeeded and all
   eight values are empty, and `setReminderWallP` is its only writer. The existing test that
   pins the key set is updated to expect `categories`, `questions`, `reflections`,
   `reminderWall`, `settings`, `tasks`, `vision`, `weeks` — not deleted or weakened.
2. AC-2: The wall is independent of the time-block data: adding, renaming, deleting or
   ticking anything in it changes no value under `tasks`, time-block `categories`, `weeks`,
   or `settings.reminders`, and no wall category is offered by the Week brush picker.
3. AC-3: `normalizeReminderWall` turns absent, `null`, `{}` and malformed values into a
   valid `{ categories, items }`, preserves every valid entry, assigns every item whose
   category is missing to exactly one `uncategorized` category created only when needed,
   and is idempotent — running it twice returns a deep-equal wall without mutating its
   input.
4. AC-4: `addCategory` trims the name, rejects an empty name with `name-empty` and a
   case-insensitive duplicate with `name-duplicate`, assigns the first palette colour not
   already used by a category, keeps the supplied id, returns a new wall, and does not
   mutate the input wall or its categories.
5. AC-5: `renameCategory` applies the same trimming and returns `name-empty` or
   `name-duplicate` for an empty name or a duplicate. The duplicate check excludes the
   category being renamed, so renaming a category to a different-case version of its own
   name (e.g. `work` → `Work`) is accepted and applied. An unknown id returns
   `category-missing` and changes nothing. On success it preserves the category's id and
   colour and every item's `categoryId`, and is a no-op only when the new name equals the old
   name exactly after trimming.
6. AC-6: `deleteCategory` on a user category reassigns every item that references it —
   active and archived — to `uncategorized`, creates that category if absent, then removes
   the category, leaving the item count unchanged. Deleting `uncategorized` while it holds
   any item returns `category-not-empty` and changes nothing. Deleting an empty category
   removes only that category. An unknown id returns `category-missing` and changes nothing.
7. AC-7: `addReminder` trims the text, rejects empty text with `text-empty` and an unknown
   category with `category-missing`, stores `createdAt` and `updatedAt` equal to the
   supplied `at`, stores no `doneAt`, returns a new wall, and does not mutate its input.
8. AC-8: `editReminder` can change text and category, rejects empty text with `text-empty`,
   an unknown category with `category-missing`, an unknown reminder id with
   `reminder-not-found` and an archived reminder with `reminder-archived`, sets `updatedAt`
   to the supplied `at`, and preserves the id, `createdAt` and `doneAt`.
9. AC-9: `markDone` sets `doneAt` and `updatedAt` to the supplied `at`, leaves every other
   field unchanged, and returns `reminder-not-found` for an unknown id. It is idempotent: a
   second call on an already-done reminder returns the wall unchanged with `error: undefined`
   (never `reminder-archived`), so a test asserts exactly that outcome. The reminder then
   appears in `archivedReminders` and not in `activeReminders`.
10. AC-10: `activeReminders` returns only items with no `doneAt`, newest `createdAt` first;
    `archivedReminders` returns only items with `doneAt`, newest `doneAt` first; both
    preserve array order for equal timestamps and return new arrays. `categoryUsage` counts
    active and archived items.
11. AC-11: The new **Reminders** section renders a **Wall** sub-tab. With at least one
    category, it shows active reminders as post-its coloured by their category, a category
    filter with **All** plus every category, and per post-it controls to tick done and edit.
    (Device.)
12. AC-12: Ticking a post-it removes it from the wall in the same interaction and it appears
    under the **Archive** sub-tab with its text, category name and done date; the archive is
    read-only — no untick, edit or delete control. Empty wall, empty category filter and
    empty archive each render their own one-line empty state. (Device.)
13. AC-13: Categories can be created, renamed and deleted from the section. Create and
    rename reject empty and duplicate names with one inline line. Delete is a two-tap
    `useArmed` action whose copy states how many reminders move to Uncategorized; deleting
    Uncategorized while it holds reminders is disabled with a reason. Creating or editing a
    reminder without a category cannot save. (Device.)
14. AC-14: The export envelope is `version: 6` and contains `reminderWall`.
    `mergeImportedReminderWall` keeps stored categories and items the file omits, lets the
    file win a shared id, and is idempotent; a v4 or v5 file without `reminderWall` imports
    with the stored wall intact; a file with the field round-trips all categories, items and
    `doneAt` values. (Pure for the merge; source for the envelope.)
15. AC-15: Wall actions make no network request, read no AI provider or key, and expose no
    AI-gated control; with AI off — `enabled: false` or `provider: "none"` — every wall
    behaviour is identical. No wall action schedules or cancels a notification, and the
    existing reminder sources in Settings behave exactly as before.
16. AC-16: `deleteReminder` permanently removes an active or archived reminder by id: it
    returns a new wall without that item, leaves every category and every other item
    deep-equal, does not mutate its input, and returns `reminder-not-found` for an unknown
    id. The deleted reminder appears in neither `activeReminders` nor `archivedReminders`,
    does not count in `categoryUsage`, and is absent from the `reminderWall` written in a
    later export. Deleting a reminder never changes a category, including leaving a
    category empty. The wall and the archive each offer the delete control as a two-tap
    `useArmed` action, with no `window.confirm`.

## Verification

**Vitest can prove** (new `tests/unit/reminderWall.test.js`, plus the key-pin and export
assertions in `tests/unit/reminders.test.js` and `tests/unit/seed.test.js`): AC-1 (source
half), AC-3 to AC-10, AC-14 (merge half), AC-16 (the pure delete and export-absence cases),
and the independence half of AC-2. Every transform is a pure function of a supplied wall and
`at`, so none waits for a real clock.

**A source-reading test can prove:** AC-1 (the eight-key set), AC-2 (no `tasks`/`weeks`/
`settings` writers in the wall module or component), AC-14 (the envelope version and field),
AC-15 (no `callAI`, no network, no notification call from the wall) and the control half of
AC-16 (delete armed in both views, no `window.confirm`).

**Only the device can confirm:** AC-11, AC-12, AC-13, the rendered delete/confirmation half
of AC-16, and the rendered half of AC-2. This repo has no component tests; claiming
otherwise would be a false coverage claim.

## Out of scope

- **Un-ticking / restoring an archived reminder.** Deletion is now in scope (owner ruling,
  2026-11-24) but undoing a tick or a deletion is not.
- **Notifications, due dates, repeat rules, priorities, tags, search or manual reordering.**
  The wall is a visual post-it board, not a scheduler.
- **Per-reminder colours or a colour picker.** A reminder takes its category's colour.
- **Moving a reminder between categories in bulk.**
- **AI involvement of any kind** — no summarising, no auto-categorising, no provider call.
- **An Uncategorized category in the seed data.** It exists only when deletion or a malformed
  import creates a need for it.
- **A separate migration of the wall shape.** Absence is unambiguous; a load-time rewrite
  would be a write with no benefit.

## Open questions

1. **Archive has no untick or edit (chosen); delete is separate (AC-16).** Should an
   archived reminder be restorable with one control? If yes, the spec gains an untick action
   and one AC; if no, an accidental tick is permanent unless the reminder is deleted.
2. **The wall is in the JSON backup (chosen, AC-14).** If you intended it to be
   device-scoped like notification preferences, say so and AC-14 is removed.
3. **Deleting a category moves its reminders to Uncategorized (chosen).** The alternative
   is refusing deletion until every reminder is gone, which the permanent archive makes
   impossible.
4. **Reminder deletion (answered 2026-11-24).** A reminder created by mistake is deletable
   from the wall and from the archive after a confirmation step, permanently. See AC-16 and
   the owner ruling below.
5. **No notifications are attached to wall reminders (chosen).** Should a wall reminder
   ever schedule an alert, or does "reminder" here mean only the visible post-it?

## Owner rulings, 2026-11-18

The owner recorded four rulings this day. Only ruling 1 changes this spec; rulings 2–4
concern block notes (spec 012) and leave this wall unchanged.

1. **The error list and the acceptance criteria agree.** Every error code in the Contract has
   at least one acceptance criterion that triggers it. `name-empty` and `name-duplicate` are
   covered by AC-4 and AC-5; `category-missing` by AC-5, AC-6 and AC-7; `category-not-empty`
   by AC-6; `text-empty` by AC-7 and AC-8; `reminder-not-found` by AC-8, AC-9 and AC-16; and
   `reminder-archived` by AC-8.
2. **Long-press hold time and same-category run selection** applies to block notes only and
   does not change this spec.
3. **Dictation instead of stored audio** applies to block notes only; the wall has no audio
   and no AI involvement.
4. **Reading notes back in the user's own voice** is a future feature out of scope for block
   notes and does not change this spec.

## Owner ruling, 2026-11-24

**Reminders can be permanently deleted, from the wall and from the archive, after a
confirmation step.** Deleting removes the reminder completely: it is not archived and does
not appear in exports afterwards. Categories are unaffected. This supersedes the earlier
"No reminder deletion" choice in A5, open question 4 and *Out of scope*, and is specified by
`deleteReminder` in the Contract and by AC-16.
