# Project Manager Brief — Nursing Study App (copy-paste prompt)

> Paste everything below the line into your project manager (person or AI). Links point to the `main` branch of https://github.com/FL8Y/readthischatgpt.

---

## PROMPT

You are the project manager for an **original Nursing Study App** for nursing-licensure exam preparation (PNLE focus, NCLEX-style items). Read the context, evidence and links below, then produce the deliverables listed at the end. Do **not** start implementation: the current phase is research consolidation and architecture planning, and application implementation is not yet authorized.

### 1. Ground rules (from the project blueprint)
- Keep the research folders separate and preserve provenance. **Reuse ideas, validated patterns and interoperable formats, not copied proprietary code or assets.**
- App 1 and App 3 are the same reference-app line (user's clarification). App 2 is a different reference app. App 4 is a separate, newer reference.
- Every research claim is labelled **observed** (literal string/value/code) or **inferred**. Keep that distinction in anything you write.
- Nothing was run on a device, and no reference app's servers were contacted. All analysis was static.
- Original reference apps and personal data found inside them are **not** stored in the repo.

### 2. Reference apps studied

| Ref | App | What it is | Report | Key takeaway for us |
|---|---|---|---|---|
| App 3 (same line as App 1) | **Gizmo 3.2.130** (`ai.saveall.app`) | AI flashcards and quizzes; Expo/React Native; custom ECS quiz engine | [Gizmo_App_Research.docx](https://github.com/FL8Y/readthischatgpt/blob/main/Nursing%20app%20master%20plan/App%203%20a%20app%20inspired%20research/Gizmo_App_Research.docx) (52 pp) | AI generation runs on the server; a daily-quiz pipeline (generate, refill, fire, response, streak events); six question types; hearts, streaks, leagues, live games |
| App 2 | **AnkiDroid 2.25.1** (`com.ichi2.anki`) | Open-source spaced-repetition flashcards; Rust backend (FSRS) | [AnkiDroid_App2_Research.docx](https://github.com/FL8Y/readthischatgpt/blob/main/Nursing%20app%20master%20plan/app%202%20inspired%20research/AnkiDroid_App2_Research.docx) (35 pp) | Interoperability: content provider API, `.apkg` decks, FSRS scheduling; notes vs cards data model |
| App 4 | **Tangerine Prep 1.9.0** (`com.tangerineprep.app`) | Philippine PNLE/NCLEX-style exam-prep app; Expo/React Native | [Tangerine_Prep_Research.docx](https://github.com/FL8Y/readthischatgpt/blob/main/Nursing%20app%20master%20plan/App%204%20tangerine%20prep%20inspired%20research/Tangerine_Prep_Research.docx) (28 pp) | Closest competitor: blueprint taxonomy NP1-NP5, NCLEX item types with partial credit, adaptive exam, study planner, offline mode, pesos pricing |
| App 1 | Raw APK-derived files | Not analysed by me | [App 1 folder](https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan/App%201%20inspired%20research) | Treat as part of the Gizmo reference line per the blueprint |

### 3. Key findings (condensed)

**Content and exam model (App 4, observed)**
- Content taxonomy: five areas (NP1-NP5) > practice area > topic > TOS (table of specifications) section.
- Item types: multiple choice, SATA (select all that apply), matrix, highlight, cloze; scored in credits (partial credit). Every item has a rationale.
- Modes: custom, AI-curated (the assistant selects from the existing question bank and does not write new exam questions), mock board, adaptive exam, case studies; a diagnostic plus passing-probability estimate. Ordinary practice questions are single-select; case-study items add SATA, matrix, cloze, highlight and free response.
- Free tier capped at 20 questions a day; paid plans in pesos; one-time local-payment passes.
- Scoring, adaptive selection, spaced repetition, ranking and AI generation are **server-side** (formulas unknown).

**Learning engine (App 2 and App 3)**
- Anki separates **notes** (content) from **cards** (schedule). One note can produce several cards (cloze numbers, reversed cards).
- AnkiDroid's engine is Rust with FSRS (fsrs crate 5.2.0). Interop options: its content provider (`com.ichi2.anki.flashcards`, runtime permission `com.ichi2.anki.permission.READ_WRITE_DATABASE`), `.apkg` import, intents.
- Gizmo's quiz engine is entity-component-system based, versioned, with activity types (flashcard, choice, typing, cloze, matching, ordering) and policies for evaluation, mistakes, skipping, hearts and hints.
- Gizmo already auto-creates the next quiz via a generate / refill / fire / response pipeline; the AI call is server-side.

**Preset content already in the repo**
- PNLE deck topic hierarchy (7 subjects, 637 nested topic folders): [nursing preset topics](https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan/nursing%20preset%20topics). It is a folder scaffold only, not imported question content.

### 3a. Tangerine Prep complete guide (every feature, UI, code)
- A 92-page guide to how every part of Tangerine Prep works (practice player, results, history, my stats, diagnostic, learning path, cheat sheets, case studies, flashcards, AI tutor Cleo, library, pre-built content, paywall, buttons and navigation, social and battles, UI design system, client-side functions) plus a tested TypeScript client kit (16/16 tests): [Tangerine Prep Complete Guide](https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan/Tangerine%20Prep%20Complete%20Guide) (report: `Tangerine_Prep_Complete_Guide.docx`; per-area notes in `research/`).
- It lists corrections to earlier notes (for example: no leaderboard list, case-study items have five types, settings live under Townhall).

### 3b. Content authoring (topics and questions)
- A separate kit covers how topics and questions are represented and made in each reference app, with schemas, a validator that enforces the canonical PNLE Question Maker prompt's rules, a topic-tree builder for the 7-subject PNLE hierarchy (636 nested topics), and six companion prompts: [Content Authoring Kit](https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan/Content%20Authoring%20Kit) (report: `Content_Authoring_and_Prompt_Reference.docx`). 11/11 tests pass; sample items are original and marked `needs_review`.
- Correction to earlier wording: Tangerine's exam assistant curates existing questions; it does not write new ones. Its library feature can generate flashcards and questions from a user's own sources, with server-side prompts that were not visible.

### 4. Working reference code (built and tested)

| Asset | Purpose | Verification |
|---|---|---|
| [practice-engine](https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan/App%204%20tangerine%20prep%20inspired%20research/product/practice-engine) (TypeScript) | Partial-credit scoring (mcq/SATA/matrix/cloze), adaptive selection (Rasch), readiness, timezone streaks, free-tier energy cap | 10/10 tests pass |
| [srs-scheduler](https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan/app%202%20inspired%20research/product/srs-scheduler) (TypeScript) | Dependency-free FSRS-5 scheduler, queue builder, leech detection | 10/10 tests pass; **not** exact parity with AnkiDroid's newer FSRS crate |
| [apkg-builder](https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan/app%202%20inspired%20research/product/apkg-builder) (Python) | Build `.apkg` decks from JSON; stable IDs so re-imports update instead of duplicating | 4/4 tests pass; not imported into a real AnkiDroid |
| [ankidroid-bridge](https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan/app%202%20inspired%20research/product/ankidroid-bridge) (Kotlin) | Send cards into AnkiDroid via its content provider, with intent fallbacks | Compiles against Android 14 stubs; **not run on a device** |
| [ai-next-quiz](https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan/App%203%20a%20app%20inspired%20research/product/ai-next-quiz) (TypeScript) | AI quiz generator with schema validation, buffer/refill, daily fire, difficulty adaptation | Type-checks cleanly; validator spot-checked; **not run against a live AI API** |

Research notes, data extracts and the repeatable method are in each folder's `research/`, `data/` and `framework/` subfolders.

### 5. Recommended feature priorities (for the PM to challenge)
1. **P1:** exam-blueprint taxonomy; NCLEX-style item types with partial credit; mandatory rationales.
2. **P2:** spaced-repetition flashcards (FSRS); adaptive practice and readiness estimate; study planner with rebalance; streak and daily goal on a fixed timezone.
3. **P3:** AI question/flashcard generation with clinician review; offline bundle with a sync outbox; Anki interoperability (`.apkg` export, AnkiDroid bridge).
4. **P4:** social (friends, groups, leaderboards, battles); voice study rooms.

### 6. Risks and constraints to manage
- **Licensing:** AnkiDroid is GPL-3.0 (Anki core AGPL-3.0). Using its content provider or file formats does not copy code; copying its source carries obligations. Get legal review before reusing any code. This is not legal advice.
- **Proprietary references:** Gizmo and Tangerine Prep are proprietary. Reuse ideas only; do not copy code, prompts, content, art or names.
- **Server-side secrets:** anything shipped in an app bundle can be extracted (scoring keys, rationales, API keys). Keep scoring, AI keys and premium content on the server.
- **Clinical accuracy:** AI-generated nursing content must have expert review, source citation and a visible disclaimer. Exam prep is not clinical guidance.
- **Privacy:** Tangerine Prep bundles ~28.6k exam-passer names and uses session replay and ad SDKs. Avoid embedding personal data; get consent; mask session replay; minimise ad tracking for students.
- **Unverified items:** nothing ran on a device; native libraries were not in the uploads; server algorithms are unknown; FSRS parity with AnkiDroid is not guaranteed.

### 7. Open decisions for you to put to the owner
1. Target exam and market first: PNLE (Philippines), NCLEX, or both?
2. Content source: licensed question bank, authored in-house, AI-assisted with review, or imported from the preset Anki topic deck?
3. Platform and stack: Expo/React Native (as both competitors) versus native Android.
4. Own scheduler (FSRS) versus Anki interoperability only, or both?
5. Monetisation: free-tier cap, price points, local payment methods.
6. Backend and hosting, and who owns AI vendor keys and cost limits.
7. Authorization gate: what criteria end the research phase and permit implementation?

### 8. Deliverables I want from you
1. A one-page status summary and a risk register (owner, likelihood, impact, mitigation).
2. A phased roadmap (research close-out, architecture, MVP, beta) with milestones and acceptance criteria, consistent with the blueprint's stage gates.
3. A prioritised backlog for the MVP, using the priorities above, with dependencies and estimates.
4. A decision log for the open decisions in section 7, with a recommended option for each.
5. A QA and content-review plan (clinical accuracy, accessibility, privacy).
6. A list of anything in the research you consider weak or unverified, with the cheapest way to verify it.

### 9. Where to read first
0. [Master Links Index](https://github.com/FL8Y/readthischatgpt/blob/main/Nursing%20app%20master%20plan/MASTER_LINKS_INDEX.md): every report, folder, code module, preset topic, question prompt and notes project, with status and what is still missing.
1. [Nursing app master plan README](https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan)
2. [Blueprint index](https://github.com/FL8Y/readthischatgpt/blob/main/Nursing%20app%20master%20plan/App%20Master%20Plan%20Blue%20Print/README.md), the authoritative planning control center (architect plan, requirements R-001 to R-034, technical contracts, roadmap, QA, decision log)
3. The three reports in section 2, then the code in section 4.

---

## What to tell your project manager (short version)
- We studied four reference apps (one flashcard/quiz line, AnkiDroid, and a direct PNLE competitor) and wrote reports plus tested code for the reusable parts.
- The closest competitor shows the feature set to match: exam-blueprint taxonomy, NCLEX-style items with partial credit, adaptive practice, study planner, spaced repetition, offline mode.
- The AI and scoring logic is server-side in these apps, so we must build our own backend, content pipeline and review process.
- Biggest risks: licensing of reused code, clinical accuracy of AI content, student privacy, and unverified assumptions (nothing was run on a device).
- We are still in research and planning; implementation needs an explicit go-ahead, and seven decisions are waiting on you and the owner.

## Repo and tool links
- Repo: https://github.com/FL8Y/readthischatgpt
- Master plan folder: https://github.com/FL8Y/readthischatgpt/tree/main/Nursing%20app%20master%20plan
- REA (reverse-engineering tool used for the analysis): https://github.com/morluto/rea
- AnkiDroid (open source): https://github.com/ankidroid/Anki-Android
