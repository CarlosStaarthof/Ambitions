# Implementation — feature 15 `week-note-longpress`

**Branch:** hermes/mwwlki8i   **Spec:** `specs/features/015-week-note-longpress.md`
**Owner goal:** "user pressed X amount of second on the calendar view = get a Note
section" — reported that selecting a task disables the long-press note gesture.

## Root cause

`WeekTab.handleCellPointerDown` began with `if (brush != null || noteDlg) return;`.
A brush is never cleared by the app: selecting a task, then switching category, leaves
`brush` set, so every later long-press returned before starting the timer. Leaving the
Week tab to Balance unmounts the component, which resets `brush` — exactly why coming
back made the gesture work again.

## Fix (files touched)

1. `src/components/WeekTab.jsx`
   - Removed the `brush != null` guard from `handleCellPointerDown`; only `noteDlg`
     suppresses the gesture. The timer starts for mouse, touch and pen.
   - Added `suppressTapRef`: the timer sets it before `openNoteAt`, and the `onClick`
     painting path consumes it without painting. The next tap paints normally.
   - Added `pointerIsTouchRef`: touch/pen do not paint through the mouse-compatibility
     `onMouseDown` path, so the hold can finish before a cell changes. Touch still
     paints on the existing `onClick` tap path.
   - Removed the `brush` change effect that cancelled a pending hold.
2. `src/components/SettingsTab.jsx`
   - Help text now says a long-press opens the note even with a brush selected and a
     short tap still paints (was: "runs only when no brush is selected").
3. `tests/unit/notes.test.js`
   - Replaced the assertion of the old guard with one that requires no brush guard and
     only the note-dialog early return (owner ruling, spec 015).
4. `tests/unit/weekNoteLongPress.test.js` (new, 9 tests) — source contracts for AC-1…AC-9.
5. `specs/features/012-block-notes.md` — owner ruling of 2026-11-25 appended; conflicting
   UI-states sentence, AC-9 and Open question 3 amended to the new rule.
6. `specs/features/015-week-note-longpress.md` (new) and `feature_list.json` (feature 15).

No stored shape, localForage key, export envelope or setting changed. Feature 12's hold
time (`clampLongPressMs`) is used unchanged.

## Acceptance criteria

| AC | Where proven |
|---|---|
| 1 no brush guard, timer still starts | `weekNoteLongPress.test.js` tests 1–2; `WeekTab.jsx` `handleCellPointerDown` |
| 2 suppression set before open | test 3 |
| 3 release tap swallowed, next paints | test 4 |
| 4 short tap still paints/erases | test 5 |
| 5 touch/pen never paint through mousedown | test 6 |
| 6 hold time clamped as before | test 2; `seed.test.js` clamp tests |
| 7 scroll rules unchanged | test 7 |
| 8 settings copy updated | test 8 |
| 9 no data/storage change | test 9 |
| 10 device: hold with a task selected | **not run here** — needs the phone |

## Verification

```
npm test --silent  → 11 files, 262 tests passed
bash init.sh       → [OK] build green, tests green, scope clean
                     -> in progress: 15 week-note-longpress
```

## What still needs a device

AC-10 is the feel test: select a task, long-press a filled block (note opens, block
unchanged), then short-tap another cell (it paints). Also worth confirming that a normal
vertical scroll still moves the grid and never opens a note after a >8 px move.
