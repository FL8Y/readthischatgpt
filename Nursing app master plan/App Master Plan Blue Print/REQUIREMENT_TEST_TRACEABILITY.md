# Requirement → Contract → Test Traceability

**Phase:** Planning only. This document defines future verification; it does not claim any application tests have passed.
**Authority:** PRODUCT_REQUIREMENTS_AND_UX.md owns learner-visible behavior; TECHNICAL_ARCHITECTURE_AND_CONTRACTS.md owns technical contracts; DECISION_LOG.md owns proposed defaults and change control.
**Rule:** Every R-ID maps to a canonical requirement, technical boundary, responsible role and deterministic test oracle. Test IDs below are planned identifiers, not existing test files.

| Requirement | Canonical requirement | Contract / data boundary | Accountable role | Planned test ID(s) and pass oracle |
|---|---|---|---|---|
| R-001 | Import personal study material | Import pipeline, SourceDocument, SourceChunk, provenance | Ingestion Architect | IMP-001/002: supported fixture imports with stable source offsets; malformed/oversized input fails safely and preserves prior data |
| R-002 | Subject/module/topic/subtopic hierarchy | Subject, Module, Topic, canonical IDs, repository transaction | Data Architect | TAX-001/002: create/move/reopen hierarchy; links and source mappings remain intact after migration/restart |
| R-003 | Cross-folder related concepts and color coding | ConceptRelation/TopicRelation and relation legend | UX + Data Architect | GRAPH-001: one canonical concept linked in multiple folders without duplication; relation meaning remains clear without color |
| R-004 | Diagnostic before new teaching | DiagnosticSession, AssessmentPolicy, LessonUnlockPolicy | Assessment Architect | DIA-001/002/003: count bounds 1–50; new lesson denied before durable completion; interruption resumes same session and does not duplicate attempts |
| R-005 | Strength/weakness identification | AttemptEvent, TopicEvidence, diagnostic projection | Learning Scientist | EVD-001: fixed attempt fixture yields expected topic-level accuracy, coverage and evidence label; diagnostic is separate from post-teaching mastery |
| R-006 | Ordered targeted learning plan | LearningPlanItem, RankingPolicyVersion | Adaptive Learning Architect | PLAN-001/002: fixed evidence produces stable ordered items and explicit reasons; same input/policy gives identical order |
| R-007 | Clickable topic lessons | Topic, LessonVersion, LessonProgress | Lesson Architect | LES-001: opening/reopening topic restores progress and source links point to the correct version |
| R-008 | Visual aids and pictures | VisualAsset, attribution/provenance, loading state | Content/Media Architect | MED-001/002: every asset has attribution/source status; unavailable asset yields accessible fallback and does not block lesson |
| R-009 | Mnemonics and memory techniques | LessonSection schema and clinical-claim provenance | Nursing Content Reviewer | LES-002: mnemonic has explanation/limitations; unsupported clinical claim is flagged rather than presented as source-derived |
| R-010 | Mind map plus linked outline | TopicGraph, ConceptRelation, graph/list projections | Graph/Accessibility Architect | GRAPH-002/003: graph and text outline represent identical canonical edges; keyboard/screen-reader navigation reaches each linked topic |
| R-011 | Detailed AI explanations | Lesson/Tutor generation contract and SourceContext | AI Content Architect | AI-LESS-001: schema-valid output with real source links or explicit AI-added/needs-review label; fabricated citation is rejected |
| R-012 | 1–5 question topic quiz | TopicQuiz policy and versioned QuestionSet | Assessment Architect | QUIZ-001/002: counts 1 and 5 pass; 0 and 6 reject; invalid provider count is corrected by bounded regeneration or surfaced as failure |
| R-013 | Instant feedback and wrong-answer rationale | GradingKey, AnswerEvaluation, FeedbackPayload | Assessment Architect | GRADE-001/002: rationale matches exact question/rubric version; shuffled ordering/matching grades by canonical IDs; server-backed pre-answer payload omits keys |
| R-014 | Comprehensive module quiz | ModuleAssessment and versioned coverage blueprint | Assessment Architect | MOD-001: generated assessment meets declared topic/difficulty coverage or returns an explicit insufficiency state |
| R-015 | Targeted topics after module assessment | RemediationPlan and TopicEvidence | Learning Scientist | REM-001: weak/uncovered concepts rank ahead of adequately evidenced topics; every recommendation states why |
| R-016 | Repeat adaptive learning cycle | Evidence watermark and versioned LearningPlan | Adaptive Learning Architect | PLAN-003: new attempts change the plan only according to policy; prior plan and evidence snapshot remain auditable |
| R-017 | Points for answers, scores, completion and streak milestones | RewardEvent, reward policy version, idempotency key | Progress/Rewards Architect | REW-001/002: each eligible unique event earns the defined reward once; replay/duplicate submission earns no additional points |
| R-018 | Streaks and levels/ranks | Streak projection, configured timezone, profile progress | Progress/Rewards Architect | REW-003/004: day-boundary fixtures cover midnight/time-zone changes; losing streak never deletes history |
| R-019 | Progress dashboard | Progress projection, due queue, mastery/confidence and next action | UX + Learning Architect | DASH-001: dashboard values reconcile exactly to fixed event fixtures and display next action, due reviews, confidence and recency |
| R-020 | Tutor discussion mode | TutorSession, TutorMessage, SourceContext | AI Platform Architect | TUTOR-001/002: follow-up retains selected context; missing source support is disclosed; cancel/retry does not duplicate messages |
| R-021 | First-launch provider key for every AI feature | ProviderConfig, task-specific provider adapter | AI Platform Architect | KEY-001/002: configured provider is used for every listed AI task; missing/invalid/rotated key states are explicit and recoverable |
| R-022 | Credential handling | CredentialStore boundary and redacted diagnostics | Platform Architect | KEY-003: key absent from logs, backups, crash metadata and exported data; removal/rotation invalidates old configuration |
| R-023 | Graceful provider/network failures | Typed ProviderError, RetryPolicy, saved-work boundary | AI Platform Architect | NET-001/002: timeout/auth/quota/malformed/offline/cancel cases preserve committed work and stop after bounded retries |
| R-024 | Flashcards generated from topics | Flashcard, SourceRelation, CardVersion | Learning Content Architect | CARD-001: generated card links to canonical topic and source; user edit/dismiss preserves audit trail and never silently changes prior review |
| R-025 | Spaced review depends on recall/weakness | ReviewEvent, SchedulerState, scheduler version | SRS Architect | SRS-001/002: fixed clock/rating vectors yield exact due dates/state transitions; scheduler version is persisted |
| R-026 | Weak cards recur sooner | Scheduler policy and lapse/relearning state | SRS Architect | SRS-003: controlled Again/Hard/Good/Easy fixtures show configured relearning/interval ordering for selected implementation |
| R-027 | Persist learning history | Append-only AttemptEvent/ReviewEvent and migrations | Data Architect | DATA-001/002: restart, process death and migration preserve events and derived projections without duplication |
| R-028 | Privacy, export and recovery | ExportManifest, schema version, restore transaction | Data Architect | BACKUP-001/002: export-import round trip preserves content/source links/history; corrupted backup fails without damaging live data |
| R-029 | Mobile accessibility and usability | Design tokens, semantic UI states, graph alternatives | Accessibility Reviewer | A11Y-001/002: contrast/text-scale/focus/screen-reader/touch-target checks pass; no critical state depends only on color |
| R-030 | Clinical-content reliability | Source provenance, review status, content version | Nursing Content Reviewer | CLIN-001/002: unsupported/contradictory claim cannot be labelled source-grounded; flagging/review retires or versions unsafe content |
| R-031 | AI cost/rate control | UsageBudget, RequestPolicy, cache and cancellation | AI Platform Architect | COST-001/002: rate/budget limits halt new calls predictably; cancellation and cache behavior produce no hidden duplicate request |
| R-032 | Testability and evidence | Test receipts, commit/environment metadata, CI gates | QA Lead | QA-001: every critical flow has test ID, fixture, oracle and owner; receipt records exact command/runtime/commit/result |
| R-033 | Explainable evidence-aware mastery | MasteryPolicyVersion, TopicEvidence, MasteryEstimate | Learning Scientist + Data Architect | MAST-001 through MAST-010: all ten named scenarios produce expected evidence/confidence/mastery labels; duplicate events do not alter projections |
| R-034 | Deterministic adaptive-plan ordering | RankingPolicyVersion, LearningPlanItem | Adaptive Learning Architect | PLAN-004/005: same evidence produces same order; prerequisites/uncovered concepts/low evidence precede stronger topics; AI cannot override eligibility |

## Cross-cutting contract invariants

1. **Stable identity:** Questions, concept families, sources, cards, attempts, reviews, plans and policies have stable IDs and versions.
2. **No silent policy changes:** Any change to grading, mastery, ranking, reward or scheduler policy increments a version and defines historical recalculation/migration behavior.
3. **Event idempotency:** Retrying a committed request cannot create another attempt, review, reward, or generation job.
4. **Durable gating:** A new lesson cannot unlock until its selected scope's diagnostic is complete and persisted.
5. **Source truth:** Every source-grounded claim points to an actual source location; unsupported content is labelled rather than cited falsely.
6. **Determinism:** Fixed clock + fixed event fixtures + fixed policy version must yield the same projections, due dates and plan order.
7. **Failure preservation:** Cancellation, timeout, process death, malformed AI output and offline transitions never discard already committed learning events.
8. **Accessibility parity:** Graph and visual state have text/semantic alternatives; the alternatives convey the same underlying content.
9. **No implementation claim:** Planned test IDs are not existing tests. They become passing evidence only when an implementation, fixture, command and result are recorded after separate authorization.

## Acceptance of this traceability document

This file is complete as a planning map only when each R-ID has an agreed owner, contract boundary and test oracle. It does not mean the application is implemented or verified. QA must keep this table synchronized with the canonical requirements and technical contracts at every planning revision.
