# Implementation report — feature 18 `menu-order`

**Status:** in_review (not self-approved)
**Spec:** `specs/features/018-menu-order.md`
**Round:** 1 of 5 for this owner goal

## What changed

| File | Change |
|---|---|
| `specs/features/018-menu-order.md` | New spec (the `feature_list.json` entry referenced it but the file was missing). |
| `src/components/AppMenu.jsx` | Reordered the five `ITEMS` entries to Plan & Balance, To-Do's Chart, Vision Board, Records, Settings. Ids, labels and icons untouched. |
| `tests/unit/menuOrder.test.js` | New source-read test: order, labels once each, ids unchanged, header labels still map to the same ids. |
| `feature_list.json` | Feature 18 `pending` → `in_review`; acceptance criteria filled from the spec. |

## What did not change

No data, storage key, settings default, export version, route id, component outside the
drawer, or `android/` file. The change is presentational, so `npm run build` is the
device-side verification (no `cap:sync` needed).

## Acceptance criteria → evidence

| AC | Evidence |
|---|---|
| AC-1 | `tests/unit/menuOrder.test.js` "lists the sections as plan, reminders, vision, tasks, settings" |
| AC-2 | same file, "keeps the five labels, each exactly once, in the new order" |
| AC-3 | same file, "keeps every section id so active highlighting and routing are unchanged" |
| AC-4 | same file, "leaves the header labels mapped to the same section ids" |
| AC-5 | No data files touched; `git diff` limited to the four files above |
| AC-6 | `npm test --silent` → 17 files, 356 tests passed; `bash init.sh` → `[OK]` |

## Gate

- `npm test --silent`: 17 files, 356 tests passed.
- `bash init.sh`: `[OK]` (build + tests + scope clean).

## Remaining

- Reviewer approval, then the leader moves feature 18 to `done`.
- No device check is required beyond opening the drawer in the freshly built app.
