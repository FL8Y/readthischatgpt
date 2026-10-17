# Review Queue

## Verified in current branch
- [x] Restrict changes to `notes/agents-playground/`; no source items were moved, renamed, deleted, or overwritten.
- [x] Capture the baseline recursive tree at `71d3bd60e92e2597c3ae992708c2ab0cf61b39f4`.
- [x] Inventory all 147 file blobs under the playground in `SOURCE_FILE_INVENTORY.csv`.
- [x] Copy all 32 identified study-note deliverables into subject-oriented destinations.
- [x] Re-fetch and compare all 32 copied note bodies to live sources; all match exactly after removing the collection-only provenance comment.
- [x] Create three separate curated derivatives with source links and explicit curation limits:
  - mental-health review, printed pp. 53–58;
  - perioperative/postoperative/pain review, printed pp. 89–101;
  - communicable-disease/public-health overview, printed pp. 68–85;
  - professional nursing foundations review, images/printed pp. 1–13.
- [x] Link both derivatives in the subject index and document their source relationships in `DUPLICATES_AND_OVERLAPS.md`.

## Priority 1 — Supporting-file inventory audit
- [ ] Review entries marked `preliminary-path-classification` in `SOURCE_FILE_INVENTORY.csv`; verify their contents and correct their classification where needed.
- [ ] Any `manual-review-needed` or uncertain entry must be explicitly retained with a reason, or copied only if later confirmed to be a study-note deliverable.
- [ ] Do not copy prompts, logs, checklists, references-only files, handoffs, or templates into the study-note collection.

## Priority 2 — Cross-corpus note relationships
- [ ] Compare the other candidate note groups by actual content and page coverage.
- [ ] Classify each group as exact duplicate, near-duplicate/revision, complementary, overlap, continuation, conflict, or uncertain.
- [ ] Preserve both versions when there are source or clinical conflicts; do not silently reconcile them.

## Priority 3 — Curated derivatives and final validation
- [ ] Create additional derivatives only where expansion/fusion improves learning and source provenance can be retained.
- [ ] Re-fetch both derivatives, the index, inventory, manifest, README, and review files; validate all relative links.
- [ ] Re-fetch the branch tree and PR file list to prove all changed paths remain under `notes/agents-playground/` and no original paths were removed.
- [ ] Report remaining uncertainty honestly and keep the PR in draft until the owner reviews it.
- [ ] Qualified nursing review remains a separate external review requirement; do not claim it has occurred.
