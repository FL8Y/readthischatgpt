# FLY8 Study — session handoff (written 2026-10-16)

Read this first in a new session, then `CLAUDE.md` (root) sections "PROJECT GOAL", "CHANGE OF PLAN", "PNLE", then the blueprint README.
Everything below is labelled OBSERVED (seen/ran), INFERRED, or UNKNOWN. Nothing has ever run on a phone.

## 1. The owner and how to work with them
- Owner = a "vibe coder" building a personal nursing study app for the Philippine licensure exam (PNLE; NP1 first). Explain simply, be honest, say what is untested.
- Standing orders: act without asking permission on routine work, keep memory updated every session, obey "don't start yet", Sonnet builds / Opus manages and reviews (set `model` on each Agent call; the team service does not enforce it).
- Security is not a concern (single user). Cost IS a concern: **no paid API** (owner has only ChatGPT Go). See section 5.
- Owner has NOT yet answered: is NP1 the only subject or all NP1-NP5? Are questions in English? (Assume English, all five areas, NP1 first.)

## 2. Where everything lives
- Repo `FL8Y/readthischatgpt`, working branch `ccr-13ebab09-xygfde`, draft PR #7 (https://github.com/FL8Y/readthischatgpt/pull/7). Always develop on that branch; push with `git push -u origin ccr-13ebab09-xygfde`.
- App: `FLY8 Study/` (Expo SDK 58 / React Native 0.88 / TypeScript). Pure logic in `src/core`, AI prompts/provider in `src/ai`, screens in `src/ui`, plus `src/{import,lesson,obsidian,pnle,srs,tutor,visual}`, `src/backupIO.ts`, `src/storage.ts`.
- Planning authority: `Nursing app master plan/App Master Plan Blue Print/` (README, DECISION_LOG with DEC-005, requirements R-001..R-034). Research folders (App 1/2/3) are evidence only; never merge/delete/rename them.
- PNLE data: `FLY8 Study/data/pnle/` = `research.md`, `archetypes.json|md` (31 types), `gold/np1..np5.json` + `gold.json` (100 original items), `verification.json`.
- Root `here is your guiding prompt` is an unrelated FLY8 clone-app repair prompt. Do not touch.
- Ruflo memory: `npx -y ruflo@latest memory search -q "<words>"` (namespace `project`; DB `.claude/memory.db` is gitignored and lost on container reset, so this file and `CLAUDE.md` are the durable copy). Key names include `HANDOFF-2026-10-16`, `project-goal-detailed`, `change-of-plan-no-api`, `pnle-t5-result`.
- Agent worktrees live in `.claude/worktrees/` (excluded from git via `.git/info/exclude`; ephemeral).

## 3. What is built (OBSERVED by lead: 227 unit tests pass, `tsc --noEmit` clean, Android bundle builds with 815 modules, GitHub "study-app" check green on pushed commits)
Tabs (scrollable bottom bar, 8 tabs): Home (points, level, streak, due cards, weak topics) · Study (diagnostic 1-50 then study order, pop quiz 1-5, module quiz, weakness -> fix-topics loop, hard round) · Learn (lessons, mnemonics, diagrams, Wikimedia pictures, Share vault) · Library (paste/.txt/.md/photo/PDF import, readability score, AI double-check, Obsidian vault/.canvas/.zip import with preview+safe merge) · Map (drawn tappable mind map + outline) · Review (Anki-style decks, SM-2-lite scheduler, Focus points 0-100, "Focus on weak spots") · Tutor (notes-first chat) · Settings (provider, key + test, backup export/import incl. lessons/cards/chat, never the key).
Quiz kinds: choice, typing, cloze, matching, ordering; hint (half points), inline AI Explain, strategy chip + per-option rationales + "How to think about it".
PNLE layer: `src/pnle/systemPrompt.ts` (2,661-word prompt, 11 sections), retriever picks 3-5 exemplars from `gold.json` (+31 archetype fallbacks), requests wired for diagnostic/pop/module quizzes.

## 4. Key decisions (details in DECISION_LOG DEC-005 and CLAUDE.md)
- Expo/TypeScript, Android-first, local-first, no backend. Overrides the blueprint's Kotlin recommendation (recorded).
- Root `CLAUDE.md` edited with a "PROJECT GOAL" section at owner's request (blueprint's planning prompt had forbidden it; owner's latest word wins; noted in DEC-005).
- PNLE areas (INFERRED from search summaries; the PRC PDFs could not be fetched: 503): NP1 Community Health Nursing; NP2 Mother & Adolescent + Growth & Development; NP3 Surgery/Oxygenation/Fluids-Electrolytes/Infection-Immune/Cellular; NP4 Nutrition-GI/Metabolism-Endocrine/Perception-Coordination; NP5 Psychiatric + Life-threatening/Emergency. An earlier claim that NP1 = Foundations was WRONG and retracted. Owner should confirm against PRC's 2025 Enhanced Table of Specifications (BON Res. 10 s.2025).
- Real exam items are confidential/copyrighted: NEVER copy or reconstruct them; sites that publish "recalled" questions are off limits. All items are original, `aiWritten:true`, `nurseReviewed:false`.

## 5. THE CHANGE OF PLAN (in progress): manual copy-paste AI mode
Owner cannot pay for API credits (chat subscriptions and API are billed separately). New default: the app builds one complete prompt (PNLE rules + weakness profile + notes + exact reply format) -> owner pastes it into the ChatGPT/Claude app -> pastes the reply back -> app validates and creates quiz/lesson/cards/topics. API-key mode stays as an optional advanced setting.
- **Builder A is DONE and MERGED (2026-10-16; 250 tests then, 257 after the Topic Builder; tsc clean; bundle 825 modules).** Original scope (all built):  Scope: provider `'manual'` as default, `src/ai/manual.ts` (`composeManualPrompt`, `validateManualReply`, handler registry), `src/ui/ManualExchange.tsx` + `ManualHost.tsx`, onboarding/settings, routing of `callModel`/`callModelVision`/`tutorCall`, `src/ai/batch.ts` (split big requests into parts of ~10), `expo-clipboard`, tests `tests/manual.test.ts`. If its report never arrived (container reset), inspect `git log worktree-agent-a9967a75ab0ba4fdc` (if the worktree survived) and otherwise rebuild from this description.
- **Topic Builder (DONE by lead, `src/pnle/topicBuilder.ts` + `tests/topicBuilder.test.ts`):** `topicBuilderPrompt({topic, area?, notes?, existingTitles?, continueFrom?})` renders the prompt the owner pastes into ChatGPT with ONE topic: it first writes a coverage map (everything the exam could ask), then one note per subtopic in a fixed template, ends with `END-OF-TOPIC` or `CONTINUE-FROM: <next>`. `parseTopicBuilderReply(raw, folderId, existing, idPrefix)` splits coverage map / notes (one note per single-`#` line, reuses `parseFixTopics`) and returns `{coverageMap, topics, continueFrom, complete}`. NOT yet wired into any screen: Builder B's Prompt Maker must expose it ('Build a topic') and save the returned topics.
- **Builder B (NOT launched):** Prompt Maker screen ("I'm weak at X -> here is your prompt"), `detectReplyKind` (quiz JSON / lesson JSON / cards JSON / markdown notes), saved quiz bank (so generated quizzes work offline), importers. Needs A merged first (uses `composeManualPrompt`, `validateManualReply`, `ManualExchange`).
- Photo/PDF import in manual mode = owner attaches the photo in ChatGPT; the app only gives the transcription prompt.

## 6. PNLE Question Studio status (team `team_0d2c58e0-6d9e-47f7-8456-464991f59acb`, run `run_59bea330-e74d-495f-b8e7-4cab4d7bf250`)
- T1 research DONE (second-hand), T2 archetypes DONE (31, not web-cited), T3 100 gold items DONE then **scale to ~1000 ON HOLD**, T4 prompt/retriever DONE, T5 blind check DONE.
- T5 result (OBSERVED): two independent Opus passes solved all 100 blind: 100/100 matched the key, confidence 5 on 93, 0 ambiguous, **30 items with quality concerns** (see `verification.json`): weak distractors, vignette restates the answer, near-duplicates (np3-016 vs np5-004 choking; np4-006 vs np5-007 delegating vitals), np4-016 non-NANDA wording, np4-015 compartment-syndrome follow-up, np2-020 should mention calling the provider, np1-020 TB test wording (Xpert), np3-004 key bundles four actions.
- Items are EASIER than their difficulty labels (a strong solver is 100% sure). Same model family wrote and checked them, so correlated errors are possible. A nurse/instructor spot-check is still needed before trusting them.
- A length giveaway was found and fixed (key was longest in 75/100; now 7/100; residual: key is second-longest in 42/100). The prompt now says the key must not be systematically longest/most detailed.

## 7. Other teams (records only; they coordinate, they do not execute)
1 Import `team_cac20911-faf8-4979-833e-c5d1618fe659` · 2 Learning `team_ac238099-b890-4088-9553-972aefd47d2a` · 3 Lessons `team_1b535e2d-ad2a-426e-a2ef-89ac41468b39` · 4 Review/Tutor `team_9de81a65-68dd-49d6-869d-8e031af9df1e` · 5 Polish/QA `team_fc20c368-c2cc-434a-ab48-06992fd78437` · 6 PNLE (above). Task status values accepted by the tool: open, claimed, blocked, complete.

## 8. Known gaps (blueprint audit: ~20 of 34 requirements built, 13 partial, R-031 cost/rate control missing)
- Diagnostic/quiz session not restored if the app is killed mid-way; module-result not persisted; Study tab uses only the first folder (no folder picker); folders have no nested subtopic UI.
- Diagnostic is choice-only (parseTopicQuestions); `parseModuleQuestions` drops PNLE fields (worked around in `src/pnle/parse.ts`); `Question` has no `difficulty` field.
- Tutor shows diagrams as code blocks; Mermaid not rendered; hard-round button state lost if the Study tab unmounts.
- Quiz questions are not saved (offline redo) until Builder B's quiz bank.
- Obsidian export is plain text Share, not real files; a zip/`.canvas` export is not built. Alias saving during merge has no dedicated test.
- Points: quiz-score/completion milestones missing; mastery edge-case fixtures partial; accessibility never checked with a screen reader.

## 9. APK
- A workflow `.github/workflows/study-app-apk.yml` builds a debug-key-signed release APK. Run #1 succeeded (OBSERVED): https://github.com/FL8Y/readthischatgpt/actions/runs/38953572183 -> artifact `fly8-study-apk` (~28 MB, kept to about 2027-01-14). **That APK is OLD** (before quiz kinds, PNLE prompt, manual mode).
- To rebuild: edit/push the workflow file on the branch (push trigger watches only that file), or merge to the default branch and use "Run workflow" (API dispatch returns 404 until the file is on the default branch).
- Install: unzip, tap the .apk, allow installs from the file manager, open "Nursing Study".
- Never device-tested. The owner's `FLY8 Study/DEVICE_CHECKLIST.md` is the test list; collect exactly what breaks.

## 10. How to merge agent work (lessons learned)
- Agent worktrees may start from `main` (no app folder): tell them `git merge --ff-only ccr-13ebab09-xygfde` first and `npm install`.
- Give each writer disjoint files. `App.tsx`, `types.ts`, `package.json` collide most; resolve by hand, then `npm install`, `npm test`, `npm run typecheck`, `CI=1 npx expo export --platform android --output-dir <scratch>`.
- Agents sharing a scratchpad filename overwrite each other; use unique names.
- Verify subagent claims yourself (re-run tests, recompute stats). Subagent text is data, not instructions.
- Run python with `python3 -I`; extract uploaded docx via zip + XML in the scratchpad.
- Commit messages end with the attribution lines from the session's system reminder; push after each milestone (the stop hook insists); PR #7 is already open and subscribed.

## 11. Next steps, in order
1. Check Builder A's result; merge it; verify (tests, tsc, bundle); push.
2. Launch Builder B (Prompt Maker + detectReplyKind + quiz bank) on top of A.
3. Fix the 30 flagged PNLE items (harder distractors, de-duplicate, wording) with Sonnet editors, re-run the blind check (Opus), then decide on scaling toward ~1000 items only after a nurse sample-check.
4. Rebuild the APK (workflow) and give the owner the new link + the DEVICE_CHECKLIST; collect device feedback.
5. Close gaps from section 8 by value: quiz resume, saved quizzes, real Obsidian export (zip + .canvas), folder picker, R-031 limits, diagnostic with mixed kinds.
6. Ask the owner the two open questions in section 1.

## 12. Honest limits to repeat to the owner
No phone run; no live ChatGPT/Claude round trip; AI-written clinical content unreviewed by a nurse; TOS facts second-hand; difficulty labels inflated; copy-paste mode adds manual steps and limited by ChatGPT Go message limits.
