# Repository Audit — Nursing Study App Planning

**Audit date:** 2026-10-17  
**Repository:** `FL8Y/readthischatgpt`, default branch `main`  
**Scope:** Complete recursive Git tree inventory plus semantic inspection of project-relevant documentation and reference source.  
**Important limitation:** A tree inventory is not the same as reading every file's contents. Binary resources and hundreds of unrelated Claude/Ruflo framework files were inventoried but not all semantically read. The two complete research DOCX reports have now been read across all 54 Gizmo pages and all 35 AnkiDroid pages.

## 1. Repository-wide inventory

The initial GitHub recursive tree scan returned **729 entries** with `truncated=false`. After adding the ten new planning artifacts and updating the two READMEs, a verification scan returned **739 entries**, again with `truncated=false`. Top-level entry counts below are from the initial inventory before the planning artifacts were added:

| Top-level path | Entries | Purpose / treatment |
|---|---:|---|
| `.agents` | 4 | Agent skill/config material; preserve |
| `.claude-flow` | 16 | Ruflo runtime config, capability docs, metrics/policy; preserve |
| `.claude` | 308 | Agent definitions and commands; preserve |
| `.gitignore` | 1 | Root configuration; preserve |
| `.mcp.json` | 1 | Claude/Ruflo MCP configuration; preserve |
| `CLAUDE.md` | 1 | Root execution rules; read and preserve |
| `Nursing app master plan` | 397 | Research and project blueprint; primary task scope |
| `here is your guiding prompt` | 1 | Existing FLY8 repair continuation prompt; unrelated project; preserve unchanged |

The tree inventory is complete for the Git ref inspected. File content inspection was focused on the project instructions, research directories, reference implementations, and tests most relevant to the nursing app.

## 2. Master-plan directory inventory

Counts below are based on the recursive tree at the time of the audit.

| Directory | Entries | Files | Directories | Total listed bytes | Notes |
|---|---:|---:|---:|---:|---|
| App 1 inspired research | 337 | 280 | 57 | 49,682 | APK-derived Android metadata/resources; transfer log indicates incomplete archive upload |
| app 2 inspired research | 29 | 18 | 11 | 220,518 | AnkiDroid research, decoded manifest, integration examples, scheduler and APKG builder |
| App 3 a app inspired research | 27 | 20 | 7 | 283,937 | Gizmo report, derived extracts, research notes, AI quiz-generation reference code |
| App Master Plan Blue Print | 2 before this planning set | 1 | 1 | 3,872 | Previously only the README; now contains architect planning documents being added |

The bytes are Git tree listed file sizes, not the original APK size or a claim that all archive bytes were uploaded.

## 3. Project instruction files inspected

### Root `CLAUDE.md`
Observed rules include: read before editing, avoid unnecessary new files, never commit secrets, keep files under 500 lines, validate at system boundaries, separate writers into isolated worktrees, test focused/regression/failure paths, bind claims to exact commit/build receipts, and publish only through an authorized release gate.

**Application to this task:** create only the explicitly requested blueprint documentation; do not change global Claude configuration or the root FLY8 prompt.

### `.mcp.json` and `.claude-flow/config.yaml`
Observed configuration points to Ruflo/Claude Flow with hierarchical-mesh topology, up to 15 agents, hybrid memory, and hooks; `autoStart` is false. Configuration documents do not prove the MCP server is currently available or healthy.

### `.claude-flow/CAPABILITIES.md`
Contains the configured capabilities reference and agent categories. It is generated/dated and must not be treated as proof that every named agent/tool is installed, registered, reachable, or authorized now. A Claude Code execution must inspect live capability before spawning agents.

### Root `here is your guiding prompt`
This is a separate FLY8 repair/parity prompt. It is not the Nursing Study App specification. It was inspected for scope identification and must remain unchanged.

## 4. App 1 research findings

Paths inspected:
- `Nursing app master plan/App 1 inspired research/README.md`
- `Nursing app master plan/App 1 inspired research/UPLOAD_LOG.md`

The README is a minimal placeholder. The upload log is the strongest transfer-status source currently present.

Observed upload-log claims:
- The source archive had 1,790 file entries.
- The log historically states that 190/1,790 entries had been committed at the time it was written.
- Later entries describe a blocked Android-resource transfer and explicitly list the manifest, DEX files, compiled resources, and media as not uploaded in that batch.
- The log instructs future workers not to declare completion until the archive manifest and final Git tree are compared.

**Conclusion:** The App 1 directory is not proven to contain the full archive. Its current 280 Git files do not establish completeness. Do not infer a final transfer percentage by dividing current tree files by archive entries because repository paths may include pre-existing files, folder structure, or other commits.

## 5. App 2 research findings

Files inspected:
- `app 2 inspired research/README.md`
- `framework/METHOD.md`
- `research/core_engine_librsdroid.md`
- `research/integration_surface.md`
- `product/ankidroid-bridge/src/AnkiDroidBridge.kt`
- `product/apkg-builder/build_apkg.py`
- `product/apkg-builder/test_apkg.py`
- `product/srs-scheduler/src/fsrs.ts`
- `product/srs-scheduler/test/fsrs.test.ts`
- decoded Android manifest

Key observations:
- The report labels observed versus inferred findings and states static analysis only.
- The AnkiDroid bridge targets a content provider and runtime permission; it says compile-checked but not device-tested.
- The APKG builder has tests; README reports 4/4 passing.
- The scheduler is explicitly a minimal FSRS-5 reference and warns it does not reproduce exact AnkiDroid scheduler intervals.
- README reports 10/10 scheduler tests, but these are documented claims until reproduced in a suitable environment.
- The method notes state that source code was not executed on a device.

**Architecture implication:** Own review data/scheduling behind an interface, and evaluate optional AnkiDroid interoperability separately. Do not make a third-party app a mandatory dependency without a product decision.

## 6. App 3 research findings

Files inspected:
- `App 3 a app inspired research/README.md`
- `framework/METHOD.md`
- `research/quiz_engine_rules.md`
- `research/data_model_events_flags.md`
- `research/native_android_security.md`
- data extracts for routes, API paths, model strings, daily quiz events, ECS components, and quiz systems
- `product/ai-next-quiz/src/quiz.ts`
- `product/ai-next-quiz/src/generate.ts`
- `product/ai-next-quiz/src/quizService.ts`
- `product/ai-next-quiz/package.json` and `tsconfig.json`

Key observations:
- Research is static analysis of a Gizmo Android package; the app was not run and no requests were sent to its servers.
- The report says most app logic is in Hermes bytecode and AI generation occurs server-side.
- The reference quiz schema supports choice, typing, cloze, matching, and ordering question types.
- Its generic quiz schema is constrained to 3–12 questions, which conflicts with the product's configurable 1–5 topic quizzes and 1–50 diagnostics if reused unchanged.
- The code has bounded retries and schema/semantic checks, but the shown schema allows a choice `answerIndex` to be outside the option range until the semantic check runs; this illustrates why semantic validation is required.
- The service uses an in-memory per-user refilling set and abstract storage interfaces. Production correctness still requires persistent concurrency control, atomic dequeue/insert semantics, idempotency, and explicit failure recovery.
- The generation file expects an environment key and a provider SDK; that is server-side reference code, not safe to ship in a mobile client.
- README states the reference is type-checked but not run against a live API.

## 7. Current blueprint condition

Before this planning set was added, the blueprint directory contained only `README.md`. Its README's App 1/App 2/App 3 relationship description conflicted with the user's latest explicit clarification. The new plan records the current relationship: App 1 and App 3 are related; App 2 is distinct.

## 8. Evidence coverage and remaining work

### Inspected directly in this audit
- Complete recursive Git tree metadata (729 entries, not truncated).
- Root project execution instructions and key Ruflo configuration/capability summary.
- Master-plan parent README and blueprint README.
- App 1 README/upload log.
- App 2 README, method, core engine/integration notes, decoded manifest, and principal reference code/tests.
- App 3 README, method, selected research addenda/data extracts, and principal quiz-generation reference code.

### Inventoried but not semantically read in full
- Hundreds of unrelated `.claude/commands` and `.claude/agents` files.
- Most Android resource XML and generated metadata files under App 1.
- Every binary/native/resource file and every individual file in the complete repository.
- The complete 35-page and 52-page DOCX reports were not fully extracted during this GitHub content pass; their READMEs and relevant research files were inspected, and a Gizmo report snippet is available in the conversation's file search results.

### Must be done before implementation planning is declared complete
1. Read/extract both complete DOCX reports, including appendices, and reconcile their claims with the markdown notes.
2. Inspect the remaining reference-code files and run isolated tests where tooling permits.
3. Verify the current Git tree after the new planning files are committed.
4. Build the requirements traceability matrix and architecture options report.
5. Record unresolved decisions and red-team findings.
6. Do not declare the App 1 archive transfer complete without the original manifest and a verifiable path/size/hash comparison.
