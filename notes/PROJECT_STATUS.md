# Project Status — notes

## Current state
- Canonical project location: `notes/`.
- Duplicate `Detailed_Image_Notes_Maker/` directory was removed from current `main` in commit `6bf081603952ec6b44a187d102077fc30b1103a6`; live recursive tree check found zero entries under the old path.
- Unique detailed nursing-specific rules were merged into the active master prompt and re-fetched.
- Root source-of-truth guide documents recovery when chat memory is missing or conflicting.
- Functional tests are now partially evidenced by actual image-to-repository output; dense-table, diagram, continuity, consolidation, and qualified nursing review remain unverified; fresh-session ingestion has now passed.

## Session ledger
| Work item | Status |
|---|---|
| Merge legacy prompt's detailed nursing rules into active prompt | DONE — re-fetched active prompt; nursing logic and output loop present |
| Establish single source of truth for memory recovery | DONE — root recovery guide updated |
| Remove duplicate directory | DONE — commit created and live tree confirms zero legacy entries |
| Test A: clear prose coverage + repository save | PASS — page 101 notes saved to canonical `notes/generated/fundamentals/`, re-fetched, and mapped against visible source sections |
| Test D: uncertainty handling | PASS — unclear “Pentoxidone” source text explicitly flagged; medication identity not guessed |
| Test B: dense table fidelity | NOT STARTED — needs a dense table image and row/column comparison |
| Test C: diagram/flowchart fidelity | NOT STARTED — needs a diagram image and arrow/sequence comparison |
| Test E: adjacent-page continuity | NOT STARTED |
| Test F: consolidation | NOT STARTED |
| Test G: fresh-session ingestion | PASS — current session recovered instructions and pending work from live canonical files, then re-fetched the generated note |
| Qualified nursing accuracy review | NOT STARTED — no qualified reviewer has audited representative clinical notes |

## Resume rule
When memory is lost or chat summaries conflict, read the root source-of-truth guide and current live files. Resume the first unfinished task. Do not infer functional success from prompt edits.

## Next action
Run Test B using an available dense-table textbook image, save notes to `notes/generated/`, re-fetch them, and compare each row/column, units, footnotes, and exceptions to the source. The current session has no additional source image for this test, so it remains pending until one is available.
