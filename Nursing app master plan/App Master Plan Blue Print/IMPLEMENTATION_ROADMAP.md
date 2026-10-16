# Implementation Roadmap — Nursing Study App

**Current gate:** Stage 0 / Stage 1 planning. **Do not begin application implementation yet.**

## Stage 0 — Source and requirement audit
**Goal:** Know what evidence exists and what is missing.
- Re-scan the Git tree and verify paths/counts.
- Read/extract both complete research DOCX reports and appendices.
- Inspect relevant research code and run isolated tests if the environment supports it.
- Verify archive status without assuming incomplete uploads are complete.
- Finalize requirement traceability and evidence ledger.

**Exit gate:** Auditable source inventory; every user requirement captured; all limitations visible.

## Stage 1 — Architecture decisions
**Goal:** Select a coherent stack and deployment/data strategy.
- Compare Android-first vs cross-platform stack.
- Decide local-first/backend/hybrid requirements.
- Choose provider-key strategy and privacy boundary.
- Select scheduler strategy/version and interoperability plan.
- Define ingestion scope, graph model, backup/export, and sync behavior.
- Record each choice in DECISION_LOG.md with alternatives and validation tests.

**Exit gate:** No unresolved decision blocks a minimal vertical slice; all important trade-offs documented.

## Stage 2 — UX, learning, and contracts
**Goal:** Specify behavior before coding.
- Finalize primary user journeys and screen states.
- Define canonical content taxonomy and provenance.
- Define question types and assessment-specific count policies.
- Define mastery/confidence and reward rules.
- Define service contracts, error types, idempotency, schema versions, migrations, and privacy behavior.
- Create traceability from each requirement to implementation tasks and tests.

**Exit gate:** Data/API contracts are consistent; accessibility and clinical safeguards have acceptance tests.

## Stage 3 — Technical validation spikes (only after planning authorization)
**Goal:** Test high-risk assumptions with minimal disposable code.
Possible spikes: native storage performance, provider authentication flow, document extraction, scheduler library comparison, graph rendering, and offline event replay.
- Isolate spike branches/worktrees.
- Do not turn a spike into an unreviewed product subsystem.
- Capture exact environment, commit, commands, measurements, and limitations.
- Delete or archive spikes only after results are documented and user-approved policy allows it.

**Exit gate:** Highest-risk stack and integration choices have measured evidence.

## Stage 4 — Implementation planning
**Goal:** Convert architecture into small, dependency-ordered tasks.
- Establish repository/app structure only after stack approval.
- Create epics and atomic tasks with file ownership.
- Assign one writer per worktree/file set.
- Define test fixtures and quality gates before feature implementation.
- Plan migrations and rollback for every persistence change.

**Exit gate:** Every task has acceptance criteria, dependencies, owner, tests, and integration path.

## Stage 5 — Incremental implementation (separate authorization required)
Suggested dependency order:
1. Project foundation, CI, app shell, design tokens.
2. Persistence, schema migrations, source provenance.
3. Taxonomy/library and import preview.
4. Question/card schemas and grading engine.
5. Assessment sessions and durable attempt events.
6. Scheduler and review queue.
7. Mastery evidence and learning-plan engine.
8. AI provider abstraction, key configuration, validation and limits.
9. Lesson generation and topic quizzes.
10. Diagnostic generation and module assessments.
11. Tutor context/retrieval.
12. Topic graph/mind-map view.
13. Rewards and progress dashboard.
14. Backup/export/import and optional sync.
15. Accessibility, performance, security, and clinical-content hardening.

This order is provisional; adjust it based on selected architecture and dependency evidence.

## Stage 6 — Verification and release
- Unit, property, integration, migration, and end-to-end tests.
- Device tests across the agreed Android/API matrix.
- Offline/restart/background recovery.
- Accessibility and screen-reader review.
- Security/privacy review and secret scan.
- AI cost/rate-limit/failure testing.
- Nursing-content source/provenance review.
- Export/import/restore validation.
- Reproducible build and release receipts.

**Release gate:** No severity-1 security, data-loss, or clinical-content defects; all critical flows have verifiable evidence; known limitations are documented.

## Continuous review loop

For every bounded implementation batch:
1. Define acceptance criteria.
2. Assign explicit file ownership and dependencies.
3. Implement the smallest coherent slice.
4. Run focused tests.
5. Run regression tests.
6. Conduct independent developer, UX, nursing-learning, security, and QA review.
7. Fix findings and rerun affected tests.
8. Verify final diff and repository state.
9. Record commit/test evidence and remaining risks.
10. Proceed only when the batch gate is satisfied.

Do not use an arbitrary “10/10” score as a substitute for evidence. Any score must link to observable acceptance criteria and test results.
