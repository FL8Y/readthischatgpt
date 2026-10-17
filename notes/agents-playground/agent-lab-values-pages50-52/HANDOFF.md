# Handoff — agent-lab-values-pages50-52

## Objective
Produce source-faithful, evidence-backed nursing study notes from the supplied photographs of printed pages 50–52.

## Scope
- p. 50: Liver Function Tests.
- p. 51: Electrolytes.
- p. 52: Other Values (ICP, CPP, CVP, IOP, ESR) and TLC diet nutrient content.

## Standards inspected
Live repository files read include the root source-of-truth, start guide, session protocol, project status and queue, master prompt, research/design/log, completion checklist, page-tracker template, generated README, playground README, agent master prompt, session handoff, and neighboring pages 44–46 research/deliverable.

## Deliverables intended
- `DELIVERABLES/nursing-liver-tests-electrolytes-other-values-tlc-pp50-52.md`
- `IMAGE_COVERAGE_CHECKLIST.md`
- `RESEARCH_LOG.md`
- `WORK_QUEUE.md`
- `HANDOFF.md`

## Source uncertainties preserved
- Potassium's second range on p. 51 is unreadable/inconsistent; explicitly marked `[unclear in image]`.
- CVP units on p. 52 are mixed in the source and are flagged.
- Older/awkward source interpretations for ammonia, PT, and CPP are retained as source content and qualified in separate explanations.

## Verification gate
Do not mark the batch DONE until all files are re-fetched from GitHub and checked. The study note must contain every table row and the checklist must match the three source images. First exact action after writes: re-fetch the study note and confirm headings/rows for ALT, AST, albumin, ALP, ammonia, bilirubin, GGT, PT; six electrolytes; ICP, CPP, CVP, IOP, ESR; and all TLC nutrient rows.
