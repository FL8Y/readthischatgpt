# MASTER PLAN: FLY8 Study v1, a Tangerine-style PNLE practice app (original build)

Manager: Opus. Builders and writers: Sonnet. Written 2026-10-19 from digests 1-8 plus targeted reads of `FLY8 Study/src` (OBSERVED: `src/pnle/types.ts` PnleItem, `src/srs/*`, `src/ui/Review.tsx`, `react-native-web` and `playwright-core` in package.json). **Owner's main goal: match Tangerine Prep's practice experience as closely as possible, in function and flow only.** Nothing here has run on a phone.

## 1. Vision (5 lines)
1. FLY8 Study becomes an offline, Tangerine-style PNLE practice app: thousands of original exam-style questions, the same kinds of modes, screens and feedback loop, no account, no paywall, no paid AI.
2. For one Filipino nursing student reviewing on an Android phone, short on time, using free AI keys or copy-paste only.
3. A session: Practice tab, pick Quick practice / Custom / Mock board / Adaptive / Case study; answer one vignette at a time (strike out options, flag, jump with the map); see right/wrong, why each option is right or wrong, and the strategy (Maslow, ABC, safety).
4. After: score, per-area bars, what to review, review grid, retry missed; misses return on their own; Home shows the learning path, daily goal, streak, rank, exam countdown and a gated readiness estimate.
5. Notes, diagrams, tutor and the question maker exist to feed and explain the bank; anything that does not serve practice is deferred.

## 2. Non-negotiables
| # | Rule |
|---|---|
| N1 | MCQ-family only (single best, select-all-that-apply, case-study item types). **No flashcards, no card SRS, no flashcard Review tab.** Spacing survives only as "missed questions come back". |
| N2 | Practice works fully offline with zero AI. AI (free-key pool, then copy-paste) only makes, curates, explains or tutors. No paid API. |
| N3 | Legal: match Tangerine's function and flow; never its code, art, name, brand, mascot, palette, fonts, sounds, copy text or questions. Never copy or reconstruct real or recalled PNLE items. Handout-derived text always rewritten. All UI wording is ours. |
| N4 | Honesty: review label on every item; nothing is nurse-reviewed; readiness = "practice estimate, not a pass prediction"; docs label OBSERVED / INFERRED / UNKNOWN; "device untested" until the owner ticks the checklist. |
| N5 | Expo/React Native + TypeScript, local-first, single user, no backend. Cost and usage limits matter; security does not. |
| N6 | Max 5 concurrent agents; own worktree each; disjoint files per wave; commit and push every finished file; no test claim without the command and its result. |

## 3. What the merged app is
```
 AI layer (free-key pool -> copy-paste)  : question maker | AI curation | tutor | results analysis | note import
                         |                                   (all optional)
 CONTENT  notes 974 + diagrams 115 --noteId--> QUESTION BANK (BankItem v2: single, sata, case sets)
          cheat sheets (from notes)            gold 100 + bank packs + user-made; validator; fact-check flags
                                                      |
 PRACTICE ENGINE  select(mode) -> session (saved each answer, timer, reveal mode) -> score (partial credit)
                                                      |
 ATTEMPT LOG (append-only) -> mastery, re-queue dates, theta (adaptive), points/streak/rank (Manila day)
                                                      |
 RESULTS -> HISTORY -> MY STATS -> READINESS -> LEARNING PATH + HOME card          BACKUP (state + user items)
```
Tabs: **Home / Practice / Library / Stats / More** (Practice replaces Study; Stats replaces the flashcard Review tab; Library = notes, cheat sheets, bank browser).

| Source | Taken as IDEA | Dropped |
|---|---|---|
| Tangerine guide (digests 1-3) | Every mode/screen in the parity matrix (section 5) | Code, brand, mascot, copy, palette, sounds, content, passer lists, energy/paywall, social, server models |
| Practice engine + Content Authoring Kit (owner's own code, digest 4) | Partial-credit scoring for sata/matrix/cloze; Rasch theta + pickNext; readiness from ability; Manila dayKey; validator rules; prompts 01/03/04/05 | Energy, battle ranks, flashcard prompt 06, Python at runtime |
| Owner Question Maker prompt | Shapes (SATA, statement I/II, EXCEPT, sequence, calc, case cluster), Philippine settings, Bloom tag, QC gate, request fields | Plain-text output, "browse PRC" step |
| FLY8 PNLE prompt + app | Prompt core, gold, archetypes, retriever, grading, mastery, points, pool, manual mode, presets, visuals, shards, backup, theme, 410 tests, CI | `src/srs/*`, `Review.tsx`, due-card count |
| Blueprint | R-004..R-020, R-027..R-033 as checklist; append-only events; evidence floor; deterministic plan order | R-024..R-026, FSRS/Anki, Kotlin baseline |
| "everything" notes, 636-topic tree | Fact-check corrections; topic coverage checklist for writers | Importing them as content or as an app tree |

## 4. Unified item schema and question-maker prompt

### 4.1 BankItem v2 (`src/bank/schema.ts`, W1-B; other tasks code against this text)
```ts
export type Area = 'NP1'|'NP2'|'NP3'|'NP4'|'NP5'|'GEN';
export type ItemType = 'single'|'sata'|'matrix'|'cloze'|'highlight';
export interface BankItem {
  id: string; v: 2;              // stable, never reused: 'np3-0123', 'gold-np1-007', 'u-<hash8>'
  type: ItemType;
  format?: 'standard'|'except'|'statement'|'sequence'|'calc'; // owner shapes, rendered as single
  area: Area; topic: string; topicId?: string; noteId?: string;
  clusterId?: string; clusterSeq?: number;   // case study: shared vignette, 3-6 items
  vignette: string; stem: string;
  options: string[];             // single 4; sata 5-8; highlight = selectable segments
  answer: number[];              // single [i]; sata/highlight correct indexes
  rows?: string[]; columns?: string[]; rowAnswer?: number[];  // matrix: one column per row
  blanks?: { choices: string[]; answer: number }[];            // cloze dropdowns
  rationale: string; optionRationales: string[]; strategy: string;
  archetype?: string; difficulty: 1|2|3|4|5; bloom?: 'recall'|'apply'|'judgment';
  keyFacts?: string[]; beyondNotes?: boolean;
  source: 'gold'|'bank'|'user-ai'|'user-paste';
  review: 'unreviewed'|'ai-checked'|'owner-checked'|'nurse-checked';
  aiWritten: boolean; flags?: string[];
}
```
AttemptEvent gains optional `credit` (0..1), `selected`, `seconds`, `sessionId`, `mode`; old events stay valid.

### 4.2 Scoring (partial credit, Tangerine-style units, our formulas)
single 1/0. sata and highlight: +1 per correct pick, -1 per wrong pick, floor 0, divided by number correct. matrix and cloze: rows/blanks correct divided by total. Case set: sum of credits / items. "Correct" for mastery, re-queue and goals only at credit 1. Points = round(10 x credit); hint halves points, never accuracy; no hints in mock board. Mix caps in the bank: sata <=12%, matrix/cloze/highlight only inside case sets.

### 4.3 Mapping in
| Input | Mapping |
|---|---|
| 100 gold PnleItem | `[answerIndex]`; strategyTag->strategy; reasoning->rationale; 'any'->GEN; source 'gold'; review 'unreviewed' until W1-D re-solves (gold was edited after T5), then 'ai-checked' |
| AI pop/module output (`Question`, kind choice) | `fromQuestion()`, source 'user-ai'; other kinds not imported |
| Owner shapes | statement/EXCEPT/sequence/calc = single + `format`; calc only if every number and unit is in the stem (validator); SATA = sata; case cluster = clusterId set |
| Tangerine-style case study | clusterId set of 3-6 items mixing single, sata, matrix, cloze, highlight |
| Kit JSON | `fromKit()`: letter->index, why_not->optionRationales, easy/moderate/difficult->2/3/4 |

Migration: W1-B writes schema, validator, adapters and `data/bank/gold.v2.json`; `tests/bankData.test.ts` validates every `data/bank/**/*.json` (the CI content gate); old `data/pnle/gold.json` stays as prompt exemplars until W4-E repoints the retriever.

### 4.4 Unified question-maker prompt (W4-E)
`core` = FLY8 sections (role, safety, hierarchy, 11 distractor error types, rationale with Flip line and optionRationales, difficulty, notes-first, "Beyond your notes") + owner QC gate (exact count, one defensible answer, key spread, no invented citations or doses, no recalled items) + Philippine settings + Bloom tag. **Shape modules** on demand: single, sata, statement, except, sequence, calc, case-set (with matrix/cloze/highlight). **Request block** = owner template fields (note/topic, count, NP area, difficulty, shape, setting, weakness profile). JSON only, BankItem v2 names, 10 items per batch. NP labels from `data/pnle/research.md`. Writers use the same prompt, so app-made and agent-made items share one format.

## 5. Tangerine parity matrix
Status: OBSERVED in code (digest 8) unless noted. Wave = queue wave in section 7.

| Tangerine feature | What it does (guide: OBS/INF) | Our original equivalent | FLY8 now | Wave |
|---|---|---|---|---|
| Practice hub | Mode cards; offline only for Custom (OBS) | Mode cards, all offline | StudyHub (AI quizzes only) | W3 |
| Session player | One Q per page, lettered options, Submit/Next, no Previous, question-map grid, flag (OBS) | Same flow, own design | Quiz.tsx (AI items, no map/flag) | W2 |
| Option elimination | Long-press strike-through, restorable (OBS) | Same gesture, own visuals | None | W2 |
| Reveal mode | Show as you go / at end (OBS) | Toggle in setup | Instant only | W2 |
| Soft timer, pause, leave dialog, resume | Timer prompt at zero; End/Break/Keep (OBS) | Same; session saved after every answer | Not resumable | W2 |
| Rationale card | Full/Simplify tabs, pearl, sources, images, verified badge, high-yield, Bloom, cohort % (OBS) | Rationale + per-option why + strategy chip + key facts + review badge + "Read the note" + diagram; Simplify later | QuizFeedback (partial) | W2 (Simplify W6) |
| Report a problem | Unclear / too long / incorrect / other + note (OBS) | Stored locally, exported in backup, feeds fix waves | None | W2 |
| Custom exam | Subject tree, count 10-125, time 5-120 min, reveal (OBS) | Area > bundle > topic tree, count 10/25/50/75/100, timer, reveal, filters unseen/missed/flagged | None | W3 |
| AI exam | AI curates a set from the bank, not new writing (OBS) | "Smart set": local curation (weak topics, unseen, difficulty band) offline; optional AI curation via pool/copy-paste (prompt 05 idea) | None | W3 local, W4 AI |
| Mock board | One NP, ~100 items/120 min (INF), answers at end (OBS) | Same; "short mock" when an area has <100 items | None | W3 |
| Adaptive exam | Server picks by ability (formula unseen) | Rasch theta per area + pickNext with weak bonus (owner's engine) | None | W4 |
| Diagnostic | Feedback each Q, level buckets 40/60/80, areas list (OBS) | 25 items, 5 per NP, level per area; soft gate | AI-generated gate, blocks lessons | W3 |
| Passing probability / readiness | Server forecast, evidence gate, caveat (OBS label, INF model) | Recency-weighted per-area accuracy; theta-based once adaptive has data; hidden until 30 answers per area; "no area below 60%" flag; own band wording | None | W3, refined W4 |
| Case studies | Shared stem, mcq/sata/matrix/highlight/cloze, credit units, Bloom ladder (OBS) | Case sets with all five types, partial credit, reasoning-level summary | None | W4 |
| Results report | Score, readiness chip, area bars, what to review, review grid, missed-only, Bloom, AI analysis (OBS) | Same sections; local error-pattern summary from strategy tags; optional AI analysis via pool | SessionResult discarded | W3 (AI analysis W6) |
| History | Sessions, Resume/Review, no filters (OBS) | Same + filter by mode | None | W3 |
| Question browser | Search, topic Correct/Wrong/Unseen, practice topic, mastery filter, TOS mode (OBS) | Bank browser: search, counts, practice topic, tag filter, group by NP area | Notes search only | W5 |
| Mastery tag | Learning/Reviewing/Mastered, user override (OBS) | Auto from answers + override | Per-topic mastery only | W2 store, W5 UI |
| My stats | Passing ring, area accuracy, weakest-first, 14-day trend (OBS) | Same, hand-drawn SVG | Home tiles only | W3 |
| Daily goal, streak, milestones | Goal ring, Manila-day streak, 3..365 milestones (OBS) | Same with Asia/Manila dayKey | Streak (phone clock) | W3 |
| Ranks | 9 tiers + stars, battle-driven (OBS) | Tier ladder with own names, stars from accuracy, streaks, flawless runs | 6 levels | W3 |
| Study plan / learning path | Schedule card, task states, exam-date countdown, calendar (OBS UI, planner logic server) | Deterministic path from diagnostic + mastery + exam date: daily tasks (practice X, missed queue, weekly mock), states Today/Up next/Needs attention/Done | None (planner lost) | W4 |
| Cheat sheets | AI-generated sheets, gated (OBS) | "Quick review" sheet per topic built from preset note key facts and diagrams, offline | Notes reader | W5 |
| Ask Cleo (tutor) | Chat from a question (OBS) | "Ask tutor about this question" opens Tutor with item context | Tutor exists | W4 |
| Library from own sources | Files/photos/text -> AI questions, review, refine (OBS) | Note import (exists) + Prompt Maker from ticked notes -> validate -> save; refine later | Import yes, Prompt Maker "Coming soon" | W4 |
| Explain-It | AI-graded free text (OBS) | Optional, copy-paste grading | None | W6 |
| Offline bundle download | Chunked server bundle (OBS) | Bank ships inside the APK; extra packs imported as JSON files | n/a | W5 |
| Battles, Versus, social, Townhall | Server, WebSockets (OBS) | Cannot; substitute "Beat your best" timed challenge against your own past score | None | W6 |
| Energy, paywall, IAP, voucher | Server metering (OBS) | Not matched on purpose (free personal app) | n/a | never |
| Audio/video rationales | Premium (OBS) | Not matched | n/a | never |
| Flashcards | SRS decks (OBS) | Not matched (owner); missed re-queue instead | SRS stack exists | W1 removes |

**What cannot be matched, and the local substitute**
| Tangerine piece | Why not | Substitute |
|---|---|---|
| Scoring, adaptive, pass-probability, planner formulas | Server-side, never seen | Our own documented formulas (4.2, Rasch, evidence-gated readiness, deterministic path), labelled estimates |
| Their question bank (thousands, RN-verified) | Proprietary, server-side | Our original bank: 1,500 in v1, 3,000+ later, AI-written, Opus blind-checked, badge says so |
| Cohort stats (% correct, avg time) | Needs many users | Reviewer difficulty rating + your own time and accuracy |
| RN-verified badge | No nurse reviewer | Review labels; "owner-checked"; nurse-checked only if one actually checks |
| Payments, energy, accounts, sync | Server | None needed; backup file |
| Social, battles, ranks vs others | Backend | Solo ranks, "Beat your best" |

## 6. Content plan (the biggest gap: 100 -> 1,500 in v1 -> 3,000+)
- **Grounding**: every item cites a preset note (`noteId`). Writer packet = note text, blueprint row, 3 gold exemplars, unified prompt, fact-check list.
- **Blueprint** (`data/bank/blueprint.json`, W1-E): v1 target 1,500 = 100 gold + 1,400 new; per NP area >=250 (GEN items count toward the area they test); difficulty 2:15% / 3:35% / 4:35% / 5:15%; sata <=12%; owner shapes <=15%; 40 case sets (about 200 items). The 636-topic tree and the 32 "everything" retrieval checks are coverage checklists only.
- **Production**: from wave 2 on, 1-2 writers and 1 reviewer run in every wave. Writer run = 200 items in files of 25 (`data/bank/<area>/<bundle>-NN.json`), commit and push per file; per-area id counters owned by one writer at a time.
- **Gates in order**: (1) validator: schema; banned all/none-of-the-above; duplicate options or stems; option length ratio >3x; longest-is-correct >50% per file; key position 15-35% per letter per file; rationale >=40 chars; optionRationales count; calc numbers present; near-duplicate stem (trigram Jaccard >0.6) against the whole bank; (2) fact-check scan: hit on `data/pnle/factcheck.json` -> fix or visible "check textbook" flag; (3) **Opus blind solve**: reviewer sees stem and options only, answers, rates difficulty, lists defects; accept on key match with no "wrong/ambiguous" defect, else to the fix queue; also checks for copied or recalled-looking phrasing; (4) calibration: reviewer difficulty differs by >=2 -> relabel; after v1, owner accuracy on items seen >=3 times shown as weak evidence.
- **Labels**: passing all gates -> `ai-checked`; owner may mark `owner-checked`; `nurse-checked` only on the owner's word. All `aiWritten:true`; badge on every rationale card.
- **Fact-check list** (restarted, W1-E): RA 10352 vs 10351, AO 2007-0012 superseded, cyanide/TCA/NAC antidote table, unreadable p.101 drug, HIV and antidiabetic gaps, preset "check textbook" law numbers, doses, lab values. No URLs.
- **Post-v1 growth**: waves of 3 writers + 2 reviewers (600 items per wave) until 3,000+, then fill weakest-covered topics from the owner's stats and reports.
- Kit validator: ported to TypeScript, not run as Python. "everything" notes: not imported. Lost ~530 MCQs: regenerated under these gates.

## 7. THE QUEUE (ranked: Tangerine practice flow first)
Conventions: base branch `ccr-13ebab09-xygfde`; each agent on `q/<id>` in its own worktree; Opus manager merges in ID order after each wave and alone edits `package.json`/lockfile and workflows unless a task owns them. **Checkpoint**: first commit and push within 20 minutes; push every file as soon as its tests pass; on usage-limit warnings push and stop. Paths are under `FLY8 Study/` unless they start with `.github`. Every task runs and reports `npx tsc --noEmit && npx vitest run` with counts.

### Wave 1: ground and contract
| ID | Title | Owner | Files owned | Dep | Acceptance | Size |
|---|---|---|---|---|---|---|
| W1-A | Remove flashcards | Sonnet builder | delete `src/srs/*`, `src/ui/Review.tsx`, `tests/srs.test.ts`, `tests/focus.test.ts`; edit `Dashboard.tsx`, `src/backupIO.ts`, `App.tsx`, card mentions in Settings/Tutor/Lesson/Library | - | `grep -rn "srs/\|countDueCards" src App.tsx` empty; old backup with SRS key imports (new test); tsc + vitest green (about 378) | M |
| W1-B | Schema v2, validator, adapters, gold migration | Sonnet builder | `src/bank/schema.ts`, `validate.ts`, `adapters.ts`, `scripts/bank/migrateGold.ts`, `data/bank/gold.v2.json`, `tests/bankSchema.test.ts`, `tests/bankData.test.ts` | - | schema.ts is the first commit; pass + fail test per rule and per item type; 100 gold migrate with 0 errors | M |
| W1-C | Scoring, session, clock | Sonnet builder | `src/bank/score.ts`, `session.ts`, `clock.ts`, `tests/bankSession.test.ts`; optional fields on AttemptEvent in `src/core/types.ts` | W1-B commit 1 | credit tests for all 5 types and case sets; remainingSeconds with pause; session round-trip; Manila midnight | M |
| W1-D | Blind re-solve of gold | Opus reviewer | `data/pnle/verification-v2.json` | - | 100 entries {id, blindAnswer, keyMatch, difficulty, defects}; failing ids listed | M |
| W1-E | Fact-check list + blueprint | Sonnet writer | `data/pnle/factcheck.json`, `data/bank/blueprint.json`, `tests/factcheck.test.ts` | - | >=40 fact entries, no URLs; blueprint sums to 1,500 with section 6 mix | S |

### Wave 2: player and engine, content starts
| ID | Title | Owner | Files | Dep | Acceptance | Size |
|---|---|---|---|---|---|---|
| W2-A | Loader, store, re-queue | Sonnet builder | `src/bank/loader.ts`, `store.ts`, `requeue.ts`, `tests/bankStore.test.ts` | W1 | gold + packs + user items deduped; attempts, flags, tags, reports, sessions in new shard keys; re-queue 1/3/7/21 days | M |
| W2-B | Selection, results, readiness, history, smart-set logic | Sonnet builder | `src/bank/select.ts`, `results.ts`, `history.ts`, `curate.ts`, `tests/bankSelect.test.ts` | W1 | seeded deterministic selectors for quick/custom/diagnostic/mock/weak/requeue/smart set; readiness hidden under floor; band edges tested | M |
| W2-C | Player UI (single + sata) | Sonnet builder | `src/ui/practice/Player.tsx`, `OptionRow.tsx`, `QuestionMap.tsx`, `RationaleCard.tsx`, `TimerHeader.tsx`, `ReportSheet.tsx`, `tests/playerLogic.test.ts` | W1 | elimination, flag, map, reveal now/at end, leave dialog, report sheet; glyphs not colour-only; files <500 lines; `useTheme()` | L |
| W2-D | Writer batch 1: NP1 + NP2 (200) | Sonnet writer | `data/bank/np1/*`, `np2/*` | W1-B,E | 8 files of 25; bankData test green | L |
| W2-E | Writer batch 2: NP3 (200) | Sonnet writer | `data/bank/np3/*` | W1-B,E | as W2-D | L |

### Wave 3: the Tangerine loop end to end
| ID | Title | Owner | Files | Dep | Acceptance | Size |
|---|---|---|---|---|---|---|
| W3-A | Practice hub, custom setup, quick/smart set, diagnostic, mock board, tabs | Sonnet builder | `src/ui/practice/PracticeHub.tsx`, `CustomSetup.tsx`, `src/ui/StudyHub.tsx`, `src/ui/Study.tsx`, `App.tsx` | W2 | 5 tabs; diagnostic soft gate (`canTeach` no longer blocks); AI quiz paths reachable as "Make new questions" | M |
| W3-B | Results, History, My Stats, Home card, streak, ranks | Sonnet builder | `src/ui/practice/Results.tsx`, `History.tsx`, `src/ui/Stats.tsx`, `Dashboard.tsx`, `src/core/mastery.ts` | W2 | review grid + missed-only + retry; Resume from History; Manila streak test; rank tier test | M |
| W3-C | Headless e2e + CI | Sonnet builder | `scripts/e2e/*`, `tests-e2e/*`, `.github/workflows/study-app.yml` | W2-C | web export + playwright-core Chromium, all fetch mocked; flows: skip AI -> quick set -> results -> history; sata; reload mid-mock resumes; CI green | M |
| W3-D | Writer batch 3: NP4 + NP5 (200) + gold fixes | Sonnet writer | `data/bank/np4/*`, `np5/*`, `data/bank/gold.v2.json` | W1-D | as W2-D; failing gold fixed or 'unreviewed' | L |
| W3-E | Review batch 1 (W2-D, W2-E) | Opus reviewer | `data/bank/review/batch1.json` | W2-D,E | every item blind-solved; reject list; relabels | M |

### Wave 4: adaptive, case studies, path, AI features
| ID | Title | Owner | Files | Dep | Acceptance | Size |
|---|---|---|---|---|---|---|
| W4-A | Adaptive exam + theta readiness + learning path | Sonnet builder | `src/bank/adaptive.ts`, `src/bank/path.ts`, `src/ui/practice/Path.tsx`, `tests/adaptive.test.ts` | W3 | theta clamp -4..4, logit (d-3)*0.8; path deterministic from mastery + exam date; task states tested | M |
| W4-B | Case-study player (matrix, cloze, highlight, cluster view, reasoning summary) | Sonnet builder | `src/ui/practice/CaseSet.tsx`, `MatrixTable.tsx`, `ClozeLine.tsx`, `HighlightText.tsx` | W2-C | each type answerable and scored via score.ts; set credit shown | M |
| W4-C | Writer batch 4: 40 case sets (~200 items) | Sonnet writer | `data/bank/cases/*` | W1-B | 5 sets per file; every type used; bankData green | L |
| W4-D | Review batch 2 (W3-D, fix files from batch 1) + rework of rejects | Opus reviewer | `data/bank/review/batch2.json` | W3-D,E | as W3-E | M |
| W4-E | Unified prompt, Prompt Maker, AI smart set, ask-tutor-from-question | Sonnet builder | `src/pnle/*`, `src/ui/PromptMaker.tsx`, `src/ui/More.tsx`, `src/ui/Tutor.tsx`, `tests/pnle.test.ts`, `tests/promptBudget.test.ts` | W2 | each shape has a reply fixture that parses to valid v2; pasted reply -> per-item errors -> valid items saved; prompt budget test green | M |

### Wave 5: polish, browser, cheat sheets, release
| ID | Title | Owner | Files | Dep | Acceptance | Size |
|---|---|---|---|---|---|---|
| W5-A | Restyle settings/AI screens; onboarding AI-optional | Sonnet builder | `Onboarding.tsx`, `Settings.tsx`, `QuickSetup.tsx`, `ProviderPool.tsx`, `ProviderEditor.tsx`, `FreeAiGuide.tsx`, `ManualExchange.tsx` | W4 | no legacy `c, sp` imports in these files; first launch lands on Home | M |
| W5-B | Library tab: bank browser/search, mastery tags, cheat sheets, restyle note screens, backup of user items | Sonnet builder | `src/ui/practice/BankBrowser.tsx`, `src/ui/CheatSheet.tsx`, `Library.tsx`, `NoteReader.tsx`, `PresetPacks.tsx`, `Topics.tsx`, `src/backupIO.ts` | W4 | search by text; "Practice this topic" from a note; backup round-trip with user items and reports | M |
| W5-C | Writer batch 5: top-up to blueprint (300) + case/fix rework | Sonnet writer | gap files named by W4-D and blueprint | W4-D | bank >=1,500 items | L |
| W5-D | Review batch 3 (cases, W5-C) + calibration summary | Opus reviewer | `data/bank/review/batch3.json`, `summary.json` | W4-C, W5-C | accepted per area, difficulty and key histograms | M |
| W5-E | APK, device checklist, docs and handoff | Sonnet builder | `.github/workflows/study-app-apk.yml`, `DEVICE_CHECKLIST.md`, `HANDOFF.md`, `CLAUDE.md` status, `DECISION_LOG.md` (DEC-006 MCQ-first, Tangerine parity, Expo supersedes ADR-007) | W5-A,B | APK run green on HEAD, run id recorded; claims labelled | S |

Deferred (wave 6+): Simplify rationale, AI results analysis, Explain-It, "Beat your best" challenge, refine flow for generated items, Lesson/Graph/ObsidianImport restyle, growth waves to 3,000+.

### LOST list
| Item | Status | Why |
|---|---|---|
| Offline MCQ bank engine | Restarted W1-W2 | Core of Tangerine parity |
| ~530 MCQs | Restarted, changed W2-W5 | New schema, 25-item checkpoints, blind review |
| Planner | Changed into learning path W4-A | Matches Tangerine schedule card; calendar view deferred |
| Fact-check list | Restarted W1-E | Feeds writers, validator, reviewers |
| Search | Restarted for questions W5-B | Tangerine question browser |
| Bookmarks | Restarted as flags W2 | Player flag + filter |
| Auto-flashcards | Cancelled | Owner: no flashcards |

## 8. Test and verification
- **Unit**: vitest for every `src/bank/*` module, scoring per type, validator rules, prompt shapes, re-queue, readiness bands, theta, path, Manila clock; `bankData.test.ts` is the content gate. Baseline 410; drop after W1-A is expected; each task reports before/after counts.
- **Headless e2e** (W3-C onward, extended by later builders in their own spec files): Expo web export + playwright-core Chromium, all fetch mocked. Proves logic and flow on react-native-web only.
- **CI**: `study-app.yml` (tsc, vitest, e2e, android export) and `study-app-apk.yml`; a wave is done only when merged HEAD is green and the run id is in HANDOFF.
- **Device-untested list**: Android launch; AsyncStorage with long history; long-press elimination; timer in background; resume after OS kill; SVG chart speed; matrix/highlight touch targets; clipboard round trip with the ChatGPT app; live free-key providers; APK install.
- **Owner phone test (~20 min)**: install APK from the Actions artifact; skip AI; do a quick set (eliminate, flag, use the map); start a mock board, swipe the app away, reopen, confirm resume; finish, open Results, retry missed; open one case study; check History, My Stats, Home path and countdown; Prompt Maker: copy prompt to ChatGPT, paste reply back, find the items in the bank browser; screenshot problems; tick `DEVICE_CHECKLIST.md`.

## 9. Risks and mitigations
| Risk | Mitigation |
|---|---|
| Usage limits kill agents | <=5 per wave, push per file, 20-minute first commit, 25-item files, merge between waves |
| Free APIs flaky | Practice never needs AI; pool then copy-paste; batches of 10 |
| Content wrong, not nurse-reviewed | Notes-grounded, validator, fact-check list, Opus blind solve, badge, report-a-problem, fix waves |
| Inflated difficulty | Reviewer relabel; enforced mix |
| Scope creep from "be Tangerine" | Parity matrix is the scope; "never" rows stay never; wave 6 holds extras |
| Legal | Original copy and visuals; reviewers check phrasing; no recalled items; handout facts rewritten |
| Merge conflicts | Disjoint ownership; manager owns shared manifests |
| Storage | Bank ships as bundled JSON; only attempts and user items in shards |

## 10. Owner decisions (work proceeds on the default)
| # | Question | Default |
|---|---|---|
| 1 | SATA and case studies in v1? | Yes: sata <=12%, 40 case sets with partial credit |
| 2 | Diagnostic mandatory first? | Offered first, skippable; lessons unlocked |
| 3 | Readiness estimate? | Yes, after 30 answers per area, "practice estimate, not a pass prediction" |
| 4 | Mind map, Obsidian, AI lessons | Keep under More, no new work in v1 |
| 5 | Exam date and NP labels | Exam date optional (drives path/countdown); NP1-NP5 from `research.md` until you send the official TOS |
| 6 | Any nurse to spot-check 50 items? | Assume no; badges say "AI-written, AI-checked"; you can mark "checked by me" |

## 11. Definition of done: "v1 you can study with"
1. Current-HEAD APK builds green and installs; until the owner opens it, v1 is "built, device-untested".
2. No flashcard code or screens; tabs Home / Practice / Library / Stats / More.
3. With no AI key, these work offline from the bank: quick/smart set, custom, diagnostic, mock board, adaptive, weak-spot, missed re-queue, case studies.
4. Bank >=1,500 items, >=250 per NP area, 40 case sets, 0 validator errors, every item Opus blind-solved with key match, badge visible.
5. Sessions save after every answer and resume after the app is killed (e2e on web; device check by owner).
6. Results with review grid, History, My Stats, ranks, streak (Manila day), learning path and gated readiness work.
7. Prompt Maker makes a prompt, accepts a pasted reply, validates and saves items into the bank.
8. Every "W1-W5" row of the parity matrix is shipped or explicitly moved to wave 6 in HANDOFF.
9. tsc, vitest and headless e2e green on merged HEAD with commands and counts in HANDOFF.md; device-untested list current.
