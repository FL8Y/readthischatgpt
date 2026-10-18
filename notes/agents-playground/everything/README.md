# Everything — Agent Study Notes Collection

This folder is a centralized, non-destructive collection of study-note files discovered under `notes/agents-playground/`.

## Preservation model

- `notes/` contains 32 organized study-note copies. Their study content is preserved and the requested AI-written caution is appended; each source path and original blob SHA is recorded in the manifest/inventory.
- `curated/` is reserved for newly authored derivatives that synthesize or expand source notes. Derivatives must cite/link all inputs and describe additions, reconciliations, exclusions, uncertainties, and conflicts. Never replace the exact copies with derivatives.
- `review/` records duplicate/overlap findings, content conflicts, and open review tasks. The current curated guides live under `curated/`: mental health pp. 53–58; perioperative/postoperative/pain pp. 89–101; communicable diseases/public health pp. 68–85; and professional nursing foundations, images/printed pp. 1–13.
- `MIGRATION_MANIFEST.csv` maps each copied study note to its original path and blob SHA, destination, topic, page range, relationship, and copy-verification state.
- `SOURCE_FILE_INVENTORY.csv` records all 147 original file blobs. The 32 study notes are organized under `notes/` with the requested caution; exact original blobs for all 32 are separately archived. The other 113 workspace records (handoffs, coverage checklists, research logs, references, queues and verification records) are also archived byte-for-byte under `archive/agent-records/`. All 145 files from the 26 agent workspaces have archive destinations. Two top-level governance/instruction files remain at the playground root. The printed p. 18 note was re-audited: the saved note contains the case-management entry and all five nursing-process phases/activity lists; the original queue says DONE and item-level checklist checks are complete, while one checklist summary row is stale. Root governance/instruction files are retained in place. See `review/REVIEW_QUEUE.md` for remaining qualified professional review gates.

## Naming and classification

Use lowercase kebab-case names. Preserve printed page numbers in file names when known. Organize by the note's actual contents rather than the agent directory name alone. Never overwrite a colliding path: choose a unique descriptive name and record the decision in the manifest.

## Rules

1. The archive is the preservation layer for source workspace records. Do not delete or rewrite anything under `everything/`; any source-workspace retirement must happen only after the archive audit passes.
2. The first-pass copy layer must remain content-identical to the source.
3. Do not classify files as duplicates solely because names or page ranges overlap.
4. Do not merge away disagreements, uncertainties, warnings, exceptions, doses, units, or source wording.
5. Added explanations must be distinguishable from source-derived notes and supported with citations when they use external sources.
6. Clinical and medication-related derivatives require explicit review of all numbers, units, doses, contraindications, populations, and source/current-guidance distinctions. Never claim qualified review unless performed.
7. Any changes under this repository must stay inside `notes/agents-playground/`.

## Status

This is the centralized collection and archive for the captured 147-file baseline. Use `ARCHIVE_GUIDE.md` first: future agents should read the index and task-relevant summaries, and consult archived process records only when needed rather than rereading every workspace by default. Archive verification passed for the captured baseline: all 145 original files from the 26 agent workspaces have matching byte-identical archived blobs. The original workspaces are being retired in a separate cleanup commit; the two top-level governance/instruction files remain at the playground root.
