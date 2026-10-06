# Conventions

What the reviewer checks style against. Match the surrounding code; when this file and
the code disagree, raise it rather than silently picking one.

## Language

- **JavaScript + JSX. Not TypeScript.** No type annotations, no `.ts`/`.tsx`.
- ES modules (`"type": "module"`).
- Terse, single-line handlers are the house style. Match the density of the file you are
  editing rather than importing a different one.

## Styling

- Tailwind utility classes. Dark theme only: `bg-black`, the zinc scale, `amber-500`
  accent, `red-*` for destructive.
- **Reuse the shared strings in `src/lib/ui.js`** — `card`, `inputCls`, `selectCls`,
  `btnPrimary`, `btnGhost`, `TIP`. Do not re-derive an equivalent inline.
- Any `flex-1` child that holds text needs `min-w-0`, or it refuses to shrink and pushes
  siblings out of the card. Siblings that must not shrink get `shrink-0`.
- The app draws edge-to-edge behind the Android system bars. Anything pinned to the top
  or bottom of the screen uses the safe-area utilities from `src/index.css`
  (`pt-safe`, `pb-safe`, `drawer-safe`).

## Components

- Icons from `lucide-react`. Charts from `recharts`, reusing `TIP`.
- Destructive actions use `useArmed()` — first tap arms for 4s, second commits. **Never
  `window.confirm`.**
- New entity ids come from `uid()` in `time.js`. Seed entities keep their fixed ids
  (`t1…`, `g2…`, `ambition`, `open`).
- Enter in a single-line field should advance, not insert a newline — use
  `advanceOnEnter` from `ui.js`. Multi-paragraph fields (reflection answers) are the
  exception and keep newline behaviour.

## Hours

Durations are stored as **decimal hours** (`0.5` = 30 minutes) because the grid is
half-hour cells. They are displayed as **h:mm** everywhere. Convert only at the UI edge
with `fmtHM` / `parseHM`; never change the stored shape. While a field is being typed,
hold the raw text in local state and parse on blur — parsing mid-keystroke fights the
user on `"1:"`.

## Comments

Explain **why**, never what. A comment that restates the line below it is noise.
Good reasons to write one: a non-obvious constraint, a migration's rationale, a platform
quirk, a deliberate trade-off.

```js
// A task carrying `weekKey` belongs to that week alone — one-offs shouldn't clutter
// the picker on every other week. Everything else is available always.
const inThisWeek = (t) => !t.weekKey || t.weekKey === weekKey;
```

## Tests

- Vitest, in `tests/unit/<module>.test.js`.
- Target `src/lib/` — pure, framework-free, fast. Components are not unit-tested here;
  say what needs device checking instead of faking coverage.
- Name the behaviour, not the function: `it("treats Sunday as the END of its week")`.
- **Every migration gets an idempotency test.** Running it twice must change nothing.
- Never delete or skip a failing test to reach green.

## Migrations

Any change to a stored shape must:

1. extend `normalizeModel()` (or add a sibling like `backfillOpenWeeks`) in `seed.js`
2. be called from `useStore` on load
3. bump the export `version` in `DataTab`
4. be idempotent, and have a test proving it
5. handle data written by **every** earlier version, not just the last one

Old data is the common case, not the edge case. A feature that only works on a fresh
install is not finished.

## Copy

- Sentence case. No exclamation marks.
- Provider-neutral when referring to AI ("your AI provider", not "Claude") — the app is
  bring-your-own-key across three vendors.
- Say what a control does, not how clever it is.
