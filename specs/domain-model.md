# Domain model

Authoritative rules. A spec-writer that cannot answer a question from this file must
stop and escalate rather than invent a rule.

## Entities

### Category
`{ id, name, protected }`

- `protected: true` marks the **Ambition** track. Exactly one exists, id is the literal
  `ambition`, it is always first, and it cannot be deleted.
- `open` is the one-off bucket. Always last. Unprotected, so its hours count as
  Committed.
- Every other category is user-created with a `uid()` id.

### Task
`{ id, name, categoryId, color, target, weekKey?, retired?, retiredAt? }`

- `target` is a **weekly** target in decimal hours, or `null` for none.
- `weekKey` present = the task is scoped to that week alone (one-offs). Absent = always
  available.
- Deleting a task **retires** it — it is marked `retired` and disappears from every list,
  picker and count, but stays resolvable so weeks that already hold it keep rendering it
  with its real name and colour. **Deletion never writes the `weeks` key.** Restoring a retired
  task clears both flags and returns it to its category, pickers and counts.
  (Decided 2026-09-29 after confirmed data loss; see `specs/features/007-week-integrity-fix.md`.)

### Week
`{ [isoMondayDate]: { cells: { "<dayIdx>-<slot>": taskId } } }`

- Week key is the ISO date of that week's **Monday**.
- `dayIdx` 0-6 = Mon-Sun. `slot` 0-47 = 00:00-23:30.
- A cell holds exactly one taskId, or is absent. There is no overlap and no partial cell.

### Question / Reflection
`questions: [{ id, text }]`, `reflections: { [yyyy-mm]: { [questionId]: text, _ai? } }`

- Answered **monthly**. The month is the reflection period; the week is the planning
  period.
- `_ai` is reserved — generated text, not a user answer. Code iterating answers skips it.

### Vision
`vision: { [year]: [{ id, img, caption, done, createdAt }] }`

- Grouped by **year** — the horizon above the week and the month.
- `img` is a downscaled JPEG data URI (max edge 1200px).
- `caption` is the image's description. It is used for other purposes later, so it is
  captured at commitment time and then frozen (see the window rules below).
- There is **no link to an Ambition task**. Any `taskId` on existing data is dropped by
  migration.
- Every image is tickable. There is no "perpetual / never-ending" flag — an ongoing
  reminder is simply one the user chooses never to tick.

## Rules

1. A week always has exactly 336 cells available. Free = (336 - filled) x 0.5 hours.
2. Ambition hours = tasks whose category is `protected`. Committed = all other scheduled
   tasks. These two plus Free describe the whole week.
   A scheduled cell whose task cannot be resolved counts as **Committed** — it cannot be
   shown to be Ambition — so Ambition + Committed + Free always equals 168:00.
3. Durations are stored as decimal hours and displayed as h:mm.
4. A task's target is per week, never per day or month.
5. One-off tasks appear only in their own week's picker, and the Open category chip is
   hidden entirely on weeks that have none.
6. AI is off by default. With `enabled: false` or `provider: "none"`, no AI surface
   renders anywhere.
7. API keys belong to the user, live in hardware-backed secure storage, and never appear
   in localForage or the JSON export.

## Vision Board windows (decided 2026-09-16)

The board is a commitment device, not a scrapbook. Interaction is gated by the calendar;
**viewing is never gated.**

| Period | Add | Edit caption | Tick / untick | Delete |
|---|---|---|---|---|
| 1–15 January | yes | yes | no | no |
| Last 4 calendar days of any month | no | no | yes | yes |
| Any other day | no | no | no | no |

1. **Add window** — 1 to 15 January inclusive, local time, for that year's board only.
2. **First-run exception** — for 30 days from first app open the add window is open
   regardless of date, for the current year's board. This is the only exception. The
   anchor is a stored first-open timestamp; it moves to the account when accounts exist.
3. **Review window** — the last 4 calendar days of every month (February: 25–28, or
   26–29 in a leap year). Ticking, unticking and deleting are allowed only here.
4. **Windows apply to the current year's board only.** Past years are permanently
   read-only even during a window. A future year cannot be edited at all.
5. **Missing the January window means no board for that year.** Deliberate. There is no
   grace period and no late start.
6. Outside every window the board is fully read-only — no add, no caption edit, no tick,
   no delete.
7. Every gate decision is a **pure function of a supplied date**, so it is unit-testable
   without waiting for a real calendar window.

## Still open

Escalate to the user; do not guess.

- **Accounts.** Deferred to a later phase. Until then there is no user identity, so
  nothing may assume one.
- **Cross-device sync.** Out of scope while local-first holds.
- **Exact-alarm notifications.** Whether block-start reminders justify
  `USE_EXACT_ALARM` and its Play Store declaration is undecided.
- **Where the first-open timestamp lives** once accounts exist. Until then it is on the
  device; an account would move the 30-day anchor to registration time.
- **Vision images in the export.** Currently included, which makes exports several MB.
  Whether to keep, shrink further, or exclude is undecided.
- **iOS.** No `ios/` platform exists yet. Nothing may assume one.
