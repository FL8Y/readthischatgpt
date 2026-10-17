# Session Handoff — notes

## Objective
Keep one canonical notes-maker project and make recovery reliable if AI chat memory is lost.

## Verified completed
- Confirmed `notes/` is the active project and the root legacy handoff redirects users there.
- Compared both folders. The old master prompt contained detailed nursing-specific source-fidelity, clinical reasoning, topic-adaptive formatting, and continuity rules not present in the shorter active prompt.
- Merged those detailed rules into `notes/MASTER_SYSTEM_PROMPT.txt`, retaining the execution-first loop and canonical output path `notes/generated/`.
- Re-fetched the active master prompt; verified both the detailed nursing rules and repository-output instructions are present.
- Updated the root source-of-truth recovery guide to describe the canonical project and recovery sequence.

## Pending verification
- Removal of the duplicate folder from the current branch (must verify after commit).
- Functional image-to-repository test.
- Table/diagram fidelity, uncertainty handling, multi-page continuity, consolidation, and fresh-session recovery.
- Qualified nursing accuracy review.

## First exact action next session
Check the live Git tree to confirm only `notes/` remains as the active project. Then use a clear supplied textbook page for Test A: produce notes, save them in `notes/generated/`, re-fetch the file, compare it against the image, and record actual omissions or defects.

## Important
No sample textbook image was available in this turn, so functional image test A remains unrun. Prompt changes do not prove OCR quality.
