# Everything — Agent Study Notes Collection

This folder is a centralized, non-destructive collection of study-note files discovered under `notes/agents-playground/`.

## Preservation model

- `notes/` contains exact copies of selected source notes. The original agent workspaces remain the source of record and must not be deleted, cut, or edited by this collection workflow.
- `curated/` is reserved for newly authored derivatives that synthesize or expand source notes. Derivatives must cite/link all inputs and describe additions, reconciliations, exclusions, uncertainties, and conflicts. Never replace the exact copies with derivatives.
- `review/` records duplicate/overlap findings, content conflicts, and open review tasks. The current curated guides live under `curated/`: mental health pp. 53–58; perioperative/postoperative/pain pp. 89–101; and communicable diseases/public health pp. 68–85.
- `MIGRATION_MANIFEST.csv` maps each copied study note to its original path and blob SHA, destination, topic, page range, relationship, and copy-verification state.
- `SOURCE_FILE_INVENTORY.csv` records every file blob under `notes/agents-playground/` at the captured source commit, including copies and supporting files intentionally retained in place. Supporting-file categories are preliminary when based on filename/path; see `review/REVIEW_QUEUE.md` for the remaining content audit.

## Naming and classification

Use lowercase kebab-case names. Preserve printed page numbers in file names when known. Organize by the note's actual contents rather than the agent directory name alone. Never overwrite a colliding path: choose a unique descriptive name and record the decision in the manifest.

## Rules

1. Do not move, rename, delete, or overwrite original workspaces or source notes as part of this collection.
2. The first-pass copy layer must remain content-identical to the source.
3. Do not classify files as duplicates solely because names or page ranges overlap.
4. Do not merge away disagreements, uncertainties, warnings, exceptions, doses, units, or source wording.
5. Added explanations must be distinguishable from source-derived notes and supported with citations when they use external sources.
6. Clinical and medication-related derivatives require explicit review of all numbers, units, doses, contraindications, populations, and source/current-guidance distinctions. Never claim qualified review unless performed.
7. Any changes under this repository must stay inside `notes/agents-playground/`.

## Status

This is an initial pilot collection. Only files explicitly listed in the manifest should be treated as copied and verified. Do not infer whole-repository completion from the pilot.
