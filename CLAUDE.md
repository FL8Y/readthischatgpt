# Ruflo — Claude Code Configuration

> **NEW SESSION? READ `FLY8 Study/HANDOFF.md` FIRST** (full state, in-flight work, next steps, gotchas). It was written 2026-10-16 and is the most detailed record; the sections below are the standing rules.

## PROJECT GOAL — read this first every session

**Building:** a personal-use Nursing Study App (Gizmo + AnkiDroid hybrid, nursing focus e.g. NP1). Owner is a "vibe coder": explain simply, be honest about what is untested. Security is not a concern (single user); do not over-engineer it.

**What it must do (owner's 10-point plan):**
1. Folders by subject (e.g. "NP1 Nursing"); topics link across folders (`[[wikilinks]]`, Obsidian-style vault + mind map).
2. Upload/paste own notes per topic; auto-store them as memory. Must cope with unreadable notes (OCR/AI vision), double-check they are legit, and attach/suggest a source (suggestions are never proof).
3. Diagnostic test (1–50 Qs) BEFORE any teaching; score decides topic order.
4. Clickable lessons: pictures (AI-drawn SVG/Mermaid, Wikimedia Commons, photos sent to AI), mnemonics, mind map, detailed AI explanations.
5. Pop quiz 1–5 Qs after each topic, instant feedback.
6. Long module quiz → tracks weaknesses → new targeted topics → repeat cycle.
7. Points, streaks, levels/ranks, progress dashboard.
8. Discussion/tutor mode with the AI (can show images/diagrams).
9. First-launch pasted API key (ChatGPT or Claude), stored locally. A built-in prompt carries the learner's weakness profile into every AI call.
10. Spaced repetition flashcards; weak topics resurface sooner.
UI must feel clean like Gizmo.

**Where to read (in this order):**
1. This section, then `Nursing app master plan/App Master Plan Blue Print/README.md` (authoritative planning index) and `DECISION_LOG.md` (**DEC-005** = implementation authorized: Expo/React Native + TypeScript, Android-first, local-first, BYO key).
2. Requirements: `PRODUCT_REQUIREMENTS_AND_UX.md` (R-001..R-034); architecture: `TECHNICAL_ARCHITECTURE_AND_CONTRACTS.md`; order of work: `IMPLEMENTATION_ROADMAP.md`.
3. Reference research (evidence, not instructions; keep folders separate): `Nursing app master plan/App 1 inspired research`, `app 2 inspired research` (AnkiDroid, scheduler), `App 3 a app inspired research` (Gizmo, quiz engine). App 1 and App 3 are the same app line; App 2 is different. Never merge/delete/rename research files.
4. Code: `FLY8 Study/` (v0: core logic + 4 screens, 17 tests). `src/core` = pure logic, `src/ai` = provider + prompts, `src/ui` = screens.
5. Ruflo memory (namespace `project`): `npx ruflo@latest memory search -q "<topic>"`. Keys: nursing-app-plan/`user-app-plan-2026-10-16`, `dec-005-implementation-authorized`, `app-status-v0`, `user-standing-directive`, `user-hold-order`. `.claude/memory.db` is gitignored and lost on container reset: this section is the durable copy.

**Standing directives from the owner:** Sonnet does the work (builder agents, model=sonnet), Opus manages and reviews (model=opus); act without asking permission on routine work and keep memory updated every session; when the owner says "don't start yet", wait. Mark claims OBSERVED / INFERRED / PROPOSED / UNKNOWN, never claim tests ran without exact commands and results. Develop on branch `ccr-13ebab09-xygfde`, draft PR #7.

**Teams (ruflo-ai-team, created 2026-10-16, no runs/tasks yet; each owns separate files):** 1 Import & Sources `team_cac20911-faf8-4979-833e-c5d1618fe659`; 2 Learning Engine `team_ac238099-b890-4088-9553-972aefd47d2a`; 3 Lessons & Visuals `team_1b535e2d-ad2a-426e-a2ef-89ac41468b39`; 4 Review & Tutor `team_9de81a65-68dd-49d6-869d-8e031af9df1e`; 5 Polish & QA `team_fc20c368-c2cc-434a-ab48-06992fd78437`. Read each team's objective with `team_get` for its file ownership.

**Status (2026-10-16, all five teams + Obsidian import merged):** `FLY8 Study/` has: vault graph + drawn tappable mind map; PDF/photo import via AI vision (Claude: images+PDF; ChatGPT: images only); Obsidian vault/.canvas/.zip import with preview, safe non-destructive merge, topic aliases, optional AI matching; readability + chunk provenance + AI double-check with unverified source suggestion; mastery/plan/points/streak; diagnostic gate; pop quiz (1-5), module quiz (typing, cloze, matching, ordering and choice questions; hint button, inline AI Explain, hard round; hinted correct answers earn half points), weakness-to-fix-topics loop; lessons (mnemonic, key facts, exam traps, sanitized AI SVG diagrams, Wikimedia images with credit, saved offline); flashcards + SM-2-lite spaced repetition (not FSRS, not AnkiDroid parity) with Anki-style deck list (New/Learning/Due per topic) and a 0-100 'Focus' score per card (lapses, recent misses, low ease, weak topic, new, overdue; see src/srs/focus.ts) driving a 'Focus on weak spots' session + tutor chat answering from notes first; Obsidian export; backup export/import now includes lessons, cards/reviews and tutor chat (never the key); Home dashboard with due-card count, key onboarding with test button, scrollable 8-tab bar, CI workflow, device checklist. Checked by lead: 199 unit tests pass, tsc clean, Android bundle builds. KNOWN GAPS: quiz/diagnostic resume after app is killed; module-result persistence; folder picker (Study uses first folder); tutor shows diagrams as code blocks; merge-time alias storing has no dedicated test. NEVER run on a device, never run against a live AI or real Obsidian vault.

**PNLE QUESTION STUDIO (accepted by owner 2026-10-16):** Team 6 `team_0d2c58e0-6d9e-47f7-8456-464991f59acb`, run `run_59bea330-e74d-495f-b8e7-4cab4d7bf250` (tasks T1 research, T2 archetypes, T3 ~100 gold then ~1000 original items, T4 long prompt + retriever + strategy chip, T5 verification). Hard rules: NEVER copy or reconstruct real PNLE items (confidential/copyrighted; recalled-question sites are off limits); original items only, flagged aiWritten/nurseReviewed:false. RESOLVED by T1 (second-hand: the official PRC PDFs could not be fetched): NP1 is NOT 'Foundation of Professional Nursing Practice'; it is Community Health Nursing. Fundamentals, ethics and pharmacology run through all five tests. See `FLY8 Study/data/pnle/research.md` and `archetypes.json` `pnleAreaNames`. Merged so far: T1 research, T2 archetypes (31). Next: T3 exemplars, T4 prompt + retriever, T5 verification.

**CHANGE OF PLAN (owner, 2026-10-16): NO PAID API.** Owner has only a ChatGPT Go subscription (and no API credits); API usage is billed separately from chat subscriptions. New default = **manual copy-paste mode** (provider 'manual'): the app builds a complete, detailed prompt (PNLE rules + learner weakness profile + notes + strict output format), the owner copies it into ChatGPT/Claude (their app), copies the reply, and pastes/uploads it back; the app validates it and creates the quiz/lesson/cards/topics. Plus a **Prompt Maker** screen ('I'm weak at X -> give me the prompt') with `detectReplyKind` to route the pasted reply, and a saved quiz bank so generated quizzes work offline. Keep the API-key mode as an optional advanced setting. Photo/PDF import in manual mode = owner attaches the photo in ChatGPT themselves using the app's transcription prompt. Keep batches small for ChatGPT Go message limits. Builders: A = manual bridge + settings/onboarding + routing of callModel/vision/tutor; B = Prompt Maker + reply detection + quiz bank. T4 (PNLE long prompt) is reused by both.

**PNLE status (2026-10-16):** T1 research, T2 archetypes (31), T3 100 original gold items (`FLY8 Study/data/pnle/gold.json`, per-area files in `gold/`), T4 long prompt + retriever + strategy chip merged; T5 blind check done (`data/pnle/verification.json`): 100/100 keys matched an independent Opus solve, but 30 items have quality concerns and the items are easier than their difficulty labels. Scale-up to ~1000 is ON HOLD until the 30 flagged items are fixed (harder distractors, no vignette-restates-answer, remove near-duplicates np3-016/np5-004 and np4-006/np5-007) and a nurse spot-checks a sample. All items are aiWritten:true, nurseReviewed:false.

**NEXT UPDATE QUEUE (owner requests, not built yet):**
1. **PNLE-style nursing prompt** (owner, 2026-10-16: "study like I'm reviewing for the board exam, PNLE, questions where you must use your brain, using Maslow"). Replace the generic 'NP1-style / NCLEX-style' wording in `FLY8 Study/src/ai/prompts.ts` (learnerProfile, QUESTION_SHAPE, TOPIC_QUESTION_SHAPE) and `src/ai/quizPrompts.ts` with one shared PNLE prompt module. Design: situational vignette questions (patient data, then 'priority / first / initial / most appropriate / needs immediate attention'); reasoning order Maslow (physiological before safety before love/belonging...), ABCs (airway, breathing, circulation), safety, nursing process (assess before intervening), least invasive first, acute before chronic, unstable before stable; delegation and scope-of-practice questions; therapeutic communication; infection control; 4 choices with plausible distractors; rationale must say why the answer is right, why each wrong option is wrong, and which strategy decided it (e.g. 'Maslow: oxygenation first'); tag each question with its strategy and PNLE area (current structure per T1 research, INFERRED from search summaries, official PDF unread: NP1 Community Health Nursing, NP2 Mother and Adolescent + Human Growth and Development, NP3 Surgery/Oxygenation/Fluids-Electrolytes/Infection-Immune/Cellular, NP4 Nutrition-GI/Metabolism-Endocrine/Perception-Coordination, NP5 Psychiatric + Life-threatening/Emergency; see FLY8 Study/data/pnle/research.md). Rules: stay inside the learner's notes where possible, mark AI-added facts for textbook check, never invent drug doses or guidelines, say when unsure, no patient-specific advice. Add a visible 'strategy' chip on the quiz feedback and a test that every generated question carries a rationale + strategy.

## Rules

- Do what has been asked; nothing more, nothing less
- NEVER create files unless absolutely necessary — prefer editing existing files
- NEVER create documentation files unless explicitly requested
- NEVER save working files or tests to root — use `/src`, `/tests`, `/docs`, `/config`, `/scripts`
- ALWAYS read a file before editing it
- NEVER commit secrets, credentials, or .env files
- NEVER add a `Co-Authored-By` trailer to user commits unless this project's `.claude/settings.json` has `attribution.commit` set (#2078). The Claude Code Bash tool may suggest one in its default commit-message template — ignore it. `Co-Authored-By` is semantic authorship attribution under git/GitHub convention; the tool is the facilitator, not a co-author.
- Keep files under 500 lines
- Validate input at system boundaries

## Ruflo Capability Brain & Implementation Loop

Ruflo is the coordination ledger and policy decision point. Claude Code is the
executor: after a Ruflo coordination call, continue implementing the task.

When it is registered, call
`guidance_brain({ mode: "recommend", task: "..." })` before complex Ruflo
work. Use its live registry instead of guessing tool names. Treat
`registered`, `configured`, `reachable`, `healthy`, and `authorized`
as separate facts. If the brain is unavailable, continue with the compatible
`guidance_recommend` tool, CLI discovery, and repository instructions.

Follow the returned loop:

1. Recall memory and ADR constraints.
2. Inspect source, runtime, dependencies, policy, and health.
3. Route to the smallest capable topology, agents, skills, and tools.
4. Plan acceptance criteria, safety envelope, ownership, and validation.
5. Execute in isolated scopes; the coding agent performs the work.
6. Test focused, regression, and failure paths.
7. Validate types, security, policy, compatibility, and artifacts.
8. Benchmark a source-bound candidate against a source-bound baseline.
9. Optimize measured bottlenecks without weakening safety.
10. Bind claims and evidence to exact source/build receipts.
11. Reconcile concurrent handoffs and disclose limitations.
12. Publish only through a separately authorized release gate.

### Concurrency and authority

- Never allow two writers in one worktree; give each writing agent an isolated
  worktree and explicit file ownership.
- Read-only research may run concurrently and report findings to the owner.
- Only the integration owner edits shared manifests and lockfiles or reconciles
  overlapping changes.
- A child may drop capabilities but cannot add tools, network, secrets, spend,
  concurrency, namespaces, or delegation depth.
- A lease or claim coordinates ownership; it does not authorize a side effect.
- Darwin, Flywheel, MetaHarness, memory, and neural systems may propose or
  evaluate candidates but cannot self-promote or expand their SafetyEnvelope.
- Bind tests, benchmarks, policy decisions, and release evidence to an exact
  commit or immutable dirty-worktree snapshot.

## Agent Comms (SendMessage-First Coordination)

Named agents coordinate via `SendMessage`, not polling or shared state.

```
Lead (you) ←→ architect ←→ developer ←→ tester ←→ reviewer
              (named agents message each other directly)
```

### Spawning a Coordinated Team

```javascript
// ALL agents in ONE message, each knows WHO to message next
Agent({ prompt: "Research the codebase. SendMessage findings to 'architect'.",
  subagent_type: "researcher", name: "researcher", run_in_background: true })
Agent({ prompt: "Wait for 'researcher'. Design solution. SendMessage to 'coder'.",
  subagent_type: "system-architect", name: "architect", run_in_background: true })
Agent({ prompt: "Wait for 'architect'. Implement it. SendMessage to 'tester'.",
  subagent_type: "coder", name: "coder", run_in_background: true })
Agent({ prompt: "Wait for 'coder'. Write tests. SendMessage results to 'reviewer'.",
  subagent_type: "tester", name: "tester", run_in_background: true })
Agent({ prompt: "Wait for 'tester'. Review code quality and security.",
  subagent_type: "reviewer", name: "reviewer", run_in_background: true })

// Kick off the pipeline
SendMessage({ to: "researcher", summary: "Start", message: "[task context]" })
```

### Patterns

| Pattern | Flow | Use When |
|---------|------|----------|
| **Pipeline** | A → B → C → D | Sequential dependencies (feature dev) |
| **Fan-out** | Lead → A, B, C → Lead | Independent parallel work (research) |
| **Supervisor** | Lead ↔ workers | Ongoing coordination (complex refactor) |

### Rules

- ALWAYS name agents — `name: "role"` makes them addressable
- ALWAYS include comms instructions in prompts — who to message, what to send
- Spawn ALL agents in ONE message with `run_in_background: true`
- After spawning, continue independent local work; wait only when a dependency
  genuinely blocks progress
- Do not poll repeatedly — agents message back or complete automatically
- Give every writing agent an isolated worktree and a non-overlapping file scope

## Swarm & Routing

### Config
- **Topology**: hierarchical-mesh (anti-drift)
- **Max Agents**: 15
- **Memory**: hybrid
- **HNSW**: Enabled
- **Neural**: Enabled

```bash
npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 8 --strategy specialized
```

### Agent Routing

| Task | Agents | Topology |
|------|--------|----------|
| Bug Fix | researcher, coder, tester | hierarchical |
| Feature | architect, coder, tester, reviewer | hierarchical |
| Refactor | architect, coder, reviewer | hierarchical |
| Performance | perf-engineer, coder | hierarchical |
| Security | security-architect, auditor | hierarchical |

### When to Swarm
- **YES**: 3+ files, new features, cross-module refactoring, API changes, security, performance
- **NO**: single file edits, 1-2 line fixes, docs updates, config changes, questions

### 3-Tier Model Routing

| Tier | Handler | Use Cases |
|------|---------|-----------|
| 1 | Agent Booster (WASM) | Simple transforms — skip LLM, use Edit directly |
| 2 | Haiku | Simple tasks, low complexity |
| 3 | Sonnet/Opus | Architecture, security, complex reasoning |

## Memory & Learning

### Before Any Task
```bash
npx @claude-flow/cli@latest memory search --query "[task keywords]" --namespace patterns
npx @claude-flow/cli@latest hooks route --task "[task description]"
```

### After Success
```bash
npx @claude-flow/cli@latest memory store --namespace patterns --key "[name]" --value "[what worked]"
npx @claude-flow/cli@latest hooks post-task --task-id "[id]" --success true --store-results true
```

### MCP Tools (use `ToolSearch("keyword")` to discover)

| Category | Key Tools |
|----------|-----------|
| **Memory** | `memory_store`, `memory_search`, `memory_search_unified` |
| **Bridge** | `memory_import_claude`, `memory_bridge_status` |
| **Swarm** | `swarm_init`, `swarm_status`, `swarm_health` |
| **Agents** | `agent_spawn`, `agent_list`, `agent_status` |
| **Hooks** | `hooks_route`, `hooks_post-task`, `hooks_worker-dispatch` |
| **Security** | `aidefence_scan`, `aidefence_is_safe`, `aidefence_has_pii` |
| **Hive-Mind** | `hive-mind_init`, `hive-mind_consensus`, `hive-mind_spawn` |

### Background Workers

| Worker | When |
|--------|------|
| `audit` | After security changes |
| `optimize` | After performance work |
| `testgaps` | After adding features |
| `map` | Every 5+ file changes |
| `document` | After API changes |

```bash
npx @claude-flow/cli@latest hooks worker dispatch --trigger audit
```

## Agents

**Core**: `coder`, `reviewer`, `tester`, `planner`, `researcher`
**Architecture**: `system-architect`, `backend-dev`, `mobile-dev`
**Security**: `security-architect`, `security-auditor`
**Performance**: `performance-engineer`, `perf-analyzer`
**Coordination**: `hierarchical-coordinator`, `mesh-coordinator`, `adaptive-coordinator`
**GitHub**: `pr-manager`, `code-review-swarm`, `issue-tracker`, `release-manager`

Any string works as a custom agent type.

## Build & Test

- ALWAYS run tests after code changes
- ALWAYS verify build succeeds before committing

```bash
npm run build && npm test
```

## CLI Quick Reference

```bash
npx @claude-flow/cli@latest init --wizard           # Setup
npx @claude-flow/cli@latest swarm init --v3-mode     # Start swarm
npx @claude-flow/cli@latest memory search --query "" # Vector search
npx @claude-flow/cli@latest hooks route --task ""    # Route to agent
npx @claude-flow/cli@latest doctor --fix             # Diagnostics
npx @claude-flow/cli@latest security scan            # Security scan
npx @claude-flow/cli@latest performance benchmark    # Benchmarks
```

26 commands, 140+ subcommands. Use `--help` on any command for details.

## Setup

```bash
claude mcp add claude-flow -- npx -y ruflo@latest mcp start
npx ruflo@latest doctor --fix
```

> The background `daemon` is optional. It runs interval workers that each spawn
> a headless `claude` session, so it consumes tokens continuously. Start it only
> if you want those sweeps: `npx ruflo@latest daemon start` (self-stops after 12h
> by default; `--ttl 0` to disable, `daemon status --all` to audit running daemons).

**Agent tool** handles execution (agents, files, code, git). **MCP tools** handle coordination (swarm, memory, hooks). **CLI** is the same via Bash.

**PRESET LIBRARY (2026-10-17, Team 8 `team_3ec96d18-09cf-4775-899f-dc5b348d9cab`, run `run_79ce1d0d-bd54-4926-8e12-7ceae3eebb90`):** `FLY8 Study/data/presets/*.json` now holds 793 AI-written notes in 14 packs (NP1 community + communicable, NP2 OB + pedia, NP3 cardio/resp + blood/cancer/surgery + fluids/burns/renal, NP4 ortho + neuro/senses + GI/endocrine, NP5 psych/emergency, GEN: fundamentals, pharmacology, laws/management/research). 690 were rewritten (own words, 0.3% 10-gram overlap, checked) from the owner's 20 review-handout PDFs; the PDFs and extracted text are NOT in the repo (scratchpad only; keep it that way). Each note has a "Check against your textbook" section; builders flagged many wrong/garbled handout facts (law numbers, doses, lab values): nothing is nurse-reviewed. Known gaps: handout text for HIV/AIDS cut off, antidiabetic drug section missing in pharmacology handout, NP area placement of some packs is a guess (GEN = all exams). Saved state is now sharded across AsyncStorage keys (`src/core/shards.ts`) so a full library does not hit Android's ~2MB value limit. Single-file reader: `FLY8 Study/scripts/reader` (build_reader.py), published as an Artifact. New UI (indigo, 5 tabs) merged; legacy screens (Library, Lesson, Tutor, Settings, Graph, Review) still need the second design wave. Prompt Maker/quiz bank and PNLE question fixes still deferred by owner.
