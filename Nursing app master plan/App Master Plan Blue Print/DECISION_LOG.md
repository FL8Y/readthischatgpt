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
- **Verification:** The current parent and blueprint READMEs now state that App 1 and App 3 are related and App 2 is distinct. Historical stale wording remains only in dated review history where it is explicitly recorded as a past issue.

### DEC-003 — This stage is planning only
- **Status:** Confirmed by user
- **Decision:** This workspace is the architect's planning and Claude-agent prompt workspace. Do not build the application during the source-audit and architecture stage.
- **Acceptance:** Only planning documentation and prompt artifacts are created in the blueprint folder until a separate implementation-stage authorization.

### DEC-004 — Evidence honesty
- **Status:** Confirmed operating rule
- **Decision:** Separate observed source facts, inferences, proposals, and unknowns. Never claim files were read, tests passed, archives transferred, or features verified without evidence.

### DEC-005 — Implementation authorized; personal-use, Expo, local-first (2026-10-16)
- **Status:** Confirmed by user in chat (supersedes the planning-only gate of DEC-003 for the app source tree only).
- **Evidence:** User messages in session 2026-10-16: "ill tell you the plan first" followed by the 10-point feature plan; "so heres the plan... its in this repo, everybit of it"; "you have free will of everything... you dont have to ask permission just do your job"; "its for personal use. security isn't the matter"; "i want it to be a gizmo clean app".
- **Decision:** Build the app in `FLY8 Study/` (outside this planning folder). Stack: Expo / React Native + TypeScript, Android first, local-first with no backend, user-pasted provider key (OpenAI or Anthropic) stored on device. This overrides the recommended defaults in OPEN-001..OPEN-004 (Kotlin/Compose, secure storage threat model) for v1 because the app is single-user personal use; the user explicitly de-scoped key-extraction defenses.
- **Still kept (cheap, high value):** no key in logs/exports (R-022 minimum), source provenance on every imported chunk (R-001, R-030), mandatory diagnostic gate (R-004), deterministic scoring/rewards (R-017, R-033).
- **Added requirement from user:** notes import must cope with unreadable/low-quality material (OCR), verify it, and attach a source; notes are stored as a linked Markdown vault (`[[wikilinks]]`, Obsidian-compatible) that also drives the mind-map graph (R-010).
- **Alternatives:** Kotlin/Compose (better native feel, slower iteration); rejected for v1 by speed-of-change priority. Revisit if Expo limits appear.
- **Scope notes (added after re-reading MASTER_ARCHITECT_PLAN and CLAUDE_MASTER_PROMPT):** The planning-phase prompt forbids editing root `CLAUDE.md` and `.claude*`. The owner asked in chat for a durable read-first goal that is reloaded every session, so a "PROJECT GOAL" section was added to root `CLAUDE.md` (user's latest direction outranks the planning prompt per the source-of-truth hierarchy). The app folder is `FLY8 Study/` (renamed from `apps/nursing-study-app/`). Stages 1-3 (stack comparison, spikes, task breakdown) were collapsed by the owner's direction; the open items in OPEN-001..OPEN-011 that matter for v1 are settled here, the rest stay open.
- **Rollback:** The app tree is self-contained; deleting `FLY8 Study/` restores the planning-only state.

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

### ADR-007 — Proposed default architecture baseline (not user-approved)

- **Status:** Proposed; requires validation and a later implementation-stage authorization.
- **Decision:** Use the provisional baseline in `TECHNICAL_ARCHITECTURE_AND_CONTRACTS.md`: Android-first Kotlin/Jetpack Compose; modular monolith with explicit logical boundaries; local-first relational persistence with versioned migrations and append-only attempts/review events; offline-capable reading/review/progress; user-supplied provider key stored in platform-backed secure storage with clear extraction limits; a provider-neutral AI adapter; an app-owned scheduler interface backed by a maintained, license-compatible scheduler/version selected only after test-vector review; APKG portability as a candidate and AnkiDroid provider integration optional; text/paste and Markdown as the simplest initial ingestion path while PDF/OCR scope is costed separately.
- **Reason:** This is the most conservative fit for Android-centred usage, durable offline study, transparent data ownership and avoiding an unrequested hosted backend. The existing Gizmo and AnkiDroid research informs requirements but does not dictate the product's stack.
- **Alternatives:** React Native/Expo or Flutter if a committed cross-platform requirement changes the trade-off; hosted/hybrid backend if multi-device sync or server-side key handling becomes necessary; direct AnkiDroid provider integration if later device validation proves sufficient value over package exchange.
- **Trade-offs / risks:** Native Android may increase future cross-platform effort; local user keys remain extractable in principle; local-only storage needs backup/recovery; scheduler and mastery behavior require exact-version tests; OCR/visual generation can increase latency and provider cost.
- **Validation:** Compare platform options against a declared device/API matrix; run store/restore/migration and interrupted-write tests; test secret redaction and key removal; confirm provider model/API support before implementation; run deterministic scheduler vectors; test assessment payloads and answer-key isolation; evaluate import limits and graph accessibility.
- **Rollback / change control:** No code has been authorized. If validation invalidates this proposal, record new evidence, alternatives and impacted documents before implementation; do not quietly promote this recommendation to a confirmed requirement.

## Open decisions and recommended defaults

These are **architect recommendations**, not user-approved commitments. They make the plan implementation-ready while preserving a clear override point before the implementation gate. Each default must be revisited only when new evidence or a changed product requirement justifies it.

### OPEN-001 — Target platform and minimum Android version
- **Recommended default:** Android-first, native Android client; do not promise web/iOS in the first release.
- **Why:** The current user context and reference artifacts are Android-centred, and offline review/background behavior benefits from native platform control.
- **Still required:** Define the supported Android/API device matrix before implementation. Do not infer the minimum version from the Gizmo report; its report conflicts internally (main identity section says minSdk 34; Addendum C says minSdk 26 citing apktool.yml). The original apktool.yml is not present in the repository, so the reference minimum remains UNKNOWN.
- **Owner / gate:** Master Architect; record the chosen app minimum and tested device matrix before implementation.

### OPEN-002 — Technology stack
- **Recommended default:** Kotlin + Jetpack Compose, organized as a modular monolith with explicit logical service boundaries.
- **Why:** Native Android access, local persistence, accessibility and offline lifecycle control outweigh a future cross-platform option that has not been requested.
- **Alternative trigger:** If web/iOS becomes a committed first-release requirement, score Flutter and React Native/Expo against the same acceptance matrix before selecting.
- **Owner / gate:** Master Architect; record comparative scoring and constraints.

### OPEN-003 — Persistence, backend, authentication, and sync
- **Recommended default:** Local-first relational persistence with versioned migrations and append-only attempt/review events. No hosted backend or cross-device sync in v1 unless a concrete requirement proves it necessary.
- **Why:** The core study/review loop should work offline and not depend on a server for existing content or progress.
- **Required behavior:** Local saved lessons, imported content, available quizzes, due reviews and progress remain usable offline; generation/tutor features explain network/provider dependency. Export/backup and restore are v1 requirements.
- **Owner / gate:** Data Architect; provide migration, restore, duplicate-event and interrupted-write test designs.

### OPEN-004 — API-key strategy and provider support
- **Recommended default:** Bring-your-own-key, provider-neutral adapter, platform-backed secure storage, explicit key removal/rotation and no secret logging. No hosted proxy by default.
- **Why:** Matches the requested first-launch key setup and avoids silently introducing a recurring hosting bill.
- **Limit:** A key on a user-controlled device cannot be guaranteed impossible to extract. If this trade-off is unacceptable, the product requirement changes to a backend/proxy with operating costs and privacy obligations.
- **Owner / gate:** AI Platform Analyst; verify selected provider API/model support and failure/cost behavior before implementation.

### OPEN-005 — Spaced-repetition engine/version
- **Recommended default:** App-owned scheduler interface backed by a maintained, license-compatible FSRS implementation after exact package/version/license review; keep APKG export/import as portability and AnkiDroid bridge optional.
- **Why:** Core review must work when AnkiDroid is not installed; the checked-in FSRS-5 reference is illustrative, not exact AnkiDroid parity.
- **Owner / gate:** Learning/Data Architect; capture deterministic golden vectors, due-date semantics, migration rules and comparison output.

### OPEN-006 — Import formats and visual generation
- **Recommended default:** v1 supports paste/text and Markdown with source offsets/provenance. Treat PDF text extraction as a separately validated next format; OCR, video/URL scraping and generated images are out of initial scope until accuracy, permissions, storage and cost are evaluated.
- **Why:** Start with a reliable, testable ingestion path instead of making every file format a critical dependency.
- **Owner / gate:** Product/UX Architect; define format, size, page, parser-time and recovery limits before implementation.

### OPEN-007 — Mastery and reward formulas
- **Recommended default:** Use the provisional, versioned, evidence-aware mastery and adaptive-plan policy in PRODUCT_REQUIREMENTS_AND_UX.md and TECHNICAL_ARCHITECTURE_AND_CONTRACTS.md. Keep diagnostic results separate from post-teaching mastery; require diverse concept coverage, multiple sessions and delayed retrieval before “Likely mastered.”
- **Why:** Avoid false mastery from a small or repetitive quiz sample; make every label explainable and testable.
- **Validation:** Run the deterministic scenario suite, conduct learning-science review and label the thresholds provisional until calibrated. Change policy only with a method-version increment and regression comparison.
- **Owner / gate:** Learning Scientist + Master Architect.

### OPEN-008 — Backup, export, deletion, and recovery
- **Recommended default:** Local backup/export and restore in v1, with schema-version metadata, integrity checks, media/source references, review history and explicit conflict behavior. Cross-device sync remains out of scope until separately justified.
- **Why:** Users need recoverability without committing to accounts or hosted infrastructure.
- **Owner / gate:** Data Architect; round-trip tests must prove history and source links survive.

### OPEN-009 — Telemetry and analytics
- **Recommended default:** No nonessential telemetry by default. Use local diagnostics and user-visible export for troubleshooting; any remote analytics requires a separate documented purpose, data inventory and consent/retention policy.
- **Why:** Analytics are not required to deliver the core learning loop and may expose sensitive study material.
- **Owner / gate:** Product owner + privacy reviewer; document only if a concrete analytics need arises.

### OPEN-010 — Clinical source policy and review
- **Recommended default:** Preserve source/page/section/version for imported material; distinguish source-supported claims from AI-added explanations; flag conflicts and unsupported answer keys. Never label quiz mastery as clinical competence.
- **Why:** The product is for nursing education and should not invent clinical certainty.
- **Owner / gate:** Nursing-content reviewer; define authoritative source classes and which high-risk claims require human review before content generation is authorized.

### OPEN-011 — Device and performance targets
- **Recommended default:** Specify low-end Android acceptance targets for startup, lesson opening, quiz response, memory pressure and import recovery before implementation; test the agreed matrix on real devices rather than treating emulator-only success as sufficient.
- **Why:** Native architecture is not proof of good performance.
- **Owner / gate:** Mobile Architect + QA; record target device/API matrix and measurement procedure.



## Change template

For every new major decision, record:
- ID / date / status
- evidence and exact source
- decision and rationale
- alternatives and trade-offs
- security/privacy/cost consequences
- impacted documents and agent tasks
- verification and rollback plan
