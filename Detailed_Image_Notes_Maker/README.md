# Detailed Image-to-Notes Maker

## Purpose
Convert sequential images of book pages into detailed, organized, source-faithful study notes, with nursing-specific structure where appropriate. This project is separate from PNLE Question Prompt Maker.

## Start here
For any new chat/session, read [SESSION_PROTOCOL.md](SESSION_PROTOCOL.md), [PROJECT_STATUS.md](PROJECT_STATUS.md), [WORK_QUEUE.md](WORK_QUEUE.md), [RESEARCH_AND_DESIGN.md](RESEARCH_AND_DESIGN.md), then [MASTER_SYSTEM_PROMPT.txt](MASTER_SYSTEM_PROMPT.txt). Follow the anti-loop rules; resume the first incomplete task.

## Files
- `MASTER_SYSTEM_PROMPT.txt` — core prompt, nursing-specific content logic, prioritization, note formats, uncertainty, and quality gate.
- `RESEARCH_AND_DESIGN.md` — focused evidence review and how findings were translated into prompt rules.
- `SESSION_PROTOCOL.md` — repeatable cross-session startup, execution, verification, and closeout protocol.
- `PROJECT_STATUS.md` — verified current state and session ledger.
- `WORK_QUEUE.md` — prioritized work with explicit acceptance criteria.
- `SESSION_HANDOFF.md` — next-session starting point.
- `USER_PROMPT_TEMPLATE.txt` — reusable user-facing prompt.
- `PAGE_TRACKER_TEMPLATE.md` — tracks uploaded pages, key terms, and gaps.
- `RESEARCH_LOG.md` — design decisions and changes.
- `COMPLETION_CHECKLIST.md` — artifact and functional acceptance criteria.

## Workflow
1. Upload one or more page images in reading order.
2. State book/subject/chapter and output preferences if desired.
3. Process each new page once. Maintain the page ledger and mark uncertain regions.
4. Ask for a clearer crop only for the region that affects understanding.
5. When all intended pages are processed, request consolidation and compare it with the ledger.
6. Use original recall questions and spaced review as learning aids, not guarantees.

## Design principles
- Faithful extraction before summarization.
- Tables, diagrams, procedures, and formulas retain their relationships and order.
- Source claims, explanatory paraphrase, and external updates are kept distinct.
- Nursing-specific structures are selected by topic; no one template is forced on every subject.
- Priority rules are contextual, not mechanical.
- Reuse verified work across sessions; do not restart just because the conversation changed.

## Limitations
No prompt guarantees perfect OCR, complete coverage, clinical currency, or mastery. Formal image tests and qualified nursing review are still required before claiming functional or clinical validation. These are educational notes, not patient-specific clinical guidance.

## Copyright-aware use
Transform supplied excerpts into notes, explanations, and original review questions; do not reproduce substantial copyrighted text verbatim or create a substitute for the book.