# Architecture Options — Nursing Study App

**Status:** Initial evidence-based comparison. Final stack and deployment choices remain open.  
**Important:** These are planning recommendations, not a commitment to a specific implementation.

## 1. Evaluation criteria

Evaluate each option against: Android UX/performance, access to native capabilities, ability to work offline, development complexity, AI/provider integration, accessibility, testing, release/maintenance burden, privacy, cost, and future platform flexibility.

## 2. Mobile application stack

| Option | Strengths | Risks / costs | Evidence needed | Current position |
|---|---|---|---|---|
| Kotlin + Jetpack Compose (Android-first) | Native Android UI, straightforward local database/secure storage integration, strong platform access, good offline-first control | Android-only initial client; cross-platform later requires separate client | Confirm Android-only priority, UI complexity, team/build workflow | Strong candidate if Android is the primary target |
| React Native / Expo | Cross-platform client; Gizmo research demonstrates this class of stack is used by a comparable product | Native integrations can require modules/config plugins; dependency and runtime constraints; not evidence that Gizmo's stack is right for this project | Confirm required native APIs, package maturity, low-end-device behavior | Candidate if cross-platform is a real requirement |
| Flutter | Cross-platform UI and consistent rendering | Separate ecosystem and native integration decisions; no project-specific evidence yet | Prototype only after platform scope confirmed | Candidate, not preferred by default |

**Provisional recommendation:** If the user's initial target is Android and no web/iOS requirement is confirmed, favor an Android-first architecture and compare Kotlin/Compose with React Native using a small, non-production technical spike only after the planning stage is approved. Do not create that spike now.

## 3. Data persistence and backend

| Option | Strengths | Risks / costs | Best fit |
|---|---|---|---|
| Local-first only | Offline, user control, no server operation cost, simple initial deployment | Multi-device sync and server-side key protection are difficult; device loss risk | Single-device study MVP |
| Backend-first | Central account/sync, server-side AI calls and provider keys, cross-device access | Hosting, auth, privacy compliance, offline complexity, recurring costs | Multi-device collaborative product |
| Hybrid local-first + optional backend | Offline study/review with sync and server AI when configured | Conflict resolution, migrations, auth, and sync are significantly more complex | Likely long-term product if offline and cross-device are both required |

**Decision needed:** Define whether cross-device sync is required for the first release. Do not add a backend merely because AI is present; provider-key strategy may make one necessary, but must be justified.

## 4. AI provider-key strategy

| Option | Benefits | Risks | Guardrails |
|---|---|---|---|
| User's own key stored on device | Direct provider account, no central API bill | Key can potentially be extracted from a compromised/rooted device or instrumented app; provider-specific APIs; client can leak secrets in logs | OS-backed secure storage, never hard-code, redaction, clear removal/rotation, no key in backups, usage warnings |
| Server proxy with platform-owned key | Key stays server-side; consistent validation, caching, safety and rate limits | Server cost, abuse risk, privacy obligations, authentication and operations required | Auth, quotas, per-user budgets, rate limits, no content retention by default where feasible, secret manager |
| Hybrid provider adapter | Flexible; can support direct key and proxy modes | More complex UX and test matrix | Clear provider capability contract and per-mode threat model |

**Provisional security position:** Never embed a platform key in the mobile bundle. A user-supplied key may be stored locally, but documentation must not promise that it is impossible to extract. If a backend proxy is selected, enforce authentication, quotas, request limits, source-content size limits, and secret redaction.

## 5. AI generation architecture

Use a provider-neutral logical boundary with tasks such as:
- lesson generation;
- diagnostic question generation;
- topic quiz generation;
- module assessment generation;
- flashcard generation;
- tutor conversation;
- topic map generation.

Each task should specify a schema and policy. Validate structural constraints, answer-key consistency, duplicates, source grounding, question count, difficulty range, and content safety before persistence/display. Use bounded retries with error feedback. Never retry indefinitely.

The App 3 reference uses a generic 3–12 question schema, which is incompatible with the product's 1–5 pop quiz and 1–50 diagnostic ranges if used unchanged. Use assessment-specific constraints. Consider generating in smaller batches for large diagnostics, but ensure coverage and deduplication across batches.

For nursing content, distinguish:
1. user-supplied source;
2. source-derived summary;
3. AI-added general explanation;
4. claim that needs verification;
5. conflicting or insufficient evidence.

Do not fabricate citations or imply that generated material is authoritative clinical guidance.

## 6. Assessment answer-key boundary

A generated question object may contain correct answers for validation and grading, but the client-facing question payload must not include those answers before submission in server-backed mode. Separate the learner-visible prompt/options from the grading key and rationale. For ordering/matching, randomize the presented item order and preserve canonical IDs/mapping for grading. If the application supports local-only offline assessment with local answer keys, disclose that a determined device owner can inspect local app data; do not promise perfect secrecy. Add tests that inspect actual serialized/network payloads, not only rendered UI.

## 7. Spaced repetition

| Option | Strengths | Risks | Position |
|---|---|---|---|
| App-owned scheduler behind an interface | Integrated history and mastery; works without another app; can migrate algorithm | Requires correct implementation and validation | Recommended baseline |
| AnkiDroid content-provider bridge | Direct transfer into AnkiDroid on supported Android devices | User must have AnkiDroid; permission and version/device behavior; does not automatically synchronize internal review history | Optional integration |
| .apkg export/import | Portable deck exchange; can be tested offline | Does not guarantee continuous two-way progress sync; media/schema compatibility | Useful portability feature |
| Embed/reuse Anki core | Potentially closer scheduling/format behavior | License obligations, integration cost, version maintenance, native complexity | Do not choose without a legal/technical review |

The existing scheduler reference identifies itself as FSRS-5 and warns that it does not reproduce exact intervals from the newer AnkiDroid engine inferred from binary strings. Before choosing an algorithm, record the intended version, source/license, test vectors, migration policy, and performance expectations.

## 8. Topic graph / mind maps

Proposed logical model:
- canonical Topic/Concept records;
- typed relations such as prerequisite, related, contrasts-with, part-of, and clinically-associated-with;
- generated graph projections from canonical relations;
- navigation from graph nodes to lessons/cards/questions;
- text/list alternative for accessibility and small screens.

Do not store the same concept separately in every subject. A graph should be a view of relations, not the only source of truth.

## 9. Import and media strategy

Define a versioned ingestion pipeline:
1. identify file type by content rather than extension alone;
2. enforce size, page, image, and processing limits;
3. extract text and preserve source locations;
4. scan/sanitize imported HTML and untrusted markup;
5. store provenance and a content hash;
6. allow user preview/edit before generation;
7. pass only the minimum relevant context to an AI provider;
8. expose parse errors and allow retry.

Evaluate plain text/Markdown first, then PDF and images/OCR. Avoid requesting unnecessary Android permissions. For generated/retrieved images, preserve source/license/attribution where applicable and provide a useful fallback when unavailable.

## 10. Offline and synchronization

Before implementation, specify:
- which actions work offline (read lessons, answer due cards, local quizzes, inspect progress);
- which require AI/network (new generation, tutor calls, remote image search);
- durable local queue behavior;
- idempotency keys for attempts/rewards;
- conflict policy for concurrent review events;
- schema versioning and migrations;
- export/import and deletion behavior;
- recovery after process death during a quiz/review.

A review answer must not be lost if the app closes after the user selects Again/Hard/Good/Easy. Sync should merge immutable events and resolve derived-state conflicts deterministically.

## 11. Testing architecture

Require:
- unit tests for schemas, grading, scheduler transitions, mastery, rewards, streak boundaries, and import parsers;
- property/fuzz tests for malformed AI output and imported content;
- integration tests for persistence, migrations, provider failures, and idempotency;
- golden test fixtures for diagnostic coverage and learning-plan ordering;
- accessibility tests and manual screen-reader review;
- Android device tests for background/resume, offline recovery, low-memory behavior, and permissions if Android-first;
- cost/rate-limit tests for AI calls;
- export/import round-trip tests.

All reported results must include actual commands, environment, commit SHA, and output summary. Static review is not runtime verification.

## 12. Recommendation status

No final stack decision is made. The most consequential unresolved inputs are initial target platform, offline/sync expectations, provider-key strategy, and budget/privacy constraints. The architect should recommend a default after reviewing complete reports and running available reference tests, not before.
