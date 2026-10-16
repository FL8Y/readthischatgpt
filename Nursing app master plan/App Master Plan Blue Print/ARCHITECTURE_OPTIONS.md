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

No final stack or deployment decision has been approved. A recommendation is still useful at the planning stage: the default below is **PROPOSED**, is based on the current product requirements and available repository evidence, and must be validated before implementation. Do not block the architectural recommendation merely because device tests have not yet run; record what still needs empirical verification.

## 13. Master Architect's proposed baseline

| Decision area | Proposed default | Why this is the current best fit | Required validation / trigger to reconsider |
|---|---|---|---|
| Product platform | **Android-first, native Kotlin + Jetpack Compose** | The source repository and current usage context are Android-centred; native storage, secure credential handling, accessibility and offline review are central. The Gizmo/Expo reference is evidence of an alternative, not proof it is the best fit. | Compare the actual build workflow, target Android API matrix, low-end-device performance and developer constraints in a bounded technical assessment after separate authorization. Reconsider React Native/Flutter if web/iOS becomes a committed initial requirement. |
| Deployable architecture | **Modular monolith with explicit logical boundaries** | The product needs coherent transactions across questions, attempts, rewards, scheduling and mastery. Splitting into network microservices would add operational complexity without demonstrated need. | Keep package/module contracts testable. Reconsider service separation only when deployment, scaling or team boundaries justify it. |
| Persistence | **Local-first relational store with versioned migrations and append-only attempt/review events** | Protects core study and SRS from network failure and avoids losing review history; supports deterministic derived-state rebuilds. A relational model suits subject/topic links, assessment versions, attempts and source provenance. | Validate interrupted writes, backup/restore, migrations, large imports, low-storage behavior and event recomputation. Decide multi-device sync explicitly rather than assuming it. |
| Network and sync | **Offline-capable core; no cloud sync in the first baseline unless required** | Reading saved lessons, local quizzes, review queues and progress should remain usable offline. AI generation and tutor calls inherently need network access. A backend would add authentication, hosting, privacy and conflict-resolution costs. | Add sync only if it is a committed requirement; then specify authentication, event merge, conflict handling, deletion propagation and recovery. |
| AI credentials | **Support the user's own provider key locally as the first proposed mode, with explicit extraction warning; keep a provider adapter so a backend-proxy mode can be added deliberately** | Matches the user's stated first-launch/API-key workflow without silently introducing a hosted service or platform-owned bill. A provider-neutral boundary avoids coupling learning features to one vendor. | Use platform-backed secure storage, remove/rotate key, exclude it from backup/logs/analytics/crash data, cap source size/retries and explain provider cost. A local key is not impossible to extract on a compromised/instrumented device. Do not ship a platform key in the client. |
| AI generation | **Schema-first, evidence-grounded, bounded generation** | Reference code demonstrates schema validation/retry patterns but its generic 3–12 question cap fails the product's 1–5 pop quizzes and 1–50 diagnostics; its in-memory refill lock is not a production concurrency model. | Separate assessment policies, grading keys, learner payloads and feedback; test source coverage, duplicates, answer correctness, prompt-injection resistance, concurrency, timeouts and provider failures. |
| Spaced repetition | **Own scheduler interface; select a maintained, license-compatible scheduler/version before coding** | Avoids runtime dependency on AnkiDroid and keeps review history available even when that app is absent. The checked-in FSRS-5 example is explicitly not proven to match the current AnkiDroid engine. | Compare maintained library/API candidates, licenses, versioned test vectors, deterministic fixed-clock behavior and migration. Do not ship the reference FSRS-5 code unchanged based only on README claims. |
| Anki interoperability | **Versioned APKG import/export as a portability candidate; provider bridge optional** | Package exchange can support learner ownership without requiring AnkiDroid at runtime. The bridge's runtime permission and device behavior are not device-verified. | Round-trip cards/media and review metadata; test supported Android versions, absent-app and denied-permission flows before enabling bridge integration. |
| Import scope | **Text/paste and Markdown as the lowest-cost first ingestion path; evaluate PDF and image/OCR as a separately costed tier** | Preserves core study-material input while limiting parsing and permission complexity early. Visual aids remain part of lessons; ingestion OCR is a separate workload. | Define formats/size/page limits, source-location retention, malicious-file tests, offline behavior and OCR cost/performance targets. |
| Topic graph / lessons | **Canonical topic/concept relations; graph is a projection with an accessible text alternative** | Avoids duplicate concepts and allows lessons, cards, questions and subjects to share stable references. | Verify graph navigation, relation provenance, small-screen usability, screen-reader alternative and relation updates after topic moves. |
| Mastery and rewards | **Explainable, conservative estimates with separate accuracy, evidence volume, recency, coverage, confidence and scheduler state; idempotent reward events** | A single score or one session cannot establish durable mastery. Repeat taps and retried submissions must not create fake progress. | Compare candidate formulas against fixed learner scenarios, sparse-data cases, item difficulty, guesses, old versus recent answers and duplicate/offline submissions. Keep the formula a documented decision until tested. |
| Privacy / analytics | **Local by default, data-minimizing, no nonessential telemetry until explicitly justified and disclosed** | Study notes can be sensitive; sending the whole library to a provider or retaining it on a backend is unnecessary for many tasks. | Document what content leaves the device for each generation task, retention/deletion behavior and consent. Test data minimization, redaction, export and deletion. |

### Recommendation confidence and limits

- **Moderate confidence:** Android-first native client, local-first event model, logical modules rather than microservices, separate grading-key boundary, and optional Anki interoperability.
- **Moderate-to-low confidence pending test vectors:** exact scheduler library/version, mastery formula and reward formula.
- **Open product inputs:** whether cross-device sync is required in the first release, import format priority beyond text, provider list/usage budget, minimum supported Android/device matrix and visual-generation cost ceiling.
- **Hard gate:** these are planning recommendations only. No app code, spike or prototype should be created before separate implementation-stage authorization.
