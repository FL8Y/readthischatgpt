PNLE QUESTION PROMPT MAKER — RESEARCH LOG

Status: Initial implementation committed; verification pending.
Scope: Build a standalone, reusable prompt-maker folder at the repository root for generating hard, original PNLE-style multiple-choice practice questions from a topic and skill selection.
Repository: FL8Y/readthischatgpt
Folder: PNLE_Question_Prompt_Maker/

Research and decisions
1. Official PRC/BON Enhanced TOS
   - Source: https://www.prc.gov.ph/sites/default/files/2025-10%20%20published%20Enhanced%20TOS%20nuse.pdf
   - Finding: PRC BON Resolution No. 10 (s. 2025) adopts the Enhanced Tables of Specifications for the Nurses Licensure Examination and states it applies beginning with the November 2025 examination and subsequent schedules, superseding earlier resolutions.
   - Decision: Use the enhanced TOS as the primary alignment reference for post-November-2025 practice. Do not retroactively describe it as the governing blueprint for 2021–2024 exams.

2. Official PRC nursing board page
   - Source: https://www.prc.gov.ph/Pages/PRBv4/Nursing.htm
   - Finding: PRC lists Resolution No. 10 (s. 2025) and its annex among nursing board resources.
   - Decision: Prefer official PRC/BON material over unofficial exam-review claims.

3. Official May 2024 PNLE program
   - Source: https://prc.gov.ph/sites/default/files/exam%20progam%20may%202024%20pnle%20%28nursing%29%20v2%20signed.pdf
   - Finding: The program describes five parts: NP I Community Health Nursing; NP II care of healthy/at-risk mother and child; NP III, IV, and V care of clients with physiologic and psychosocial alterations, parts A, B, and C.
   - Decision: Use this as evidence for the 2024 exam program only; do not assume identical program details for every year without checking each source.

4. Official PRC exam schedules
   - Source: https://www.prc.gov.ph/exam-schedules-menu
   - Finding: PRC provides examination schedule pages across 2021–2026.
   - Decision: Schedules confirm sittings and administrative details, not the actual wording or difficulty distribution of question booklets.

5. Availability of complete actual question papers
   - Finding: The reviewed official PRC pages surfaced schedules, examination programs, and TOS materials, but did not establish public availability of complete official PNLE question booklets for every sitting from 2021 through 2026.
   - Classification: NOT VERIFIED that full official papers are publicly accessible for the entire requested period.
   - Decision: Do not claim to have scanned every paper. Do not rely on unofficial recalled questions as authenticated exam content. Build original questions from official blueprint information and sound item-writing principles.

Implementation decisions
- Four answer options (A–D), one best answer by default.
- SATA only when explicitly selected.
- Hardness is based on clinical reasoning and meaningful competing priorities, not trick wording.
- Include correct answer, rationale, distractor explanations, competency, and cognitive demand by default.
- Prefer Philippine clinical and legal context where relevant.
- Require a quality-control gate for answer uniqueness, safety, scope, calculations, distractors, answer distribution, and count.
- Avoid copying or reconstructing actual/recalled/leaked exam questions.
- Make the prompt portable across AI APIs; API-specific JSON schemas can be added by the app when needed.

Files created
- MASTER_SYSTEM_PROMPT.txt
- USER_PROMPT_TEMPLATE.txt
- README.md
- COMPLETION_CHECKLIST.md

Progress log
- [x] Establish folder scope and create standalone root folder through new files.
- [x] Research official PRC/BON TOS and publicly accessible exam-program evidence.
- [x] Draft reusable system prompt.
- [x] Draft fill-in user prompt template.
- [x] Document source limitations and research decisions.
- [ ] Independently re-fetch all created files from GitHub and verify exact contents/paths.
- [ ] Validate a sample generated question set against the prompt (requires an available model/API execution environment).
- [ ] Add app-specific structured output schema only if the app's parser requirements are known.

Next validation rule
Do not mark this project fully verified until GitHub paths and contents are re-fetched successfully. Do not claim live model-output testing because no target AI API or app runtime was supplied in this task.