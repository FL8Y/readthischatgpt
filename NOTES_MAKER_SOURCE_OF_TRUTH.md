# Notes-Maker Project — Single Source of Truth

## Canonical project location
The active project is `notes/`. The duplicate `Detailed_Image_Notes_Maker/` directory has been removed from the current branch. All new generated study notes go in `notes/generated/`. The old directory's unique nursing-specific master-prompt rules were merged into the active master prompt before deletion; Git history retains prior commits.

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
- `notes/MASTER_SYSTEM_PROMPT.txt`: detailed source-faithful nursing-aware rules plus execution and quality requirements.
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
- Detailed nursing-specific source fidelity, clinical topic structures, prioritization caveats, multi-page continuity, and learning-science rules were preserved from the retired folder in the active master prompt.
- Execution-first repository loop and generated output path are explicit.
- Dedicated generated-output folder exists.
- Functional image-to-repository test has NOT been run; no confirmed generated study-note files have been validated yet.
- Dense table, diagram, unclear-text, multi-page continuity, consolidation, and fresh-session tests remain pending.
- Qualified nursing accuracy review remains pending.
- Duplicate folder removal verified: commit `6bf081603952ec6b44a187d102077fc30b1103a6`; live recursive tree returned zero entries under `Detailed_Image_Notes_Maker/`.

## Recovery rules
- Never rely on AI memory alone; re-read this repository guide and canonical files.
- A tool call or attempted edit is not proof. Re-fetch edited content.
- Never say a page was saved unless the actual file has been fetched and checked.
- Do not report percentages instead of producing notes.
- Do not claim autonomous background work continues after the current session ends.
- If a source page or tool is missing, preserve progress, document the exact blocker, and continue with other available material.
- After two actions without new evidence/progress, re-plan rather than looping.
- Keep all project work in `notes/`; do not recreate or continue the retired duplicate directory.
