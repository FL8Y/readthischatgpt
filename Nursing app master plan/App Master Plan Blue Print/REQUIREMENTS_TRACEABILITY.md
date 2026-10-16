# Requirements Traceability — Nursing Study App

**Status:** Initial draft; requirements extracted from the user's specification and mapped to proposed modules.  
**Rule:** "Planned" is not "implemented". No application code is authorized in the current phase.

| ID | Requirement | Proposed module / data | Acceptance evidence | Dependencies | Status |
|---|---|---|---|---|---|
| R-001 | Import personal study material | Ingestion, SourceDocument, ContentChunk, provenance | Supported fixture files import; extracted text/source location retained; failures recover cleanly | Import formats, storage | Planned |
| R-002 | Arrange material by subject/module/topic/subtopic | Content Library, Subject, Module, Topic | Create, move, search, nest, and reopen hierarchy without losing links | Data model, UX | Planned |
| R-003 | Link related concepts across folders | ConceptLink / TopicRelation | One concept can be linked in multiple topics without duplicate canonical content | Canonical identity | Planned |
| R-004 | Diagnostic exam before teaching selected scope | Assessment Engine, DiagnosticSession | A 1–50 question diagnostic must be completed for the selected subject/module before the app begins teaching its topics; persist interruption/resume state and show topic-level results | Assessment policy, question bank | Planned |
| R-005 | Identify strengths and weaknesses | Attempt ledger, TopicEvidence, MasteryEstimate | Results show topic-level performance and confidence; sparse data is labelled uncertain | Event model, learning spec | Planned |
| R-006 | AI creates ordered targeted learning plan | Adaptive Plan Engine, LearningPlanItem | Given a fixed attempt fixture, output plan is reproducible within documented rules and ordered by priority | Mastery model, AI contract | Planned |
| R-007 | Clickable topic lessons | Lesson module, Topic, LessonVersion | Every generated topic opens a lesson with preserved progress and source links | Content model, navigation | Planned |
| R-008 | Visual aids and pictures | Media / VisualAsset | Lesson displays available media, source/attribution, loading and unavailable states | Media sourcing, safety | Planned |
| R-009 | Mnemonics and memory techniques | Lesson section schema | Lesson can show mnemonic, rationale, and limitations; no unsupported clinical claims | Generation schema, review | Planned |
| R-010 | Topic mind map and cross-topic connections | TopicGraph, ConceptLink, graph projection | Graph renders known relations, navigates to topic, and works with keyboard/screen reader alternatives | Content relations, UI | Planned |
| R-011 | Detailed AI explanations | Lesson and Tutor service | Output follows schema, links sources, and handles unsupported questions honestly | Provider strategy, grounding | Planned |
| R-012 | 1–5 question topic pop quiz | Assessment policy / TopicQuiz | Configured quiz count 1–5 is enforced by service and UI; feedback appears after each answer | Question schema | Planned |
| R-013 | Instant feedback and wrong-answer rationale | AnswerEvaluation, Rationale | Correctness and rationale are tied to the versioned question; unsupported rationale flagged; learner payload contains no answer key before submission; ordering/matching grading survives presentation shuffle | Valid question key, source grounding, answer-key boundary | Planned |
| R-014 | Comprehensive module quiz | ModuleAssessment | Assessment covers configured topic blueprint and reports coverage, score, and weak areas | Taxonomy, assessment blueprint | Planned |
| R-015 | Targeted new topics after module assessment | RemediationPlan | Weak topics produce prioritized review/lesson tasks without repeating mastered material unnecessarily | Mastery model | Planned |
| R-016 | Repeat learning cycle | Adaptive Plan Engine | Completing remediation triggers updated plan using new evidence, not a blind reset | Event ledger | Planned |
| R-017 | Points for correct answers and completions | Rewards service / RewardEvent | Deterministic reward rules; retries do not award duplicate points | Idempotency | Planned |
| R-018 | Streaks, levels/ranks | Streak, ProfileProgress | Time-zone boundary, missed day, restore, and duplicate event tests pass | Date/time policy, persistence | Planned |
| R-019 | Dashboard and per-topic mastery | Progress projection | Dashboard reconciles with attempt/review event fixtures and displays confidence/recency | Mastery formula | Planned |
| R-020 | Tutor discussion mode | TutorSession, TutorMessage, SourceContext | Follow-ups retain intended context; source-grounded answers expose relevant references when available | Provider, privacy | Planned |
| R-021 | First-launch AI key setup | Credential Settings | First-run setup supports valid/missing/invalid key states and key rotation/removal | Provider design | Planned |
| R-022 | Local secure credential storage | Credential boundary | No keys in logs, backups, crash reports, or source; threat model documents extraction limits | Platform choice | Planned |
| R-023 | Provider/network errors handled gracefully | Provider Adapter, RetryPolicy | Tests cover timeout, rate limit, auth error, malformed output, no network, exhausted retries, and secret redaction | AI contracts | Planned |
| R-024 | Flashcards generated from topics | Card Generator, Flashcard | Cards preserve source/topic linkage and are editable or suppressible by user | Content schema | Planned |
| R-025 | Spaced review depends on recall and weaknesses | Scheduler, ReviewEvent, CardState | Fixed time/rating fixtures yield deterministic due dates; Again/Hard/Good/Easy behaviors documented | Scheduler choice | Planned |
| R-026 | Weak cards reviewed more often | Scheduling policy | Incorrect/relearning cards enter shorter review intervals per chosen algorithm | Scheduler policy | Planned |
| R-027 | Persist learning history | AttemptEvent, ReviewEvent, migrations | App restart and backup restore preserve attempts, scheduler state, and progress | Storage choice | Planned |
| R-028 | Privacy, export, and recovery | Backup/Export, privacy settings | Export/import round-trip tests, deletion behavior, and secret redaction pass | Storage and security | Planned |
| R-029 | Mobile accessibility and usability | Design system, screen states | Contrast, dynamic text, touch targets, semantic labels, screen reader and error states verified | Platform, UX | Planned |
| R-030 | Clinical-content reliability | Source provenance, content review state | Unsupported facts are not attributed to sources; conflicting sources are flagged; educational limitation is visible | Grounding/review workflow | Planned |
| R-031 | Cost/rate control for AI | AI usage policy | Limits, retries, generation cache, cancellation, and spend telemetry (without secrets) tested | Provider strategy | Planned |
| R-032 | Testability and evidence | QA / CI / audit receipts | Each feature has unit/integration/device criteria and exact test receipts; concurrent generation/refill is idempotent; attempt/reward events cannot duplicate | Stack and CI | Planned |

## Cross-cutting invariants

1. Generated content has stable IDs and a versioned schema.
2. Every attempt references the exact question/content version answered.
3. Reward events are idempotent.
4. Review events preserve the user's rating and review timestamp.
5. Mastery estimates include evidence volume and confidence, not only a percentage.
6. AI outputs cannot bypass validation.
7. Imported content is untrusted input and cannot override system instructions.
8. Source provenance must not be fabricated.
9. No API credential is included in app binaries or logs.
10. Data migrations and backup restore preserve history or fail safely.
11. User deletion and export must cover generated content and associated history according to a documented policy.
12. No item is marked implemented/verified without evidence.

## Requirements still needing specification

- Exact supported import formats and size limits.
- Diagnostic question-count default and whether users can skip/retest.
- Question types for diagnostics, pop quizzes, and module tests.
- Topic mastery formula and confidence thresholds.
- Rewards and anti-farming rules.
- Clinical source policy and when human review is required.
- Offline and multi-device sync expectations.
- API provider list, key strategy, and cost ceilings.
- Target Android/API levels and minimum-device performance.
