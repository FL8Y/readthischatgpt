# Repository Audit — Nursing Study App Planning

**Audit date:** 2026-10-17  
**Repository:** `FL8Y/readthischatgpt`, default branch `main`  
**Scope:** Complete recursive Git tree inventory plus semantic inspection of project-relevant documentation and reference source. Latest current tree after score-file consolidation: 740 entries (599 blobs/files, 141 tree/directory entries), `truncated=false`; the blueprint contains 12 Markdown files, including the requirement-test traceability matrix. Current score and acceptance gates live in QA_COUNCIL_REVIEW.md.  
**Important limitation:** A tree inventory is not the same as reading every file's contents. Binary resources and hundreds of unrelated Claude/Ruflo framework files were inventoried but not all semantically read. The current Library DOCX versions were independently read in full during Cycle 5: Gizmo 54/54 pages and AnkiDroid 35/35 pages. The App 3 README's former claim of 52 pages was corrected to 54. The Gizmo minimum-SDK conflict remains unresolved: the report's main identity section says 34, while Addendum C says 26 citing apktool.yml; the primary apktool.yml itself is not present in the repository.

## Cleanup addendum — 2026-10-17

After consolidating the blueprint documents, a fresh recursive Git tree query returned **739 entries: 598 blobs/files and 141 tree/directory entries**, with `truncated=false`. The verified post-deletion snapshot was `81432ac4c8f4c0d05dabe7106d20886e36a14dad`; subsequent edits changed existing Markdown content, not paths.

The final `Nursing app master plan/` subtree has 407 entries including its root directory. The blueprint folder had 11 Markdown files at the recorded pre-readiness-trace snapshot and now has 12 Markdown files, no nested directories. The previously recorded 141,524-byte total is historical and should not be reused as current. `d018a28f50495a5c14f1d6bbf7dbe0f1f384fa33`. The QA review was then updated without changing paths; the byte total is a snapshot metric and may differ after later content edits. Research folder counts remain App 1: 280 files/57 directories including its root; App 2: 18 files/11 directories; App 3: 20 files/7 directories. Counts are path-specific and must be refreshed after later path changes.

The four legacy planning documents are now consolidated and deleted. Their exact original blob SHAs, destination documents and deletion commit SHAs are recorded in `CLEANUP_LOG.md`. No research files, raw assets, reference code or global Claude/Ruflo files were deleted.

## 1. Repository-wide inventory

The historical baseline tree had **729 entries** and the intermediate pre-cleanup snapshot had 743. The **final post-cleanup** tree has **739 entries (598 blobs/files, 141 tree/directory entries)** with `truncated=false`, verified at snapshot `158cdefab76f585b995cfc7a58b9da38fbbe668d`. The top-level counts below reflect the final post-cleanup tree:

| Top-level path | Entries | Purpose / treatment |
|---|---:|---|
| `.agents` | 4 | Agent skill/config material; preserve |
| `.claude-flow` | 16 | Ruflo runtime config, capability docs, metrics/policy; preserve |
| `.claude` | 308 | Agent definitions and commands; preserve |
| `.gitignore` | 1 | Root configuration; preserve |
| `.mcp.json` | 1 | Claude/Ruflo MCP configuration; preserve |
| `CLAUDE.md` | 1 | Root execution rules; read and preserve |
| `Nursing app master plan` | 407 | Research and project blueprint; primary task scope |
| `here is your guiding prompt` | 1 | Existing FLY8 repair continuation prompt; unrelated project; preserve unchanged |

The tree inventory is complete for the Git ref inspected. File content inspection was focused on the project instructions, research directories, reference implementations, and tests most relevant to the nursing app.

## 2. Master-plan directory inventory

Counts below are based on the recursive tree at the time of the audit.

| Directory | Entries | Files | Directories | Total listed bytes | Notes |
|---|---:|---:|---:|---:|---|
| App 1 inspired research | 337 | 280 | 57 | 49,682 | APK-derived Android metadata/resources; transfer log indicates incomplete archive upload |
| app 2 inspired research | 29 | 18 | 11 | 220,518 | AnkiDroid research, decoded manifest, integration examples, scheduler and APKG builder |
| App 3 a app inspired research | 27 | 20 | 7 | 283,937 | Gizmo report, derived extracts, research notes, AI quiz-generation reference code |
| App Master Plan Blue Print | 12 | 11 | 1 | 141,457 | Eleven canonical Markdown documents after consolidation; no nested directories |

The bytes are Git tree listed file sizes, not the original APK size or a claim that all archive bytes were uploaded.

## Test-execution limitation

A local `git ls-remote` / checkout attempt failed because the container could not resolve `github.com`. GitHub API reads and read-back verification were available, but this environment did not run the App 2 offline tests, reference TypeScript typecheck, device tests, live provider calls, or an app build. Historical test counts in READMEs and prior reports are not newly reproduced results in this pass.



### Cycle 5 archive-manifest comparison (2026-10-17)
A Library search surfaced `FULL_ARCHIVE_MANIFEST.csv` and `README_FOR_CLAUDE.txt`. The raw CSV was materialized and parsed from its original bytes in the working container: it contains **1,790 data rows across 12 split-part names**, no duplicate paths, no blank paths/CRC values, and a listed uncompressed-size total of **192,555,632 bytes**. Those values match the source archive count/byte total recorded in `UPLOAD_LOG.md`; therefore, the earlier claim that the *raw CSV* had only 1,000 rows was incorrect. The 1,000-row limit applies to the parsed-text view returned by the Files reader, not to the raw manifest bytes.

A comparison was therefore performed against the **first 1,000 indexed rows only** (indices 0–999) exposed by that parsed-text view. The current App 1 subtree has 280 Git blobs: 218 exact relative-path matches to those 1,000 rows; 216 of those matches have exact byte-size agreement; two differ in size (`META-INF/NOTICE.md`: manifest 1,074 bytes vs Git 1,075; `assets/www.bundle/_expo/static/css/styles-40df4e19ca742774b7c0458734a7055e.css`: manifest 474 vs Git 473); 782 of the first 1,000 manifest-listed paths are absent from the current subtree; and 62 current subtree files are not represented in that first-1,000-row subset. These are **not** full-manifest counts. Rows 1000–1789 have not yet been compared to the Git tree, so no 1:1 transfer-completeness claim or valid overall completion percentage can be made. The full manifest itself is available; the remaining work is complete path/size/CRC reconciliation using a comparison method that can process all 1,790 raw rows and the current Git tree together.

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

At the post-consolidation snapshot, the blueprint contained 11 Markdown files. The current branch has 12 Markdown files after adding REQUIREMENT_TEST_TRACEABILITY.md; the two temporary standalone score artifacts were later removed and the score rubric is now consolidated in QA_COUNCIL_REVIEW.md. See CLEANUP_LOG.md for the source-to-destination map and deletion receipts. The source relationship is user-confirmed: App 1 and App 3 are related; App 2 is distinct. The prior QA review identified and corrected stale relationship wording and added an answer-key boundary, strict diagnostic gate, and concurrency requirements.

## 8. Evidence coverage and remaining work

### Cycle 5 update — 2026-10-17
- Read the current Library versions of the full Gizmo report (54/54 pages; 2,671 extracted text lines) and AnkiDroid report (35/35 pages; 1,765 extracted text lines) using the file-reading pipeline. This is a fresh full-text read, not an inference from the Git tree.
- Resolved the report page-count issue: the Gizmo DOCX has 54 pages; the App 3 README's 52-page statement was stale and has been corrected. AnkiDroid is 35 pages.
- Reconfirmed the SDK conflict is inside the Gizmo report itself: its identity section says min SDK 34, while Addendum C says minSdk 26 and cites apktool.yml. The raw apktool.yml is not present in the current repository tree, and the decoded manifest has no uses-sdk element. Keep the product-reference minimum UNKNOWN; do not select either value as fact.
- Added explicit provisional mastery/evidence rules, deterministic adaptive-plan ordering, ten scenario fixtures, and requirements R-033/R-034. These are proposed product policies, not empirically validated learning-science thresholds.

### Inspected directly in this audit
- Complete recursive Git tree metadata was re-scanned after cleanup (739 entries: 598 blobs and 141 trees; `truncated=false`; see the cleanup addendum for the snapshot SHA).
- Root project execution instructions and key Ruflo configuration/capability summary.
- Master-plan parent README and blueprint README.
- App 1 README/upload log.
- App 2 README, method, core engine/integration notes, decoded manifest, and principal reference code/tests.
- App 3 README, method, selected research addenda/data extracts, and principal quiz-generation reference code.

### Inventoried but not semantically read in full
- Hundreds of unrelated `.claude/commands` and `.claude/agents` files.
- Most Android resource XML and generated metadata files under App 1.
- Every binary/native/resource file and every individual file in the complete repository.
- The full reports were freshly re-read from the Library during Cycle 5 (Gizmo 54/54 pages; AnkiDroid 35/35 pages). The stale 52-page App 3 README statement is corrected. The SDK contradiction remains because the primary apktool.yml is missing from GitHub. The App 3 decoded `AndroidManifest.decoded.xml` shows `compileSdkVersion="36"` but has no `<uses-sdk>` element, so that file cannot settle the conflicting reported minimum-SDK values of 26 versus 34. Keep min-SDK **UNKNOWN** until the original APK manifest/build metadata (`apktool.yml` or equivalent) is verified.

### Must be done before implementation planning is declared complete
1. Resolve the Gizmo min-SDK conflict only from `apktool.yml` or another primary build/manifest artifact. The decoded manifest in GitHub proves compile SDK 36 but not minimum SDK.
2. Complete the path/size/CRC comparison for all 1,790 rows of the raw `FULL_ARCHIVE_MANIFEST.csv` against the current App 1 Git tree; the current comparison only covers indexed rows 0–999.
3. Inspect remaining relevant reference-code files and run isolated tests where tooling permits; record exact commands/results or why they were not run.
4. Re-scan and read back the latest tree and all changed files after each commit; ensure counts and links are current.
5. Validate proposed architecture defaults, scheduler version and device matrix; finalize exact expected outputs for the provisional mastery scenario suite and obtain independent learning-science review.
6. Do not declare the App 1 archive transfer complete without full path/size/CRC reconciliation. Do not infer a transfer percentage from current file counts.
