# Archive and Agent Handoff Guide

## Purpose
This folder is the centralized study-note collection and preservation archive for the captured agent-workspace baseline. It exists to reduce repeated token-heavy rereading while retaining the evidence needed to resume or audit earlier work.

## Default workflow for future agents
1. Read this guide, `README.md`, `INDEX.md`, and the relevant rows in `WORK_QUEUE.md`.
2. Open only the study note(s) or curated guide relevant to the assigned task.
3. Read `MIGRATION_MANIFEST.csv` for source provenance and `SOURCE_FILE_INVENTORY.csv` for the exact original file and archive mapping.
4. Open a specific archived record only when the task requires its detailed research trail, page-by-page coverage, reference list, uncertainty record, or prior handoff.
5. Do not recursively reread `archive/agent-records/` by default. It is a preservation archive, not the normal study interface.
6. New synthesis belongs in `curated/`; keep the organized study notes and archive records intact. Mark additions and uncertainties clearly, cite sources, and do not claim qualified nursing/legal review unless performed.

## What is preserved
- 32 organized study-note files under `notes/`. Their source study content is preserved, with the requested AI-written caution appended. Source paths and original blob SHAs are recorded.
- Four separately authored curated guides under `curated/`.
- All 145 original files from the 26 agent workspaces under `archive/agent-records/`, byte-for-byte identical to the original Git blobs. This includes 32 exact original study-note blobs plus handoffs, image coverage checklists, research logs, work queues, reference files, legal verification evidence, and the AI-assisted content audit.
- `SOURCE_FILE_INVENTORY.csv`: inventory of all 147 original file blobs, including original paths, blob SHAs, dispositions, and archive destinations.
- `MIGRATION_MANIFEST.csv`: provenance for the 32 organized study notes.
- Two root-level governance files remain outside this collection: `notes/agents-playground/README.md` and `notes/agents-playground/AGENT_MASTER_PROMPT.md`.

## Deletion gate
**Verification passed on the cleanup branch:** all 145 agent-workspace files listed in the 147-row baseline inventory have archive destinations, and every archived Git blob SHA exactly matches its source blob SHA (zero missing paths, zero mismatches). The 32 organized notes, four curated guides, manifest, inventory, and index are present. See `ARCHIVE_VERIFICATION.md`. The 26 original agent workspace directories are now being retired in a separate cleanup commit; the two root governance files stay in place. Do not delete anything inside `everything/`. Git history is additional recovery, not a substitute for this archive.

## Quality boundary
This is a content-preservation and organization workflow, not professional validation. Qualified nursing review of the four guides and qualified legal/nursing review of the Philippine legal overview remain outstanding. The cross-corpus overlap audit is incomplete; do not infer that every note is clinically validated or every possible duplicate has been resolved.
