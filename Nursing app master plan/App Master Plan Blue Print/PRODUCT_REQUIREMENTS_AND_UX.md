# Product Requirements, UX and Learning Specification

**Status:** Planning specification; no app implementation is authorized.  
**Purpose:** Canonical home for learner-facing requirements, learning rules, accessibility, nursing-content safeguards and testable acceptance criteria. This document consolidates the former Requirements Traceability and UX and Learning Specification documents.

## 1. Product principle

The intended learning loop is:

**Import → organize → diagnose → teach → practice → review → assess → adapt.**

The interface should answer quickly:
1. What should I study next?
2. Why is the app recommending it?
3. How will I know whether I have learned it?

The dashboard should prioritize the next recommended action, due reviews, current-module progress and a concise view of weak topics rather than becoming a wall of charts.

**Non-negotiable assessment rule:** Before the app begins teaching topics in a newly selected subject/module scope, the learner must complete a diagnostic containing 1–50 questions. Preserve progress through interruption/resume. This is a strict gate for the normal first-learning path, not an optional suggestion or silent skip.

## 2. Requirement-to-component traceability

“Planned” means specified for future work, not implemented. Every requirement must eventually map to implementation work and passing acceptance evidence.

| ID | Requirement | Proposed module / data | Acceptance evidence | Dependencies | Status |
|---|---|---|---|---|---|
| R-001 | Import personal study material | Ingestion, SourceDocument, SourceChunk, provenance | Supported fixtures import; text and source locations are retained; failures recover cleanly | Import formats, storage | Planned |
| R-002 | Arrange material by subject/module/topic/subtopic | Content Library, Subject, Module, Topic | Create, move, search, nest and reopen hierarchy without losing links | Data model, navigation | Planned |
| R-003 | Link related concepts across folders | ConceptRelation / TopicRelation | One concept can be linked from multiple topics without duplicating canonical content | Canonical identity | Planned |
| R-004 | Diagnostic before teaching selected scope | Assessment Engine, DiagnosticSession | A 1–50 question diagnostic must be completed before generated teaching starts in that scope; interruption/resume works and topic-level results appear | Assessment policy, question bank | Planned |
| R-005 | Identify strengths and weaknesses | Attempt ledger, TopicEvidence, MasteryEstimate | Results show topic-level performance and confidence; sparse evidence is labelled uncertain | Event model, learning spec | Planned |
| R-006 | AI creates an ordered targeted learning plan | Adaptive Plan Engine, LearningPlanItem | Fixed attempt fixtures produce an explainable plan in documented priority order | Mastery model, AI contract | Planned |
| R-007 | Clickable topic lessons | Lesson module, Topic, LessonVersion | Each generated topic opens a lesson with saved progress and source links | Content model, navigation | Planned |
| R-008 | Visual aids and pictures | MediaAsset / VisualAsset | Available media has source/attribution and loading/unavailable states | Media sourcing, safety | Planned |
| R-009 | Mnemonics and memory techniques | Lesson section schema | Lesson can show a mnemonic, rationale and limitations without unsupported clinical claims | Generation schema, review | Planned |
| R-010 | Topic mind map and cross-topic connections | TopicGraph, ConceptRelation, graph projection | Graph renders known relations, navigates to topics and provides keyboard/screen-reader alternatives | Content relations, UX | Planned |
| R-011 | Detailed AI explanations | Lesson and Tutor services | Output follows schema, links sources when available and handles unsupported questions honestly | Provider, grounding | Planned |
| R-012 | 1–5 question topic pop quiz | Assessment policy / TopicQuiz | Service and UI enforce 1–5 questions; feedback appears after each answer | Question schema | Planned |
| R-013 | Instant feedback and wrong-answer rationale | AnswerEvaluation, Rationale | Correctness/rationale match the versioned question; unsupported rationale is flagged; answer keys are not exposed before submission in server-backed mode; shuffled matching/ordering grade correctly | Question validation, answer-key boundary | Planned |
| R-014 | Comprehensive module quiz | ModuleAssessment | Assessment follows a versioned topic/difficulty coverage blueprint and reports coverage, score and weak areas | Taxonomy, assessment blueprint | Planned |
| R-015 | Targeted topics after module assessment | RemediationPlan | Weak topics produce a prioritized plan without unnecessarily repeating mastered material | Mastery model | Planned |
| R-016 | Repeat adaptive learning cycle | Adaptive Plan Engine | Remediation produces an updated plan from new evidence rather than resetting blindly | Event ledger | Planned |
| R-017 | Points for correct answers and completion | Rewards service, RewardEvent | Reward rules are deterministic; retries and duplicate requests do not award duplicate points | Idempotency | Planned |
| R-018 | Streaks and levels/ranks | Streak, ProfileProgress | Time-zone boundaries, missed days, restore and duplicate events are tested | Time policy, persistence | Planned |
| R-019 | Dashboard and per-topic mastery | Progress projection | Dashboard reconciles with attempt/review fixtures and displays confidence/recency | Mastery formula | Planned |
| R-020 | Tutor discussion mode | TutorSession, TutorMessage, SourceContext | Follow-ups retain context; source-grounded answers expose relevant references when available | Provider, privacy | Planned |
| R-021 | First-launch AI key setup | Credential Settings | Setup handles valid, missing and invalid credentials plus key rotation/removal | Provider design | Planned |
| R-022 | Secure credential storage | Credential boundary | No key in logs, backups, crash reports or source; threat model documents extraction limits | Platform choice | Planned |
| R-023 | Graceful provider/network errors | Provider Adapter, RetryPolicy | Timeout, rate-limit, auth, malformed-output, offline and exhausted-retry cases preserve progress and redact secrets | AI contracts | Planned |
| R-024 | Flashcards generated from topics | Card Generator, Flashcard | Cards preserve source/topic links and can be edited or dismissed by the user | Content schema | Planned |
| R-025 | Spaced review depends on recall and weaknesses | Scheduler, ReviewEvent, SchedulerState | Fixed-time/rating fixtures produce deterministic due dates; rating behaviors are documented | Scheduler choice | Planned |
| R-026 | Weak cards recur sooner | Scheduling policy | Incorrect/relearning cards receive shorter intervals according to the chosen algorithm | Scheduler policy | Planned |
| R-027 | Persist learning history | AttemptEvent, ReviewEvent, migrations | Restart and backup restoration preserve attempts, scheduler state and progress | Storage choice | Planned |
| R-028 | Privacy, export and recovery | Backup/Export, privacy settings | Export/import round-trip, deletion and secret-redaction tests pass | Storage, security | Planned |
| R-029 | Mobile accessibility and usability | Design system, screen states | Contrast, text scaling, touch targets, semantic labels, screen-reader and error states are verified | Platform, UX | Planned |
| R-030 | Clinical-content reliability | Source provenance, review state | Unsupported facts are not attributed to sources; conflicting sources are flagged; educational limitation is visible | Grounding/review workflow | Planned |
| R-031 | AI cost/rate control | AI usage policy | Limits, retries, caching, cancellation and safe usage metrics are tested | Provider strategy | Planned |
| R-032 | Testability and evidence | QA / CI / audit receipts | Each feature has test criteria and exact test receipts; concurrent generation is idempotent; attempts/rewards cannot duplicate | Stack, CI | Planned |

## 3. Canonical learner journeys

### 3.1 First launch and AI configuration
1. Explain why an AI provider is needed and which features require connectivity.
2. Provide the specified personal-key configuration path; any limited/offline setup path must be explicitly defined.
3. Never redisplay a saved secret in plaintext.
4. Validate configuration with a minimal safe request when appropriate.
5. Distinguish invalid key, unsupported model, quota/rate limit, no network and provider outage.
6. Provide key change/removal and privacy/data-retention information.
7. Never imply local encryption makes a key impossible to extract from a compromised device.
8. If the key is missing/invalid, show a recoverable setup state or an explicitly limited/offline mode. That mode may support saved content and existing due-card reviews, but must not silently bypass a required diagnostic before teaching a new scope. If no valid diagnostic question set can be generated or retrieved, preserve the session and clearly explain how to unblock it.

### 3.2 Import study material
1. Select an explicitly supported input format.
2. Validate type and size and show processing progress.
3. Extract and preview content with source location/page/heading when available.
4. Allow correction of title, subject and module mapping.
5. Explain what will be stored and sent to an AI provider.
6. Preserve the source and import status.
7. Recover from corrupt, empty, scanned-only, unsupported or oversized files without losing unrelated work.

### 3.3 Begin a new subject or module
1. Show included sources and topics.
2. Require the diagnostic before teaching starts in that scope.
3. Allow a question count from 1–50 or use a separately documented default.
4. Persist session state for interruption/resume.
5. Report results by topic and learning objective with evidence count and confidence.
6. Explain the recommended learning order; do not show only one aggregate score.

### 3.4 Study a topic
1. Display the learning objective and estimated time.
2. Present a structured explanation, source references, visual aids where available, useful mnemonics and related topics.
3. Avoid an unstructured AI essay dump.
4. Support requests for simpler wording, worked examples and deeper explanation.
5. Record lesson completion separately from demonstrated mastery.
6. Offer a configurable 1–5 question topic quiz with immediate feedback and rationale.

### 3.5 Complete a module assessment
1. Explain scope and estimated time.
2. Preserve progress across interruption.
3. Report results by topic and objective.
4. Distinguish incorrect, unanswered and flagged items.
5. Generate a prioritized remedial plan with reasons.
6. Reassess with new or suitably varied questions after remediation.

### 3.6 Review flashcards
1. Open directly into due reviews where practical.
2. Keep content readable and interactions predictable.
3. Record Again/Hard/Good/Easy or equivalent rating.
4. Explain the next due date when useful.
5. Persist the rating before presenting a final success state.
6. Support offline review and interruption recovery according to the approved architecture.
7. Avoid mechanics that pressure the learner to rush or guess.

### 3.7 Tutor discussion
1. Keep the current topic/source context visible.
2. Support follow-up questions and alternate explanations.
3. Distinguish source-grounded responses from general model knowledge.
4. Show relevant source locations when available.
5. Acknowledge conflicting or insufficient sources instead of fabricating certainty.
6. Do not present the app as patient-specific clinical decision support.

### 3.8 Dashboard and settings
The dashboard should prioritize the next useful action, due reviews, active learning plan, module progress and weak topics. Settings should cover provider configuration, privacy, backup/export, accessibility, notifications and data controls. Avoid forcing users through many nested screens to start a quiz or review a card.

## 4. Information architecture

Conceptual destinations:
- **Home:** next action, due reviews, active plan and concise progress.
- **Library:** subjects, modules, topics, sources, search and connected concepts.
- **Study:** diagnostic, lesson, topic quiz, module assessment and remediation.
- **Review:** due cards, queue and session summary.
- **Tutor:** source-aware discussion.
- **Progress:** mastery, confidence/evidence, history, points and streaks.
- **Settings:** provider, privacy, export/backup, accessibility, notifications and data control.

The hierarchy should represent Subjects → Modules → Topics → Subtopics. A topic may be linked to multiple subjects or modules; links must not duplicate the canonical concept. Typed relationships may include prerequisite, related-to, contrasts-with, part-of and clinically-associated-with. Mind maps are views of the canonical topic graph, not the only record of relationships. Provide a text/list alternative.

## 5. Learning model and mastery rules

### Diagnostic
A diagnostic is a strict gate before first teaching in the selected scope, not an optional suggestion. It estimates prior knowledge and must sample the scope according to a coverage blueprint, contain 1–50 questions, avoid near-duplicate questions, and distinguish low-information results from mastery evidence. Interrupted sessions resume without losing attempts or silently restarting. There is no silent skip in the normal first-learning path; a review-only mode may revisit previously taught material but cannot unlock new lessons. Guessing and small sample size reduce confidence. Diagnostic scores are learning signals, not clinical competency certification.

### Personalized teaching
The learning plan should prioritize gaps, prerequisite dependencies, supplied-source coverage and confidence in evidence. Explain why each topic is selected. Avoid repeatedly assigning content already understood while neglecting persistent weaknesses. Use examples, mnemonics or visual aids when useful, not as replacements for accurate understanding.

### Retrieval and feedback
Feedback should identify the correct answer, explain the underlying reasoning and address common misconceptions. Clinical rationales must not overstate certainty or invent citations. Incorrect answers inform future review without labelling the learner.

### Spaced repetition
Use actual recall ratings and review history. Weak cards should reappear sooner according to the chosen, versioned scheduler. Do not treat tap counts or screen time as proxies for mastery.

### Mastery, confidence and module readiness
Keep separate:
- observed accuracy;
- attempt count and recency;
- question difficulty and topic coverage;
- review performance;
- estimated mastery;
- confidence/evidence sufficiency;
- module readiness.

A small number of correct answers must not imply high certainty. Labels such as “new,” “developing,” “likely mastered,” and “insufficient evidence” require documented definitions. Module readiness should reflect coverage, recent performance and evidence sufficiency; it is not proof of clinical competence.

## 6. Points, levels and streaks

Reward meaningful valid answer attempts, completed learning activities, quiz performance and review consistency. Define transparent anti-farming and idempotency rules. Repeating a completed activity or submitting the same event twice must not mint additional points. Streaks must have an explicit time-zone/travel policy, and losing a streak must never delete learning history. Levels/ranks should motivate without hiding weak topics or pressuring unsafe speed.

## 7. Accessibility and device usability

- Correctness and topic state must not depend on color alone.
- Use readable body text and adjustable text scaling.
- Provide semantic labels for controls and charts.
- Use logical focus order and screen-reader announcements for feedback.
- Maintain usable touch targets and spacing.
- Ensure contrast remains usable in any supported theme.
- Offer text/list alternatives for graphs.
- Avoid flashing, forced time pressure or motion as the only signal.
- Preserve quiz/review state when backgrounded or recreated.
- Design for short study sessions and modest mobile hardware.

## 8. Nursing-content safeguards

- Preserve source name, version, page/section and import date when available.
- Distinguish source quotation, source-derived summary and AI-added explanation.
- Do not fabricate citations or imply that a source supports a claim it does not.
- Flag conflicting or insufficient source content.
- When external research is used for high-risk clinical claims, use appropriate authoritative and current references.
- Keep education distinct from patient-specific diagnosis/treatment advice.
- Retain relevant clinical context and qualifiers in rationales.
- Permit the learner to flag suspected errors and allow unsafe generated content to be reviewed or retired.
- Version generated content so past answers remain interpretable.
- Never treat a high quiz score as proof that a learner can safely perform a clinical procedure.
- Record provenance for question prompts, answer keys and rationales separately where possible; a well-grounded prompt does not guarantee a correct answer key.

## 9. Acceptance test catalogue

A later implementation must prove at minimum:
- Diagnostic count is 1–50, coverage is enforced, teaching is gated, and interrupted sessions resume.
- Topic quiz count is 1–5 and feedback is tied to the exact question version.
- Module assessment creates topic-level coverage/weakness evidence and a new targeted plan.
- Every generated question has validated structure, a valid answer key and real source references or an explicit general/needs-review label.
- No pre-answer server-backed learner payload contains answer keys; shuffled ordering/matching grades correctly.
- Imported instructions cannot override generation policy.
- Duplicate requests do not create duplicate sessions, attempts or rewards.
- Repeated/low-evidence answers do not create unjustified mastery.
- Provider failures, invalid credentials, offline mode and cancellation preserve work.
- Offline review ratings survive restart according to the selected offline policy.
- Source references navigate to actual source locations.
- Text scaling, screen readers, contrast, focus order, graph alternatives and non-color feedback work.
- Suspected clinically unsafe content can be flagged and withheld/retired under a documented policy.
- Reward and streak calculations are deterministic, idempotent and time-zone aware.

## 10. Remaining policies that require an explicit decision

- Supported import formats, file/page/size limits and OCR scope.
- Diagnostic default count, retest behavior and whether any separate review-only mode is ever supported.
- Question types for each assessment kind.
- Topic mastery formula and confidence thresholds.
- Reward amounts, levels and anti-farming rules.
- Clinical source policy and which claims require human review.
- Offline boundaries and multi-device synchronization requirements.
- AI providers/models and cost ceilings.
- Minimum Android/API level, device matrix and performance targets.
