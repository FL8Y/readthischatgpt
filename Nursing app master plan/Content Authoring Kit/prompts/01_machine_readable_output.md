# 01 — Machine-readable output wrapper

Use together with the canonical PNLE Question Maker prompt. Paste the canonical prompt first, then this block.

```
OUTPUT FORMAT OVERRIDE
Follow every item-quality rule in the canonical prompt. Instead of the standard item format, return ONLY a JSON array
that validates against question.schema.json. No prose before or after the array.

Per item:
- id: "<topic-slug>-<3-digit number>"
- type: "mcq"; options: exactly four {label A-D, text, why_not}; answer: one letter
- why_not: one short internal note per distractor (the canonical "internal analysis"); empty string for the answer
- rationale: per the canonical rationale standard; rationale_simplified: one or two plain sentences
- meta: nursing_practice (NP1-NP5), tos_content_area, topic, topic_id (from the supplied topic tree when given),
  competency, cognitive_domain (lowercase), difficulty (easy|moderate|difficult), nursing_process_phase
  (assessment|analysis_diagnosis|planning|implementation|evaluation|not_applicable),
  evidence_status = "needs_review" ALWAYS (a human reviewer changes it), sources[] when you rely on a guideline or law
- Do not add fields that are not in the schema.

Inputs: TOPIC_ID: {{topic_id}}  COUNT: {{n}}  PRACTICE: {{NP1..NP5}}  DIFFICULTY: {{mix}}  SOURCE_MATERIAL: {{notes}}
```

After generation run `python tools/validate_content.py out.json --topic-tree samples/topic-tree.generated.json`; fix errors, then send to clinical review.
