# Session Handoff — notes

## Objective
Keep one canonical notes-maker project and make recovery reliable if AI chat memory is lost.

## Verified completed
- Compared the old and active folders.
- Merged the old master prompt's detailed nursing-specific source-fidelity, clinical reasoning, topic-adaptive formatting, learning, and continuity rules into `notes/MASTER_SYSTEM_PROMPT.txt`; re-fetched and verified the content.
- Confirmed `notes/` is the canonical project and `notes/generated/` is the generated-notes output folder.
- Updated `NOTES_MAKER_SOURCE_OF_TRUTH.md` with a recovery sequence for missing/conflicting chat memory.
- Deleted all 11 tracked files under `Detailed_Image_Notes_Maker/` in commit `6bf081603952ec6b44a187d102077fc30b1103a6`.
- Re-fetched the recursive Git tree after deletion; it contains zero entries under `Detailed_Image_Notes_Maker/`.
- Updated the legacy root handoff to redirect to the canonical folder and explain that Git history retains prior versions.

## Still unverified
- Functional image-to-repository output quality.
- Table/diagram fidelity, uncertainty handling, multi-page continuity, consolidation, and fresh-session recovery.
- Qualified nursing accuracy review.

## First exact action next session
Use a clear supplied textbook page for Test A: produce notes, save them in `notes/generated/`, re-fetch the saved file, compare it against the image, and record actual omissions or defects.

## Important
No sample textbook image was available in this turn, so functional image test A remains unrun. Prompt changes do not prove OCR quality.
