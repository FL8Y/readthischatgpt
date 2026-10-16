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

Maintain canonical Topic/Concept records and typed relationships, potentially including prerequisite, related, contrasts-with, part-of and clinically-associated-with. Build interactive graph views from those relations, link nodes to lessons/cards/questions, and provide a text/list alternative. The graph is a projection, not the sole data store.

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
- **RewardService:** deterministic, idempotent points and streaks.
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

## 11. Mastery and rewards model — decision required

Do not adopt an arbitrary formula without documenting why. Compare:
- simple recency-weighted topic accuracy;
- item/difficulty-aware estimates;
- a conservative evidence-count/confidence layer.

The first version should be transparent and testable. Report accuracy, number/recency of attempts, question difficulty/coverage, review performance, estimated mastery and confidence separately. Sparse evidence remains “insufficient evidence” even when every answer is correct.

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
