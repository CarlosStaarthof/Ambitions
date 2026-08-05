# Working with me efficiently on Tiempo

A short brief on the Claude Code skills/features worth using for this project, and —
more importantly — **how to hand me your change list so I move fast and get it right.**

## Skills worth knowing (type `/` to see them)

| Skill / feature | Use it for | When |
| --- | --- | --- |
| **Plan mode** | I draft an implementation plan you approve *before* I write code | Big/architectural work (P1 settings + BYO-key, P2 accounts) |
| **/code-review** | Reviews the current diff for bugs + simplifications | After each change-set, before committing |
| **/security-review** | Focused security pass | Before every release; any change touching keys, the proxy, auth, or storage |
| **/verify** and **/run** | Actually launches the app and confirms a change *works*, not just compiles | After UI/behavior changes |
| **/simplify** | Quality cleanup of changed code | When a change works but got messy |
| **/claude-api** | Authoritative, current Claude model ids + API params | When wiring the proxy / confirming model ids |
| **/schedule**, **/loop** | Recurring automation (e.g. nightly "does `main` still build?") | Once CI/release cadence matters |
| **/init** | Refreshes `CLAUDE.md` from the codebase | After the structure reorg or big features |
| **Memory + CLAUDE.md** | Persistent project context so I don't relearn each session | Always on — keep them current |

`/code-review ultra` is a deeper multi-agent cloud review you can trigger on a branch/PR before a release. Note: I won't spawn background sub-agents unless you explicitly ask.

## How to give me the change list (this is the big efficiency lever)

Your instinct — **identify, categorize, then hand me a clean list** — is exactly right. To make each item directly actionable, give me:

1. **Location** — which page/tab (Week, Tasks, Balance, Guiding, Data), and the element.
2. **Category** — your idea is good; I'd use: `Visual` (looks), `UX` (behavior/flow), `System` (app logic/state), `Backend` (proxy/AI/data/accounts). Add more as needed.
3. **Current → Desired** — what it does now vs. what you want. A screenshot with a note beats paragraphs.
4. **Priority** — must-fix vs. nice-to-have. Lets me batch and sequence.
5. **Done when…** — one line I can test against.

### A template you can copy per item
```
[Page] Balance — Category: Visual — Priority: High
Current: the three stat cards wrap awkwardly on a narrow phone.
Desired: keep them on one row, shrink text instead of wrapping.
Done when: on a 360px-wide screen the cards stay in one row.
```

Format doesn't matter — a markdown doc, a numbered list, or annotated screenshots all work. **One doc for the whole batch** is ideal so I can plan the order (e.g. do all `System` changes before `Visual` polish that depends on them).

## How I'll run each batch
1. Read the list, group by category/dependency, and (for anything architectural) show you a quick plan first.
2. Work on a branch, committing in logical chunks.
3. `/code-review` (and `/security-review` when relevant) before I call it done.
4. Rebuild/verify, then summarize what changed and what to test on your phone.

## Small setups that pay off
- I can create a **custom `/release` skill** for this repo (bump version, tag, build the APK, sync native) so shipping is one command.
- `fewer-permission-prompts` / `update-config` can trim the approval clicks for routine commands as we get into a rhythm.
