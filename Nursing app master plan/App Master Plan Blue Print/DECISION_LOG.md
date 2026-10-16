# Decision Log — Nursing Study App

This file records confirmed project constraints, provisional architecture decisions, and unresolved decisions. Do not silently promote a proposal to a user-approved decision.

## Confirmed constraints

### DEC-001 — Original nursing study product
- **Status:** Confirmed product direction
- **Decision:** Plan one original nursing education application combining adaptive AI learning and spaced repetition.
- **Reason:** User's product specification.
- **Boundary:** Reference apps are sources of inspiration and evidence, not a license to copy proprietary implementation or assets.

### DEC-002 — Repository reference relationships
- **Status:** Confirmed by user
- **Decision:** App 1 and App 3 are related to the same reference-app line; App 2 is a different app/reference.
- **Consequence:** Keep the research folders distinct during planning and preserve all assets. Do not merge or delete material as part of this architecture task.
- **Correction required:** Existing README wording that describes App 3 as separate and App 1/App 2 as a possible pair is stale relative to the user's latest clarification.

### DEC-003 — This stage is planning only
- **Status:** Confirmed by user
- **Decision:** This workspace is the architect's planning and Claude-agent prompt workspace. Do not build the application during the source-audit and architecture stage.
- **Acceptance:** Only planning documentation and prompt artifacts are created in the blueprint folder until a separate implementation-stage authorization.

### DEC-004 — Evidence honesty
- **Status:** Confirmed operating rule
- **Decision:** Separate observed source facts, inferences, proposals, and unknowns. Never claim files were read, tests passed, archives transferred, or features verified without evidence.

## Provisional architecture proposals

### ADR-001 — One canonical content model
- **Status:** Proposed
- **Decision:** Store canonical concepts/questions/cards once and link them to subjects/topics through relationships.
- **Benefits:** Avoid duplicated material and keep cross-subject connections coherent.
- **Risks:** More careful relationship and search design required.
- **Validation:** Prototype the model on overlapping nursing concepts; test search, move/copy, import deduplication, and topic links.

### ADR-002 — Record attempts and reviews as events
- **Status:** Proposed
- **Decision:** Preserve answer attempts and review events; calculate mastery and progress from event history rather than storing only the latest score.
- **Benefits:** Supports trend analysis, adaptation, auditability, and scheduler recovery.
- **Risks:** More storage and migration complexity.
- **Validation:** Test repeated attempts, offline duplicates, correction/regrading, restore, and schema migration.

### ADR-003 — Structured AI generation
- **Status:** Proposed
- **Decision:** AI outputs must pass schema and semantic validation, source-grounding checks, duplicate checks, and bounded retry/error handling before being shown as valid learning content.
- **Benefits:** Reduces malformed or unsupported quiz content.
- **Risks:** Validation cannot guarantee clinical correctness.
- **Validation:** Adversarial malformed outputs, source contradictions, unsupported facts, duplicate prompts, invalid answer keys, timeout, rate limits, and provider failure.

### ADR-004 — Scheduler is an explicit module
- **Status:** Proposed
- **Decision:** Keep scheduler logic behind a versioned interface and preserve review history. Treat the existing FSRS-5 file as a reference implementation, not confirmed parity with current AnkiDroid.
- **Alternatives:** Use a maintained FSRS library, implement a validated scheduler, or export to AnkiDroid.
- **Validation:** Golden test cases, deterministic time control, scheduler migration, and comparison against a known implementation/version.

### ADR-005 — Provider credentials require a documented threat model
- **Status:** Proposed
- **Decision:** Compare on-device user keys, server proxy, and hybrid. Never hard-code secrets into the app bundle. Explain to the user that local encryption does not make a client-side key impossible to extract.
- **Validation:** Inspect logs/crash reports/backups, threat-model device compromise, test key removal/rotation, and verify no secret reaches source control.

### ADR-006 — Optional AnkiDroid interoperability
- **Status:** Proposed
- **Decision:** Do not make AnkiDroid installation or its provider a core runtime dependency unless research shows a compelling reason. Evaluate export/import and optional provider integration as separate options.
- **Validation:** Device tests on supported Android versions and graceful behavior when AnkiDroid is absent or permission is denied.

## Open decisions

### OPEN-001 — Target platform and minimum Android version
Need: user goal and distribution constraints; compare Android-only versus cross-platform.
Owner: Master Architect.
Gate: architecture options report.

### OPEN-002 — Technology stack
Need: platform requirements, performance, native integrations, developer workflow, build/release requirements.
Owner: Master Architect with mobile engineer.
Gate: scored comparison with evidence.

### OPEN-003 — Persistence, backend, authentication, and sync
Need: offline scope, multi-device expectations, privacy, costs, conflict handling.
Owner: Data Architect + Security Analyst.
Gate: data contract and threat model.

### OPEN-004 — API-key strategy and provider support
Need: security/cost trade-offs and whether a backend is acceptable.
Owner: Security/AI Platform Analyst.
Gate: documented default plus failure-mode tests.

### OPEN-005 — Spaced repetition engine/version
Need: accuracy expectations, library maintenance, license compatibility, portability.
Owner: AnkiDroid Analyst.
Gate: implementation options with test plan.

### OPEN-006 — Import formats and visual generation
Need: priority formats, OCR needs, offline behavior, image provenance, cost controls.
Owner: Product/UX Architect.
Gate: ingestion matrix.

### OPEN-007 — Mastery and reward formulas
Need: how topic mastery, confidence, module readiness, points, and streaks should be calculated.
Owner: Learning Scientist.
Gate: formulas, sample scenarios, and acceptance tests.

### OPEN-008 — Backup, export, and deletion
Need: user ownership, recovery, portability, privacy.
Owner: Data Architect + Security Analyst.
Gate: lifecycle and migration spec.

## Change template

For every new major decision, record:
- ID / date / status
- evidence and exact source
- decision and rationale
- alternatives and trade-offs
- security/privacy/cost consequences
- impacted documents and agent tasks
- verification and rollback plan
