# Work Queue — notes

## Current next action
Run image-based acceptance tests in priority order. Do not keep rewriting the prompt unless a test reveals a specific failure.

## Priority order
1. [ ] Test A — clear prose page: compare every visible heading and substantive section against the notes.
2. [ ] Test B — dense table: check row/column relationships, units, footnotes, and exceptions.
3. [ ] Test C — diagram/flowchart: check labels, arrows, direction, and sequence.
4. [ ] Test D — blurry/cropped text: ensure uncertainty is marked and missing text is not guessed.
5. [ ] Test E — adjacent pages: check continuation, overlap, and duplicate avoidance.
6. [ ] Test F — consolidation: reconcile chapter notes with the page tracker and disclose gaps.
7. [ ] Test G — fresh-session ingestion: verify a new chat rebuilds state from live files and resumes correctly.
8. [ ] Qualified nursing review of representative clinical output.
9. [ ] Fix specific failures and rerun the relevant tests.

## Anti-loop rules
- Don't repeat a DONE item without a specific reason.
- An attempted write is not a verified change.
- After two actions with no new evidence or progress, re-plan.
- After three materially different failed fixes, revisit the design.
- Don't mark a test passed without a sample and a documented result.

## Acceptance-test record
| Test | Sample / commit | Result | Defects | Retest |
|---|---|---|---|---|
| A: prose coverage | Not run | PENDING | — | — |
| B: table fidelity | Not run | PENDING | — | — |
| C: diagram fidelity | Not run | PENDING | — | — |
| D: uncertainty handling | Not run | PENDING | — | — |
| E: adjacent pages | Not run | PENDING | — | — |
| F: consolidation | Not run | PENDING | — | — |
| G: fresh-session ingestion | Not run | PENDING | — | — |
