# notes — Detailed Image-to-Notes Maker

This folder is the home of the sequential book-image note-making project. It is separate from the PNLE Question Prompt Maker.

## New-chat/session start
Read SESSION_PROTOCOL.md, PROJECT_STATUS.md, WORK_QUEUE.md, RESEARCH_AND_DESIGN.md, then MASTER_SYSTEM_PROMPT.txt. Resume the first incomplete task; don't repeat verified work.

## Core files
- MASTER_SYSTEM_PROMPT.txt — nursing-aware image-to-notes prompt.
- RESEARCH_AND_DESIGN.md — evidence review and design rationale.
- PROJECT_STATUS.md — verified current state.
- WORK_QUEUE.md — prioritized unfinished tasks.
- SESSION_PROTOCOL.md — cross-session anti-loop instructions.
- SESSION_HANDOFF.md — next-session handoff.
- USER_PROMPT_TEMPLATE.txt — reusable request.
- PAGE_TRACKER_TEMPLATE.md — page and uncertainty tracker.
- RESEARCH_LOG.md — design decisions and changes.
- COMPLETION_CHECKLIST.md — acceptance tests.

## Generated output
Actual study notes belong in [`generated/`](https://github.com/FL8Y/readthischatgpt/tree/main/notes/generated/). The master prompt requires each unit to be saved as Markdown, re-fetched, checked against the supplied image, and tracked. Chat summaries and progress percentages are not substitutes for generated notes.

## Workflow
Upload pages sequentially, process each new page once, track unclear areas, and request clearer crops where needed. At the end, consolidate against the page tracker. Re-fetch repository edits to verify them.

## Limits
Prompt improvements are not proof of accurate OCR or clinical correctness. Image-based tests and qualified nursing review remain pending. These are educational notes, not patient-specific clinical guidance.
