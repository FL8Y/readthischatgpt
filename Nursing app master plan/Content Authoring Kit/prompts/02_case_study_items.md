# 02 — Case-study (situation) items

```
Write ONE clinical situation and {{k}} linked items for {{topic}} at {{difficulty}}, following the canonical PNLE prompt's
rules for accuracy, Philippine context, rationales and distractors. Return JSON matching question.schema.json
(type "situation" with items[]).

Situation: 3-6 sentences, realistic, with the cues a nurse needs; do not name a diagnosis the nurse must infer.
Items (use a mix, each answerable from the situation alone):
- mcq: four options, one best answer
- sata: 5-8 options, 2 or more correct, never all correct; stem ends "Select all that apply."
- matrix: 2-5 columns, 2-6 rows, one correct column per row; rows are findings/actions, columns are conditions/priorities
- cloze: one sentence with {{1}}, {{2}} blanks, 2-4 dropdown choices each, one correct
- highlight: 5-9 text segments of a chart note; mark which are relevant/abnormal and make only those selectable-and-correct
Every item needs a rationale that names the decisive cue. All items evidence_status "needs_review".
```

Scoring reference: partial credit per correct row/blank; SATA uses +1 per correct pick, -1 per wrong pick, floor 0 (see App 4 `product/practice-engine`).
