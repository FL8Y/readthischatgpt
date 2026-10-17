# Work Queue — notes

## Current next action
Finish the single-folder cleanup and verify it against the live Git tree, then run Test A with a real clear textbook page.

## Execution order
1. [ ] Confirm `Detailed_Image_Notes_Maker/` is absent from current `main` and all active links point to `notes/`.
2. [ ] Test A — clear prose page: generate notes, save to repository, re-fetch, compare every visible heading and substantive section.
3. [ ] Test B — dense table: preserve row/column relationships, units, footnotes, and exceptions.
4. [ ] Test C — diagram/flowchart: preserve labels, arrows, direction, and sequence.
5. [ ] Test D — blurry/cropped text: mark uncertainty; never guess missing content.
6. [ ] Test E — adjacent pages: verify continuity, overlap, and duplicate avoidance.
7. [ ] Test F — consolidation: reconcile chapter notes with the page tracker and disclose gaps.
8. [ ] Test G — fresh-session ingestion: verify a new session recovers state from live files.
9. [ ] Qualified nursing review of representative clinical output.
10. [ ] Fix specific failures and rerun affected tests.

## Operating rules
- Canonical project folder is `notes/`; do not recreate or edit `Detailed_Image_Notes_Maker/`.
- Deliverable = actual Markdown notes saved in `notes/generated/`. Chat summaries and percentages do not substitute for saved notes.
- Process and persist each completed unit before moving to the next when the batch is large.
- Re-fetch every changed note and verify its content before marking it saved.
- Do not mark tests passed without a real sample and documented evidence.
- After two actions without new evidence/progress, re-plan. After three materially different failed fixes, revisit the design.

## Acceptance-test record
| Test | Sample / commit | Result | Defects | Retest |
|---|---|---|---|---|
| Single-folder cleanup | Pending live-tree check | IN PROGRESS | — | — |
| A: prose coverage + repository save | Awaiting sample image | PENDING | — | — |
| B: table fidelity | Not run | PENDING | — | — |
| C: diagram fidelity | Not run | PENDING | — | — |
| D: uncertainty handling | Not run | PENDING | — | — |
| E: adjacent pages | Not run | PENDING | — | — |
| F: consolidation | Not run | PENDING | — | — |
| G: fresh-session ingestion | Not run | PENDING | — | — |
