# Implementation — feature 13 `vision-board-text`

Round 1 of the owner's vision-board goal, 2026-11-24. Spec:
`specs/features/013-vision-board-text.md`.

## What changed

- **Task link removed.** `src/components/VisionTab.jsx` no longer reads `tasks` /
  `categories`, no longer renders the ambition `<select>`, the `Link2` icon or the linked
  task colour line. `src/App.jsx` now passes only `vision` and `setVisionP`.
- **Open text instead.** Each card's caption is a wrapped `textarea` with
  `maxLength={VISION_TEXT_MAX}` (280) and a live `n/280` counter. New text is clamped on
  change. The header copy and empty state describe a free line, not a task.
- **`This year` jump.** The year header keeps the prev/next chevrons, tracks
  `new Date().getFullYear()`, and renders a `This year` button (same idea as the Week tab's
  `Today`) only when the shown year is not the current one.
- **Header tidied.** "What <year> looks like" stays, `<done>/<total> reached` sits beside
  it, and the Add image button moved to the right of the card. The KB/MB image-size readout
  and `humanSize`/`dataUrlBytes` usage are gone. Footer copy keeps the privacy/export line
  without a size figure.
- **Migration.** New `src/lib/vision.js`: `VISION_TEXT_MAX`, `clampVisionText`,
  `normalizeVisionItem`, `normalizeVision`. `useStore` loads `vision` through
  `normalizeVision`, so any stored `taskId` is dropped and any over-long caption clamped in
  memory — no key added, no load-time write.
- **Feature bookkeeping.** Added feature 13 to `feature_list.json` as `in_progress`; moved
  feature 12 `block-notes` to `in_review` (complete for review, gate allows one
  `in_progress`).

## Verification

- `npm test --silent` → 9 files, 233 tests passed (new `tests/unit/vision.test.js`, 14 tests).
- `bash init.sh` → `[OK] build green, tests green, scope clean`.

## Not covered here

- Calendar-gated add/review windows are feature 6, untouched.
- Device-only visual check: 390 px layout of the two-column cards with the longer textarea
  and the header button placement.
