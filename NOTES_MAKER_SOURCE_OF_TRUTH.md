# Notes-Maker Project — Single Source of Truth

## Canonical project location
The active project is `notes/`. Do not continue development in `Detailed_Image_Notes_Maker/`; it is being retired as a duplicate. All new generated study notes go in `notes/generated/`.

## Start here after a new chat, memory loss, or handoff
1. Read this file.
2. Read `START_HERE_NOTES.md`.
3. Read `notes/SESSION_PROTOCOL.md`, `notes/PROJECT_STATUS.md`, `notes/WORK_QUEUE.md`, and `notes/SESSION_HANDOFF.md`.
4. Read `notes/MASTER_SYSTEM_PROMPT.txt` and `notes/generated/README.md`.
5. Re-fetch the current `main` branch state. Repository files outrank recollections or summaries from old chats.
6. Resume the first unfinished concrete task. Do not repeat verified work unless new evidence, a defect, or the user requires it.

## What the project does
Turn user-supplied textbook images into detailed, source-faithful notes, then save the actual output as Markdown in `notes/generated/`. A chat answer alone is not the deliverable.

## Required processing loop
Inspect each available image → extract meaningful content → organize useful notes → save to `notes/generated/` → re-fetch saved file → compare coverage with source → correct defects → update page tracker/handoff → continue to next unfinished page.

Preserve headings, concepts, examples, data, table relationships, diagram arrows, sequence, and uncertainty. Never guess unreadable content. Distinguish source notes from added explanation. For nursing content, preserve safety details exactly and avoid unsupported clinical advice.

## Canonical files
- `START_HERE_NOTES.md`: session entry guide.
- `notes/MASTER_SYSTEM_PROMPT.txt`: execution and quality requirements.
- `notes/SESSION_PROTOCOL.md`: session recovery and anti-loop rules.
- `notes/PROJECT_STATUS.md`: verified current state.
- `notes/WORK_QUEUE.md`: next unfinished tests.
- `notes/SESSION_HANDOFF.md`: last verified work and exact next action.
- `notes/RESEARCH_AND_DESIGN.md`: design evidence and limits.
- `notes/RESEARCH_LOG.md`: design change log.
- `notes/COMPLETION_CHECKLIST.md`: acceptance criteria.
- `notes/PAGE_TRACKER_TEMPLATE.md`: page and uncertainty ledger template.
- `notes/USER_PROMPT_TEMPLATE.txt`: user task starter.
- `notes/generated/`: real generated study notes, organized by subject/chapter/topic.

## Verified state at consolidation
- Execution-first master prompt saved and re-fetched.
- Dedicated generated-output folder created with README.
- Session protocol and repository README explicitly require actual verified Markdown notes in `notes/generated/`.
- Work queue prioritizes Test A: clear prose page, including save and coverage comparison.
- Functional image-to-repository test has NOT been run; there are no confirmed generated study-note files yet.
- Dense table, diagram, unclear-text, multi-page continuity, consolidation, and fresh-session tests remain pending.
- Qualified nursing accuracy review remains pending.

## Recovery rules
- Never rely on AI memory alone; re-read this repository guide and canonical files.
- A tool call or attempted edit is not proof. Re-fetch edited content.
- Never say a page was saved unless the actual file has been fetched and checked.
- Do not report percentages instead of producing notes.
- Do not claim autonomous background work continues after the current session ends.
- If a source page or tool is missing, preserve progress, document the exact blocker, and continue with other available material.
- After two actions without new evidence/progress, re-plan rather than looping.
- Keep the legacy folder only as a short-lived migration source; once unique material is captured and active links point to `notes/`, it can be removed.
