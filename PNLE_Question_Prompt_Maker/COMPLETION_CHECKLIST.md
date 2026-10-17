PNLE QUESTION PROMPT MAKER — COMPLETION CHECKLIST

Scope and location
- [x] Create a new standalone folder at repository root: PNLE_Question_Prompt_Maker/
- [x] Do not intentionally place files inside any pre-existing project folder.
- [x] Keep prompt, template, evidence log, and usage instructions together.

Prompt quality
- [x] User can request a topic, number of questions, and PNLE reasoning/skill type.
- [x] Four options (A–D) and one best answer by default.
- [x] Hard questions emphasize clinical judgment, prioritization, safety, and analysis.
- [x] Include answer key and rationales by default.
- [x] Include distractor analysis, competency, and cognitive demand.
- [x] Include Philippine context and nursing scope considerations.
- [x] Include final item-quality control and exact-count checks.
- [x] Prohibit fabricated citations and unsupported claims about actual exam questions.
- [x] Distinguish the enhanced TOS effective from November 2025 onward from earlier frameworks.
- [x] Avoid copying/reconstructing purported actual or recalled exam items.

Evidence
- [x] Official PRC/BON Enhanced TOS located.
- [x] Official May 2024 PNLE program located.
- [x] Official PRC exam schedule index located.
- [x] Limitation on complete public 2021–2026 papers explicitly recorded.
- [ ] Verify whether additional official year-specific programs or TOS documents materially change the historical comparison.
- [ ] Do not state that every 2021–2026 question paper was scanned unless each full paper is obtained and reviewed.

Technical verification
- [x] Files created through GitHub API; commit SHA returned for each creation.
- [ ] Re-fetch README.md and all prompt/log files from the repository to verify path and contents.
- [ ] Run a test prompt through the target model/API.
- [ ] Confirm output schema against the app's parser, if structured JSON is required.
- [ ] Review clinical answer keys with authoritative current sources and qualified nursing review before production use.

Completion policy
A GitHub file-creation success is evidence that a write was attempted and committed, but not by itself proof that every final file can be fetched or that the AI-generated clinical content is correct. Mark unverified steps honestly.