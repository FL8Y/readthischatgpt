# QA Council Review — Planning Iteration 1

**Date:** 2026-10-17  
**Scope:** Planning documents, repository audit, research report review, and upload verification.  
**Not in scope:** Application runtime, app build, device tests, or feature verification.

## Document evolution note

This file preserves historical review findings. References below to the former files `REQUIREMENTS_TRACEABILITY.md`, `UX_AND_LEARNING_SPEC.md`, `ARCHITECTURE_OPTIONS.md` and `DATA_MODEL_AND_CONTRACTS.md` refer to the versions that existed when those findings were recorded. Their current consolidated destinations are `PRODUCT_REQUIREMENTS_AND_UX.md` and `TECHNICAL_ARCHITECTURE_AND_CONTRACTS.md`; the mapping and deletion receipts are in `CLEANUP_LOG.md`.

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


## Corrective Cycle 3 — architecture recommendation and cross-document consistency (2026-10-17)

### New findings and corrections

| Finding | Correction | Status |
|---|---|---|
| ARCH-001 — Open architecture choices lacked a concrete proposed default | Added a provisional baseline in `ARCHITECTURE_OPTIONS.md` and ADR-007 in `DECISION_LOG.md`: Android-first native client; modular monolith; local-first relational/event persistence; user-supplied key with explicit extraction caveat; provider adapter; versioned scheduler interface; optional APKG/AnkiDroid integration. The recommendation remains PROPOSED, not user-approved. | Applied; empirical validation and final scope decisions remain open |
| LEARN-003 — Some UX wording still said “offer a diagnostic” | Updated the UX spec, master architect plan, data contracts and traceability matrix to require a completed 1–50 question diagnostic before new teaching. An interrupted session resumes; review-only mode may revisit prior lessons but cannot unlock new lessons. | Applied to planning docs |
| QA-003 — Requirement matrix retained outdated skip wording | Changed the open question from whether users can skip to the diagnostic retake policy; skipping is explicitly not a bypass. | Applied to planning docs |
| DOC-001 — Proposed architecture could be mistaken for a confirmed user decision | Labeled the baseline PROPOSED, recorded alternatives, risks, validation and rollback/change-control expectations in ADR-007. | Applied |

### Cycle 3 checks

- Fetched the changed UX spec, data contract, requirement traceability, master plan, architecture options and decision log after their GitHub writes.
- Verified the diagnostic gate is described in the learner journey, service/contract policy, traceability invariants and master product intent.
- The architecture options compare the proposed default with alternatives and preserve unresolved product inputs; no stack-specific code or prototype was created.
- No reference tests, live provider calls, app build or device tests were run in this cycle. The branch's file/path count did not change because the cycle modified existing Markdown files only.

### Updated planning scorecard

| Category | Score / 10 | Reason |
|---|---:|---|
| Repository inventory accuracy | 9 | Tree is non-truncated and the 740-entry snapshot is recorded; source payloads and unrelated framework files are not all semantically inspected. |
| Requirements traceability | 9 | Strict diagnostic gate, assessment-specific counts, feedback, remediation, provenance and answer-key protections now agree across core docs; more edge-case acceptance tests remain to run. |
| Architecture clarity | 9 | An explicit proposed default and alternatives are documented; target-device validation, provider API verification, scheduler selection, sync and formulas remain open. |
| Data/service contract quality | 9 | Versioning, immutable events, idempotency, concurrency and answer-key separation are covered; contract behavior remains unexecuted. |
| Security/privacy and nursing safety | 8 | Key extraction, imported prompt injection, clinical source provenance and backup/log boundaries are covered; threat model and runtime checks remain incomplete. |
| UX/accessibility/learning effectiveness | 8 | Strict diagnostic gating and accessible alternatives are explicit; no usability study, screen-reader test or student workflow observation was performed. |
| Claude agent readiness | 9 | The prompt, agent scopes, ownership protocol, cycle, and honesty rules are explicit; live registry/agent availability and isolated worktrees must be checked by Claude Code. |
| QA/repository hygiene | 8 | Readbacks and Markdown link checks were performed; source-test execution, App 1 archive manifest reconciliation and minimum-SDK conflict resolution remain. |

**Cycle 3 verdict:** The planning documents are more coherent and actionable, but the package is **not 10/10** and cannot honestly be rated 15/10 on an auditable quality scale. Continue with source/test validation, not application implementation.

### Precise continuation point

Next: verify the raw source behind the Gizmo minimum-SDK discrepancy; run available offline tests with recorded environment/output; perform a full cross-document link/path/requirements scan; then update this scorecard from the actual findings. Keep app implementation blocked until the user separately authorizes it.


## Corrective Cycle 4 — consolidation, prompt completeness and final link audit (2026-10-17)

### Work completed

- Consolidated repeated requirements and architecture/contracts content into two canonical specifications: `PRODUCT_REQUIREMENTS_AND_UX.md` and `TECHNICAL_ARCHITECTURE_AND_CONTRACTS.md`.
- Deleted the four overlapping blueprint-only documents after checking the canonical replacements. Exact blob and deletion commit SHAs are recorded in `CLEANUP_LOG.md`. No research folders, binary files, reference-code files, root Claude/Ruflo configuration or the unrelated FLY8 prompt were removed.
- Updated `CLAUDE_MASTER_PROMPT.md` to point to the canonical documents and added a planning-only iteration report template plus 2–3 required next-improvement suggestions. It remains explicitly forbidden to build the app in this phase.
- Kept the architecture baseline explicitly **PROPOSED**, not user-approved, and strengthened the service-level diagnostic gate and missing-key/recoverable state.
- Freshly fetched all current blueprint Markdown files plus the parent README from GitHub and confirmed non-empty readbacks.
- Re-ran relative Markdown link validation across the two README indexes: **18 relative links checked, 0 broken**.
- Re-scanned the current recursive tree: **739 entries, 598 blobs/files, 141 trees/directories, `truncated=false`**, at the initial post-cleanup head/tree SHA `d018a28f50495a5c14f1d6bbf7dbe0f1f384fa33`. A fresh final follow-up after QA/audit edits at `131aa5434aaacadab2dfd0c9b522e2ced2e4c10d` returned the same 739/598/141 counts and `truncated=false`. The blueprint contains 11 Markdown files. No file paths were added or removed since the prior post-cleanup snapshot; only existing documents were edited.

### Verification limitation

Historical Cycle 4 limitation (superseded by Cycle 6/7): at that time, a local `git ls-remote` / checkout attempt could not resolve `github.com`, so reference tests and app build were not run. The report page-count issue was subsequently resolved by reading the current Library DOCX files in full: Gizmo is 54 pages and AnkiDroid is 35 pages; the stale App 3 README count was corrected. The Gizmo min-SDK conflict remains UNKNOWN because the report itself states both 34 and 26, and the primary apktool.yml is absent. The App 1 archive remains unverified against a complete manifest and all hashes. The full tree was inventoried; not every binary or unrelated generated Claude/Ruflo file was semantically read.

**Primary-source cross-check:** The decoded App 3 manifest was fetched and inspected directly. It contains compile SDK 36 but no `<uses-sdk>` declaration, so it is not evidence for a minimum SDK of either 26 or 34. The report page-count discrepancy also remains open. Do not treat either discrepancy as resolved without checking the original report/build metadata from source bytes.

### Cycle 4 scorecard

These are scores for planning readiness, not for a working application.

| Category | Score / 10 | Evidence / remaining limitation |
|---|---:|---|
| Repository inventory and hygiene | 9 | Current tree is non-truncated; duplicate planning docs are consolidated; 18 README-relative links resolve. Unrelated binary/framework contents are not all semantically read. |
| Requirements coverage | 9 | Mandatory 1–50 diagnostic, 1–5 topic quiz, module remediation, tutor, spaced review, key setup and nursing safeguards are in the canonical spec. Edge cases still need executable tests. |
| Architecture recommendation | 9 | A practical default and alternatives are written down and labelled proposed. Target-device validation, sync scope, provider budget, scheduler and formula choices remain unresolved. |
| Data/service contracts | 9 | Canonical entities, provenance, answer-key split, event idempotency, concurrency, migration and offline requirements are specified; contracts have not been executed. |
| Security/privacy/clinical reliability | 8 | Key extraction caveat, imported prompt-injection, source/answer-key provenance and secret redaction are addressed. No runtime threat-model verification or human clinical review has occurred. |
| UX/accessibility/learning science | 8 | Strict diagnostic gate, resumability, evidence-aware mastery and graph text alternatives are specified. No usability study or screen-reader/device test has been performed. |
| Claude agent readiness | 9 | Prompt, ownership rules, real-capability checks, handoff schema, iterative review and suggestions are present. Live agent spawning is still not verified in this ChatGPT environment. |
| QA and empirical validation | 7 | Repository and link readbacks are verified, but reference tests were not runnable here; archive completeness and SDK evidence remain blocked. |

**Verdict:** The planning workspace is cleaner and substantially more actionable. It is not defensible to call it 15/10 or all 10s while important empirical checks are blocked. Overall planning-readiness judgment: **8.5/10** (summary judgment, not an arithmetic replacement for the category scores). Do not begin app implementation.

### Next best improvement cycle

1. Verify the conflicting Gizmo minimum-SDK claims against the raw decoded manifest and build configuration, recording the exact source that wins.
2. Run the existing App 2 offline tests and reference typecheck in a checkout-capable environment; record exact commands, environment, commit and output.
3. Reconcile the App 1 archive manifest with Git paths, sizes and hashes before making any completeness claim. Continue to hold the application build gate.

## Corrective Cycle 5 — requirement-level product council (2026-10-17)

### Council findings and changes applied

| Lens | Finding | Fix applied |
|---|---|---|
| Developer / requirements traceability | The first cleaned requirements matrix represented topic linking and rewards, but did not explicitly preserve every detail from the user's prompt. | Updated R-003 to require cross-folder relation color coding with text/icon redundancy; R-006 to require a diagnostic-derived plan with explicit ordered topics, teaching depth and rationale; R-017 to explicitly include points for correct answers, quiz scores, completion and streak milestones; R-021 to state the configured personal provider/key covers all AI-powered learning features. |
| UI/UX and accessibility | A graph-only interpretation could omit the requested Obsidian-style linked-outline experience; color coding can be inaccessible if it stands alone. | Updated R-010 and the technical graph section to require an Obsidian-style linked Markdown/text outline alongside the graph, plus a consistent legend and labels/icons. Added the accessibility invariant that relationship meaning must never depend on color alone. |
| Nursing learner | A progress screen could show mastery but omit the motivating details and the next step that help a learner resume a busy study session. | Updated R-019 to require visible points, level/rank, streak, due reviews, next recommended action, per-topic mastery, confidence and recency. |
| Learning scientist | Reward points could be ambiguous, and raw repeated performance could be mistaken for learning. | Extended reward contracts to spell out correct-answer, topic/module quiz-score, completion and streak-milestone events; kept mastery evidence separate from motivational points and required idempotent events. |
| QA / security | A single provider preference could be interpreted as serving only quizzes, leaving lesson/map/tutor calls outside the intended credential and failure policy. | R-021 now states that the configured provider/key is used for diagnostics/adaptive plans, lessons, topic/module quizzes, flashcards, mind maps and tutor discussion. The technical spec already requires one task-specific adapter/schema per feature and explicit missing/invalid-key handling. |

### Cycle 5 cross-document verification

- Fetched the canonical product specification, technical contract and master architect plan after edits; all three contain the newly explicit requirements, including topic-depth/order, linked graph/outline, accessible color coding, point-earning milestones, dashboard details and all-AI provider coverage.
- Confirmed the canonical Claude prompt does not refer to the four deleted documents as active inputs/outputs. It directs agents to the consolidated product and technical specs.
- The most recent independent recursive tree and link scan is recorded in Cycle 4 and REPO_AUDIT.md: 739 entries / 598 blobs / 141 trees, `truncated=false`; 11 blueprint Markdown files; 18 relative links across the two README indexes, zero broken.
- Subsequent edits changed existing Markdown content only. The tree's path count and links therefore remain unchanged; no new app or test files were created.
- No app code or runnable mock-up was created. The implementation gate remains closed.
- No executable/device/provider tests were run: the available container could not resolve github.com, so this pass could only use GitHub API readbacks. The SDK/report page-count discrepancy, incomplete App 1 archive verification and lack of user/device usability tests remain open.

### Cycle 5 scorecard (planning readiness)

| Category | Score / 10 | Reason |
|---|---:|---|
| Repository inventory and hygiene | 9 | Consolidation/deletion record, current inventory and 18-link check are recorded; some unrelated/binary files were inventoried rather than semantically read. |
| Requirements coverage | 9 | All specified user-visible flows are now explicit in the canonical matrix, including color-coded links, linked outline, all-AI credential scope, streak/quiz-score rewards and complete dashboard details. No executable acceptance run proves an implementation. |
| Architecture clarity | 9 | Practical proposed baseline, alternatives, event model and scheduler boundary exist. The proposal remains unapproved and has open platform/sync/provider/scheduler choices. |
| Data/service contracts | 9 | Canonical content, provenance, strict diagnostic gate, answer-key boundary and idempotency/concurrency rules are documented but not runtime-tested. |
| Security/privacy/clinical reliability | 8 | Known client-key limits, import-injection, backups/logging and nursing provenance are covered; no runtime threat test or human clinical review occurred. |
| UX/accessibility/learning effectiveness | 8 | Graph/outline access, non-color cues, resumability and learning evidence are explicit; real student usability and assistive-tech tests remain unperformed. |
| Claude agent readiness | 9 | Bounded work packages, non-overlapping ownership, prompt template and honesty/score rules are present; actual external Claude-agent execution is not verified here. |
| QA and empirical validation | 7 | Tree/link and file readbacks passed; executable reference tests, full archive hash reconciliation and primary SDK verification are still blocked. |

**Cycle 5 verdict:** Requirement fidelity improved, but a complete product cannot receive a 15/10 or a truthful 10/10 readiness score while execution tests and primary-source checks remain incomplete. Current planning-readiness judgment remains **8.5/10**. The right next action is source/test validation in an environment with repository checkout, not app implementation.

### Remaining improvements

1. Resolve the Gizmo minimum-SDK and DOCX page-count discrepancies from the original primary artifacts.
2. In a checkout-capable environment, run the existing APKG builder tests, FSRS reference tests and Gizmo TypeScript typecheck; record exact commands/output.
3. Reconcile the original App 1 archive manifest against all uploaded files by path/size/hash. Preserve the build gate until separately authorized.


## Corrective Cycle 6 — mastery policy, decision defaults, evidence trace (2026-10-17)

### Work completed
- A standalone weighted 1000-point readiness trace was briefly added, then removed in later repository commits. Its scoring rubric is now consolidated into this QA review; Cycle 7 records the removal and current canonical location.
- Freshly read the complete Library versions of the Gizmo report (54/54 pages; 2,671 extracted text lines) and AnkiDroid report (35/35 pages; 1,765 extracted text lines). Corrected the App 3 README from 52 to 54 pages.
- Reconciled the page-count discrepancy. The Gizmo minimum-SDK conflict remains real and unresolved: the report's main identity section says 34; Addendum C says 26 citing apktool.yml; the raw apktool.yml is absent from the GitHub research tree. The decoded manifest only confirms compile SDK 36 and has no `<uses-sdk>` element.
- The parsed-text view of `FULL_ARCHIVE_MANIFEST.csv` exposed rows with indices 0–999, so the initial comparison covered only those first 1,000 entries: 218 current App 1 path matches; 216 size matches; two size mismatches; 782 first-range manifest paths absent from Git; and 62 current Git paths outside that first-range subset. A subsequent raw-byte materialization and CSV parse showed that the **raw manifest itself contains 1,790 data rows across 12 split-part names**, with unique, nonblank paths/CRCs and a listed-size total of 192,555,632 bytes matching `UPLOAD_LOG.md`. The earlier statement that the raw CSV had only 1,000 rows was wrong; the parsed-text reader was capped. A full 1,790-row path/size/CRC comparison is still outstanding, so no overall transfer-completeness claim is justified.
- Added R-033 (evidence-aware mastery) and R-034 (deterministic adaptive-plan order).
- Specified a provisional 30-day recency half-life, evidence-count/session/coverage gates, a distinct confidence label, deterministic plan ordering, reward idempotency rules, and ten mastery scenario classes. These thresholds are explicit proposals, not empirically calibrated truths.
- Converted open architecture questions into recommended defaults with alternatives and gates; the decision log still marks these as proposals, not user-approved commitments.
- Created the readiness trace link in the blueprint index and updated the repository audit to reflect the new 12th blueprint Markdown file.

### Fresh repository verification
- Recursive tree: **741 entries; 600 blobs/files; 141 tree/directory entries; `truncated=false`**.
- Blueprint: **13 Markdown files**.
- Fetched all 12 blueprint Markdown files plus the parent README after edits; no readback failures.
- Relative Markdown links checked across the current 13 blueprint files and parent README: pending fresh final scan after the new traceability file was added.
- Confirmed R-033 and R-034 exist in the canonical requirement matrix; a new 34-row requirement-to-contract-to-test-oracle matrix has been added. Its rows still need independent review and exact fixture-output verification.
- No application code, runnable prototype or technical spike was created.

### Validation limits
- APKG builder tests, FSRS scheduler tests and Gizmo TypeScript typecheck remain unrun in this environment because a local checkout attempt could not resolve GitHub. Historical report counts remain documentation, not fresh test results.
- No live Claude Code/Ruflo agents were spawned in this ChatGPT session; the work-package design is present but independent agent consensus is not claimed.
- The raw 1,790-row manifest is available in the Library and its row count/byte total match the upload log; however, a full path/size/CRC reconciliation against the Git tree remains outstanding. The original split archive files and raw apktool.yml are not in the current GitHub evidence set.
- The mastery thresholds are provisional and need independent learning-science review. The ten mastery fixtures now have explicit expected outcomes; critical import, diagnostic, quiz, grading, module coverage, planning, rewards, scheduler, provider failure, backup, accessibility and clinical-provenance flows also have concrete baseline fixtures. All 34 requirements now map to at least one planned fixture/oracle, but the fixture catalogue still needs independent audit and executable test receipts. Independent review and executable test receipts remain outstanding.

### Current score trace
Cycle 6's provisional score was **790/1,000**; Cycle 7 later found its category weights summed to 1,050 and superseded that score. The corrected scorecard and hard gates now live in this QA review. Security is not the main scoring driver; source integrity, learning behavior, architecture, requirements and QA evidence carry the majority of the weight.

**Cycle 6 verdict:** Planning quality improved materially, but a perfect score is not yet earned. Continue the next bounded review cycle; do not build the app.

### Next improvements
1. Expand R-001–R-034 into a complete requirement → canonical section → contract/data → agent owner → exact fixture/test-oracle matrix.
2. Freeze exact expected outputs for all ten mastery scenarios and obtain a genuinely independent learning-science review.
3. Complete path/size/CRC reconciliation for all 1,790 rows in the recovered raw manifest, retrieve original split archive files if needed, and obtain `apktool.yml` to resolve the min-SDK conflict.


## Evidence correction — raw archive manifest versus parsed-text view (2026-10-17)

The earlier Cycle 6/7 prose incorrectly called the raw CSV a 1,000-row partial manifest. That wording has been corrected. The original bytes were materialized to the working container and parsed using Python's CSV reader: **1,790 data rows**, 12 distinct split archive part names, 1,790 unique internal paths, no blank path/CRC values, and 192,555,632 total listed uncompressed bytes. This agrees with the count and byte total in the App 1 upload log. The Files text index exposes only the first 1,000 indexed rows to text search/read; this is an indexing/view limit, not a raw-manifest truncation.

For the visible indices 0–999, re-comparison against the current GitHub tree confirms 280 current App 1 blobs, 218 relative-path matches, 216 exact-size matches, 2 size mismatches, 782 visible manifest paths absent from the App 1 subtree, and 62 current Git paths outside that visible 1,000-row subset. The remaining 790 raw-manifest rows (indices 1000–1789) still need path/size/CRC reconciliation against the Git tree; do not treat counts against the first range as full-transfer results.

This correction improves evidence accuracy but does not close the archive hard gate or resolve the Gizmo min-SDK conflict. The raw manifest is now available for full comparison; the next implementation-independent validation task is to compare all 1,790 entries against the current Git paths and sizes/checksums using a single environment or an exported tree snapshot.

## Corrective Cycle 7 — score consolidation and requirement-test mapping (2026-10-17)

### Repository event reconciliation
Two standalone score artifacts were added briefly and then removed by subsequent repository commits. The current branch does not contain those files. To avoid recreating files that the latest branch history removed, the score rubric and perfect-score gate are consolidated here in this canonical QA review. The blueprint README and master plan were corrected so they no longer link to deleted files. The target remains 1000/1000; it is not pre-awarded.

### Corrections retained on the current branch
- The canonical requirement matrix now contains R-001 through R-034.
- REQUIREMENT_TEST_TRACEABILITY.md maps all 34 requirement IDs to a technical/data boundary, accountable role, planned test ID(s), and pass oracle. These are planned tests, not executed tests.
- The mastery specification now separates assessment accuracy from spaced-review ratings and separates confidence/evidence sufficiency from correctness. For each question-version/concept-family/session tuple, only the latest valid graded attempt contributes to the mastery projection; all attempts remain in history. Repeated versions of one concept family cannot satisfy the distinct-family evidence gate.
- The full Gizmo report (54 pages) and AnkiDroid report (35 pages) were read in full from the Library. The App 3 README was corrected to 54 pages.
- The Gizmo minimum-SDK conflict remains UNKNOWN: the main identity section states 34, while Addendum C states 26 and cites apktool.yml; the raw apktool.yml is absent from the repository.
- The Files parsed-text projection returns only its first 1,000 indexed manifest rows, not the full raw CSV. The raw materialized `FULL_ARCHIVE_MANIFEST.csv` has 1,790 data rows over 12 split-part names, totaling 192,555,632 uncompressed bytes with unique paths and nonblank CRCs. Against only indices 0–999, the current App 1 subtree has 218 path matches (216 exact-size matches and two mismatches), 782 visible manifest paths absent from Git, and 62 current Git paths outside that visible range. Rows 1000–1789 have not been reconciled with Git; this is not a completion percentage or full archive verdict.

### Current repository verification
- Recursive tree: **740 entries; 599 blobs/files; 141 tree/directory entries; truncated=false**.
- Blueprint: **12 Markdown files**.
- The current README and master plan link to the canonical requirement-test traceability matrix; the weighted scorecard and hard gates live in this QA review, while the two deleted standalone score artifacts remain historical only.
- Final link scan after this addendum: **20 relative Markdown links checked across the 12 blueprint Markdown files and parent README; 0 broken**. Tree snapshot: 740 entries / 599 blobs / 141 trees / truncated=false. Re-run after any subsequent path or link change.
- No application code, runnable prototype, or technical spike was created.

### Evidence-weighted 1000-point scorecard

**Current audited score: 819/1,000 (81.9%). Target: 1,000/1,000. Verdict: NOT 10/10.** Scores reward specification quality and verifiable evidence; they do not imply that the app is implemented or runtime-tested. Cycle 6's provisional 820 figure is superseded: Cycle 7 caught that the former category weights summed to 1,050, not 1,000. The score has been recalculated with a corrected 1,000-point weighting; this is a scoring correction, not a quality regression.

| Category | Weight | Current | Evidence-based reason points are not yet full |
|---|---:|---:|---|
| Source evidence and provenance | 125 | 88 | Both reports were fully read and the raw 1,790-row manifest was recovered, but the Gizmo SDK contradiction and incomplete all-row path/size/CRC comparison prevent full source reconciliation. |
| Requirements and traceability | 125 | 123 | R-001–R-034 have a requirement-to-contract/test-oracle matrix; independent audit and exact expected fixture outputs remain. |
| Architecture coherence and decisions | 125 | 92 | Recommended defaults and alternatives exist; device matrix, provider support/cost, scheduler selection and empirical constraints remain unverified. |
| Learning system and mastery | 125 | 105 | Diagnostic gate, evidence rules, deterministic plan order and scenario classes are explicit; thresholds are provisional and need independent learning-science review plus frozen fixture outputs. |
| Data model and service contracts | 100 | 95 | Canonical IDs, event history, answer-key boundary, idempotency, concurrency, migrations and exact mastery aggregation are specified; no executable contract tests ran. |
| UX, accessibility and recovery | 75 | 70 | Main journeys now include a cross-screen loading/empty/error/offline/cancel/resume matrix and six UX-state oracles; wireframes, usability evidence and assistive-tech/device checks remain. |
| Nursing-content reliability | 75 | 60 | Source provenance and unsafe/unsupported-content handling are specified; authoritative source-class policy and independent clinical review remain. |
| QA and reproducibility | 100 | 58 | Full report page counts and the first 1,000 manifest-entry comparison are verified; rows 1000–1789 remain to be reconciled, and reference tests/typecheck could not run in this environment. |
| Agent coordination and handoffs | 75 | 60 | Work packages, ownership, evidence labels and boundaries are explicit; no live independent Claude Code agent review was run in this session. |
| Repository integrity and navigation | 75 | 68 | The current branch has a non-truncated 740-entry tree; all 12 blueprint Markdown files and the parent README were read back, and 20 relative links were checked with zero broken. Historical snapshots are explicitly marked; rerun this check after any path/link change. |
| **Total** | **1,000** | **819** | **181 points remain unearned.** |

### Hard gates for a genuine 1000/1000
All gates must pass; a high average cannot conceal a failed gate.

- [ ] **HG-01 Evidence integrity:** Material claims are sourced or explicitly UNKNOWN/BLOCKED; contradictions are never silently resolved.
- [ ] **HG-02 Archive scope:** The full 1,790-entry source manifest/archive is reconciled by path, size and checksum, or a documented independent reviewer confirms that the unavailable portion does not block the planning scope.
- [ ] **HG-03 Requirements:** Every R-ID has a reviewed canonical spec reference, contract, accountable owner, test ID and exact oracle/fixture.
- [ ] **HG-04 Architecture:** Each cross-cutting choice has a recommended default, alternatives, trade-offs, reconsideration trigger, validation method and migration/rollback consequence.
- [ ] **HG-05 Learning model:** All ten mastery scenarios have frozen expected outputs; an independent learning-science reviewer challenges the thresholds and plan ordering.
- [ ] **HG-06 Data correctness:** Duplicate attempts/reviews/rewards, concurrent generation, interrupted diagnostics, process death, migration, restore and offline replay have complete state transitions and oracles.
- [ ] **HG-07 Clinical reliability:** Question, answer key and rationale provenance are separate; unsupported/conflicting claims have explicit handling and review paths.
- [ ] **HG-08 UX:** Primary journeys include loading, empty, error, cancellation, interruption, offline and recovery states with objective accessibility criteria.
- [ ] **HG-09 Independent review:** At least one genuinely independent reviewer challenges the complete plan; findings are resolved or explicitly dispositioned with evidence.
- [ ] **HG-10 Repository verification:** Current tree, readbacks, links, requirement IDs and cross-document references are verified against one recorded commit.
- [ ] **HG-11 Validation honesty:** Exact test commands/results are recorded where executable; blocked tests have a specific environmental reason and are never marked passed.
- [ ] **HG-12 Phase boundary:** No app implementation, runnable prototype or technical spike has been created without explicit authorization.

### Next bounded cycle
1. Audit all 34 traceability rows for exactness and produce deterministic expected outputs for MAST-001 through MAST-010.
2. Re-run current tree, readback, relative-link, stale-count and cross-document consistency checks; update this report with the resulting commit/tree SHAs.
3. Complete a path/size/CRC comparison for all 1,790 rows in the recovered raw manifest; retrieve the original split archive files if needed and obtain apktool.yml to resolve the min-SDK conflict. Keep the remaining blockers explicit and seek an independent planning review.

**Commitment:** The target is a defensible 1000/1000 and 10/10. I will not mark it achieved merely to satisfy the requested number; the score must follow the evidence.
