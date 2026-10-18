# Review Queue

## Completed and verified on this branch
- [x] Restrict all PR changes to `notes/agents-playground/`; no originals were moved, renamed, deleted, or overwritten.
- [x] Capture the baseline recursive tree at `71d3bd60e92e2597c3ae992708c2ab0cf61b39f4`.
- [x] Inventory all 147 file blobs at that baseline with `SOURCE_FILE_INVENTORY.csv`.
- [x] Copy and verify 32 study-note files, with a 32-row `MIGRATION_MANIFEST.csv`.
- [x] Source and destination bodies were checked before adding the requested caution; source study content is preserved, with a transparent AI-written/not-nurse-reviewed caution appended to each of the 32 collected notes.
- [x] Create four separately authored curated guides, each with source links and an explicit source-to-derivative record.
- [x] Content-review supporting artefacts across handoffs, image-coverage checklists, research logs, references, work queues, a legal verification matrix, and an AI-assisted perioperative content audit. Each has a reasoned classification in the source inventory.
- [x] Update the index and overlap review with the four confirmed curated groups.
- [x] Validate 78 relative Markdown links across key collection documents and all four curated guides; none broken.
- [x] Audit all 32 copied notes for path-relative links; none found.
- [x] Replace blanket `not-yet-audited` manifest labels with explicit topic/page relationship classifications for all 32 notes. Classifications distinguish complementary groups, known overlap candidates, related-domain-only topics, and the four curated groups; no candidate is labelled a confirmed exact duplicate without direct evidence.
- [x] Add a whole-corpus relationship matrix documenting 32-note cluster assignments and likely partial overlaps, plus boundaries and cautions.
- [x] Add a conflict-review register naming high-risk cross-check targets (medication name uncertainty, clinical ranges/doses, infectious-disease precautions, pediatric milestones, and legal-title/current-status claims) and the evidence needed to resolve them.

## Priority 1 — outstanding professional acceptance gates
- [x] Re-audit printed p. 18 by re-fetching the original checklist, work queue, and study note. Case management plus all five nursing-process phases and their activity lists are present in the note, and the original queue records p. 18 as DONE. The checklist's inventory row is stale but its item-level p. 18 checks are all ticked. The original agent workspace remains untouched.
- [ ] Obtain qualified nursing review of the four curated guides. Do not describe AI-assisted synthesis as qualified peer review.
- [ ] Obtain qualified legal/nursing review of the professional foundations/legal overview before relying on legal status statements.

## Final release gate
- [ ] Re-fetch tree, manifest, index, inventory, guides and PR file list after any later change; ensure every changed path remains under `notes/agents-playground/`.
- [ ] Re-check CI/status after final commit. A lack of reported status checks is not a green result.
- [ ] Keep the issue open until professional review is obtained or a human explicitly accepts the deferral.
