# Project Status — notes

## Current state
- Canonical project location: `notes/`.
- Duplicate `Detailed_Image_Notes_Maker/` directory was removed from current `main` in commit `6bf081603952ec6b44a187d102077fc30b1103a6`; live recursive tree check found zero entries under the old path.
- Unique detailed nursing-specific rules were merged into the active master prompt and re-fetched.
- Root source-of-truth guide documents recovery when chat memory is missing or conflicting.
- Functional image tests and qualified nursing review remain unverified.

## Session ledger
| Work item | Status |
|---|---|
| Merge legacy prompt's detailed nursing rules into active prompt | DONE — re-fetched active prompt; nursing logic and output loop present |
| Establish single source of truth for memory recovery | DONE — root recovery guide updated |
| Remove duplicate directory | DONE — commit created and live tree confirms zero legacy entries |
| Test A: clear prose coverage + repository save | BLOCKED — needs a sample image |
| Tests B–G | NOT STARTED |
| Qualified nursing accuracy review | NOT STARTED |

## Resume rule
When memory is lost or chat summaries conflict, read the root source-of-truth guide and current live files. Resume the first unfinished task. Do not infer functional success from prompt edits.

## Next action
Run Test A on a clear textbook page, save the resulting notes to `notes/generated/`, compare every visible section against the saved file, and record defects.
