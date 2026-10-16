# Claude Agent Work Packages — Nursing Study App

**Phase:** Research and architecture only. No app implementation.  
**Coordination model:** One lead architect/integration owner; read-only research in parallel; one writer per file.

## Coordination contract

Every agent begins by reading the blueprint README and MASTER_ARCHITECT_PLAN.md, plus its assigned source files. Agents must not edit other agents' outputs or modify research assets. They return evidence with file paths and label facts OBSERVED, INFERRED, PROPOSED, or UNKNOWN/BLOCKED. Do not use a shared worktree for concurrent writers. The lead architect owns reconciliation and final commits.

Before spawning agents, inspect the real Claude Code/Ruflo agent registry and tools. Use only agents and capabilities actually available. If unavailable, execute the same bounded assignments sequentially and say so.

## Agent 1 — Repository Auditor

**Ownership:** REPO_AUDIT.md  
**Scope:** Inventory every entry returned by the current recursive Git tree (the pre-cleanup snapshot had 740 entries; the post-cleanup snapshot had 739 entries: 598 blobs and 141 trees; re-scan current branch first and use REPO_AUDIT.md for the latest recorded evidence); categorize root configuration, Claude/Ruflo framework, master-plan folders, research assets, reference code, tests, and generated/binary files. Read root CLAUDE.md, .mcp.json, relevant config, parent README, blueprint README, App 1 README and UPLOAD_LOG, App 2 README/method/research/product/test files, App 3 README/method/research/data/product files. Do not claim all binary payloads were read. Record paths, sizes, SHA where available, source limits, and missing/blocked archive items.  
**Acceptance:** Counts reproduce from a fresh tree; paths and directory names are exact; current transfer status is separated from historical upload-log status; FLY8 root prompt is identified as unrelated and preserved.

**Copy-paste prompt**
> You are the read-only Repository Auditor for the Nursing Study App planning project. Read the blueprint instructions and audit all repository paths and project-relevant files. Do not build the app or modify research files. Produce REPO_AUDIT.md only in the blueprint folder. Report exact tree counts, directory counts, important paths, file types, current versus historical archive-transfer status, source files semantically inspected, files only inventoried, limitations, and open gaps. Label findings OBSERVED/INFERRED/UNKNOWN. Do not claim to have read binary files. Do not edit root CLAUDE.md, .mcp.json, .claude*, .agents, or the root FLY8 guiding prompt. Do not create the audit file until you have inspected the relevant sources and verified the current tree.

## Agent 2 — Gizmo / App 3 Research Analyst

**Ownership:** Gizmo evidence section in TECHNICAL_ARCHITECTURE_AND_CONTRACTS.md; report findings to lead before editing shared docs.  
**Scope:** Read App 3 README, report if available in repository/library, METHOD.md, quiz_engine_rules.md, data_model_events_flags.md, native_android_security.md, data extracts, and product/ai-next-quiz source/config. Review schema bounds, source grounding, validation, retries, concurrency, buffering, error handling, answer-key leakage risk and gaps relative to the required diagnostic/pop-quiz sizes. Do not call external Gizmo services or use credentials.  
**Acceptance:** Separate direct observations from inference; identify reusable concepts versus proprietary implementation; propose improvements and tests.

**Copy-paste prompt**
> Analyze only the Gizmo/App 3 research material for the original Nursing Study App. Read the assigned research and reference code. Do not build the app, contact Gizmo servers, or copy proprietary code/assets. Report evidence-backed patterns, code-level risks, source limitations, and design recommendations for quiz generation, lessons, tutoring, quiz buffering, schema validation, and clinical-source grounding. Specifically compare existing 3–12 generated-quiz schema bounds with product requirements of 1–5 topic quizzes and 1–50 diagnostics. Label all findings OBSERVED/INFERRED/PROPOSED/UNKNOWN. Send a concise report to the lead architect; do not edit other agents' files.

## Agent 3 — AnkiDroid / Spaced-Repetition Analyst

**Ownership:** AnkiDroid evidence section in TECHNICAL_ARCHITECTURE_AND_CONTRACTS.md; report findings to lead.  
**Scope:** Read App 2 README, METHOD.md, android_layer.md, core_engine_librsdroid.md, integration_surface.md, decoded manifest, AnkiDroid bridge, APKG builder/tests, scheduler implementation/tests. Evaluate owned scheduler versus optional AnkiDroid integration and export. Confirm which tests are documented versus rerun.  
**Acceptance:** Explain FSRS-5 limitation, permission/integration risks, device-test gap, scheduler persistence and migration needs.

**Copy-paste prompt**
> Analyze the AnkiDroid/App 2 research and reference code for the Nursing Study App. Do not implement the production app and do not alter the reference files. Inspect the bridge, APKG builder/tests, scheduler/tests, manifest and research notes. If execution is available, run existing isolated tests without modifying source and report exact commands/results; otherwise report not run. Compare (a) app-owned scheduler, (b) optional AnkiDroid bridge, and (c) APKG import/export. Include licensing/IP boundaries, Android permission behavior, scheduler versioning, review-event persistence, migration, offline use, and device-verification gaps. Label evidence and send findings to the lead architect.

## Agent 4 — Learning Science & Nursing Safety Reviewer

**Ownership:** Research findings for PRODUCT_REQUIREMENTS_AND_UX.md; send evidence and recommendations to the integration owner  
**Scope:** Convert product requirements into assessment, lesson, retrieval, feedback, mastery, and remedial-cycle rules. Define uncertainty and safeguards for clinical content; do not invent medical claims.  
**Acceptance:** Distinguish diagnostic score from mastery, define data needed for reliable adaptation, avoid rewarding spam, propose testable learning outcomes and content provenance.

**Copy-paste prompt**
> You are an independent learning-science and nursing-content-safety reviewer. Do not write application code. Specify the learning loop from diagnostic through lesson, short quiz, spaced review, module assessment, and targeted remediation. Define how topic mastery and confidence differ, how sparse evidence and guessing are handled, what a clinically responsible rationale should include, how conflicts in user source material are surfaced, and which claims require review against authoritative sources. Produce PRODUCT_REQUIREMENTS_AND_UX.md in the blueprint folder only if you are the assigned sole writer; otherwise send findings to the lead. Include acceptance tests and concrete failure cases.

## Agent 5 — Mobile UX & Accessibility Reviewer

**Ownership:** PRODUCT_REQUIREMENTS_AND_UX.md UX sections, coordinated with Agent 4 through lead.  
**Scope:** Mobile-first navigation, subject/topic library, diagnostic, lesson, quiz, review queue, tutor, dashboard, settings, import, offline, error/empty/loading states, accessibility. Do not select a tech stack without the technical architecture comparison.  
**Acceptance:** Every primary flow has states and recovery paths; short study sessions are supported; no screen depends solely on color.

**Copy-paste prompt**
> Review the Nursing Study App requirements as a mobile UX and accessibility specialist. Do not build UI code or choose a framework prematurely. Define navigation, primary screens, user journeys, empty/loading/error/offline states, progress visibility, accessible color/contrast/text/touch targets, screen-reader labels, and low-friction study flows. The app includes diagnostics, lessons, 1–5 question pop quizzes, module tests, spaced review, tutor chat, imported materials, and API settings. Produce evidence-backed UX requirements and acceptance tests; report to the lead architect.

## Agent 6 — Security, Privacy & AI Platform Analyst

**Ownership:** Security findings for TECHNICAL_ARCHITECTURE_AND_CONTRACTS.md; send findings to the integration owner. Do not edit the shared spec unless explicitly appointed its sole writer.  
**Scope:** Evaluate direct provider-key storage vs backend proxy, local encryption, data minimization, import/document processing, logging, rate limits, validation, privacy, backups, sync, and source-grounded generation. Do not request or expose any real key.  
**Acceptance:** Threat model includes key extraction, malicious imports/prompt injection, data leakage, provider failure, abuse/cost controls, and backup compromise.

**Copy-paste prompt**
> Perform a threat-model and AI-platform architecture review for the Nursing Study App. Do not implement code and do not use real secrets. Compare user-supplied provider keys stored securely on-device, a backend proxy, and a hybrid design. Assess the fact that client-side keys cannot be guaranteed secret; document local encryption limits, log redaction, prompt injection from imported notes, malicious documents, data retention, backups, network failure, rate limiting, budget limits, provider fallback, schema validation, and clinical content safety. Recommend a default with explicit trade-offs and verification tests. Send findings to the lead architect.

## Agent 7 — Data Model & API Contract Architect

**Ownership:** Research findings for TECHNICAL_ARCHITECTURE_AND_CONTRACTS.md; send findings to the integration owner  
**Scope:** Propose canonical content entities, stable IDs, topic relationships, source provenance, assessments, questions, answer attempts, review events, scheduler state, mastery estimates, generated lessons, tutor sessions, rewards, and sync/version metadata.  
**Acceptance:** Define invariants, event/idempotency strategy, schema versioning, offline conflict behavior, APIs, and transaction boundaries. No final stack-specific code.

**Copy-paste prompt**
> Design the stack-neutral data model and service contracts for the Nursing Study App. Do not implement application source. Define entities, IDs, relationships, provenance, content versions, question variants, diagnostic sessions, answer attempts, review events, scheduler state, mastery estimates with confidence, remedial plans, rewards, AI generation jobs, tutor sessions, and sync metadata. State invariants, uniqueness rules, idempotency, transactions, migration/versioning, offline conflict resolution, and API request/response contracts. Mark unresolved choices and acceptance tests. Produce TECHNICAL_ARCHITECTURE_AND_CONTRACTS.md as the sole writer or send findings to the lead.

## Agent 8 — Independent Architecture Red Team

**Ownership:** Review report in DECISION_LOG.md or a separately assigned review file.  
**Scope:** Challenge proposed architecture and agents' conclusions. Find contradictions, overengineering, under-specified boundaries, impossible acceptance criteria, unverified assertions, privacy risks, unsafe clinical-content assumptions, and race conditions.  
**Acceptance:** Every finding has severity, evidence, impact, recommended fix, and verification step.

**Copy-paste prompt**
> Independently red-team the Nursing Study App planning package. Do not implement the app and do not approve the plan by default. Read the source evidence and all current planning documents. Find contradictions between requirements, UX, data model, provider architecture, SRS, and work packages; flag answer-key leakage, non-atomic queue operations, duplicate rewards/attempts, diagnostic bypass paths, unverifiable claims and weak tests. Prioritize findings by severity and include evidence, impact, remediation, and a verification test. Send findings to the integration owner. Do not overwrite other documents.

## Integration owner — Master Architect

The lead is the only final writer for integrated planning specs unless a task explicitly assigns one specialist as the sole writer. Agents must submit research first and avoid overlapping edits.

The lead:
1. Re-scans current Git tree and checks repository state.
2. Assigns the above tasks using actual available agents or runs them sequentially.
3. Prevents overlapping writes and reconciles contradictory results.
4. Owns TECHNICAL_ARCHITECTURE_AND_CONTRACTS.md, PRODUCT_REQUIREMENTS_AND_UX.md, IMPLEMENTATION_ROADMAP.md, DECISION_LOG.md, and final document integration.
5. Reviews all outputs from developer, designer, nursing student, learning scientist, security, and red-team perspectives.
6. Rereads all changed files from GitHub and checks links.
7. Reports what was done, what was not done, and the next bounded task.
8. Does not begin application implementation until a separate authorization gate is satisfied.
