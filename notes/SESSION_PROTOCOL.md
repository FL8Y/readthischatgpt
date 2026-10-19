# Session Protocol — Continue Without Repeating Work

## Required read order at the start of every new chat/session
0. NOTES_MAKER_SOURCE_OF_TRUTH.md at the repository root (canonical recovery guide)
1. This file: SESSION_PROTOCOL.md
2. PROJECT_STATUS.md
3. WORK_QUEUE.md
4. RESEARCH_AND_DESIGN.md
5. MASTER_SYSTEM_PROMPT.txt
6. RESEARCH_LOG.md and COMPLETION_CHECKLIST.md
7. START_HERE_NOTES.md (current root entry point; use its links to locate the active project files)
8. notes/generated/README.md (output location and naming conventions)

## Mandatory start-of-session routine
1. Inspect the current repository branch and latest commit.
2. Re-fetch the status and queue; do not trust old chat summaries if the repo says otherwise.
3. Read the latest session handoff and identify the last completed item.
4. State the exact next incomplete task and its acceptance test.
5. Reuse existing artifacts. Never recreate the project or repeat finished research without cause.
6. Work on one prioritized item at a time; independent reads may be parallelized, writes should be serialized.
7. After editing, re-fetch every changed file and verify key content/links.
8. Update PROJECT_STATUS.md, WORK_QUEUE.md, RESEARCH_LOG.md, COMPLETION_CHECKLIST.md, and SESSION_HANDOFF.md as applicable.
9. Commit a concise handoff so the next session can resume without reconstructing context.

## Generated-note execution rule
- The deliverable is actual study-note files under `notes/generated/`, not a chat-only answer, plan, or percentage report.
- For each supplied image, inspect, draft, save, re-fetch, compare against the image, record uncertainty, and continue to the next unfinished page.
- Do not mark an image or batch complete until the saved notes pass the coverage check.

## Completion state vocabulary
- DONE: direct evidence confirms the postcondition.
- IN PROGRESS: work exists but the acceptance test is incomplete.
- BLOCKED: a specific missing input/tool/authorization prevents progress.
- NOT STARTED: no meaningful attempt yet.
Never use DONE for an attempted write, planned test, or unverified output.

## Per-task loop
RECOVER state → define one observable outcome → do the smallest useful action → test its postcondition → update ledger → select next incomplete item.

## Anti-loop and scope controls
- A task is complete only if its acceptance criteria are met and the result is verified.
- Do not repeat work simply because the chat changed.
- Do not broaden the task or perform unrelated cleanup.
- If the same action has already been attempted and failed, inspect the error and change the hypothesis rather than retrying blindly.
- After two consecutive actions without new evidence or progress, stop and re-plan.
- After three materially different failed fixes, revisit the architecture instead of adding patches.
- Never claim ongoing work will continue after the current response; create a clear next-session handoff instead.

## Session closeout template
Update SESSION_HANDOFF.md with:
- Date/session:
- Objective:
- Verified completed:
- Files changed:
- Verification performed (specific paths/content):
- Remaining work, in priority order:
- First exact action for next session:
- Blockers/uncertainties:
- Explicitly not tested:
