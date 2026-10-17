# Project Status — notes

## Current state
- Canonical project location: `notes/`; legacy duplicate `Detailed_Image_Notes_Maker/` is being removed from the current branch.
- Active master prompt now includes the detailed nursing-specific rules recovered from the legacy prompt plus the verified repository-output execution loop.
- Session recovery instructions designate `NOTES_MAKER_SOURCE_OF_TRUTH.md` as canonical when chat memory is missing or conflicting.
- Functional image tests and qualified nursing review remain unverified.

## Session ledger
| Work item | Status |
|---|---|
| Merge legacy prompt's detailed nursing rules into active prompt | DONE — re-fetched active prompt; nursing logic and output loop present |
| Establish single source of truth for memory recovery | DONE — root recovery guide updated |
| Remove duplicate directory | IN PROGRESS until deletion commit and live tree are verified |
| Test A: clear prose coverage + repository save | BLOCKED — needs a sample image |
| Tests B–G | NOT STARTED |
| Qualified nursing accuracy review | NOT STARTED |

## Resume rule
When memory is lost or chat summaries conflict, read the root source-of-truth guide and current live files. Resume the first unfinished task. Do not infer functional success from prompt edits.

## Next action
Complete duplicate-directory removal, verify the live tree, then run Test A on a clear textbook page and record actual coverage defects.
