# 023 — Records sub-tabs named after the main sections

**Feature id:** 23   **Status:** approved   **Depends on:** 14, 18

## Purpose

Records is the editing screen, but its flat sub-tabs (`Tasks`, `Questions`, `Reminders`)
give no clue which part of the app each one edits: `Tasks` and `Questions` feed Plan &
Balance, while reminder management backs To-Do's Chart. Grouping the Records sub-tabs
under the same names as the main sections makes Records read as the management face of
those sections instead of a third, unrelated list.

## Owner's decisions

- Records gets two top-level sub-tabs, named after the main sections they serve:
  **Plan & Balance** and **To-Do's**. Tradeoff accepted: opening a Task now costs one
  extra tap (Records → Plan & Balance → Tasks).
- The current `Tasks` and `Questions` sub-tabs fall **under Plan & Balance**, unchanged in
  name, order and behaviour. Tradeoff accepted: two levels of tabs on one screen.
- The current `Reminders` sub-tab is renamed **To-Do's** and keeps its `Manage` and
  `Archive` views plus every reminder/category control. Tradeoff accepted: the label
  differs from the main menu's `To-Do's Chart` so the two are not confused.
- **Vision Board** is named as a future example only and is not added in this feature.
  Tradeoff accepted: Records will gain a third sub-tab when that management surface
  exists.

## User stories

- As the owner, I open Records → Plan & Balance and find Tasks and Questions together, so
  I know those two edit my plan.
- As the owner, I open Records → To-Do's and find the reminder and category controls that
  back the To-Do's Chart.

## Data touched

None. This is a presentational regrouping of local component state. No localForage key,
stored shape, settings default or export envelope changes.

## Contract

`src/App.jsx`:

- New local state `recordsSub` (default `"plan"`) selects the top-level Records tab.
- Records renders `SubTabs` with exactly
  `[["plan", "Plan & Balance"], ["todos", "To-Do's"]]`.
- When `recordsSub === "plan"` it renders a nested `SubTabs` with
  `[["tasks", "Tasks"], ["guiding", "Questions"]]` and the existing `TasksTab` /
  `GuidingTab` under it.
- When `recordsSub === "todos"` it renders the existing nested
  `[["wall", "Manage"], ["archive", "Archive"]]` tabs and `ReminderWallTab`.
- `SubTabs` gains an optional `nested` flag that only dims and indents the bar so the two
  levels are distinguishable; the default rendering is unchanged.

Every section id, menu label, component prop and stored key stays as it is.

## UI states

- The two top-level sub-tabs render in every state; the active one is highlighted by id.
- Plan & Balance shows Tasks or Questions; To-Do's shows Manage or Archive. Empty,
  loading, error and AI-off states are whatever those existing components already render
  — this feature changes no view.

## Acceptance criteria

- AC-1: `App.jsx` renders the Records top-level tabs in exactly the order
  `[["plan", "Plan & Balance"], ["todos", "To-Do's"]]`, and no Records top-level tab is
  labelled `Reminders`, `Tasks` or `Questions`.
- AC-2: Under the `plan` tab, `Tasks` and `Questions` render in exactly that order from
  `[["tasks", "Tasks"], ["guiding", "Questions"]]`, and they still mount `TasksTab` and
  `GuidingTab` with the same props as before.
- AC-3: Under the `todos` tab, `Manage` and `Archive` still mount `ReminderWallTab` with
  the same props, so category create/rename/delete, reminder create/edit and permanent
  delete (open and archived) remain reachable.
- AC-4: `AppMenu.jsx` and the `App.jsx` `SECTION_LABEL` map are unchanged: `tasks` still
  reads `Records` and `reminders` still reads `To-Do's Chart` in the main menu.
- AC-5: No stored shape, localForage key, settings default or export version changes; the
  only files touched are `src/App.jsx`, the test files and docs.
- AC-6: `npm test --silent` passes, including a source-read test asserting the tab arrays
  and mounts above.

## Out of scope

- Adding a Vision Board sub-tab or any new management surface inside Records.
- Renaming the main menu entries, section ids, `To-Do's Chart` or any section header.
- Reordering or changing the `Manage` / `Archive` views or any reminder control.
- Any device-only work: this is a web-only presentational change.

## Open questions

- None for this phase. The Vision Board sub-tab is deliberately deferred until it has a
  management surface to hold.
