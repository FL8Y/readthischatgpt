# Review Queue

## Completed and verified on this branch
- [x] Restrict all PR changes to `notes/agents-playground/`; no originals were moved, renamed, deleted, or overwritten.
- [x] Capture the baseline recursive tree at `71d3bd60e92e2597c3ae992708c2ab0cf61b39f4`.
- [x] Inventory all 147 file blobs at that baseline with `SOURCE_FILE_INVENTORY.csv`.
- [x] Copy and verify 32 study-note files, with a 32-row `MIGRATION_MANIFEST.csv`.
- [x] Re-fetch source and destination for all 32 copies; exact body matches confirmed after removing only the collection provenance comment.
- [x] Create four separately authored curated guides, each with source links and an explicit source-to-derivative record.
- [x] Content-review supporting artefacts across handoffs, image-coverage checklists, research logs, references, work queues, a legal verification matrix, and an AI-assisted perioperative content audit. Each has a reasoned classification in the source inventory.
- [x] Update the index and overlap review with the four confirmed groups.
- [x] Validate 78 relative Markdown links across key collection documents and all four curated guides; none broken.
- [x] Audit all 32 copied notes for path-relative links; none found.

## Priority 1 — explicitly unresolved
- [ ] Printed p. 18 coverage/re-fetch audit in `agent-nursing-documentation-process-p17-19/`. Its existing checklist states that coverage is drafted but the re-fetch audit is pending. Keep this as an external follow-up; do not edit the source agent workspace without coordinator authorization.
- [ ] Obtain qualified nursing review of the four curated guides. Do not describe AI-assisted synthesis as qualified peer review.
- [ ] Obtain qualified legal/nursing review of the professional foundations/legal overview before relying on legal status statements.
- [ ] Finish relationship classification for note groups outside the four documented curated groups; do not infer duplication from naming/page similarity.

## Final release gate
- [ ] Before marking the broader organization issue complete, close the above follow-ups or record a specifically accepted block/deferral.
- [ ] Re-fetch tree, manifest, index, inventory, guides and PR file list after any later change; ensure every changed path remains under `notes/agents-playground/`.
