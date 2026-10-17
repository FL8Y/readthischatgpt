# Work Queue — notes

## Current next action
Run Test B with a real textbook page containing a dense table; preserve row/column relationships, units, footnotes, and exceptions.

## Execution order
1. [x] Test A — prose page: generate notes, save to repository, re-fetch, compare visible headings and substantive sections.
2. [ ] Test B — dense table: preserve row/column relationships, units, footnotes, and exceptions.
3. [ ] Test C — diagram/flowchart: preserve labels, arrows, direction, and sequence.
4. [x] Test D — blurry/cropped text: mark uncertainty; never guess missing content.
5. [ ] Test E — adjacent pages: verify continuity, overlap, and duplicate avoidance.
6. [ ] Test F — consolidation: reconcile chapter notes with the page tracker and disclose gaps.
7. [x] Test G — fresh-session ingestion: current session recovered canonical instructions and task state from live repository files.
8. [ ] Qualified nursing review of representative clinical output.
9. [ ] Fix specific failures and rerun affected tests.

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
| Single-folder cleanup | `6bf081603952ec6b44a187d102077fc30b1103a6`; live tree checked | PASS | Zero legacy directory entries | Not needed |
| A: prose coverage + repository save | Printed p. 101, [saved note](https://github.com/FL8Y/readthischatgpt/blob/main/notes/generated/fundamentals/pain-management-page-101.md); commit `d4cfaf02c196f5af3f914c264ff37dcdbc1aa04a` | PASS | One unclear drug name recorded explicitly; all visible prose/Q&A sections mapped to notes | Re-fetch passed |
| B: table fidelity | No dedicated dense-table sample audited yet | PENDING | — | — |
| C: diagram fidelity | No dedicated diagram sample audited yet | PENDING | — | — |
| D: uncertainty handling | Printed p. 101, “Pentoxidone” line; same saved note as Test A | PASS | Drug identity cannot be confidently read; explicitly marked unclear and not guessed | Re-fetch passed |
| E: adjacent pages | Not run | PENDING | — | — |
| F: consolidation | Not run | PENDING | — | — |
| G: fresh-session ingestion | Current session; source-of-truth, start guide, session protocol, project status, work queue, generated README, and active prompt re-read from live `main` | PASS | Live state recovered; generated note re-fetched | Passed |

