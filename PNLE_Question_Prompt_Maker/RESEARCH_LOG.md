PNLE QUESTION PROMPT MAKER — RESEARCH LOG

Status: Initial implementation committed and GitHub path/content verification completed. Live model testing remains pending because no target API/runtime was provided.
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

5. Official program comparison through 2026
   - 2021 source: PRC, November 2021 PNLE program (official PRC-hosted PDF).
   - 2022 source: PRC, May 2022 PNLE program (official PRC-hosted PDF).
   - 2023 source: PRC, May 2023 PNLE program: https://www.prc.gov.ph/sites/default/files/040423%20exam%20progam%20may%202023%20pnle%20%28nursing%29.pdf.
   - 2024 source: PRC, May 2024 PNLE program (official PRC-hosted PDF).
   - 2025 source: PRC, May 2025 NLE program: https://www.prc.gov.ph/sites/default/files/14%20-%20MAY2025%20NURSES_Tacloban.pdf; November 2025 program also located through PRC-hosted material.
   - 2026 source: PRC, August 2026 NLE program: https://www.prc.gov.ph/sites/default/files/exam%20progam%20aug%202026%20nle%20%28nursing%29%20signed.pdf
   - Finding: Older programs (including 2022 and 2024) use NP I community health, NP II healthy/at-risk mother and child, and NP III–V physiologic/psychosocial alterations Parts A–C. The August 2026 program provides more specific topic groupings for NP I–V, including NP II Parts 1–2 and named physiologic systems for NP III–IV, with behavioral and high-acuity/emergency content in NP V.
   - Decision: The generator must use the exact official program for the target sitting; it must not hard-code older NP headings as timeless. Exam program headings are not enough to infer item-level weighting.

6. Availability of complete actual question papers
   - Finding: The official PRC pages reviewed surfaced schedules, examination programs, and TOS materials, but did not establish public availability of complete official PNLE question booklets for every sitting from 2021 through 2026.
   - Classification: NOT VERIFIED that full official papers are publicly accessible for the entire requested period.
   - Decision: Do not claim to have scanned every paper. Do not rely on unofficial recalled questions as authenticated exam content. Build original questions from official blueprint information and sound item-writing principles.

Council re-audit based on user-supplied classroom exam photos
- Observed broad patterns: linked clinical vignettes; pathophysiology-to-manifestation reasoning; causal chains and event ordering; numbered statements and Statement I/II combinations; EXCEPT/least-appropriate items; priority/first action; patient-teaching interpretation; misconception correction; and analogies for explaining mechanisms.
- Implementation: add these as reusable item-design patterns, not templates to copy verbatim. Validate each proposition, causal link, answer uniqueness, scope, and whether the stem supplies enough information.
- Safeguard: format variety is optional; never force a format if it creates ambiguity, flawed premises, or two defensible answers. The photos are classroom assessment examples, not proof of official PRC wording or a verified 2021–2026 PNLE pattern.

Implementation decisions
- Four answer options (A–D), one best answer by default.
- SATA only when explicitly selected.
- Hardness is based on clinical reasoning and meaningful competing priorities, not trick wording.
- Include correct answer, rationale, distractor explanations, competency, and cognitive demand by default.
- Prefer Philippine clinical and legal context where relevant.
- Require a quality-control gate for answer uniqueness, safety, scope, calculations, distractors, answer distribution, and count.
- Avoid copying or reconstructing actual/recalled/leaked exam questions.
- Make the prompt portable across AI APIs; API-specific JSON schemas can be added by the app when needed.

Files created and verified
- MASTER_SYSTEM_PROMPT.txt — fetched successfully; revised after council audit for 2026 target-sitting program alignment.
- USER_PROMPT_TEMPLATE.txt — fetched successfully; revised to capture target exam sitting/year.
- README.md — fetched successfully; updated evidence limitation and official references.
- RESEARCH_LOG.md — fetched successfully; this file.
- COMPLETION_CHECKLIST.md — fetched successfully; 2,246 characters.

Progress log
- [x] Establish folder scope and create standalone root folder through new files.
- [x] Research official PRC/BON TOS and publicly accessible exam-program evidence.
- [x] Council re-audit: compare older official program headings with the August 2026 program and update target-sitting alignment rules.
- [x] Council re-audit of supplied exam photos: extract broad reasoning formats and add them to the master prompt and user template.
- [x] Draft reusable system prompt.
- [x] Draft fill-in user prompt template.
- [x] Document source limitations and research decisions.
- [x] Independently re-fetch all created files from GitHub and verify paths and readable contents.
- [ ] Validate a sample generated question set against the prompt (requires an available model/API execution environment).
- [ ] Add app-specific structured output schema only if the app's parser requirements are known.
- [ ] Review generated clinical answer keys with a qualified nursing reviewer before production use.

Next validation rule
Do not claim live model-output testing because no target AI API or app runtime was supplied. Do not claim every official 2021–2026 paper was scanned: the available official source set reviewed here does not establish public access to complete official question booklets for every sitting.