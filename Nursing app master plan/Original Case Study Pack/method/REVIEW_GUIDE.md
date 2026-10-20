# Reviewer rules (independent second pass; you did NOT write these cases)

Read STYLE_GUIDE.md in this folder first (same hard rules). You review and EDIT one file in place (np<N>.json), keeping ids, the 5-items-per-case structure and the JSON schema.

DO, in this order
1. CLINICAL ACCURACY AND DEFENSIBILITY (most important). For every item ask: would a competent nurse educator agree the keyed answer is the single best answer from the stem alone? Is every fact stable, textbook-level and correct? Is any distractor ALSO defensible? Does the rationale state anything wrong, overclaim, or depend on a number/dose/programme detail that varies by guideline? Fix by rewriting the option/stem/rationale into a principle-based, unambiguous form; if an item cannot be made safe and unambiguous, replace it with a new original item of the same type and topic. Never leave a doubtful claim in. SATA: every keyed answer must be clearly correct and every non-keyed option clearly wrong or clearly not indicated. Matrix/cloze/highlight: same standard.
2. OPTION-LENGTH BIAS. In the writer's draft the correct MCQ option is usually the longest (a test-taking clue). Rebalance so that across the file's MCQs the correct option is the longest in no more than about one third of items: lengthen/make more specific the distractors (keeping them plausible but wrong) or tighten the correct option, keeping options parallel in grammar and similar in length (ratio under 1.6x). Also keep correct letters spread across A-D; reorder options (and update the answer letter) if needed.
3. ABSOLUTE WORDS ("always/never/only/all/none") in options that act as giveaways: rewrite.
4. Specific known issues are listed in your task message: fix them.
5. Make sure case progression is logical, stems are unique across the whole file, and every why_not is filled for distractors.
6. VALIDATE with the validator command from STYLE_GUIDE.md until 0 ERRORS (warnings about needs_review and why_not are acceptable). Also re-check that "correct option is the longest" warning no longer appears (or is under one third).
7. Keep evidence_status "needs_review" and do not add sources.
8. Write a short log of what you changed to review_log_np<N>.md in the same folder: counts of items edited/replaced, and a list of the main accuracy fixes (item id + one line).
