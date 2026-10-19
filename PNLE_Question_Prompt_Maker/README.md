PNLE QUESTION PROMPT MAKER

Purpose
This standalone folder contains a reusable master prompt for an AI-powered app feature that generates difficult, original PNLE-style multiple-choice practice questions from a user-entered topic and selected reasoning skill.

Files
- MASTER_SYSTEM_PROMPT.txt — place this in the app's system/developer prompt field for the model.
- USER_PROMPT_TEMPLATE.txt — template the app can fill with the user's topic and options.
- RESEARCH_LOG.md — evidence reviewed, limitations, and decisions.
- COMPLETION_CHECKLIST.md — acceptance criteria for future revisions.

Question logic incorporated
The generator uses broad assessment patterns visible in the supplied classroom-exam examples—not exact copied questions. These include linked case clusters; mechanism-to-manifestation reasoning; causal sequences; Statement I/II and numbered-statement evaluation; carefully controlled EXCEPT items; priority/action-sequence questions; teach-back; misconception correction; and occasional patient-friendly analogies. Each item must be original, clinically accurate, and have one defensible best answer. Format variety is subordinate to quality.

Quick use
1. Send MASTER_SYSTEM_PROMPT.txt as the system/developer instruction to the AI API.
2. Fill USER_PROMPT_TEMPLATE.txt with the selected topic, question count, and logic skill.
3. Send the filled template as the user message.
4. If the app parses the response programmatically, request valid JSON and validate the response against the app's schema before displaying it.

Evidence limitation
The public PRC sources reviewed establish year-specific examination programs and the Enhanced TOS effective beginning with the November 2025 examination. The August 2026 official program uses more specific Nursing Practice topic groupings than older programs, so users should select the target sitting/year and the prompt should follow that sitting's exact official labels. These sources do not establish public availability of complete official PNLE question papers for every sitting from 2021 through 2026. The prompt therefore uses official TOS/program documents as the alignment basis and treats unofficial recalled/reviewer questions as unverified. It does not claim to have scanned or reverse-engineered every actual exam paper.

The generated questions are original study material, not official PRC questions, and are not a substitute for current clinical guidelines, faculty review, or official examination announcements.

Official references
- PRC / Professional Regulatory Board of Nursing, Resolution No. 10 (s. 2025), Enhanced Tables of Specifications for the Nurses Licensure Examination: https://www.prc.gov.ph/sites/default/files/2025-10%20%20published%20Enhanced%20TOS%20nuse.pdf
- PRC, Professional Regulation Board of Nursing page listing Resolution No. 10 (s. 2025): https://www.prc.gov.ph/Pages/PRBv4/Nursing.htm
- PRC, official May 2023 PNLE program: https://www.prc.gov.ph/sites/default/files/040423%20exam%20progam%20may%202023%20pnle%20%28nursing%29.pdf
- PRC, official May 2024 PNLE program: https://prc.gov.ph/sites/default/files/exam%20progam%20may%202024%20pnle%20%28nursing%29%20v2%20signed.pdf
- PRC, official May 2025 NLE program: https://www.prc.gov.ph/sites/default/files/14%20-%20MAY2025%20NURSES_Tacloban.pdf
- PRC, official August 2026 NLE program: https://www.prc.gov.ph/sites/default/files/exam%20progam%20aug%202026%20nle%20%28nursing%29%20signed.pdf
- PRC, official May 2022 PNLE program: https://www.prc.gov.ph/sites/default/files/032122%20exam%20progam%20MAY%202022%20PNLE%20%28nursing%29.pdf
- PRC, official November 2021 PNLE program: https://www.prc.gov.ph/sites/default/files/PNLE%20Progam%20November%202021%20LOGO%20corrected_0.pdf
- PRC, examination schedules menu (includes 2021–2026 schedules): https://www.prc.gov.ph/exam-schedules-menu

Folder scope
This folder was added at the repository root as a standalone project. It does not intentionally modify, nest within, or replace any existing repository folder.