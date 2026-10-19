# Content Authoring Kit

Reference and working tools for creating **topics** and **questions** for the Nursing Study App, built from the three reference-app analyses (Gizmo, AnkiDroid, Tangerine Prep) and aligned with the project's canonical **PNLE Question Maker prompt (v2.0)**.

| Path | What it is |
|---|---|
| `Content_Authoring_and_Prompt_Reference.docx` | Full report: how topics and questions are represented, authored and generated in each reference app; embedded vs server-side content; gap analysis against the canonical prompt; how to use the kit |
| `schemas/` | JSON Schemas: `topic-tree` and `question` (MCQ plus optional SATA, matrix, cloze, highlight and situation clusters) |
| `tools/build_topic_tree.py` | Builds `topic-tree.json` from the repo's PNLE hierarchy (7 subjects, 636 nested topics, depth 7) |
| `tools/validate_content.py` | Validates items against the schema and the canonical prompt's rules (4 options A-D, one best answer, no all/none of the above, rationale, metadata, key skew, duplicates, publish gate) |
| `samples/` | `topic-tree.generated.json` (real hierarchy) and `questions.sample.json` (6 original sample items, marked `needs_review`) |
| `prompts/` | Six companion prompts (drafts) that sit under the canonical prompt |
| `research/` | Markdown notes from the reference-app passes (questions, prompts, pre-built content, note types) |
| `tests/` | 11 unit tests |

## Pipeline
1. Pick a topic id from `topic-tree.json`.
2. Author items with the canonical prompt plus `prompts/01` (JSON output).
3. `python tools/validate_content.py items.json --topic-tree samples/topic-tree.generated.json`
4. Run `prompts/03` as a second-pass review; then a clinician or instructor reviews and sets `evidence_status`.
5. `--publish` refuses anything still `needs_review`.

Run the tests: `python -m unittest tests.test_kit` (needs `pip install jsonschema`).

Sample items are original and **unverified**: they exist to test the pipeline, not to teach. The subject-to-NP mapping is provisional and must be checked against the official TOS.
