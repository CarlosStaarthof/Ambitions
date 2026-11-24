# 013 — Vision Board: open text instead of a task link, and a "this year" jump
**Feature id:** 13   **Status:** in_progress   **Depends on:** none

## Purpose

The Vision Board currently ties each picture to an Ambition task, which turns a mood
board into a second task list. The owner wants the board to be free-standing: a picture
and up to 280 characters of open text, linked to nothing. The year switcher also needs the
same "jump back to now" affordance the week grid has ("Today"), so browsing to 2025 does
not strand the user there.

## Owner's decisions

- The text field is **open and unlimited in intent** — no task, no category — but capped at
  **280 characters** (owner said "250 to 300 maximum"). Existing `caption` values are kept.
- The year switcher stays as prev/next chevrons; a **This year** button appears whenever the
  shown year is not the current calendar year, mirroring the week grid's **Today**.
- In the "What <year> looks like" card the reached count sits beside the title and the
  **Add image** button moves to the right. The image-size (KB/MB) readout is removed —
  board size is not relevant on this screen.
- `taskId` on boards already on disk is dropped by migration; no data is otherwise changed.

## Data touched

`vision` (`{ [year]: [{ id, img, caption, done, createdAt }] }`) — `taskId` removed on load;
`caption` clamped to 280 characters. No new localForage key, no export envelope change.

## Contract

- `VISION_TEXT_MAX = 280`.
- `clampVisionText(text)` → `""` for non-strings, otherwise the string truncated to 280.
- `normalizeVisionItem(item)` → copy without `taskId`, `caption` clamped; non-objects pass
  through unchanged.
- `normalizeVision(vision)` → same year keys, arrays mapped through `normalizeVisionItem`,
  non-array year values preserved; idempotent.

## UI states

- **Current year:** chevrons plus the year; no This year button.
- **Other year:** chevrons, the year, and a This year button that returns to
  `new Date().getFullYear()`.
- **Empty year:** the existing empty card, now saying a picture *or a line* can be added.
- **Card:** image, tick, armed delete, and a wrapped textarea with a `n/280` counter.
- **Loading an image / error:** unchanged.

## Acceptance criteria

- AC-1: `VisionTab.jsx` contains no `taskId`, no `Link2` and no ambition-task lookup, and
  `App.jsx` passes it only `vision` and `setVisionP`.
- AC-2: Each board card renders its text in a `textarea` carrying `maxLength={VISION_TEXT_MAX}`
  and a live counter showing the current length and `/280`.
- AC-3: `clampVisionText` truncates a 281-character string to exactly 280, leaves a
  280-character string unchanged, and returns `""` for `null`, `undefined` and numbers.
- AC-4: `normalizeVisionItem` removes `taskId` and keeps every other field deep-equal; it is
  idempotent.
- AC-5: `normalizeVision` keeps every year key, clamps each caption, drops `taskId` from
  every item, preserves a non-array year value unchanged, and changes nothing on a second run.
- AC-6: `useStore` loads `vision` through `normalizeVision`, so a stored board holding
  `taskId` is shown without any task link and no stored key is added or renamed.
- AC-7: The header card still reads `What <year> looks like`, shows `<done>/<total> reached`
  in the same row as that title, and places the Add image button on the right.
- AC-8: The header renders no image-size text — no `humanSize` and no KB/MB readout.
- AC-9: When the shown year differs from the current calendar year a button labelled
  `This year` is rendered and sets the year to `new Date().getFullYear()`; on the current
  year that button is not rendered.
- AC-10: A newly added image is stored with `caption: ""` and no `taskId`.
- AC-11: `npm test --silent` and `npm run build` are green.

## Out of scope

- The calendar-gated windows (add only 1–15 January, review in the last four days of a
  month) belong to feature 6 and are not implemented here.
- No change to image scaling, storage keys, export version, or the AI surfaces.

## Open questions

None for this slice.
