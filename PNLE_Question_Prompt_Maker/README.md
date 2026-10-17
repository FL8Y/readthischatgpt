PNLE QUESTION PROMPT MAKER

Purpose
This standalone folder contains a reusable master prompt for an AI-powered app feature that generates difficult, original PNLE-style multiple-choice practice questions from a user-entered topic and selected reasoning skill.

Files
- MASTER_SYSTEM_PROMPT.txt — place this in the app's system/developer prompt field for the model.
- USER_PROMPT_TEMPLATE.txt — template the app can fill with the user's topic and options.
- RESEARCH_LOG.md — evidence reviewed, limitations, and decisions.
- COMPLETION_CHECKLIST.md — acceptance criteria for future revisions.

Quick use
1. Send MASTER_SYSTEM_PROMPT.txt as the system/developer instruction to the AI API.
2. Fill USER_PROMPT_TEMPLATE.txt with the selected topic, question count, and logic skill.
3. Send the filled template as the user message.
4. If the app parses the response programmatically, request valid JSON and validate the response against the app's schema before displaying it.

Evidence limitation
The public PRC sources reviewed establish the official examination framework/programs and the Enhanced TOS effective beginning with the November 2025 examination. They do not establish public availability of complete official PNLE question papers for every sitting from 2021 through 2026. Therefore, this prompt uses official blueprints and publicly accessible exam-program information as the alignment basis, and treats unofficial recalled/reviewer questions as unverified. It does not claim to have scanned or reverse-engineered every actual exam paper.

The generated questions are original study material, not official PRC questions, and are not a substitute for current clinical guidelines, faculty review, or official examination announcements.

Official references
- PRC / Professional Regulatory Board of Nursing, Resolution No. 10 (s. 2025), Enhanced Tables of Specifications for the Nurses Licensure Examination: https://www.prc.gov.ph/sites/default/files/2025-10%20%20published%20Enhanced%20TOS%20nuse.pdf
- PRC, Professional Regulation Board of Nursing page listing Resolution No. 10 (s. 2025): https://www.prc.gov.ph/Pages/PRBv4/Nursing.htm
- PRC, official May 2024 PNLE program: https://prc.gov.ph/sites/default/files/exam%20progam%20may%202024%20pnle%20%28nursing%29%20v2%20signed.pdf
- PRC, examination schedules menu (includes 2021–2026 schedules): https://www.prc.gov.ph/exam-schedules-menu

Folder scope
This folder was added at the repository root as a standalone project. It does not intentionally modify, nest within, or replace any existing repository folder.