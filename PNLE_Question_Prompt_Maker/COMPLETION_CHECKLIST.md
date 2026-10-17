PNLE QUESTION PROMPT MAKER — COMPLETION CHECKLIST

Scope and location
- [x] Create a new standalone folder at repository root: PNLE_Question_Prompt_Maker/
- [x] Do not intentionally place files inside any pre-existing project folder.
- [x] Keep prompt, template, evidence log, and usage instructions together.

Prompt quality
- [x] User can request a topic, number of questions, and PNLE reasoning/skill type.
- [x] Four options (A–D) and one best answer by default.
- [x] Hard questions emphasize clinical judgment, prioritization, safety, and analysis.
- [x] Include integrated reasoning patterns: linked cases, causal mechanisms, event sequences, statement combinations, EXCEPT items, teach-back, misconceptions, and analogies.
- [x] Add safeguards requiring unique answers and independent validation of each statement and causal link.
- [x] Include answer key and rationales by default.
- [x] Include distractor analysis, competency, and cognitive demand.
- [x] Include Philippine context and nursing scope considerations.
- [x] Include final item-quality control and exact-count checks.
- [x] Prohibit fabricated citations and unsupported claims about actual exam questions.
- [x] Distinguish the enhanced TOS effective from November 2025 onward from earlier frameworks.
- [x] Add target sitting/year selection and account for the more specific August 2026 official NP topic groupings.
- [x] Review supplied classroom exam photos and persist generalized logic patterns in the prompt.
- [x] Avoid copying/reconstructing purported actual or recalled exam items.

Evidence
- [x] Official PRC/BON Enhanced TOS located.
- [x] Official May 2024 PNLE program located.
- [x] Official PRC exam schedule index located.
- [x] Limitation on complete public 2021–2026 papers explicitly recorded.
- [ ] Complete a sitting-by-sitting audit of all available official 2021–2026 programs/TOS documents; this pass sampled official programs across the period and identified a material 2026 label/grouping change.
- [ ] Do not state that every 2021–2026 question paper was scanned unless each full paper is obtained and reviewed.

Technical verification
- [x] Files created through GitHub API; commit SHA returned for each creation.
- [x] Re-fetch README.md, master prompt, user template, research log, and checklist from GitHub; all paths and readable contents verified.
- [ ] Run a test prompt through the target model/API; requires the target API/runtime.
- [ ] Confirm output schema against the app's parser, if structured JSON is required.
- [ ] Review clinical answer keys with authoritative current sources and qualified nursing review before production use.

Completion status
Repository artifact: CREATED, COUNCIL-REVIEWED, AND PATH/CONTENT VERIFIED.
Live API execution: NOT TESTED; target API/runtime was not provided.
Historical paper scan: PARTIAL EVIDENCE REVIEW ONLY; complete official question papers for every sitting from 2021–2026 were not established as publicly accessible in the reviewed sources.
Clinical production validation: NOT COMPLETE; generated items need current-source checks and qualified nursing review.

Completion policy
A successful repository write proves the file was committed; re-fetching verifies the path and readable content. Neither proves that a target model's generated clinical answers are correct. Mark unverified steps honestly.