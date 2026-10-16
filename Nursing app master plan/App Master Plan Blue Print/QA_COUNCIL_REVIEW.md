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
**Evidence:** All 740 paths are inventoried, but hundreds of unrelated Claude/Ruflo files and binary Android resources were not semantically read.  
**Correction required:** Continue to state the scope honestly. The full relevant research reports were read, but the whole repository was not line-by-line semantically read. This does not block planning of the nursing app but blocks any claim that every file's contents were reviewed.

## Scorecard

| Category | Score / 10 | Reason |
|---|---:|---|
| Repository inventory accuracy | 9 | Full non-truncated tree; key research scope audited; unrelated generated/framework contents not read line-by-line |
| Requirements coverage | 8 | 32 initial traceable requirements; needs report reconciliation and stronger answer-key/privacy acceptance cases |
| Architecture clarity | 7 | Logical boundaries and options exist; stack, sync, provider, scheduler and mastery formula remain open |
| Source/evidence quality | 8 | Both complete reports read; conflicting SDK metadata and documented-but-unrerun tests are disclosed |
| Agent prompt quality | 9 | Current master prompt now explicitly requires answer-key separation, concurrency/idempotency, source evidence, planning-only boundaries, and honest scoring; live agent capability/authorization still needs checking in Claude Code |
| UX/learning readiness | 7 | Main flows and safeguards specified; formulas and detailed state tables remain open |
| Security/privacy readiness | 7 | Threats identified; provider mode and retention/sync choices unresolved |
| Planning completion | 6 | Planning artifacts exist and are uploaded; reconciliation, reference tests, and independent council corrections remain |

## Next correction cycle

- [x] Update DATA_MODEL_AND_CONTRACTS.md to separate learner-visible question payloads from grading keys, including ordering/matching shuffle behavior.
- [x] Update ARCHITECTURE_OPTIONS.md with the server/client answer-key boundary and local-only caveat.
- [x] Update REQUIREMENTS_TRACEABILITY.md with answer-key leakage, idempotency, concurrency, and source-provenance acceptance checks.
- [x] Re-fetch all 12 blueprint files and confirm non-empty content; re-scan the tree (740 entries, not truncated) and validate all 18 relative links in the two updated READMEs.
- [ ] Reconcile complete report findings against all relevant markdown notes; preserve observed/inferred labels.
- [ ] Run the existing App 2 offline test suites if an appropriate environment is available; report inability honestly if not.
- [ ] Conduct another independent council pass after report reconciliation.

## Iteration 2 verdict

The answer-key boundary and strict diagnostic gate are explicit in the planning artifacts. The current CLAUDE_MASTER_PROMPT.md has also been strengthened with a clearer phase boundary, detailed requirement groups, security/correctness rules, recurring review cycle, acceptance tests, and honest self-scoring. The prompt is materially stronger, but live agent capability/authorization has not been checked in Claude Code. Planning quality improved; overall readiness remains below completion because full source-claim reconciliation, reference test execution, final architecture decisions, and independent review remain open. No application code was created.


## Corrective Cycle 2 — follow-up review (2026-10-17)

**Review mode:** Master-architect document review and repository read-back, using the Iteration 1 findings above. This addendum does not claim that separate Claude subagents were spawned during this correction cycle. The app remains unbuilt by design.

### Applied corrections

| Finding | Action taken | Status |
|---|---|---|
| DEV-001 — pre-answer answer-key exposure | Added an explicit learner payload / grading-key / post-answer feedback split, shuffle-safe ordering/matching grading, and payload-level acceptance tests in `DATA_MODEL_AND_CONTRACTS.md`; mirrored the boundary in `ARCHITECTURE_OPTIONS.md`, `REQUIREMENTS_TRACEABILITY.md`, and the master prompt. | Applied to planning docs; not runtime-tested |
| DEV-002 — non-atomic quiz/refill and duplicate events | Expanded contract invariants and test requirements for idempotent attempts/rewards, generation-job deduplication, atomic dequeue/refill, restart recovery, and event-based state. Strengthened the future red-team prompts. | Applied to planning docs; not runtime-tested |
| LEARN-001 — diagnostic bypass | `REQUIREMENTS_TRACEABILITY.md`, UX/learning rules, roadmap and master prompt now describe a strict 1–50 question diagnostic gate before teaching in a newly selected scope, with interruption/resume rather than silent skipping. | Applied to planning docs |
| SEC-001 / SEC-002 — API key and imported prompt-injection | Expanded the master prompt's user-key/security rules, extraction caveat, no-secret handling, and untrusted-import boundary. | Applied to planning docs; threat-model decision remains open |
| QA-002 — stale counts and weak readback reporting | Refreshed the master-plan and audit snapshot to 740 tree entries (599 blobs, 141 trees; `truncated=false`) and documented the current 12-file blueprint set. Added corrected status to the blueprint index. | Verified at the recorded tree snapshot; re-scan after future path changes |
| Agent drift / overlapping edits | Expanded the orchestrator prompt with source hierarchy, real-capability checks, non-overlapping ownership, a bounded council/rebuild/verification cycle, and evidence-based scoring; tightened the relevant assignment prompts. | Applied to planning docs; live registry/spawn still must be verified in Claude Code |

### Follow-up verification record

- The rewritten `CLAUDE_MASTER_PROMPT.md` was fetched back from GitHub and confirmed non-empty (274 lines, 23,715 characters at the read-back).
- The current tree snapshot recorded 740 entries / 599 blobs / 141 tree entries and `truncated=false`. The blueprint directory contains 12 Markdown files plus its directory entry.
- The answer-key split and strict diagnostic gate are present in the contracts and requirements traceability documents.
- The parent and blueprint README links were reported parsed against the Git tree during the earlier QA pass. Re-run validation after any link/path change.
- No App 2 unit tests, TypeScript typecheck, device tests, live-provider calls or app build were run as part of this correction cycle. Historical README test counts remain documentation, not freshly reproduced results.
- App 1's source archive remains unverified as a complete 1:1 transfer. This cycle did not compare its original archive manifest with every current path/hash.
- The reported Gizmo min-SDK inconsistency remains UNKNOWN until raw manifest/config metadata can be reconciled.

### Updated scorecard

These scores evaluate the **planning package at this revision**, not implementation correctness.

| Category | Score / 10 | Evidence-based reason |
|---|---:|---|
| Repository inventory accuracy | 9 | The latest recorded tree is non-truncated and counts are corrected; not every unrelated framework file or binary was semantically read. |
| Requirements traceability | 9 | Strict diagnostic gating, 1–5 topic quizzes, answer-key boundary, idempotency and source provenance are mapped; several user-level policies remain open. |
| Architecture clarity | 8 | Logical modules and cross-cutting constraints are documented; platform, backend/sync, provider mode and scheduler version remain unresolved. |
| Data/service contract quality | 9 | Canonical content, provenance, immutable attempts/reviews and answer-key separation are specified; no implementation-level contract tests have run. |
| Security/privacy and nursing safety | 8 | Threats and mitigations are explicit; key mode, retention, source-review thresholds and deployment policy still need decisions and validation. |
| UX/accessibility/learning effectiveness | 8 | Journeys, strict diagnostic flow, mastery-confidence separation and accessible alternatives are specified; no learner/device usability test has validated them. |
| Claude agent readiness | 9 | Master prompt and non-overlapping work packages are substantially tightened; actual live tool/agent availability remains to be checked in Claude Code. |
| QA/repository hygiene | 8 | Changed planning docs were read back and historical caveats are retained; tests, complete archive reconciliation and some source-claim cross-checks remain. |

**Verdict: Continue planning; do not authorize implementation.** The aspirational “15/10” bar is not a truthful auditable score. A score above 10 on this scorecard would be cosmetic. The package is substantially stronger, but known validation gaps make a perfect score unjustified.

### Next highest-value cycle

1. Reconcile the Gizmo minimum-SDK contradiction against primary manifest/config evidence.
2. Run isolated, offline reference tests where an appropriate runtime is available; report exact commands and outputs.
3. Compare full research report claims with markdown, raw decoded metadata and source code, preserving observed/inferred labels.
4. Complete the open architecture decisions with an evidence-supported recommended default, trade-offs and rollback/migration approach.
5. Re-run tree, relative-link, cross-document terminology and secret scans; then score again. Keep implementation blocked until the user separately authorizes it.
