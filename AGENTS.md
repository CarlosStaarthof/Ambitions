# AGENTS.md — the map

Read this first. It tells you **where to look**, not everything at once.

## The one rule that makes this work

> **State lives on disk, not in chat.**

Agents write their output to a file under `progress/` and return a single line naming
that file. Nothing of substance travels as chat prose — prose degrades as it is relayed,
files do not.

## Roles

| Agent | Does | Never does |
|---|---|---|
| `leader` | Decomposes work, launches subagents, reports | Writes code |
| `spec-writer` | Writes `specs/features/NNN-<name>.md` before code exists | Writes implementation |
| `explorer` | Answers ONE narrow question, read-only | Edits anything outside `progress/` |
| `implementer` | Implements ONE feature, with tests | Self-approves |
| `reviewer` | Approves or rejects against the spec | Fixes what it finds |

## The loop

```
feature in feature_list.json
        │
        ├─ no spec?  ──────────────►  spec-writer  ──►  specs/features/NNN-*.md
        │
        ├─ unknowns? ──────────────►  explorer ×2-3  ──►  progress/explore_*.md
        │
        ├─ implement ──────────────►  implementer   ──►  progress/impl_<feature>.md
        │
        └─ verify    ──────────────►  reviewer      ──►  progress/review_<feature>.md
                                            │
                              APPROVED ──────┴────── CHANGES_REQUESTED
                                 │                          │
                          status: done            back to implementer (max 2 retries)
```

## Where things are

| Need | File |
|---|---|
| What the product is and why | `specs/product-brief.md` |
| Domain rules, open questions | `specs/domain-model.md` |
| What is in flight, one at a time | `feature_list.json` |
| Layering rules, module boundaries | `docs/architecture.md` |
| Code style, naming, patterns | `docs/conventions.md` |
| Final-state checks before `done` | `CHECKPOINTS.md` |
| Live scratchpad of the current session | `progress/current.md` |
| Completed work, newest last | `progress/history.md` |
| Product philosophy and stack facts | `CLAUDE.md` |

## Verification

```powershell
./init.ps1      # Windows
./init.sh       # POSIX
```

It runs `npm run build`, `npm test`, and checks that at most one feature is
`in_progress`. **It must print `[OK]`.** No feature reaches `done` without it.

## Never touch

These are unrecoverable or irreversible if changed:

- `android/**/*.keystore`, `android/key.properties`, `.env` — secrets, gitignored
- The localForage instance name `"ambitions"` in `src/lib/storage.js` — it is the
  database key, not a label. Renaming it orphans every existing install's data.
- `appId` (`com.carlos.ambitions`) in `capacitor.config.json` — permanent once published
- The `Ambition` category's fixed id `ambition` and its `protected: true` flag

## Status vocabulary

`pending` → `spec_ready` → `in_progress` → `in_review` → `done`, or `blocked`.
Only the **leader** moves a feature to `done`, and only after a reviewer `APPROVED`.
