# Technical Architecture, Data Model and Service Contracts

**Status:** Stack-neutral proposal. Final framework, deployment and algorithm choices remain open. No production schema or application implementation is authorized.  
**Purpose:** Consolidates the former Architecture Options and Data Model and Contracts documents so technology trade-offs and the contracts they affect are reviewed together.

## 1. Evaluation criteria and operating principles

Evaluate options against Android UX/performance, native capability access, offline operation, development complexity, AI integration, accessibility, testing, maintenance, privacy, cost and future platform flexibility.

1. Build an original product; reuse concepts and interoperable formats, not copied proprietary code or assets.
2. Maintain one canonical content model and link concepts across folders.
3. Store attempts and reviews as append-only events; derive progress from history.
4. Treat all AI output as untrusted until structural, semantic and source-grounding validation succeeds.
5. Preserve source provenance and content versions.
6. Keep the scheduler behind a versioned interface.
7. Never hard-code provider credentials into a client bundle or logs.
8. Design explicit offline and sync boundaries.
9. Use logical modules; do not assume every module needs a separate network service.
10. Do not report type-checking, tests, integrations or device verification without direct evidence.

## 2. Mobile framework options

| Option | Strengths | Risks and costs | Evidence still needed | Current position |
|---|---|---|---|---|
| Kotlin + Jetpack Compose | Native Android UX; straightforward native storage and secure-storage integration; strong platform access and offline control | Android-only initial client; cross-platform later may require a separate client | Confirm initial platform, native needs, workflow and performance | Strong candidate if Android is the primary target |
| React Native / Expo | Cross-platform client; comparable Gizmo product uses this stack class | Native integrations may require modules/config plugins; dependency/runtime constraints; Gizmo's use does not prove suitability here | Confirm native APIs, package maturity and low-end-device behavior | Candidate if cross-platform is a real requirement |
| Flutter | Cross-platform UI with consistent rendering | Different ecosystem and native integration choices; little project-specific evidence | Assess against actual platform and team constraints | Candidate, not preferred by default |

**Provisional position:** If Android is the only confirmed initial target, compare Kotlin/Compose with React Native against real requirements. Do not create a technical spike or production scaffolding during the current planning stage.

## 3. Persistence and backend options

| Option | Strengths | Risks / costs | Best fit |
|---|---|---|---|
| Local-first only | Offline control, no server operation cost, simpler initial deployment | Multi-device sync and server-side AI-key protection are difficult; device loss risk | Single-device study experience |
| Backend-first | Account, sync, server-side AI calls/keys and cross-device access | Hosting, authentication, privacy obligations, offline complexity and recurring costs | Multi-device/collaborative product |
| Hybrid local-first plus optional backend | Local study/review while adding sync or server AI where configured | More complex conflict resolution, migration, authentication and testing | Potential long-term choice if offline and cross-device use are both needed |

**Decision needed:** Determine whether cross-device sync is required in the first release. Do not add a backend merely because AI exists; justify it using the credential, privacy and product requirements.

## 4. AI provider-key strategies

| Strategy | Benefits | Risks | Necessary controls |
|---|---|---|---|
| User's own key stored on device | Uses user's provider account; avoids central provider bill | Key may be extracted from rooted/compromised or instrumented device; provider APIs differ; accidental leakage risk | OS-backed secure storage, redaction, removal/rotation, no backups/logging, usage warnings |
| Server proxy with platform-managed key | Keeps platform key server-side; central validation, limits and caching | Hosting, abuse, authentication and privacy costs | Authentication, quotas, per-user budgets, rate limits, secret manager, minimal retention |
| Supported hybrid mode | Flexibility for different deployment modes | Larger UX, testing and operational surface | Clear provider capability contract and per-mode threat model |

The user's stated preference is for a personal API key and local configuration. Research this preference seriously, but do not overstate its protection: local storage cannot guarantee that a client-side key is impossible to extract. Never ship a platform-owned provider key in a mobile app bundle. If server mode is supported, require authentication, quotas, request/source-size limits, cost controls and secret redaction.

Provider options should be behind a logical adapter for distinct tasks: lesson, diagnostic, topic quiz, module assessment, flashcard, tutor and mind-map generation. Each task has its own schema and policy. Use bounded retries; never retry indefinitely.

## 5. AI generation, validation and answer-key boundary

The Gizmo reference's generic 3–12 question limit does not satisfy product-specific 1–5 pop quizzes and 1–50 diagnostics. Use assessment-specific policies and enforce count/coverage after generation. Batching a diagnostic is only acceptable if topic coverage and deduplication remain consistent across batches.



**Mandatory diagnostic gate:** For a newly selected learning scope, the service layer—not only the UI—must verify that the 1–50 question diagnostic is completed and its attempts/results are durably saved before generating or unlocking a new topic lesson. An interrupted diagnostic resumes the same versioned session. The normal learning flow cannot silently skip the gate. A review-only mode may reopen already-taught material but must not unlock new lessons. If credentials/network are unavailable and no valid diagnostic set exists, return a clear, recoverable blocked state; never bypass the rule.


Before persisted/generated content is accepted, validate:
- schema and type bounds;
- answer key and option/index validity;
- semantic consistency and grading behavior;
- count and topic coverage;
- duplicate/near-duplicate prompts;
- source grounding and provenance;
- difficulty constraints;
- safety/unsupported claims;
- retry/cancellation behavior.

For server-backed assessment, separate:
- **LearnerQuestionPayload:** prompt, displayed options/items, response type, safe instructions and media; no correct answer/index, accepted answer, correct order or grading-only rationale before submission.
- **GradingKey:** canonical correct response, accepted variants, canonical ordering/matching pairs, rationale and supporting provenance; held server-side in server-backed mode.
- **AnswerFeedbackPayload:** after recording the attempt, return correctness and the validated rationale/source references.

For ordering/matching, shuffle the learner-visible presentation but grade against stable canonical IDs/mappings. Test serialized/network payloads; a hidden UI element is not a security boundary. In local-only/offline mode, disclose that a determined device owner may inspect local answer keys.

Nursing content must distinguish user-supplied source, source-derived summary, AI-added general explanation, conflicting evidence and unsupported claims. Do not fabricate source citations. A fluent model rationale is not proof of clinical correctness.

## 6. Spaced repetition and AnkiDroid interoperability

| Option | Benefits | Limitations | Position |
|---|---|---|---|
| App-owned scheduler behind interface | Integrated history and mastery; works without another app; algorithm can be versioned | Must implement and validate transitions and migrations | Recommended baseline candidate |
| AnkiDroid content-provider bridge | Sends cards to AnkiDroid on supported Android devices | Requires installation and permission; version/device behavior needs testing; doesn't automatically sync internal review history | Optional integration |
| .apkg export/import | Portable deck exchange; offline-friendly | Not continuous two-way progress sync; media/schema compatibility matters | Useful portability option |
| Embedding/reusing Anki core | Potentially closer scheduler/format behavior | Licence obligations, native complexity, maintenance and integration cost | Do not choose without legal and technical review |

The existing scheduler file identifies itself as FSRS-5 and warns that it does not reproduce exact intervals from the newer AnkiDroid engine inferred from binary strings. Do not treat it as parity. Before selecting the algorithm, document its exact version/source/license, test vectors, due-date behavior, migration policy and performance criteria. Evaluate maintained libraries against independent implementation and optional export/import.

## 7. Topic graph and media

Maintain canonical Topic/Concept records and typed relationships, potentially including prerequisite, related, contrasts-with, part-of and clinically-associated-with. Build interactive graph views from those relations, link nodes to lessons/cards/questions, and provide an Obsidian-style linked Markdown/text outline as well as a text/list alternative. Color-code relationship types consistently across folders and graph views, with an explicit legend plus text labels/icons so meaning never depends on color alone. The graph is a projection, not the sole data store.

Recommended import pipeline:
1. identify input type from content, not extension alone;
2. enforce file, page, image and processing limits;
3. extract text and retain source locations;
4. sanitize rich content and treat imports as untrusted;
5. store provenance and content hash/version;
6. let the user preview/edit before generation;
7. send the minimum relevant context to the provider;
8. surface parse errors and safe retries.

Evaluate plain text/Markdown first, then PDF and images/OCR. Avoid unnecessary permissions. For generated/retrieved images, retain source/license/attribution where applicable and provide a fallback when unavailable.

## 8. Conceptual data model

### Content and taxonomy
- **Subject:** stable ID, title, description, metadata, timestamps.
- **Module:** ID, subject link, title, ordering, status.
- **Topic:** stable ID, title, summary, optional parent topic.
- **SubjectTopicLink:** subject/module/topic IDs, ordering and learning-objective mapping.
- **ConceptRelation:** IDs of linked topics/concepts, relation type, provenance and confidence.
- **SourceDocument:** stable ID, owner, source name, media type, source hash, import state, timestamps and processing version.
- **SourceChunk:** ID, source document, text, page/heading/location and content hash.
- **ContentProvenance:** content ID/version, source chunk IDs, generation task/model metadata (never secrets), review state and timestamps.

### Learning content and assessments
- **Lesson / LessonSection:** topic, version, status, section type, structured content and source references.
- **MediaAsset:** source/owner, media type, local/remote URI, attribution/license and checksum.
- **Flashcard:** stable ID/version, topic/concept links, type, front/back or structured payload, source refs and active state.
- **Question:** stable ID/version, scope, topic links, type, prompt, options/answer schema, rationale, difficulty, source refs and validation state.
- **AssessmentBlueprint:** scope, purpose, allowed question-count range, topic coverage weights, difficulty policy and version.
- **AssessmentSession:** blueprint/version, scope, timestamps, status and randomization seed where appropriate.
- **LearningPlan / LearningPlanItem:** trigger evidence/assessment, ordered topic/activity, priority, rationale, estimated effort, status and evidence/confidence.

### Activity and adaptation
- **AnswerAttemptEvent:** stable event ID, session, exact question/version, selected response, correctness, duration, hint use, timestamp and idempotency key.
- **ReviewEvent:** stable event ID, card/version, rating, elapsed time, review timestamp, scheduler version and idempotency key.
- **SchedulerState:** card ID, algorithm/version, algorithm-specific state, due time, last review, repetitions/lapses and state version.
- **TopicEvidence:** derived projection of attempts/reviews, count, recency, difficulty and source coverage.
- **MasteryEstimate:** topic, estimate, confidence/evidence level, method version, update time and contributing event watermark.
- **TutorSession / TutorMessage:** scope, timestamps, retention policy, role/content, source references and provider/model metadata without secrets.
- **RewardEvent:** event ID, user, type, points, source event and idempotency key.
- **StreakProjection/ProfileProgress:** rebuildable derived state based on qualifying events and documented time-zone policy.
- **AIJob:** task, input content references/versions, status, attempt count, provider/model, token/cost estimates, validation results and timestamps; never raw credentials.

### Settings, synchronization and backups
- **ProviderConfig:** provider/mode/model preference and non-secret settings; credentials live in platform secure storage or server secret management.
- **SyncMetadata:** device ID, local sequence, remote watermark, schema version, last sync and conflicts.
- **BackupManifest:** format/schema versions, creation time, included categories and integrity checksum; exclude API secrets.

### Relationships
- Subjects contain Modules; Modules link to Topics.
- Topics may form parent/child links and typed cross-topic relations.
- SourceDocuments contain SourceChunks; Lessons, Questions and Flashcards refer to provenance linked to chunks.
- Assessments use versioned blueprints and store attempts against exact question versions.
- Flashcards have ReviewEvents and a current SchedulerState projection.
- Attempts/reviews contribute to TopicEvidence; a versioned mastery method derives MasteryEstimate.
- Assessments/evidence may trigger LearningPlans; RewardEvents reference qualifying events and deduplicate by key.

## 9. Service boundaries

These are logical ownership boundaries, not a mandate to create one network microservice per item.

- **ContentIngestionService:** validate input, extract text, retain source locations/hashes.
- **ContentLibraryService:** taxonomy, CRUD/search, topic relations and provenance.
- **AssessmentService:** blueprint rules, selection, session lifecycle and grading.
- **GenerationService:** provider abstraction, task prompts, schema/semantic validation and bounded retries.
- **LessonService:** lesson composition, source context and versioning.
- **TopicGraphService:** graph projection from canonical relations.
- **TutorService:** conversation context, source retrieval, provider calls and retention.
- **SchedulerService:** versioned review algorithm and due state.
- **LearningAnalyticsService:** evidence, mastery/confidence and module readiness.
- **RewardService:** deterministic, idempotent points for correct answers, topic/module quiz-score milestones, lesson/activity completion and streak milestones; duplicate events cannot pay twice.
- **Persistence/SyncService:** transactions, migrations, backup/export and conflict resolution.
- **CredentialService:** platform secure storage or backend credential boundary.
- **ObservabilityService:** safe diagnostics and cost metrics with secret redaction.

## 10. Illustrative stack-neutral service contracts

### Generate assessment
**Request:** task type, scope ID, blueprint ID/version, source references, target count, difficulty policy, weak-topic refs, recent question fingerprints and locale.  
**Response:** validated question versions, coverage report, provenance, validation warnings and non-secret generation metadata.  
**Failure:** typed error code, retryable flag, safe user message and diagnostic correlation ID. No secrets or sensitive internal prompts.

### Submit answer
**Request:** session ID, question ID/version, response, duration, optional hint use and idempotency key.  
**Response:** correctness, rationale, source references, recorded event ID and updated progress if available.  
**Invariant:** duplicate idempotency key cannot create another attempt or reward.

### Rate flashcard
**Request:** card ID/version, Again/Hard/Good/Easy rating, review time, scheduler version and idempotency key.  
**Response:** persisted ReviewEvent, next due time, updated SchedulerState and optional feedback.  
**Invariant:** replaying the same event does not advance the schedule twice.

### Create learning plan
**Request:** scope, assessment/session IDs, topic-evidence watermark and policy version.  
**Response:** ordered plan items with reasons, evidence/confidence and estimated effort.  
**Invariant:** priorities are explainable; weak evidence is not presented as certainty.

## 11. Mastery and rewards model — proposed v1 policy

The product requirements document defines learner-visible rules. This section defines the technical contract. The method below is **PROPOSED and provisional**, not empirically validated; an implementation agent may not replace it silently.

### 11.1 Canonical evidence inputs
- AttemptEvent: stable event ID, session ID, question ID/version, stable concept-family ID, canonical concept/topic IDs, response outcome, difficulty, grading-rubric version, timestamp and event status.
- ReviewEvent: stable event ID, card/content version, canonical concept/topic IDs, recall rating, scheduler version, timestamp and resulting scheduler state.
- EvidencePolicyVersion: policy ID, parameters, effective date and migration/recalculation rules.
- Diagnostic events remain available for initial adaptation but are kept separate from post-teaching mastery.
- Duplicate/replayed events, voided attempts and superseded grading events must not count twice. Preserve history and record correction/regrading as a new event rather than destructively rewriting history.

### 11.2 Proposed per-topic calculations
For each topic, maintain separate projections for raw accuracy, recency-weighted accuracy, concept coverage, evidence sufficiency, confidence label and mastery label.

For each question-version/concept-family/session tuple, select the latest valid graded attempt as the sole attempt contributing to the mastery projection; retain every attempt in the immutable history. This means repeating one item within a session cannot multiply its weight, and repeating the same concept family in many sessions still cannot satisfy the distinct-family evidence gate. For each eligible post-teaching graded attempt i, define age in days as max(0, now - event timestamp). The provisional recency weight is w_i = 2^(-ageDays / 30), a 30-day half-life. Compute recency-weighted accuracy as sum(w_i * correct_i) / sum(w_i). ReviewEvent ratings are summarized separately and provide delayed-retrieval evidence; they are not treated as binary correct/incorrect attempts.

Concept coverage is distinct required concept clusters with valid evidence divided by total mapped required concept clusters, using the versioned topic-coverage blueprint. If mapping or source quality is unresolved, coverage is incomplete and high confidence is blocked.

Use the proposed v1 evidence gates in PRODUCT_REQUIREMENTS_AND_UX.md: minimum 5 distinct concept-family IDs across 2 sessions for developing evidence; likely mastered requires 10 distinct concept-family IDs, 3 sessions, delayed retrieval at least 24 hours after initial learning, at least 80% coverage, recency-weighted performance at least 85%, and latest-session performance at least 80%. A separate confidence label depends only on evidence quantity/diversity, session count, delayed retrieval, concept coverage and source/mapping quality—not correctness. The mastery label separately applies accuracy thresholds. Sparse perfect scores remain insufficient evidence.

### 11.3 Deterministic mastery scenario fixtures and expected outputs

All fixtures use a fixed clock and a pinned MasteryPolicyVersion. For date-based examples, set as-of time to 2026-01-31T12:00:00Z. These are policy oracles, not claims of clinical validation.

| ID | Fixture input | Expected projection / oracle |
|---|---|---|
| MAST-001 — perfect but sparse | Five distinct families, all correct, one session, 100% coverage, all today | Raw and weighted accuracy 100%; evidence = Insufficient; confidence = Low; mastery != Likely mastered because the 2-session/10-family/delayed-retrieval gates fail |
| MAST-002 — repeated item | Ten correct attempts on the same question version and concept family across ten sessions; 10% topic coverage | Distinct-family count = 1; coverage = 10%; evidence = Insufficient; confidence = Low; mastery != Likely mastered; replaying an event ID has no effect |
| MAST-003 — sufficient recent evidence | Ten distinct families across three sessions in the last 10 days; all correct; 80% coverage; delayed successful review >=24 hours after initial learning; source mapping valid | Raw accuracy = 100%; recency-weighted accuracy = 100%; confidence = High; mastery = Likely mastered |
| MAST-004 — recent failures after old success | Seven distinct families correct 60 days ago (each weight 0.25), three distinct families incorrect today (each weight 1.0); three sessions; 90% coverage; valid delayed review | Weighted accuracy = 1.75 / (1.75 + 3.0) = 36.8421%; latest-session accuracy = 0%; confidence = Medium because no successful retrieval occurred in the last 30 days; mastery != Likely mastered |
| MAST-005 — broad but stale | Ten distinct families, three sessions, 100% accuracy and 100% coverage, but all successful retrieval is 60 days old | Weighted accuracy may remain 100% because all evidence is equally old; confidence = Medium due to no successful retrieval in the last 30 days; mastery = Needs refresh, not Likely mastered |
| MAST-006 — partial concept coverage | Ten distinct families, three recent sessions, all correct, delayed review valid, but only 60% of required concept clusters covered | Accuracy = 100%; confidence = Medium; mastery != Likely mastered because coverage <80%; uncovered concepts remain high-priority plan items |
| MAST-007 — source/mapping unresolved | Otherwise meets MAST-003, but one required concept mapping or answer-key provenance is unresolved | Confidence = Low; mastery label is blocked from Likely mastered; issue is surfaced for review |
| MAST-008 — duplicate replay | A committed attempt/review/reward event is submitted again with the same idempotency/event ID | Attempt count, weighted accuracy, coverage, confidence, mastery, scheduler state and reward balance remain exactly unchanged |
| MAST-009 — policy version change | Same immutable event ledger recalculated under policy v2 after a documented threshold change | v1 projection remains auditable; v2 projection is deterministic for the same input watermark; no attempt/review/reward is duplicated |
| MAST-010 — diagnostic-only success | Ten correct diagnostic answers across the scope, but no post-teaching graded attempts or review events | Diagnostic result displays 100%; post-teaching mastery = Insufficient evidence; diagnostic may influence the initial plan but cannot independently produce Likely mastered |

### 11.4 Rewards and streak contract
- Reward only unique, valid, committed learning events.
- Use an idempotency key scoped to the source event and reward-policy version; replayed events cannot mint points twice.
- Points, streaks and rank are motivational projections, not learning evidence; they never increase mastery.
- Streak-day boundaries use the learner's configured time zone. Time-zone changes must be deterministic and must not delete history.
- Repeating an already-completed activity may support practice but must not duplicate completion rewards.
- A policy update is versioned and must define whether historical rewards are preserved or recalculated.

### 11.5 Status and change control
The above thresholds and half-life are provisional defaults selected for transparency and testability, not scientifically calibrated cutoffs. Validate against the scenario fixtures, obtain learning-science review, and record any change in DECISION_LOG.md with affected projections and migration/recalculation rules. Do not present a mastery percentage as clinical competency.

## 12. Transactions, concurrency, offline and migrations

- Question assignment/session creation must avoid duplicate or missing questions.
- Persist an answer before treating its rewards/derived state as final.
- Scheduler transitions must be idempotent and recover after process death.
- Generation jobs need deduplication keys, cancellation and timeout handling.
- Refilling/dequeueing must use persistent atomic coordination; an in-memory per-user lock is not production multi-process coordination.
- Schema changes need versioned migrations, backup/restore tests and rollback/recovery behavior.
- Offline attempts merge as immutable events; derived-state conflicts are recomputed according to a documented deterministic policy.
- Timestamp and time-zone semantics must be explicit.

Specify offline boundaries before implementation. Consider reading saved lessons, local quizzes, due-card reviews and local progress offline; new AI generation, tutor requests and remote image search normally require network. A review answer must not be lost if the app closes after a rating.

## 13. Security, privacy and threat model

Assess:
- user/provider keys and extraction from compromised devices;
- untrusted imported documents, embedded instructions and malformed markup;
- data sent to AI providers and retention;
- keys or study material leaking to logs/crash reports/backups;
- remote URLs, oversized input, parser resource exhaustion and generated HTML;
- excessive requests, rate/cost abuse and provider outages;
- deletion/export across generated content, source links, backups and sync.

Required controls include credential redaction, no client-embedded platform keys, bounded inputs/retries, authenticated quotas if a backend is used, safe import handling, minimal content transmission, explicit retention settings, consistent export/deletion rules and secret-free diagnostics.

## 14. Required technical verification

- Structural and semantic schema validation rejects malformed questions and invalid answer indices.
- Pre-answer learner payloads omit all grading-key fields.
- Shuffled order/matching presentation grades against canonical IDs.
- Duplicate question detection works across batches.
- Diagnostic/pop-quiz counts and topic coverage are enforced.
- Lesson-generation/service calls reject new teaching when the selected scope lacks a completed diagnostic; interrupted sessions resume without loss or duplicate attempts.
- Attempt, review, job and reward idempotency passes under duplicate/concurrent calls.
- Queue/refill is consistent across concurrent requests and process restart.
- Scheduler transitions are deterministic under a fixed clock and documented version.
- Migrations/restores retain review/attempt history.
- Offline duplicate submissions do not double-score.
- Source references survive editing/reimport and point to real chunks.
- Secrets do not appear in API responses, logs, backups or crash metadata.
- Provider failures/cancellation preserve saved work.
- Import parsers handle malformed and oversized inputs safely.
- Device testing covers resume/background, offline recovery, low memory and permission handling when Android-first is chosen.
- Topic-graph relation colors use a stable mapping/legend and redundant text/icon cues; color is never the only explanation of a relationship.
- Correct-answer, quiz-score, completion and streak-milestone rewards have documented thresholds/values; replaying the same source event cannot award points twice.

## 15. Architecture decision gates

The following remain open; each decision needs evidence, alternatives, trade-offs, security/privacy/cost consequences and a verification/rollback plan:
- Android-only vs Android-first with future web/iOS.
- Kotlin/Compose vs React Native/Expo vs Flutter.
- Local-first vs backend vs hybrid; initial sync/auth requirements.
- Direct user key vs secure proxy vs supported hybrid.
- Supported AI providers/models and capability abstraction.
- Scheduler library/algorithm/version and migration policy.
- Optional AnkiDroid provider integration and/or .apkg import/export.
- Supported file types, PDF/image/OCR ingestion and processing location.
- Mind-map rendering approach and graph interaction requirements.
- Backup/export/deletion and sync conflict behavior.
- Analytics/telemetry defaults and privacy policy.
- Minimum Android version, performance targets and device matrix.


## 16. Master Architect's proposed baseline

This is a **PROPOSED default, not a user-approved final decision**. It makes the next planning gate actionable without pretending untested assumptions are facts.

| Area | Proposed default | Rationale and guardrail |
|---|---|---|
| Initial client | Android-first, native Kotlin + Jetpack Compose | Best fit for current Android-centred use and native offline/storage needs; reconsider if web/iOS becomes a committed initial requirement. Validate the real device/API matrix after implementation authorization. |
| Application architecture | Modular monolith with the logical services in this document | Shared learning state, grading, rewards, review scheduling and mastery need coherent transactions. Do not default to network microservices. |
| Storage | Local-first relational persistence, versioned migrations, source-file storage, append-only attempt/review events | Enables offline learning and recoverable progress. Multi-device sync remains opt-in scope, not an assumed requirement. |
| AI credential | Support the user's own provider key in platform-backed secure storage, with explicit extraction-risk disclosure and safe remove/rotate behavior | Matches the requested key setup without silently introducing a hosted service or platform bill. A compromised/instrumented client may expose a local key; never ship a platform-owned key in the client. |
| AI interface | Provider-neutral task adapter with separate policies/schemas for lesson, diagnostic, topic quiz, module test, flashcard, map and tutor | Limits provider lock-in and enforces per-task count/source/validation rules. Model IDs and APIs must be verified against the chosen provider before implementation. |
| Assessment privacy | Separate learner question payload, grading key and post-answer feedback; keep keys server-side for server-backed mode | Prevents pre-answer answer leakage. Local-only keys cannot be promised secret against a technically capable device owner. |
| Scheduler | App-owned versioned scheduler interface; select a maintained, license-compatible implementation after explicit version/test-vector review | Keeps AnkiDroid optional. The checked-in FSRS-5 reference is not evidence of exact parity with the current AnkiDroid engine. |
| Anki interop | Consider APKG import/export as portability; AnkiDroid provider bridge remains optional | Avoids requiring a separate app at runtime before device/permission behavior is verified. |
| Imports | Start with text/paste and Markdown as the smallest validated path; evaluate PDF and image/OCR as separate scope and cost decisions | Bounds parser, permission, performance and provider costs while preserving room to expand. |
| Mastery/rewards | Transparent, conservative evidence-aware mastery; separate accuracy, coverage, recency, confidence and review state; idempotent rewards | A single score cannot establish long-term learning, and duplicate requests must not mint progress. Formula remains a decision until scenario tests pass. |
| Privacy/telemetry | Minimize provider data and default to no nonessential telemetry until justified and disclosed | Study notes may be sensitive; transmit only context required by each task. Define retention, deletion, export and consent before sync/backend use. |

**Validation before any implementation authorization:** compare the native/cross-platform options against declared requirements; test storage/migrations/restore; validate provider APIs and budget/rate limits; select scheduler/version with deterministic vectors; define mastery/reward scenarios; prove diagnostic gating and answer-key isolation; test import limits and graph accessibility. Keep unresolved platform/device, provider-budget, sync and import priorities visible. No source code or technical spike is authorized by this proposal.
