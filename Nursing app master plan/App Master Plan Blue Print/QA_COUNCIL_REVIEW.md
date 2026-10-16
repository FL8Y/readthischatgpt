# QA Council Review — Planning Iteration 1

**Date:** 2026-10-17  
**Scope:** Planning documents, repository audit, research report review, and upload verification.  
**Not in scope:** Application runtime, app build, device tests, or feature verification.

## Council verdict

**Continue planning. Do not authorize app implementation yet.**

The initial plan is materially more useful than the previous single-README blueprint, and the new files were fetched back from GitHub. It is not complete enough for a 10/10 readiness score. Important source claims and architecture risks remain to be reconciled, and reference tests have not been rerun.

## Work completed and verified

- Recursive Git tree scan: 729 entries before planning uploads; 739 entries after uploads; both responses reported truncated=false.
- Complete Gizmo report read: 54/54 pages.
- Complete AnkiDroid report read: 35/35 pages.
- Key markdown research notes and primary reference code inspected.
- Ten planning artifacts added under the blueprint directory.
- Blueprint README and parent README updated.
- At the time of the initial council review, all 11 then-existing files in the blueprint directory were fetched back from GitHub and confirmed non-empty. A later verification pass includes this council review document as the twelfth file.
- All relative links parsed from the two updated READMEs resolved to existing tree paths in the verification pass.
- The explicit requirement that diagnostic assessment precede teaching was tightened in the traceability matrix.

## Council A — Developer / architecture

### Finding DEV-001 — Quiz answer leakage risk
**Severity:** High  
**Evidence:** The Gizmo reference schema includes answer data such as answerIndex, and ordering items are described as being generated in correct order. A generic serialized quiz sent to a client could expose the answer key before the learner responds.  
**Impact:** Assessment validity is compromised if answers can be inspected in network responses or local client state.  
**Correction applied to planning documents:** DATA_MODEL_AND_CONTRACTS.md and ARCHITECTURE_OPTIONS.md now define separate learner-visible and grading-key payloads, plus shuffle/grading requirements.  
**Still unverified:** No production implementation exists to inspect. Offline local-key exposure remains an explicit limitation.  
**Verification gate:** Inspect actual response schema and network payload; test that pre-answer payloads do not include answer keys; test shuffled display and grading.

### Finding DEV-002 — Reference quiz service is not a production concurrency model
**Severity:** High  
**Evidence:** The reference service uses an in-memory per-user Set to avoid concurrent refill. Its storage interface is abstract and the buffer check/dequeue/refill flow is not shown as a database transaction.  
**Impact:** Multiple workers/processes could generate duplicate quizzes or serve conflicting queue state.  
**Correction required:** Specify persistent job idempotency, atomic dequeue/refill, unique constraints, transaction boundaries, timeouts, and recovery from process termination.  
**Verification:** Concurrent-request tests, worker restart tests, duplicate generation test, and queue consistency assertions.

### Finding DEV-003 — Report platform metadata conflicts
**Severity:** Medium  
**Evidence:** The Gizmo report's early identity summary states min SDK 34, while its native Android addendum states minSdk 26 (target/compile SDK 36).  
**Impact:** A stack or minimum-device decision based on either value may be wrong.  
**Correction required:** Keep the minimum SDK UNKNOWN until the actual manifest/config source is reconciled. This is recorded in REPO_AUDIT.md.  
**Verification:** Compare raw decoded manifest, app config, and build metadata, and record which source each value comes from.

## Council B — UI/UX

### Finding UX-001 — Dashboard and navigation are proposals, not validated flows
**Severity:** Medium  
**Evidence:** UX_AND_LEARNING_SPEC.md defines conceptual destinations and journeys but has no wireframes, tested prototypes, or device evaluation.  
**Correction required:** After architecture authorization, create screen-state tables or low-fidelity wireframes and validate short-session flows, text scaling, and screen-reader behavior. No UI prototype is authorized in this planning phase unless specifically added as a planning deliverable.

### Finding UX-002 — Mastery color coding needs accessible equivalents
**Severity:** Medium  
**Correction required:** Keep confidence and mastery labels textual, use shape/icon/label in addition to color, and define non-graph alternatives. This requirement is already included in the UX specification and must remain in acceptance tests.

## Council C — Nursing student / clinical safety

### Finding NURS-001 — Source-grounding needs explicit answer-key provenance
**Severity:** High  
**Evidence:** The product requires detailed explanations and diagnostic/quiz feedback, but a source-grounded question does not automatically mean its answer key or rationale is supported.  
**Correction required:** Every question's answer key and rationale should reference supporting source chunks where possible. If the source does not support the answer, the system must label it as AI-added/general knowledge or require review, rather than fabricate a source citation.

### Finding NURS-002 — Diagnostic estimates are not competency certification
**Severity:** Medium  
**Correction required:** Preserve the UX requirement that quiz results estimate learning needs and do not certify clinical competence. Keep confidence/evidence sufficiency separate from accuracy.

## Council D — Learning scientist

### Finding LEARN-001 — Diagnostic gating must be strict
**Severity:** High  
**Evidence:** User explicitly requires a diagnostic before teaching any topic in the selected subject/scope.  
**Correction applied:** REQUIREMENTS_TRACEABILITY.md now requires a 1–50 question diagnostic to be completed before teaching begins, with interruption/resume and topic-level results. It no longer treats skipping as a policy option.

### Finding LEARN-002 — One accuracy percentage is insufficient
**Severity:** High  
**Correction required:** Use a transparent mastery estimate with evidence volume, recency, question coverage/difficulty, and review history; show confidence/evidence sufficiency separately. Formula remains an open decision.

## Council E — Security / privacy

### Finding SEC-001 — Client-side provider keys are extractable in principle
**Severity:** High  
**Correction required:** Do not claim that secure local storage makes a key impossible to extract. Choose a direct-key, server-proxy, or hybrid strategy after documenting the threat model, data exposure, cost controls, and key removal/rotation behavior.

### Finding SEC-002 — Imported content is untrusted input
**Severity:** High  
**Correction required:** Treat instructions inside user-imported notes/documents as data, not system instructions. Limit document size and parsing resources, sanitize rich content, and prevent imported text from overriding generation policy.

## Council F — QA and evidence

### Finding QA-001 — Existing reference test counts have not been reproduced
**Severity:** Medium  
**Evidence:** Reports state APKG builder 4/4 tests and scheduler 10/10 tests; Gizmo reference was type-checked but not run against a live API. These tests were not rerun in this session.  
**Correction required:** Re-run offline tests in an isolated environment before using their outcomes as current evidence. Report actual command, runtime, and output. Do not call provider APIs or require secrets just to run unit tests.

### Finding QA-002 — Tree verification is not content verification
**Severity:** Medium  
**Evidence:** All 739 paths are inventoried, but hundreds of unrelated Claude/Ruflo files and binary Android resources were not semantically read.  
**Correction required:** Continue to state the scope honestly. The full relevant research reports were read, but the whole repository was not line-by-line semantically read. This does not block planning of the nursing app but blocks any claim that every file's contents were reviewed.

## Scorecard

| Category | Score / 10 | Reason |
|---|---:|---|
| Repository inventory accuracy | 9 | Full non-truncated tree; key research scope audited; unrelated generated/framework contents not read line-by-line |
| Requirements coverage | 8 | 32 initial traceable requirements; needs report reconciliation and stronger answer-key/privacy acceptance cases |
| Architecture clarity | 7 | Logical boundaries and options exist; stack, sync, provider, scheduler and mastery formula remain open |
| Source/evidence quality | 8 | Both complete reports read; conflicting SDK metadata and documented-but-unrerun tests are disclosed |
| Agent prompt quality | 8 | Bounded roles, evidence labels, and ownership rules; needs updated security/answer-key checks and actual live agent capability check |
| UX/learning readiness | 7 | Main flows and safeguards specified; formulas and detailed state tables remain open |
| Security/privacy readiness | 7 | Threats identified; provider mode and retention/sync choices unresolved |
| Planning completion | 6 | Planning artifacts exist and are uploaded; reconciliation, reference tests, and independent council corrections remain |

## Next correction cycle

1. Update DATA_MODEL_AND_CONTRACTS.md to explicitly separate learner-visible question payloads from grading keys, including ordering/matching shuffle behavior.
2. Update ARCHITECTURE_OPTIONS.md with the server/client answer-key boundary and local-only caveat.
3. Update REQUIREMENTS_TRACEABILITY.md with answer-key leakage, idempotency, concurrency, and source provenance tests.
4. Reconcile complete report findings against all relevant markdown notes; preserve observed/inferred labels.
5. Run the existing App 2 offline test suites if an appropriate environment is available; report inability honestly if not.
6. Re-fetch updated files and rerun link/tree checks; record the final tree count and latest commit.
