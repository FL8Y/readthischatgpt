# Companion prompts (drafts)

The authority for writing questions is the project's **PNLE Question Maker — Canonical Master Prompt (v2.0)** in `nursing preset topics/question maker prompt`. These companions do not replace it. Each one adds a job the canonical prompt does not cover and tells the model to follow the canonical prompt for item quality. All are original wording, modelled on patterns seen in the reference apps (structure and purpose only, no copied text).

| File | Job | Pattern seen in reference apps |
|---|---|---|
| `01_machine_readable_output.md` | Make the canonical prompt emit validated JSON (schemas/question.schema.json) | Apps keep one structured item object with stem, options, rationale and metadata |
| `02_case_study_items.md` | Situation clusters with SATA, matrix, cloze and highlight items | Tangerine case studies mix these item types, scored in credits |
| `03_second_pass_reviewer.md` | Independent review before a clinician sees the item | Apps show a verified badge and let learners report an item |
| `04_rationale_variants_and_hints.md` | Simplified rationale, hint, and audio script from an approved item | Tangerine has full and simplified rationale modes plus audio; Gizmo has hint policies |
| `05_exam_set_curation.md` | Build a practice set by selecting existing approved items (no new writing) | Tangerine's "AI" curates from its existing question bank |
| `06_flashcards_from_notes.md` | Turn notes into note/card pairs that import into Anki | Tangerine's create_flashcards action; Anki cloze and basic note types |

Rules for every prompt: original practice items only; never claim items come from a real exam or are endorsed by the PRC or BON; require source status; clinical content needs human review before publishing.
