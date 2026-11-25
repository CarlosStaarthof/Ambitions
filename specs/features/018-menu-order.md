# 018 — Main menu order

**Feature id:** 18   **Status:** approved   **Depends on:** 14

## Purpose

The drawer currently reads Plan & Balance, Records, To-Do's Chart, Vision Board,
Settings. The owner wants the daily-use destinations first and the reference/editing
screen (Records) fourth, with Settings last. Without this the most-used entry (To-Do's
Chart) sits below Records, which the owner reaches less often.

## Owner's decisions

- The order is exactly: Plan & Balance, To-Do's Chart, Vision Board, Records, Settings.
  The tradeoff accepted: Records — which now owns reminder and task editing — is no
  longer in second place, so editing takes one extra tap through the drawer.
- Labels and section ids do not change. The tradeoff accepted: no new ids means the
  existing routing, deep state and active-highlight logic need no migration.

## User stories

- As the owner, I open the drawer and see To-Do's Chart directly under Plan & Balance,
  so I can reach my daily list without scanning past Records.
- As the owner, I still find Records in the same drawer and Settings in its familiar
  last position.

## Data touched

None. This is presentational. No localForage key, stored shape, settings object or
export envelope changes.

## Contract

`src/components/AppMenu.jsx` `ITEMS` is the single source of the drawer order: an array
of `{ id, label, icon }`. This feature only reorders its five entries; every entry keeps
its `id`, `label` and `icon`.

## UI states

The drawer renders five buttons in `ITEMS` order in every state. The active item is still
the one whose `id` equals the current `section`; the empty/loading/error states of the
tabs are unaffected because no section ids move.

## Acceptance criteria

- AC-1: `AppMenu.jsx` lists the five sections in exactly the order `plan`, `reminders`,
  `vision`, `tasks`, `settings`.
- AC-2: The labels in that order are `Plan & Balance`, `To-Do's Chart`, `Vision Board`,
  `Records`, `Settings`, each appearing exactly once.
- AC-3: Every section id is unchanged from before this feature (`plan`, `tasks`,
  `reminders`, `vision`, `settings`), so `section === it.id` still marks the active entry
  and every `onSelect(id)` still routes as before.
- AC-4: `App.jsx` still labels `tasks` as `Records` and `reminders` as `To-Do's Chart`;
  no section label changes anywhere.
- AC-5: No stored shape, localForage key, settings default or export version changes.
- AC-6: `npm test --silent` passes, including a test asserting the order above.

## Out of scope

- Renaming any label or section id.
- Reordering sub-tabs inside Records or To-Do's Chart.
- Any change to icons, styling or drawer behaviour.
- Any device-only work: this is a web-only presentational change.

## Open questions

None.
