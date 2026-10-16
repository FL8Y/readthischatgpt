# 1000-Point Architecture Readiness Trace

**Purpose:** An auditable path to a genuine 10/10 plan. This is a scorecard, not a motivational badge. A score may not be raised merely because the user requests a perfect score.
**Current phase:** Planning only. Application implementation is not authorized.
**Scoring rule:** 10 categories sum to 1,000 points. Each score requires repository evidence. The overall plan cannot be declared 10/10 while any hard gate below fails, regardless of the arithmetic total.
**Current audited result:** **790 / 1,000 (79%) — NOT 10/10.**
**Target:** **1,000 / 1,000 (100%)**, with every hard gate passing. The score is expected to change as evidence is added and independent reviewers challenge the plan.

## Weighted scorecard

| Category | Weight | Current | Evidence for awarded points | What prevents full points |
|---|---:|---:|---|---|
| Source evidence and provenance | 150 | 105 | Complete 54-page Gizmo and 35-page AnkiDroid reports freshly read; selected reference code and manifests inspected; observed/inferred labels retained | Gizmo min-SDK conflict remains inside the report; available archive manifest contains only indices 0–999 despite the related archive README claiming 1,790 entries; App 1 transfer is not reconciled end-to-end |
| Requirements and traceability | 150 | 140 | R-001–R-034 cover the product loop, strict diagnostics, topic quizzes, remediation, mastery, and deterministic planning; acceptance evidence is stated | Need a row-by-row independent trace from every requirement to canonical contracts, agent task, and exact test fixture; some policies still require concrete fixture outputs |
| Architecture coherence and decisions | 150 | 105 | Android-first native modular-monolith/local-first baseline, alternatives, rationale, and proposed defaults are recorded | Defaults remain proposals; no live device/API matrix, provider support/cost validation, scheduler version selection, or empirical persistence/performance evidence |
| Learning system and mastery | 150 | 110 | Diagnostic gate, distinct evidence, coverage, 30-day recency weighting, provisional mastery thresholds, deterministic plan ordering, and ten scenario classes specified | Thresholds are provisional; exact repeat-cap aggregation and expected outputs for every fixture must be frozen and independently reviewed; no learner validation |
| Data model and service contracts | 100 | 85 | Canonical entities, source provenance, event history, answer-key separation, idempotency, concurrency, migration, and offline constraints specified | No executable contract tests; several exact failure/recovery state transitions need scenario-level request/response fixtures |
| UX, accessibility and recovery | 75 | 60 | Main journeys, diagnostic recovery, graph text alternatives, non-color state, scaling, screen reader, and offline/restart needs are specified | No complete screen-state inventory, wireframes, usability evidence, or real-device accessibility tests |
| Nursing-content reliability | 75 | 60 | Source provenance, unsupported-answer labeling, conflict flags, versioned rationales, and non-certification language specified | No authoritative source-class policy, clinical reviewer sign-off, or end-to-end provenance fixture suite |
| QA and reproducibility | 100 | 40 | Acceptance catalogue and honest testing rules exist; repository tree and report page counts were rechecked | Reference test suites/typecheck could not run because the available environment could not check out GitHub; App 1 archive comparison is blocked by incomplete manifest evidence; no independent full cross-document test-matrix audit yet |
| Agent coordination and handoffs | 50 | 40 | Specialist packages, one-writer rule, evidence labels, source hierarchy, and planning-only boundary are explicit | Live Claude Code/Ruflo registry and agent spawning were not available to verify in this ChatGPT session; no fresh independent agent findings have been received |
| Repository integrity and navigation | 50 | 45 | Current recursive tree is non-truncated; canonical docs are consolidated; README navigation is maintained | Need a fresh automated link/path scan after the latest edits and reconciliation of stale historical statements in the QA/audit logs |
| **Total** | **1,000** | **790** |  | **210 points remain unearned** |

## Hard gates — all must pass before a 10/10 declaration

- [ ] **HG-01 — Evidence integrity:** Each material source claim is directly supported or explicitly marked UNKNOWN/BLOCKED. Contradictions are not silently resolved.
- [ ] **HG-02 — Archive evidence:** The available archive manifest is reconciled with the full source entry list and current repository paths/sizes/hashes, or the source transfer is explicitly scoped out with a documented reason. The present 1,000-row manifest is not enough to prove a 1,790-entry transfer.
- [ ] **HG-03 — Requirement coverage:** Every R-ID maps to a canonical spec section, logical component/data contract, owning work package, and one or more precise acceptance fixtures.
- [ ] **HG-04 — Architecture decisions:** Every cross-cutting decision has a proposed default, alternatives, trade-offs, trigger for reconsideration, owner, validation method, and rollback/migration impact.
- [ ] **HG-05 — Learning logic:** Mastery and adaptive-plan policy has exact expected outputs for every named fixture; diagnostic evidence is not conflated with post-teaching mastery; a learning-science reviewer has challenged the thresholds.
- [ ] **HG-06 — Data correctness:** Duplicate attempts/reviews/rewards, interrupted diagnostics, concurrent generation, process death, migration, restore and offline replay have explicit state transitions and test oracles.
- [ ] **HG-07 — Clinical evidence:** Question, answer key and rationale provenance are separately represented; unsupported/conflicting content has a documented state and handling path.
- [ ] **HG-08 — UX completeness:** Every primary journey has loading, empty, error, cancellation, interruption, offline and recovery states; accessibility requirements have objective criteria.
- [ ] **HG-09 — Independent review:** At least one genuinely independent review challenges the plan; findings are severity-ranked and each is resolved or has an explicit, justified disposition. A self-review alone cannot satisfy this gate.
- [ ] **HG-10 — Repository verification:** Current tree counts, changed-file readbacks, internal links, requirement IDs and cross-document terms are checked against the same commit.
- [ ] **HG-11 — Honest validation:** Test commands and outcomes are reproducible where the environment permits; unavailable tests have a precise blocker and are never reported as passed.
- [ ] **HG-12 — Phase boundary:** No app code, runnable prototype or technical spike exists in the planning phase unless the user explicitly authorizes a separate planning deliverable.

## Scoring protocol

1. Score each category only from artifacts, source reads, automated checks, or independent findings available at the recorded repository head.
2. A proposed design earns credit for clarity and testability, not for runtime behavior it has not demonstrated.
3. Do not award full points for an item whose acceptance evidence is only prose saying it is complete.
4. Re-score after each correction cycle; preserve old scores and explain score changes in the QA review.
5. Never inflate scores to meet the target. If a blocker depends on a missing source artifact, external runtime or unavailable independent reviewer, record the blocker and continue with all other work that can be completed.
6. Security is treated as a required minimum safety gate, but it is not the primary weighting driver for this user's current planning objective.

## Current blocker register

| ID | Blocker | Status | Next action |
|---|---|---|---|
| B-001 | Gizmo report's main identity section says min SDK 34; Addendum C says minSdk 26 citing apktool.yml. The primary apktool.yml is absent from the GitHub research tree; decoded manifest proves compile SDK 36 only. | UNKNOWN / external evidence needed | Preserve UNKNOWN. Locate the primary apktool.yml or the original source bundle before resolving. |
| B-002 | Available FULL_ARCHIVE_MANIFEST.csv has 1,000 rows (indices 0–999), not the 1,790 entries claimed by the archive instructions. Current App 1 tree has 280 blobs; 218 paths match those 1,000 rows, 782 listed paths are absent, 62 current files are not represented in the available partial manifest, and two matching files have size mismatches. | Partial comparison only; not a complete transfer verdict | Recover the complete manifest or all original split archives; then reconcile all paths, sizes and hashes. Do not publish a completion percentage from the partial manifest. |
| B-003 | APKG and FSRS tests/typecheck are described in reference reports but have not been rerun in this environment. | BLOCKED by checkout/runtime access | Rerun in a checkout-capable environment with exact command/runtime/commit receipts. |
| B-004 | No independent Claude Code agent run occurred in this ChatGPT session. | BLOCKED by tool boundary | Use the specified work packages in a live Claude Code environment and append evidence-backed findings; do not simulate agent consensus. |
| B-005 | Mastery thresholds and recency half-life are transparent proposals, not validated learning-science parameters. | PROPOSED | Freeze fixture outputs, obtain independent learning-science critique, and version any change. |

## Cycle history

### Cycle 5 — 2026-10-17
- Re-read the full current Gizmo report (54 pages) and AnkiDroid report (35 pages) through the Library file-reading pipeline.
- Corrected the stale Gizmo README page count from 52 to 54.
- Added proposed mastery/evidence rules and deterministic adaptive-plan ordering; added R-033 and R-034.
- Converted vague architecture questions into recommended defaults with explicit alternatives and gates.
- Discovered the available archive manifest is only a 1,000-row subset of the claimed 1,790-entry source. This is a new blocker, not evidence that transfer is complete.
- Current score: 790/1,000. No 10/10 claim is made because the hard gates remain open.

### Next cycle priorities
1. Finish the 34-row requirements-to-contracts-to-test mapping and freeze exact mastery fixture outputs.
2. Run a fresh tree/readback/link/ID consistency check after all current writes; correct stale historical statements in QA/audit.
3. Reconcile the full archive evidence if the complete manifest or original split archives are available; otherwise keep that gate explicitly blocked and improve all independent plan areas.
