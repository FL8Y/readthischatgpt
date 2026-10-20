# Original Case Study Pack

42 original nursing case studies (5 items each, 210 items) in the same format as the reference app's case studies: a short clinical situation followed by mixed item types (MCQ, SATA, cloze, matrix, highlight), each with a rationale and a simplified rationale. Organised across NP1–NP5.

**These are NOT copies of any app's content.** They were written from scratch with `method/STYLE_GUIDE.md`, then independently reviewed (`review/`).

## Honest status
- `evidence_status: needs_review` on every item. AI-written and AI-reviewed, **not clinician-verified**, no citations. Do not publish as authoritative until a licensed nurse educator reviews them (see residual doubts in `review/`).
- No images are attached. 49 items carry an `image_suggestion` (description, placement, search terms) so you can source properly licensed pictures.

## Contents
| Path | What |
|---|---|
| `Original_Case_Study_Pack.docx` | Readable report of all 42 cases with answers and rationales |
| `cases/all_cases.json`, `cases/np1–np5.json` | Machine-readable content (validates against `../Content Authoring Kit` schema) |
| `BLUEPRINT.md` | Counts, type mix, difficulty and topic coverage |
| `method/` | Style guide and review guide |
| `review/` | Reviewer logs per NP |
| `tools/`, `tests/` | Stats and docx builders; 6 tests (`python3 -m unittest discover -s tests`) |
