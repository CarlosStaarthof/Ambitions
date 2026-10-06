# Current session

**Date:** 2026-09-29
**In flight:** nothing — feature 7 closed
**Unblocked:** feature 8 `week-approval` (its dependencies 3 and 7 are both done)

## Just completed

Feature 7 `week-integrity-fix` — APPROVED, marked `done`.
See `progress/review_week-integrity-fix.md`. 127 tests, init green.

## Waiting on the user (device)

Nothing from features 3 or 7 has reached the phone. Both need
`npm run cap:sync` + an Android rebuild + reinstall.

- Feature 3: 8 device-only criteria (permission dialog, delivery, channel, post-reboot).
- Feature 7: 14 device-only criteria, plus AC-16's four UI surfaces, AC-17's arming
  behaviour and AC-35's rendered failure screen.
- **AC-35 needs a temporary debug build in which `loadKey` throws for one key** — it
  cannot be triggered from a normal build.
- **Open diagnostic:** once feature 7 is installed, previously-orphaned cells render as
  visible "unknown" blocks and contribute an `Unknown` bar in Balance. That is now the
  answer to "were the user's lost cells deleted or orphaned?" — no arithmetic needed.

## Known, deliberately deferred

- `src/components/VisionTab.jsx:23` builds its ambition-link dropdown from the raw
  `tasks` array, so a retired ambition task is still offered there. Feature 6 deletes
  that control outright.
- `WeekTab`'s "clear this week" replaces the whole week object (`{ cells: {} }`),
  which would destroy sibling fields — feature 8 must fix this before adding `approved`.
- `DataTab` import still replaces `weeks` wholesale.
- Release note item: a user who deletes every guiding question now keeps an empty list
  rather than silently getting the seed seven back.
