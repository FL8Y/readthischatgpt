# Detailed Image-to-Notes Maker

## Purpose
A reusable prompt framework for converting sequential images of book pages into detailed, structured study notes while preserving the source's meaning and making uncertainty visible.

## Files
1. `MASTER_SYSTEM_PROMPT.txt` — full operating rules and output structure.
2. `README.md` — project overview and usage.
3. `RESEARCH_LOG.md` — design decisions, limitations, and validation status.
4. `COMPLETION_CHECKLIST.md` — artifact and functional acceptance criteria.
5. `USER_PROMPT_TEMPLATE.txt` — reusable request template.
6. `PAGE_TRACKER_TEMPLATE.md` — page coverage and follow-up tracker.

## How to use
1. Upload the first page image.
2. Provide the optional subject/chapter and any output preferences.
3. Request detailed notes using the master prompt and user template.
4. Upload following pages in sequence. Each response should cover the new page and connect to prior supplied pages when relevant.
5. Keep a page tracker in the working document or conversation. Mark blurry/cropped regions and request targeted re-uploads.
6. When finished, request a consolidated chapter pack with glossary, comparison tables, process summaries, recap, and review questions.

## Operating principles
- The supplied images are the primary evidence.
- Cover all meaningful visible content, not only the main paragraph.
- Preserve the relationships in tables, diagrams, formulas, and sequences.
- Never guess unreadable or unseen content.
- Keep source-derived notes distinct from added explanations.
- Transform the content into notes rather than reproducing long passages verbatim.
- Be explicit about pages and validation that have not been processed or tested.

## Limitations
Output quality depends on image resolution, focus, glare, cropping, page curvature, handwriting, and layout complexity. The prompt cannot guarantee perfect visual extraction or subject-matter correctness. Review high-stakes or technical notes against the source. This framework has not been production-validated merely by creating these files.

## Copyright-aware use
Use the framework to study and transform user-provided excerpts into notes, explanations, and original review questions. Avoid reproducing substantial portions of a copyrighted book verbatim or reconstructing a substitute for the book.