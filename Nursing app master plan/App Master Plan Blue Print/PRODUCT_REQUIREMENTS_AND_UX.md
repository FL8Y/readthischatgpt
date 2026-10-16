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
| R-003 | Link and color-code related concepts across folders | ConceptRelation / TopicRelation and graph legend | One canonical concept can be linked across folders; relation colors are consistent and accompanied by text labels/icons so meaning never depends on color alone | Canonical identity, accessible color tokens | Planned |
| R-004 | Diagnostic before teaching selected scope | Assessment Engine, DiagnosticSession | A 1–50 question diagnostic must be completed before generated teaching starts in that scope; interruption/resume works and topic-level results appear | Assessment policy, question bank | Planned |
| R-005 | Identify strengths and weaknesses | Attempt ledger, TopicEvidence, MasteryEstimate | Results show topic-level performance and confidence; sparse evidence is labelled uncertain | Event model, learning spec | Planned |
| R-006 | AI creates a targeted learning plan with explicit depth and order | Adaptive Plan Engine, LearningPlanItem | Completed diagnostic evidence drives an ordered topic list with a documented teaching depth/priority and explanation for each item; the plan is saved and reproducible against fixed fixtures | Mastery model, AI contract, diagnostic results | Planned |
| R-007 | Clickable topic lessons | Lesson module, Topic, LessonVersion | Each generated topic opens a lesson with saved progress and source links | Content model, navigation | Planned |
| R-008 | Visual aids and pictures | MediaAsset / VisualAsset | Available media has source/attribution and loading/unavailable states | Media sourcing, safety | Planned |
| R-009 | Mnemonics and memory techniques | Lesson section schema | Lesson can show a mnemonic, rationale and limitations without unsupported clinical claims | Generation schema, review | Planned |
| R-010 | Obsidian-style topic mind map with graph and linked outline views | TopicGraph, ConceptRelation, graph projection | Graph and linked Markdown/text outline render known relations, navigate to topic lessons, use a consistent relation-color legend, and provide keyboard/screen-reader alternatives | Content relations, UX, accessible relation tokens | Planned |
| R-011 | Detailed AI explanations | Lesson and Tutor services | Output follows schema, links sources when available and handles unsupported questions honestly | Provider, grounding | Planned |
| R-012 | 1–5 question topic pop quiz | Assessment policy / TopicQuiz | Service and UI enforce 1–5 questions; feedback appears after each answer | Question schema | Planned |
| R-013 | Instant feedback and wrong-answer rationale | AnswerEvaluation, Rationale | Correctness/rationale match the versioned question; unsupported rationale is flagged; answer keys are not exposed before submission in server-backed mode; shuffled matching/ordering grade correctly | Question validation, answer-key boundary | Planned |
| R-014 | Comprehensive module quiz | ModuleAssessment | Assessment follows a versioned topic/difficulty coverage blueprint and reports coverage, score and weak areas | Taxonomy, assessment blueprint | Planned |
| R-015 | Targeted topics after module assessment | RemediationPlan | Weak topics produce a prioritized plan without unnecessarily repeating mastered material | Mastery model | Planned |
| R-016 | Repeat adaptive learning cycle | Adaptive Plan Engine | Remediation produces an updated plan from new evidence rather than resetting blindly | Event ledger | Planned |
| R-017 | Points for correct answers, quiz scores, completion and streak milestones | Rewards service, RewardEvent | Correct-answer, topic/module quiz-score, lesson-completion and streak-milestone reward events follow documented deterministic rules; retries and duplicate requests do not award duplicate points | Idempotency, scoring policy | Planned |
| R-018 | Streaks and levels/ranks | Streak, ProfileProgress | Time-zone boundaries, missed days, restore and duplicate events are tested | Time policy, persistence | Planned |
| R-019 | Progress dashboard for points, rank/level, due reviews and topic mastery | Progress projection | Dashboard reconciles with attempt/review fixtures and visibly shows points, level/rank, streak, next recommended action, due reviews, topic mastery, confidence and recency | Mastery formula, rewards, scheduler | Planned |
| R-020 | Tutor discussion mode | TutorSession, TutorMessage, SourceContext | Follow-ups retain context; source-grounded answers expose relevant references when available | Provider, privacy | Planned |
| R-021 | First-launch AI key setup for every AI-powered study feature | Credential Settings / Provider Adapter | One configured user provider/key is used for diagnostic and adaptive-plan generation, lessons, topic/module quizzes, flashcards, mind-map generation and tutor discussion; setup handles valid/missing/invalid credentials and key rotation/removal | Provider design, task schemas | Planned |
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
| R-033 | Explainable, evidence-aware mastery | Versioned MasteryPolicy, TopicEvidence, MasteryEstimate | Fixed fixtures verify sparse-perfect, repeated-item, stale-success/recent-failure, partial-coverage, delayed-recall and duplicate-event behavior; confidence is separate from accuracy | Event model, coverage blueprint | Planned |
| R-034 | Deterministic adaptive learning-plan order | LearningPlanItem, RankingPolicyVersion | Identical evidence produces identical topic order and explanation; prerequisites/uncovered concepts/low evidence take precedence; AI cannot override policy eligibility | R-004, R-005, R-033 | Planned |

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

### 3.9 Cross-screen state and recovery matrix

Every primary screen must explicitly represent loading, empty, recoverable error, offline/unsupported capability, cancellation and resume/retry. A spinner alone is not a state model. The following table is the minimum planning contract; screen-specific copy and visual design can be refined later without changing the underlying behavior.

| Flow / screen | Loading | Empty / first-use | Error / blocked | Offline behavior | Interruption / recovery oracle |
|---|---|---|---|---|---|
| First launch / provider setup | Explain setup step and validation progress; prevent duplicate submissions | Explain which AI features need a key/network and what remains available without them | Distinguish invalid key, unsupported model, quota, timeout and provider outage; never echo the secret | Saved library/reviews may be opened; new AI-dependent teaching remains blocked if no valid diagnostic set exists | Rotate/remove key and return to prior state; never lose imported content or show a saved key in plaintext |
| Import / source preview | Show stage and progress; permit safe cancellation before commit | Explain no sources imported and show supported formats | Identify unsupported, corrupt, empty, scanned-only or oversized input; retain original and unrelated work | Local text/Markdown import works without provider access; provider-dependent enrichment is queued or explicitly unavailable | Cancel/retry does not create duplicate SourceDocument records; committed source and provenance survive process death |
| Diagnostic / assessment | Show session scope, count and saved progress; avoid duplicate start requests | If no valid question set exists, explain the blocker and do not unlock lessons | Malformed/insufficient questions produce a recoverable error, not a bypass | A previously saved diagnostic can resume offline; new generation needs provider/network unless a valid cached set exists | Force-stop after an answer, reopen same versioned session, preserve answer and event ID, and keep lesson gate closed until completion is durably committed |
| Lesson / topic quiz | Show topic title and content-generation status; preserve selected topic | Explain when a topic has no imported/generated lesson and offer supported next action | Source/AI failure identifies whether cached content can be opened; unsupported claims are labelled | Saved lessons and local quizzes remain available; new AI generation is explicitly unavailable | Lesson progress and quiz answers survive rotation/background/process death; feedback matches the exact question/rubric version |
| Module assessment / remediation | Show scope, blueprint and saved completion status | Explain when a module has no mapped topics or insufficient questions to meet coverage | Coverage failure is surfaced; do not silently deliver a misleadingly “comprehensive” quiz | Resume a saved assessment and view prior results; generation of missing questions may be blocked | Interrupted assessment resumes same version; completed results and remedial plan remain auditable |
| Flashcard review | Show due count and selected card without losing current rating state | Distinguish “no cards yet” from “no cards due”; provide next action | Invalid card/version or scheduler failure must not silently advance the queue | Existing due cards and ratings work offline; persist rating locally before showing success | Duplicate rating submission is idempotent; app restart preserves rating, scheduler state and due date |
| Tutor discussion | Show request-in-progress and allow cancellation without duplicate sends | Explain missing topic/source context and offer a clear way to choose context | Distinguish provider/network failure, unsupported request and insufficient source support | Show saved conversation history; new response is unavailable without provider access | Retry/cancel does not duplicate user messages; follow-up context and source citations stay attached to the correct conversation version |
| Graph / dashboard / settings | Show partial loading without blocking access to other destinations | Explain no relations, no progress history, or no due reviews as distinct states | Missing graph nodes or inconsistent projection gets a safe text/list fallback and diagnostic reference | Show cached graph, local progress and settings; mark remote/AI-derived content stale or unavailable | Graph and outline agree on canonical edges; dashboard values recompute from persisted events after restore |

### 3.10 UX acceptance checks

- UX-STATE-001: each row above has explicit UI state, recovery action and persisted-state expectation in the implementation screen inventory.
- UX-STATE-002: offline mode distinguishes saved/local capability from provider-dependent capability and never bypasses the mandatory diagnostic gate.
- UX-STATE-003: cancel/retry/submit races do not duplicate imports, messages, attempts, reviews or rewards.
- UX-STATE-004: an empty state always distinguishes “nothing exists yet” from “nothing is due/needed now.”
- UX-STATE-005: screen-reader announcements and text alternatives cover loading, blocked, success and error states; color is never the only signal.
- UX-STATE-006: interruption tests include activity recreation, background/resume, process death and device restart for every stateful learning flow.

## 4. Information architecture

Conceptual destinations:
- **Home:** next action, due reviews, active plan and concise progress.
- **Library:** subjects, modules, topics, sources, search and connected concepts.
- **Study:** diagnostic, lesson, topic quiz, module assessment and remediation.
- **Review:** due cards, queue and session summary.
- **Tutor:** source-aware discussion.
- **Progress:** mastery, confidence/evidence, history, points and streaks.
- **Settings:** provider, privacy, export/backup, accessibility, notifications and data control.

The hierarchy should represent Subjects → Modules → Topics → Subtopics. A topic may be linked to multiple subjects or modules; links must not duplicate the canonical concept. Typed relationships may include prerequisite, related-to, contrasts-with, part-of and clinically-associated-with. Color-code relation types consistently across folders and graph views, with an explicit legend plus text labels/icons; never rely on color as the only signal. Provide an Obsidian-style linked Markdown/text outline as well as the navigable graph. Both are views of the canonical topic graph, not the only record of relationships.

## 5. Learning model and mastery rules

### Diagnostic and assessment blueprint
A diagnostic is a strict gate before first teaching in the selected scope. It estimates prior knowledge; it is not a mastery certification. It must contain 1–50 questions and sample the selected scope using a versioned coverage blueprint. The diagnostic session stores its scope, blueprint version, question versions, attempt history and completion state. Interruption resumes the same session without losing answers, silently restarting, or generating a different test under the same session ID.

A scope must not unlock a new lesson until the diagnostic is complete and its results are durably committed. If no valid diagnostic set is available because of missing credentials, network failure or invalid generated content, preserve the session and show a recoverable blocked state. A review-only path may revisit previously taught content but cannot unlock new topics. Diagnostic evidence informs the initial plan; it must not be blended invisibly into post-teaching mastery.

### Question and coverage policy
- Topic pop quizzes contain 1–5 questions. The requested count is explicit and validated after generation; no silent fallback to the reference app's 3–12 schema.
- Module assessments use a versioned blueprint that records topic coverage, difficulty distribution and the reason each question is included.
- Deduplicate by stable question/concept-family identity across batches, not only normalized prompt text.
- Preserve the question version, source version, grading-key version and rubric used for every attempt.
- For generated question sets, reject invalid structure, invalid answer mappings, unsupported citations, duplicate options, missing cloze blanks, and ordering/matching data that cannot be graded unambiguously.
- Separate diagnostic performance, topic-quiz performance, module-assessment performance and spaced-repetition recall in analytics. Each is evidence with a different purpose.

### Personalized teaching and remediation
The plan prioritizes prerequisite gaps, weak or uncovered concepts, stale evidence and source-backed content. Every recommended item has a human-readable reason and the evidence/policy version that produced it. If two topics have equal priority, use a deterministic tie-break (prerequisite order, then stable topic ID) so a learner does not receive a randomly reordered plan after restart. After a module assessment, remediation targets weak or uncovered concepts; topics already supported by sufficient recent evidence should not be repeated merely to fill a fixed-length plan.

### Retrieval and feedback
Feedback identifies the correct answer, explains the underlying reasoning, addresses the misconception and links to supporting source locations where available. If the source does not support the answer key or rationale, label it as AI-added/general knowledge or needs review; never fabricate a citation. Preserve the exact question and rubric version so a later content edit does not rewrite historical grading silently.

### Spaced repetition
Use a versioned scheduler behind an interface. Each review event stores the card/content version, rating, timestamp, scheduler version, previous state, resulting state and idempotency key. Weak cards reappear according to the selected scheduler; tap counts and screen time are not proxies for mastery. Do not claim exact AnkiDroid interval parity from the checked-in FSRS-5 reference. Scheduler selection remains a proposal until a maintained, license-compatible version is selected and its deterministic test vectors are recorded.

### Proposed v1 mastery/evidence policy (explicitly provisional)
The app must use a transparent, versioned rule set rather than an unexplained percentage. These are proposed initial product rules, not a claim of clinically validated thresholds:

1. **Diagnostic evidence:** informs the initial plan and is shown separately; it does not by itself mark a topic as mastered.
2. **Eligible post-teaching evidence:** valid, persisted attempts and review events tied to versioned questions/cards and canonical concept/topic IDs. Exclude duplicate event IDs and voided/regraded events from double counting.
3. **Per-topic performance:** compute raw accuracy and recency-weighted accuracy from valid graded assessment attempts only; do not mix review ratings into a binary-correctness denominator. For the provisional recency view, use a 30-day half-life: attempt weight = 2^(-ageDays/30). For each question-version/concept-family/session tuple, only the latest valid graded attempt contributes to the mastery projection; retain all attempts in history. Repeated sessions on the same family still count as one distinct family toward the evidence gate. Store the method version and input-event watermark. Show spaced-review ratings as a separate evidence summary.
4. **Coverage:** calculate the share of mapped concept clusters sampled by valid evidence; do not infer coverage from the number of questions alone.
5. **Evidence sufficiency and mastery:** show **Insufficient evidence** until there are at least 5 distinct concept-family IDs across at least 2 separate study sessions; different question variants from the same concept family count as one family. Show **Developing evidence** once that floor is met. Show **Likely mastered** only when there are at least 10 distinct concept-family IDs, at least 3 sessions, at least one delayed retrieval/review at least 24 hours after initial learning, at least 80% mapped-concept coverage, recency-weighted performance of at least 85%, most recent session performance of at least 80%, and at least one successful graded retrieval/review in the last 30 days. If any condition fails, do not show **Likely mastered**. If evidence is sufficient but the most recent successful retrieval is older than 30 days, show **Needs refresh** rather than implying current retention.
6. **Confidence label:** derive only from evidence sufficiency, coverage, session diversity, delayed retrieval, recency and source/mapping quality—not from whether answers were correct. Low = evidence floor not met or evidence provenance/mapping is unresolved; medium = minimum floor is met but high-evidence criteria are not; high = at least 10 distinct concept-family IDs across at least 3 sessions, delayed retrieval >=24 hours, coverage >=80%, at least one successful retrieval in the last 30 days, and no unresolved source/mapping issue. This is an evidence-sufficiency label, not a statistical probability and not proof of clinical competence. Mastery label separately uses the performance thresholds in rule 5.
7. **Missing/ambiguous evidence:** unknown source quality, ambiguous topic mapping, changed grading rubric or unresolved answer-key defect blocks a high-confidence mastery label until resolved/reviewed.
8. **Calibration gate:** check these defaults against the named scenario suite (perfect-but-sparse, repeated same-item success, recent failures after old success, broad-but-stale evidence, partial concept coverage, source mapping uncertainty, duplicate replay, policy version change, and diagnostic-only success). Threshold changes require a method-version increment and regression comparison.

These rules favor conservative explanations over false precision. The UI must expose why a label was assigned and which evidence is missing. A future evidence-based recalibration may change thresholds, but an implementation agent must not silently invent a different formula.

### Proposed adaptive-plan ordering
For the first version, rank eligible learning items lexicographically, not with an opaque blended score:
1. unresolved safety/source-quality review flags;
2. uncovered required concepts and unmet prerequisites;
3. topics below the evidence-sufficiency floor;
4. topics with the lowest recency-weighted performance;
5. topics with the oldest successful retrieval evidence;
6. stable topic ID as deterministic tie-break.
The plan may use AI to explain or enrich the recommendation, but the AI output cannot override deterministic eligibility rules or invent evidence. Record the ranking-policy version and reasons.

### Module readiness
Module readiness is an aggregate view of required topic coverage, evidence sufficiency and recent performance; its policy must list required topics and exclusions. It must not be presented as clinical competency certification. A module cannot be labelled ready if any required topic has unresolved source-quality flags or insufficient evidence.

## 6. Points, levels and streaks

Reward meaningful valid correct answers, quiz-score milestones, completed learning activities, streak milestones and review consistency. Define point values and score thresholds explicitly, along with transparent anti-farming and idempotency rules. Repeating a completed activity or submitting the same event twice must not mint additional points. Streaks must have an explicit time-zone/travel policy, and losing a streak must never delete learning history. Levels/ranks should motivate without hiding weak topics or pressuring unsafe speed.

## 7. Accessibility and device usability

- Correctness and topic state must not depend on color alone. Related-topic connections may be color-coded, but also require text labels/icons and a visible legend.
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
