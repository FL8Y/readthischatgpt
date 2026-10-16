# Data Model and Service Contracts — Nursing Study App

**Status:** Stack-neutral proposal for review. Not production schema or code.

## 1. Design invariants

1. IDs are stable and generated independently of display names.
2. Canonical concepts and source documents are not duplicated just because they appear in multiple folders.
3. Imported/generated content retains provenance and version information.
4. Attempts and reviews are append-only events; derived progress can be rebuilt.
5. An answer is graded against the exact question version the learner saw.
6. Reward issuance is idempotent.
7. Scheduler state and review history can be exported and migrated.
8. AI output is untrusted until schema and semantic validation pass.
9. Secrets are never stored in learning content, event payloads, analytics, or logs.
10. Deleted user content must be handled consistently across generated content, references, backups, and sync according to the eventual deletion policy.

## 2. Proposed entities

### Content and taxonomy
- **Subject**: id, title, description, color/tag metadata, createdAt, updatedAt.
- **Module**: id, subjectId, title, ordering, status.
- **Topic**: id, title, summary, status, optional parentTopicId.
- **SubjectTopicLink**: subject/module/topic IDs, ordering, learning objective mapping.
- **ConceptRelation**: id, fromTopicId/conceptId, toTopicId/conceptId, relationType, provenance, confidence.
- **SourceDocument**: id, userId, sourceName, mediaType, sourceHash, importStatus, createdAt, processingVersion.
- **SourceChunk**: id, sourceDocumentId, text, location/page/heading, contentHash.
- **ContentProvenance**: contentId/version, sourceChunkIds, generation task/model metadata (non-secret), review status, timestamps.

### Learning content
- **Lesson**: id, topicId, version, status, generatedAt, reviewedAt.
- **LessonSection**: id, lessonId/version, sectionType, structured content, source references.
- **MediaAsset**: id, owner/source, mediaType, URI or local reference, attribution/license metadata, checksum.
- **Flashcard**: id, canonical concept/topic links, version, cardType, front/back or structured payload, source references, active state.
- **Question**: id, version, scope, topic links, questionType, prompt, options/answer schema, rationale, difficulty, source references, validation state.
- **AssessmentBlueprint**: id, scope, purpose, min/max question count, topic coverage weights, difficulty policy, version.
- **LearningPlan**: id, scope, trigger assessment/review IDs, status, createdAt.
- **LearningPlanItem**: id, planId, topicId, priority, rationale, estimated effort, completion state.

### Activity and adaptation
- **AssessmentSession**: id, blueprintId/version, scope, startedAt, completedAt, status, randomized seed where appropriate.
- **AnswerAttemptEvent**: id, sessionId, questionId/version, selected response, correctness, response duration, hint use, timestamp, idempotencyKey.
- **ReviewEvent**: id, flashcardId/version, rating, elapsed time, review timestamp, scheduler version, idempotencyKey.
- **SchedulerState**: flashcardId, algorithm/version, stability/difficulty or algorithm-specific state, dueAt, lastReviewedAt, reps, lapses, stateVersion.
- **TopicEvidence**: derived projection from attempts/reviews with counts, recency, difficulty and source coverage.
- **MasteryEstimate**: topicId, estimate, confidence/evidence level, methodVersion, updatedAt, contributing event watermark.
- **TutorSession**: id, scope, createdAt, retention policy.
- **TutorMessage**: id, sessionId, role, content, source references, provider/model metadata without secrets, timestamp.
- **RewardEvent**: id, userId, eventType, points, sourceEventId, idempotencyKey, timestamp.
- **StreakProjection/ProfileProgress**: derived state; can be rebuilt from qualifying events and documented time-zone policy.
- **AIJob**: id, taskType, input content references/version, status, attempts, provider/model, token/cost estimates, validation outcome, timestamps; never store raw credentials.

### User settings and sync
- **ProviderConfig**: provider identifier, mode, model preference, non-secret settings; credential stored through platform-appropriate secret storage or server-side secret manager.
- **SyncMetadata**: deviceId, local sequence, remote watermark, schema version, last successful sync, conflict records.
- **BackupManifest**: format version, content schema version, creation time, included categories, integrity checksum; must not silently include API secrets.

## 3. Relationships

- A Subject contains Modules; Modules link to Topics.
- Topics may have parent/child relationships and typed cross-topic ConceptRelations.
- A SourceDocument has SourceChunks; Lessons, Questions, and Flashcards reference provenance records that point to chunks.
- Assessments use a versioned AssessmentBlueprint and contain attempts referencing exact question versions.
- Flashcards have ReviewEvents and one current SchedulerState projection.
- Attempts and review events contribute to TopicEvidence; a versioned mastery method derives MasteryEstimate.
- An assessment or new evidence may trigger a LearningPlan; plan items point to weak topics and learning activities.
- RewardEvents reference qualifying source events and are deduplicated by idempotency key.

## 4. Assessment policies

Do not hard-code a single quiz size into the generic Question/Quiz schema.

- **Diagnostic:** configurable count from 1 to 50, with a coverage plan for the selected scope.
- **Topic pop quiz:** configurable count from 1 to 5.
- **Module assessment:** count determined by a versioned blueprint and coverage needs.
- **Flashcard review:** one card per review interaction or a configured queue.

Validation must reject a generated response whose question count falls outside the policy. For large diagnostics, batch generation only if the system can preserve cross-batch coverage and deduplication.

## 5. Service boundaries (logical)

- **ContentIngestionService:** validate input, extract text, preserve locations and hashes.
- **ContentLibraryService:** CRUD/search/taxonomy/relations and provenance.
- **AssessmentService:** blueprint resolution, question selection, session lifecycle, grading.
- **GenerationService:** provider abstraction, task prompts, schema and semantic validation, bounded retry.
- **LessonService:** lesson assembly, source context and versioning.
- **TopicGraphService:** graph projection from canonical relations.
- **TutorService:** conversation context, source retrieval, provider calls, retention.
- **SchedulerService:** versioned review algorithm and next due state.
- **LearningAnalyticsService:** topic evidence, mastery/confidence and module readiness.
- **RewardService:** deterministic, idempotent points/streaks.
- **Persistence/SyncService:** transactions, migrations, backup/export, sync conflict resolution.
- **CredentialService:** platform secure storage or backend secret boundary.
- **ObservabilityService:** safe diagnostics and cost metrics with secret redaction.

These are logical boundaries, not a recommendation to deploy one network microservice per module.

## 6. Contract examples (illustrative, stack-neutral)

### Generate assessment
Request: taskType, scopeId, blueprintId/version, sourceContentRefs, targetCount, difficultyPolicy, weakTopicRefs, recentQuestionFingerprints, locale.
Response: validated question versions, coverage report, provenance, validation warnings, generation metadata.
Failure: typed error code, retryable flag, safe user message, diagnostic correlation ID. Never return secrets or internal prompts containing sensitive data.

### Submit answer
Request: sessionId, questionId/version, response payload, duration, optional hint usage, idempotencyKey.
Response: correctness, rationale, source references, recorded event ID, updated progress projection if available.
Invariant: a duplicate idempotency key cannot create a second attempt or duplicate reward.

### Rate flashcard
Request: flashcardId/version, rating Again/Hard/Good/Easy, reviewedAt, schedulerVersion, idempotencyKey.
Response: persisted ReviewEvent, nextDueAt, next SchedulerState, optional feedback.
Invariant: same event replay does not advance the schedule twice.

### Create learning plan
Request: scope, assessment/session IDs, topic evidence watermark, policy version.
Response: ordered plan items, reason for each item, evidence/confidence, estimated effort.
Invariant: each priority is explainable and does not present low-confidence inference as certainty.

## 7. Mastery model — must be specified before implementation

Do not choose an arbitrary formula without documenting why. The planning stage must compare at least:
- simple recency-weighted topic accuracy;
- item-response/difficulty-aware estimates;
- a conservative evidence-count/confidence layer.

The first version should be transparent and testable. Report separately:
- observed accuracy;
- number and recency of attempts;
- question difficulty/coverage;
- review performance;
- estimated mastery;
- confidence/evidence sufficiency.

Do not claim clinical competence from quiz scores. A topic with few questions should remain “insufficient evidence” even if all answers were correct.

## 8. Transactions, concurrency and migrations

- Session creation and question assignment must be atomic enough to avoid duplicate or missing questions.
- Answer persistence must complete before rewards or derived state are shown as final.
- Scheduler updates must be idempotent and recoverable after process death.
- Generation jobs require deduplication keys and cancellation/timeout handling.
- Schema changes require migrations, version compatibility tests, backup/restore tests, and a rollback/recovery strategy.
- Offline attempts should merge as immutable events; conflicts in derived state are resolved by recomputation using a documented ordering policy.
- All timestamp semantics and time-zone behavior must be explicit.

## 9. Required contract tests

- Invalid schema and invalid answer indices rejected.
- Duplicate question prompts detected across batches.
- Topic coverage and count constraints enforced.
- Attempt and reward idempotency.
- Scheduler determinism under fixed clock and ratings.
- Migration/restore retains event history.
- Offline duplicate submissions do not double-score.
- Source references remain valid after edits or document re-import.
- Generated citations must point to real stored source chunks.
- Secrets are absent from API responses, logs, backups, and crash metadata.
