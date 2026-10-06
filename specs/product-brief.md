# Product brief — Ambitions

## What it is

A local-first weekly time-planner and monthly reflection tool. Vite + React + Tailwind
SPA, shipped as an installable PWA and wrapped for Android with Capacitor. All data
lives on the device; the JSON export is the only backup.

## The idea everything rests on

**A week is finite: 7 days x 48 half-hour slots = 336 cells of 30 minutes each.**

You cannot create time. You can only decide what the 336 cells hold. The app makes that
trade visible rather than letting a to-do list imply infinite capacity.

## The model

Time is organised into user-defined **categories**, each holding **tasks**:

- **Ambition** — the one protected track (id `ambition`, `protected: true`). Always
  first, never deletable. Grown toward per-task weekly targets. This is the thing the
  product exists to defend.
- **Everything else** — Sleep, Work, Health, Meals, and whatever else the user adds.
  The committed realities of life. The app calls their scheduled hours "Committed".
- **Open** — a catch-all for one-off tasks created straight from the grid, scoped to the
  week they were created in, so looking back at a week shows what actually happened.

"Ambition-first" is load-bearing across the Week and Balance stat cards
(Ambition / Committed / Free) and the AI coach persona.

## Who it is for

One person planning their own week, on their own phone. Not a team tool. No accounts, no
sync, no server.

## Principles

1. **Local-first.** Nothing leaves the device. The single exception is an AI call the
   user explicitly enabled, with their own API key, to the vendor they chose.
2. **Fully usable with AI off.** AI is off by default. With it off, no AI surface
   appears anywhere — not even previously generated text.
3. **The user's data is theirs.** Export is plain JSON. No lock-in, no telemetry.
4. **Honest about time.** Hours are shown as h:mm. Free time is what is left of 336
   cells, not an aspiration.

## Non-goals

- Team or shared planning
- Cloud sync or accounts (deferred; see `docs/2 - ROADMAP-V2.md`)
- Task completion tracking, streaks, gamification
- Being a to-do list. It is a *time* tool — a thing exists here only when it costs hours.
