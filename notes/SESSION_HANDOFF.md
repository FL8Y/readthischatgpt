# Session Handoff — notes

## Objective
Make the image-to-notes workflow execute toward saved, verified repository notes instead of repeatedly reporting progress.

## Verified completed
- Updated `notes/MASTER_SYSTEM_PROMPT.txt` to require repository ingestion, an inspect → extract → organize → save → re-read → verify → track → continue loop, source fidelity, adaptive note structure, and explicit blocker handling.
- Re-fetched the master prompt and verified the new execution-first and repository-output instructions.
- Fixed the session protocol's entry-point reference to `START_HERE_NOTES.md`.

## Still unverified
- Actual image-to-notes output quality.
- Successful creation and verification of a generated Markdown note from a supplied image.
- Table/diagram fidelity, uncertainty handling, adjacent-page continuity, consolidation, and fresh-session recovery.
- Qualified nursing accuracy review.

## First exact action next session
Use a clear supplied textbook page for Test A. Produce notes, save them in the designated repository output folder using existing naming conventions, re-fetch the saved file, compare it with the image, and record actual omissions or defects.

## Blocker
No sample textbook image is available in this current turn, so functional image test A cannot be truthfully completed yet.
