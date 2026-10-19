# Master Links Index — Nursing Study App research

Everything researched so far, where it lives and how to find it. All links are on the `main` branch of https://github.com/FL8Y/readthischatgpt unless a repo is named.

Base: https://github.com/FL8Y/readthischatgpt/tree/main

---

## 1. Start here (planning and rules)

| What | Link |
|---|---|
| Nursing app master plan (folder) | https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan |
| Master plan README (index and rules) | https://github.com/FL8Y/readthischatgpt/blob/main/Nursing%20app%20master%20plan/README.md |
| Blueprint (authoritative planning control center) | https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan/App%20Master%20Plan%20Blue%20Print |
| Project manager brief (copy-paste prompt, all key links) | https://github.com/FL8Y/readthischatgpt/blob/main/Nursing%20app%20master%20plan/PROJECT_MANAGER_BRIEF.md |
| This index | https://github.com/FL8Y/readthischatgpt/blob/main/Nursing%20app%20master%20plan/MASTER_LINKS_INDEX.md |

Blueprint documents (inside the Blueprint folder): Master Architect Plan, Product Requirements and UX (R-001 to R-034), Technical Architecture and Contracts, Implementation Roadmap, Agent Work Packages, QA Council Review, Requirement-Test Traceability, Decision Log, Repo Audit, Cleanup Log, Claude Master Prompt.
Current phase per the blueprint: research consolidation and architecture planning; implementation is not yet authorized.

---

## 2. Reference-app research (reports and notes)

| Ref | App | Report (docx) | Folder |
|---|---|---|---|
| App 1 | Raw APK-derived files (same reference line as App 3 per the blueprint; not analysed by me) | none | https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan/App%201%20inspired%20research |
| App 2 | AnkiDroid 2.25.1 (spaced repetition, Anki formats, integration) | https://github.com/FL8Y/readthischatgpt/blob/main/Nursing%20app%20master%20plan/app%202%20inspired%20research/AnkiDroid_App2_Research.docx | https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan/app%202%20inspired%20research |
| App 3 | Gizmo 3.2.130 (AI flashcards and quizzes, quiz engine) | https://github.com/FL8Y/readthischatgpt/blob/main/Nursing%20app%20master%20plan/App%203%20a%20app%20inspired%20research/Gizmo_App_Research.docx | https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan/App%203%20a%20app%20inspired%20research |
| App 4 | Tangerine Prep 1.9.0, first report (PNLE exam prep) | https://github.com/FL8Y/readthischatgpt/blob/main/Nursing%20app%20master%20plan/App%204%20tangerine%20prep%20inspired%20research/Tangerine_Prep_Research.docx | https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan/App%204%20tangerine%20prep%20inspired%20research |
| App 4+ | Tangerine Prep complete guide (every feature, UI, functions; 92 pp) | https://github.com/FL8Y/readthischatgpt/blob/main/Nursing%20app%20master%20plan/Tangerine%20Prep%20Complete%20Guide/Tangerine_Prep_Complete_Guide.docx | https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan/Tangerine%20Prep%20Complete%20Guide |

Per-area notes for Tangerine Prep (screens, buttons, API calls, logic): https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan/Tangerine%20Prep%20Complete%20Guide/research
(A practice and stats; B onboarding, diagnostic, learning path, cheat sheets, case studies, flashcards; C Ask Cleo and library; D pre-built content, pricing, analytics; E navigation, buttons, social, battles; F UI and design system; G client functions and algorithms.)

---

## 3. Questionnaires, topics, lessons and pre-built materials

| What | Where | Status |
|---|---|---|
| PNLE topic hierarchy (7 subjects, 636 nested topics) | https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan/nursing%20preset%20topics/Anki%20Deck%20Topic%20Hierarchy | Folder scaffold only; no question content imported |
| Machine-readable topic tree | https://github.com/FL8Y/readthischatgpt/blob/main/Nursing%20app%20master%20plan/Content%20Authoring%20Kit/samples/topic-tree.generated.json | Generated from the hierarchy |
| PNLE Question Maker, canonical master prompt v2.0 | https://github.com/FL8Y/readthischatgpt/blob/main/Nursing%20app%20master%20plan/nursing%20preset%20topics/question%20maker%20prompt | Your authoritative question-writing prompt |
| PNLE Question Prompt Maker project (prompt, template, research log, checklist) | https://github.com/FL8Y/readthischatgpt/tree/main/PNLE_Question_Prompt_Maker (start: https://github.com/FL8Y/readthischatgpt/blob/main/START_HERE_PNLE_Question_Prompt_Maker.md) | Separate project already in the repo |
| Question and prompt authoring kit (schemas, validator, sample items, 6 companion prompts, 48-pp report) | https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan/Content%20Authoring%20Kit | 6 sample items, original and **unverified** |
| How questions, topics and prompts are structured in the reference apps | https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan/Content%20Authoring%20Kit/research | Tangerine, Gizmo and AnkiDroid notes |
| Notes maker (textbook images to study notes), generated study notes | https://github.com/FL8Y/readthischatgpt/tree/main/notes (start: https://github.com/FL8Y/readthischatgpt/blob/main/START_HERE_NOTES.md; output: https://github.com/FL8Y/readthischatgpt/tree/main/notes/generated) | Separate project; only 2 generated files so far |

**What does not exist yet (be clear with your project manager):**
- No question bank, questionnaire or lesson content was extracted from any reference app. In Tangerine Prep, questions, cheat sheets, case studies, flashcards and lessons are fetched from its servers, and only about 6 demo questions and 2 sample case studies ship inside the app (not copied here, because the blueprint says to reuse ideas, not content).
- The only sample questions in the repo are the six in the Content Authoring Kit. They have not been reviewed by a clinician.
- Lessons: the notes maker is the only lesson-like pipeline in the repo, and it has produced very little so far.

---

## 4. Working code (tested reference modules)

| Module | Link | Tests |
|---|---|---|
| Practice engine (scoring, adaptive selection, streaks, energy) | https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan/App%204%20tangerine%20prep%20inspired%20research/product/practice-engine | 10/10 |
| Client kit (API failover, offline outbox, timers, labels, rank, flashcards) | https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan/Tangerine%20Prep%20Complete%20Guide/product/client-kit | 16/16 |
| FSRS scheduler | https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan/app%202%20inspired%20research/product/srs-scheduler | 10/10 |
| Anki deck builder (.apkg) | https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan/app%202%20inspired%20research/product/apkg-builder | 4/4 |
| AnkiDroid bridge (Kotlin) | https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan/app%202%20inspired%20research/product/ankidroid-bridge | compiles; not run on a device |
| AI next-quiz generator | https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan/App%203%20a%20app%20inspired%20research/product/ai-next-quiz | type-checks; not run against a live AI |
| Content validator and topic-tree builder | https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan/Content%20Authoring%20Kit/tools | 11/11 |

---

## 5. Tools and outside references

| What | Link |
|---|---|
| REA (reverse-engineering tool and skill used for the analysis) | https://github.com/morluto/rea |
| REA skill copy in this repo | https://github.com/FL8Y/readthischatgpt/tree/main/.claude/skills/rea |
| AnkiDroid (open source, GPL-3.0) | https://github.com/ankidroid/Anki-Android |
| Official PNLE sources named in your canonical prompt | https://www.prc.gov.ph/Pages/PRBv4/Nursing.htm and https://www.prc.gov.ph/2026-schedule-examination |

---

## 6. Other research (not part of the nursing app)

These are in other repos of the same owner and were done earlier, for a different project (FLY8 / EysClone Android apps, and a Pokémon data study). They are on the working branch `ccr-10cd0087-enq2oi`, **not on `main`**, in https://github.com/FL8Y/fly8claude2:

- Docs (reports, patch queue): https://github.com/FL8Y/fly8claude2/tree/ccr-10cd0087-enq2oi/docs
- Research index: https://github.com/FL8Y/fly8claude2/blob/ccr-10cd0087-enq2oi/RESEARCH_INDEX.md
- Pokémon Lazarus study: https://github.com/FL8Y/fly8claude2/tree/ccr-10cd0087-enq2oi/research/lazarus

---

## 7. Suggested reading order for a newcomer

1. PROJECT_MANAGER_BRIEF.md (this folder)
2. Blueprint README, then Master Architect Plan and Product Requirements
3. Tangerine Prep Complete Guide (closest competitor), then Gizmo and AnkiDroid reports
4. Content Authoring Kit and the canonical PNLE Question Maker prompt
5. The code modules in section 4
