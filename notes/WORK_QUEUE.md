# Work Queue — notes

## Current next action
Run Test A with a real clear textbook page. The sample image is required to validate image reading and saved-note coverage.

## Execution order
1. [ ] Test A — clear prose page: generate notes, save to repository, re-fetch, compare every visible heading and substantive section.
2. [ ] Test B — dense table: preserve row/column relationships, units, footnotes, and exceptions.
3. [ ] Test C — diagram/flowchart: preserve labels, arrows, direction, and sequence.
4. [ ] Test D — blurry/cropped text: mark uncertainty; never guess missing content.
5. [ ] Test E — adjacent pages: verify continuity, overlap, and duplicate avoidance.
6. [ ] Test F — consolidation: reconcile chapter notes with the page tracker and disclose gaps.
7. [ ] Test G — fresh-session ingestion: verify a new session recovers state from live files.
8. [ ] Qualified nursing review of representative clinical output.
9. [ ] Fix specific failures and rerun affected tests.

## Operating rules
- Deliverable = actual Markdown notes saved in the designated output folder. Chat summaries and percentages do not substitute for saved notes.
- Process and persist each completed unit before moving to the next when the batch is large.
- Re-fetch every changed note and verify its content before marking it saved.
- Do not mark tests passed without a real sample and documented evidence.
- After two actions without new evidence/progress, re-plan. After three materially different failed fixes, revisit the design.

## Acceptance-test record
| Test | Sample / commit | Result | Defects | Retest |
|---|---|---|---|---|
| A: prose coverage + repository save | Awaiting sample image | PENDING | — | — |
| B: table fidelity | Not run | PENDING | — | — |
| C: diagram fidelity | Not run | PENDING | — | — |
| D: uncertainty handling | Not run | PENDING | — | — |
| E: adjacent pages | Not run | PENDING | — | — |
| F: consolidation | Not run | PENDING | — | — |
| G: fresh-session ingestion | Not run | PENDING | — | — |
