# Inventory Work Queue

## Baseline and completed curation
- [x] Confirm scope is restricted to `notes/agents-playground/`.
- [x] Read live repository source-of-truth, playground README/master prompt, and canonical generated-notes README; kept this collection separate from `notes/generated/`.
- [x] Capture the baseline recursive tree at `71d3bd60e92e2597c3ae992708c2ab0cf61b39f4`: 202 tree entries, 147 file blobs, 26 agent workspaces.
- [x] Copy 32 study-note deliverables into subject-oriented folders and retain all source workspaces.
- [x] Re-fetch all 32 source notes and destination copies; source study content was preserved, then the requested AI-written study-note caution was appended to each collected note. The migration manifest records this intentional derivative change.
- [x] Create four separate curated guides with source links, change descriptions, limits and explicit uncertainty.
- [x] Create a 147-row source inventory and a 32-row migration manifest; content-review supporting files and retain non-study artefacts with reasons.
- [x] Copy all 113 non-note records into `archive/agent-records/` by reusing their exact original Git blob SHAs; update inventory destinations and byte-identity status.
- [x] Archive the exact original Git blobs for all 32 study notes too, preserving their original pre-caution versions byte-for-byte.
- [x] Link the copies and curated guides in the subject index.
- [x] Validate 78 relative links across index, README, work queue, review queue, overlap review, and four curated guides; zero broken.
- [x] Check all 32 copies for relative Markdown links that would break at their new paths; zero found.

## Open items — do not silently mark complete
- [x] Re-audit printed page 18 by re-fetching the original image-coverage checklist, work queue, and study note. All five nursing-process phases and the case-management row are present in the saved note; the earlier queue shows the page sections were inventoried. The mismatch was a stale checklist status, not missing note content. The original agent workspace is intentionally unchanged; the collection inventory records the provenance check.
- [ ] Have a qualified nursing reviewer assess the four curated guides for clinical accuracy and intended educational use; current AI-assisted curation is not professional nursing peer review.
- [ ] Have qualified legal/nursing review evaluate the Philippine legal overview before treating all legal-title/status claims as final.
- [ ] Finish the remaining cross-corpus note-relationship audit. The current four curated groups are documented; other notes are left unclassified rather than presumed duplicates.
- [x] Verify all 145 archive entries exist at their inventory destinations and have the same blob SHAs as the original source records; zero missing paths and zero blob mismatches.
- [ ] Verify the 32 organized study notes and four guides, update all internal instructions so future agents start from `everything/`, and confirm no unique content remains outside the collection except the two root governance/instruction files.
- [ ] Remove the 26 redundant agent workspace directories in a separate cleanup commit; preserve `README.md` and `AGENT_MASTER_PROMPT.md` at the playground root.
- [ ] Re-run path/link/inventory audits after cleanup.

## Scope and preservation guard
- Never cut, delete, rename, or rewrite original agent deliverables.
- Do not edit another agent's workspace without coordinator authorization; the collection changes stay within `everything/`.
- Do not copy handoffs, references-only material, queues, or checklists into `everything/notes/` as study-note content.
- Exact source copies remain separate from all curated derivatives.
- Do not claim clinical/legal sign-off unless a qualified professional actually performs it.
