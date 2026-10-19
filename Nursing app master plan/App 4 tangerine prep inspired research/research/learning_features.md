# Tangerine Prep 1.9.0 - Learning features addendum

Source: Hermes-decompiled JS (`decompiled.js`, line refs `L<n>`) and `strings_all.txt`. Static analysis only; the app was not run.
Labels: **[OBS]** = literal string, constant or field in code. **[INF]** = inferred from code shape or context.
Scoring, adaptive selection, spaced repetition, ranking and AI generation are **server-side**. The client only sends and receives fields, so the formulas are not visible here.

## 0. Architecture and route map

- expo-router file routes are listed in the route table at L309900-311100 [OBS]. Learning-relevant files:
  - `practice/{index,ai,custom,coaching,mock,adaptive}`, `session/[id]`, `review/[id]`, `report/[id]`, `questions/{index,[id]}`
  - `study/{index,full,rebalance}`, `library/{create,edit-folder,folder,materials,refine,search,sources,study,usage}`
  - `flashcards/{index,[folderId],card-editor,folder,mine,mine-study,pack,pack-editor,shared/[shareId]}`
  - `cheat-sheets/{index,[id],np/[np]}`, `case-studies`, `situation-player`, `ask-cleo`, `rationale-video-lab`
  - `(shell)/versus`, `battle-intro`, `battle-topic-wheel-lab`, `fabricated-battle-royale`, `apex-rank-lab`
  - `social/{index,rank,groups/*,dm/[userId],call/[id],study/[id],study/history,school/[id],user/[id]}`
  - `townhall/*`, `townhall-lab`, `streak`, `daily-goal`, `performance/{index,[code]}`, `history`, `offline-mode`
  - `pnle-results/august-2026`, `class-work`, `subscription`, `checkout`, `feedback`
  - Internal "lab" screens: `design-lab`, `model-lab`, `server-health`.
- Route aliases [OBS, L1085038]: `/scheduler`, `/study-plan`, `/plan` all map to `/study`; `/messages` maps to `/personal-messages`; `/social/friends` maps to `/friends`.
- `/pricing` is **not** an in-app route. Checkout opens the web pricing page in a browser; see section 12.
- API paths seen [OBS]:
  - Sessions: `/sessions/`, `/sessions/create-ai/(v2/)`, `/sessions/ai-generate/(v2/)`, `/sessions/ai-generate-daily/`, `/sessions/daily-availability/`, `/sessions/ask-cleo/v2/{,stream/,usage/,transcribe/,survey/,visuals/}`, `/sessions/cleo-reply/`, `/sessions/sync/`
  - Stats: `/stats/{overview,topics,practice-areas,daily-goal,passing-estimate(+history),passing-probability(+neighbors,rank-history)}/`
  - Study plan: `/study-plan/v2/{status,calendar,events,rebalance}/`, `/study-plan/week/?week_start=`, `/study-plan/create_schedule/`
  - Flashcards: `/flashcards/review/`, `/flashcards/review/undo/`
  - Situations: `/situations/v2/`, `/situations/`
  - Diagnostics: `/questions/diagnostic/`, `/diagnostics/{check,submit-bulk,analysis,preview}/`
  - Exam report: `/exam-report/{analysis,analysis/premium,bloom,free-unlock,sample}/`
  - Offline: `/offline/bundle/{manifest,chunks}/`
  - Taxonomy: `/tos/question-structure/`, `/practice-areas/`
  - Social: `/social/rank/`, `/social/study/*`, `/social/townhall/{posts,hashtags}/`; websockets `/ws/study/`, `/ws/social/`
  - Institutions: `/institutions/learner(/reading-assignments/)`

## 1. Content taxonomy

| Item | Value | Label |
|---|---|---|
| Exam framing | "Your TOS-compliant PNLE reviewer"; cheat sheets "Organized by the official TOS" / "TOS 2025 section" | OBS |
| Five subjects | `NP_ORDER=['NP1'..'NP5']` | OBS L1097400 |
| NP1 | "Community Health Nursing": prevention, population health, community-based care, teaching, research | OBS |
| NP2 | "Maternal, Child & Human Development": pregnancy, childbirth, reproductive health, growth and development, pediatrics | OBS |
| NP3 | "Surgery, Oxygenation & Fluid Balance": perioperative, oxygenation, circulation, fluids, acid-base, immune | OBS |
| NP4 | "Nutrition, Endocrine & Coordination": nutrition, GI, endocrine, neuro, mobility, vision, hearing | OBS |
| NP5 | "Mental Health & Acute Care": mental health, crisis, acute emergencies, equipment, team coordination | OBS |
| NP UI keys | `NP_CHIP`, `NP_NUMERAL` ("Nursing Practice I..V"), `NP_HUE` (mint, coral, sky, sunshine, lavender), `NP_ICON` | OBS |
| Mock Board labels | NP I "Community Health", NP II "Maternal & Child Health", NP III "Surgery & Oxygenation", NP IV "Nutrition & Neurology", NP V "Psychiatric & Emergency Care" | OBS |
| Passing rule | "weighted average of at least 75%, with no single subject below 60%" (home "DID YOU KNOW" card) | OBS L1079044 |
| Hierarchy | practice area (`practice_area_code`) > topic (`topic_id`) > TOS section (`tos_section`, e.g. "Concepts on Acute Biologic Crisis") | OBS |
| Question tags | `bloom_level` (e.g. `applying`, `analyzing`, `evaluating`), `difficulty` (`medium`, `hard`), `is_high_yield`, `is_verified`, `verified_by` | OBS |
| Topic status filters | `Unanswered`, `Learning`, `Reviewing`, `Mastered`; "TOS Mode" toggle on the questions browser | OBS L1325700 |
| Sample subject names | "Fundamentals of Nursing", "Medical-Surgical Nursing", "Maternal and Child Health Nursing", "Community Health Nursing", "PALMR (Leadership and Management)", Mental Health, Nursing Administration | OBS |
| NCLEX | Only as a Townhall hashtag (`#NCLEX`), the coach's "NCLEX-RN" credential, and prose. No NCLEX category taxonomy in the app. | OBS |
| Regions | No region taxonomy in learning content. `/regions` hits the expo-router library. Schools (`/social/schools/`) and a Manila-day streak clock (`streak_celebration_last_manila_day`) are the only locale signals. | OBS |

## 2. Question model (practice sessions)

- Session player is `session/[id]` (~L1316000-1358800) [OBS]. Question fields:
  - `answer_sources`, `rationale_summary`, `simplified_rationale`, `rationale_audio_url` and `rationale_audio_duration_ms`
  - `premium_rationale_audio_url` and its duration (premium TTS voice), `rationale_images`
  - `short_name`, `bloom_level`, `is_verified`, `is_high_yield`, `verified_by`
- Attempt payload [OBS]: `question_id`, `selected_option_id`, `time_taken_seconds`, `option_id`. Answer-option elimination (`answer_option_eliminate` / `answer_option_restore`) is logged and can be toggled per option.
- `exam_type` values seen [OBS]: `adaptive`, `practice`, `mock`, `battle`, `ai` (`/sessions/?exam_type=ai`); the offline path uses `practice`.
- Session payload fields [OBS]: `answer_reveal_mode` (`per_question` = "Show as you go", `end` = "Show at end"), `total_questions`, `time_limit_minutes`, `question_ids`, `pnle_np`, `tos_filters`, `practice_area_codes`, `repeat_source_session_id`, `ui_preferences`, `study_assignment_id`, `study_plan_v2_stage_id`.
- Rationale toggles `rationale_mode_full` / `rationale_mode_simplified` [OBS]. The rationale card also has:
  - "Clinical pearl" with "Create flashcard with Ask Cleo"
  - "Ask Cleo about this rationale"
  - tappable wiki definitions (offline table `wiki_definitions`)
  - zoomable images (public-domain or CC credits)
- Cleo's feedback lines are **client-side** canned pools, one set for correct and one for wrong (e.g. "Want a sticker? Because you earned one."). They are picked locally; stickers are image assets in `/assets/assets/stickers` [OBS L1319380]. [INF] The pick is random.
- Question report types: wording confusing, `too_long`, `incorrect`, other [OBS].
- Offline SQLite schema [OBS L795452]:
  - `questions(id, payload, practice_area_code, topic_id, updated_at)`
  - `question_options(id, question_id, payload, is_correct)`
  - `topics`, `practice_areas(code, payload)`
  - `local_sessions(client_session_id, exam_type, started_at, completed_at, status, score, question_ids_json, total_questions, practice_area_code, server_session_id, synced_at)`
  - `local_attempts(client_session_id, question_id, selected_option_id, is_correct, time_taken_seconds, answered_at, order_index)`
  - `outbox(kind, payload, client_id, attempts)` for sync on reconnect
  - `rationale_audio_cache`, `offline_cheat_sheets`, `offline_flashcard_folders`, `offline_user_flashcard_packs`, `flashcard_local_progress`, `cached_reports`, `wiki_definitions`
  - [INF] `is_correct` is stored per option, so offline grading is local.

## 3. Practice hub `/practice` (L1313600-1314200)

Four tiles, "How would you like to practice?" [OBS]:

| Tile | Tagline | Route |
|---|---|---|
| Custom Exam | "Pick topics, item count, and exam conditions." | `/practice/custom` (accepts `?practice_area=`) |
| AI Exam | "Let Cleo build an exam around what you need." | `/practice/ai` |
| 1-on-1 Coaching | "A live call with a topnotcher." Badge "Available Soon" | `/practice/coaching` |
| Mock Board | "Simulate the PNLE." | `/practice/mock` |

- AI Exam is blocked offline: "AI Exam needs a connection... or use a Custom Exam offline".
- Adaptive Exam is reached from `/practice` or from study-plan items (`kind: 'adaptive'`).

### 3a. `/practice/custom`
- Subject tree of practice areas > topics, with tri-state checkboxes, "Select all", and an `__all__` "All subjects" option. "Advanced Selection" toggle builds the exam from official TOS sections via `getTosQuestionStructure` (`/tos/question-structure/`) and sends `tos_filters` plus `pnle_np`. [OBS]
- Settings [OBS L1312709]:
  - question stops `[10, 25, 50, 75, 100, 125]`
  - time-limit stops `[5, 10, 20, 30, 60, 90, 120]` minutes
  - `1200` constant (purpose not resolved)
  - "Answers: Show as you go / Show at end"
- Offline: the exam is built locally from the cached `questions` table (`custom_exam_local`, `offline.session_started`). Errors "No offline questions" or "Advanced Selection needs a connection". Online: POST create session, then navigate to `/session/<id>`.

### 3b. `/practice/mock` (Mock Board)
- Horizontal NP carousel (NP1..NP5), 100 items and 120 minutes [INF from adjacent constants `100`, `120`]. Payload [OBS]: `exam_type:'mock'`, `pnle_np`, `total_questions`, `time_limit_minutes`, `answer_reveal_mode:'end'`. UI shows "Items / Minutes / After exam: Answers & rationales". Requires a connection.
- Study-plan v2 text: "Five timed Mock Exams, one for each NP, show you where you stand." [OBS]

### 3c. `/practice/adaptive` ("Adaptive Exam", Chev(TM))
- Copy [OBS]:
  - "Chev finds your range in the first 5 questions. Each set after that stays near your ability edge and includes a controlled stretch."
  - "Difficulty rises with you. After repeated misses, Chev steadies the next set without removing the challenge."
  - "Chev(TM) is in research preview."
- Request [OBS]: `{exam_type:'adaptive', total_questions:N, answer_reveal_mode:'per_question'}`. The response carries `adaptiveCalibration{modelVersion, repetitionMode, model, fallbackReason}`.
- States [OBS]:
  - `connecting`, then `connected` ("Calibrated", "revisits useful material based on your history" when `repetitionMode`)
  - `scout` ("Chev needs recorded answers before it can predict. Your first set will build that signal.")
  - `fallback` when `fallbackReason !== 'learner_cold_start'` ("Chev could not be reached, so this set uses Tangerine's coverage-safe selection")
  - User actions: Retry Chev, "Continue with safe set", switch to Custom or AI
- [INF] "Chev" is a server-side learner model (ability estimate near the "ability edge" plus a stretch fraction). The 5-question scout is a cold start. The fallback is coverage-based selection. The slider's stops list was not resolved.

### 3d. `/practice/ai` (AI Curator, Cleo)
- Tangerine+ feature: upsell "Unlock AI Curator exams... build personalized tests from your weak spots, tune the question mix" (events `ai_curator_start_upsell_*`). [OBS]
- Flow [OBS]:
  1. Cleo greets, with a stats summary built client-side from `/stats/practice-areas/`, `/stats/overview/` and `/stats/topics/`: total attempts, overall accuracy, untouched/strong areas, weakest/strongest topics.
  2. Optional "Would you like me to specialize on anything?" (free text, e.g. pharmacology). The reply is a one-line LLM-style acknowledgement via `/sessions/cleo-reply/`.
  3. POST `/sessions/ai-generate/` with `preference`, `total_questions`, `time_limit_minutes`, `repeat_source_session_id`, `answer_reveal_mode`, `ui_preferences`.
  4. Review "Your Test... questions - ~N min", pick Show at end / Show as you go, "Start Test".
- Daily recs via `generateDailyRecommendation(kind)` posted to `/sessions/ai-generate-daily/`, with availability from `/sessions/daily-availability/`. [OBS]
  - `daily_climb`: "Every day I pick 20 questions from your weakest material. No timer, no pressure." Unlocks after 30 practice questions.
  - `daily_polish`: unlocks after mastering N questions (`mastery_threshold`).
  - Server reasons: `already_used_today`, `mastery_threshold`/`threshold`, `insufficient_data`.
- The 20 in the "Daily Climb" copy is from literal text; the other thresholds are server-driven.

### 3e. `/practice/coaching`
Pilot offer, not a live product [OBS]:
- Offer id `raysha-1x1-pilot`; a named PNLE topnotcher coach (Nov 2025); 60-minute live video call; early-bird price PHP 799.
- Four guide steps: choose topic, booking, "Answer, then talk it through", next focus.
- The CTA is "Join pilot waitlist" ("No payment today. This just saves your interest."), which sends `coaching_waitlist_joined` / a `coaching_decision`.

## 4. Study plan, schedule, rebalancing (`/study`, `/study/full`, `/study/rebalance`)

- Onboarding collects first name, school, study days and rest days (`rest_days`, `rest_dates`), `exam_date` ("Is this your exam date?"), daily goal and starting level. [OBS L915300, L919000-926000]
  - Level choice: "Find my level" (diagnostic; "Let Cleo recommend where you should start") or "Skip the test" ("Start from the easiest questions and build up from the basics").
  - Plan creation: `/study-plan/create_schedule/` ("Create an account to save your N-day study plan").
  - Diagnostic events: `diagnostic_started`, `question_count`, `diagnostic_completed`, `diagnostic_abandon`, "Failed to grade diagnostic", "Finding your level...", "Your misses cluster in a few areas...".
- Home "Your Schedule" shows days until exam and a "Your learning path". Task states `completed`, `due`, `overdue`, "Needs attention", "Path complete", "Exam day awaits"; rest days read "Rest day. You earned it." [OBS L986000-992500]
- Assignment kinds (`source_type` / event type) [OBS]: `practice`, `ai` ("Daily AI session"), `mock` ("Timed mock exam"), `case_study`, `cheat_sheet`, `flashcards`, `review`, `class_reading`.
  - Fields: `plan_version`, `study_plan_v2_stage_id`, `stage_status`, `completed_source_ids`, `target_questions`, `estimated_minutes`, `situation_id`, `cheat_sheet_id`, `class_reading_assignment_id`, `study_assignment_id`.
  - Idempotent event posts (`idempotency_key`, `source_key`) go to `/study-plan/v2/events/`; mark-complete is manual (`schedule_manual`).
  - Blocked items: `blocked_content` ("This curriculum stage is waiting for reviewed content").
- Starting a task: creates an exam session with `study_assignment_id` and `study_plan_v2_stage_id`. It works offline for practice via the local session repo; Ask Cleo and Mock require a connection.
- **Rebalance** [OBS L1427000-1429600]:
  - Screen "Rebalance schedule: Adjust your days off, then redistribute."
  - Reads `/study-plan/v2/status/`; POSTs `/study-plan/v2/rebalance/` with `rest_days`, `rest_dates`, `study_minutes_per_day`, `plan_version`.
  - "Daily study target: We'll group activities up to this target and keep your selected days off clear." One option is "1.5 hours".
  - Banner (event `study_plan_upgrade_banner_*`): "Your study plan just leveled up. We rebuilt your remaining schedule around how the PNLE actually tests... everything you completed still counts."
- [INF] Rebalancing is a server-side redistribution of remaining stages across non-rest days under a minutes-per-day budget, preserving completed items.

## 5. Spaced repetition: flashcards (`/flashcards/*`)

- Rating: 4 buttons `again`, `hard`, `good`, `easy`. Cards are dragged or flicked to a screen corner: "Good upper left, Easy upper right, Again lower left, Hard lower right". "Recall the answer before you reveal it." [OBS L1160000-1174000]
- Server SRS [OBS]:
  - POST `/flashcards/review/` (`/review/undo/`) with `flashcard_id`, `folder_id`, `state_before`, `state_after`, `interval_days`, `review_number`, `review_duration_ms`.
  - The session queue has `due_count`, `new_count`, `session_size`. "No cards are due right now. Your next review is in about...", "each card will return when it is due". "Due review requires a connection"; ratings are `pending_sync` offline.
  - Local progress table `flashcard_local_progress(source, source_id, card_id, rating)`. "mastered" = rating in (`good`, `easy`), "learning" = (`again`, `hard`).
- [INF] The exact algorithm (SM-2 or FSRS-like) is hidden server-side, since only `interval_days` and state transitions are visible.
- Sources: official topic folders (`/flashcards/[folderId]`, `mine`, `shared/[shareId]`) plus user packs (`pack`, `pack-editor`, `card-editor`, `publish`, community packs). Free tier is capped at 100 personal cards; offline pack downloads need Tangerine+. [OBS]
- Flashcards can be made from rationales, cheat sheets or Ask Cleo (`create_flashcards`, `clinical_pearl_create_flashcard`). Cards also take error flags ("Flashcard correction").

## 6. Library: AI study-material generation (`/library/*`)

- Users bring their own sources (file, pasted notes or a photo) into folders; source privacy: "Your sources stay private". [OBS]
- APIs [OBS L839800-840420]:
  - `/library/folders/`, `/folders/`, `/cover/`
  - `/sources/` (uploadSource, pollSource, processSource, unlinkSource)
  - `/materials/` (createMaterial, getMaterial, updateMaterial `version`, deleteMaterial)
  - `/generate/` (generate, retry), `/refine/` (refine, revision key/undo), `/revision/`
- Material kinds: **Flashcard**, **Question**, **Explain It**, **Cheat Sheet** ("Create with Cleo" vs "Create manually"). Loading copy: "Cleo is cooking something up...". Refine prompt: "What should Cleo change?" (e.g. "Make the answers shorter..."). [OBS]
- **Explain It** [OBS]:
  - "Answer a question as if you were explaining it to a classmate. Speak or type."
  - Voice: m4a upload to `/sessions/ask-cleo/v2/transcribe/` (also used by Ask Cleo).
  - Result sections: "Your understanding", "Your feedback", "Not included", "One way to explain it".
  - [INF] An LLM grades the answer against key points ("Checking the key points").
- Shared folders: "Community material"; "Saved to My Library". `/library/usage` shows usage limits.

## 7. Ask Cleo (`/ask-cleo`)

- Chat via `/sessions/ask-cleo/v2/` and `/stream/`. Voice input is transcribed. [OBS]
- Quick prompts [OBS]: "Why did I get this score?", "What should I improve?", "Why am I wrong?", "Why is my answer correct?", "Quiz me on this concept", "Explain this another way".
- Structured tool outputs in replies [OBS]:
  - `ask_user_input` (clarifying choices)
  - `create_flashcards` (save to pack)
  - `draft_exam` (generates via `/sessions/ai-generate/v2/` with `client_creation_key`, source `cleo-exam-v2`)
  - `performance_visualization` (charts: accuracy vs overall, 3-day rolling total and moving average)
  - `cheat_sheet_recommendations` (locked for free users)
  - `support_ticket` draft
  - Visuals fetched from `/visuals/`; failures reported to `/failure/`.
- Usage is daily-metered ("See my usage... Your allowance refreshes tomorrow at"); free vs Plus is an "Ask Cleo limits" row. Satisfaction survey: rating plus reason. Includes a "pnle test-taking strategy playbook" source label. [OBS]

## 8. Case studies and situation player

- `/case-studies` list: "Multi-step clinical scenarios that build your reasoning. One patient, several linked decisions." The intro labels them "Hard on purpose" and "Scored in credits"; free tier gets 2 cases and the rest are locked ("requires a subscription"). [OBS]
- Cards show `answered_count`, `credits_earned/credits_max`, `best_pct` and bands by NP; "Start over" (`resetSituation`) clears answers but keeps the best score. [OBS]
- API [OBS]: `/situations/v2/` list/get with `pnle_np`, `practice_area`, `attempt_no`, `stem_audio_url`; `/items/<id>/answer/`; `/report/` (`report_type`); `/reset/`. Answer result: `is_correct`, `earned_units/max_units`, `earned_credits/max_credits`, `correct_answer`.
- Item types (`ITEM_TYPE_LABEL`) [OBS L1366679]: `mcq` "Multiple choice", `sata` "Select all", `matrix`, `highlight`, `cloze`. There is an NGN-style flavor (multi-part items), but no `bowtie` item type in the player.
  - `matrix`: `columns`, `rows`, `correct_column` per row ("Each row must have 1 response option selected").
  - `highlight`: `segments[{selectable, correct}]`.
  - `cloze`: `tokens[{kind:'text'|'blank', choices[], correctIndex}]`.
  - `sata`: `options[{text, is_correct}]`; `mcq` options likewise.
  - Each item carries `bloom_level`, `difficulty`, `rationale`. A shared "situation" stem applies to all N items.
- Bundled `SAMPLE_SITUATIONS` (trauma "Warehouse Collapse", "Jeepney Collision") are tagged `np5-gpt41-raw-output`, `tos_section`, `practice_area`, `pnle_np`. [OBS] [INF] Case content is LLM-drafted and reviewed.

## 9. Cheat sheets (`/cheat-sheets`)

- Condensed one-page-per-topic PNLE notes, in folders per NP (`/cheat-sheets/np/[np]`) and per TOS section. Free users get "Preview" and `cheat_sheet_preview_gated` (`premium_required`). [OBS]
- Reader features [OBS]:
  - zoom ("Fit page width"), table of contents, favorites (stored locally under `cheat_sheet_favorites_v1_`), "viewed" tracking, "Make flashcards from this cheat sheet"
  - pen/highlighter/eraser ink with undo; strokes saved locally; screen-capture protection
  - offline download (`offline_cheat_sheets`)
- Class readings: instructors can assign cheat sheets; viewing is auto-recorded (`class_reading_assignment_id`).

## 10. Performance, passing estimate, exam report, history

- Performance [OBS L1228500-1262000]:
  - "Estimated passing chance" (`passing_probability`) and "Practice rank ... of active users".
  - Evidence rule: "First answers from the last 90 days count toward your estimate. Repeating a question does not add evidence." "Recent first answers carry more weight." Needs coverage of all five subjects ("Cover all five subjects").
  - States: "Time to dig in", "Closing the gap", "On track to pass", "More evidence needed".
  - Free tier is blocked: "Upgrade to see your weak areas and 30-day trend." Premium shows a 14-Day and 30-Day trend. `/performance/[code]` drills into a subject: topics weakest first, "Practice this subject" goes to `/practice?practice_area=`.
- Daily goal (`/stats/daily-goal/`): goal tailored to exam date ("questions today", "Goal reached"). Panel stats: "Topics mastered", "Pass rate - 7d", messages "Recovery mode", "Needs reinforcement", "Almost there", "Board-ready momentum". [OBS]
- Exam report after a session [OBS]: score, "Review my answers", "See my ranking", "See what to review", "See my AI analysis", "See my Bloom analysis" (`/exam-report/bloom/`, `bloom_breakdown`). The AI analysis classifies misses as **test-taking technique / knowledge gap / mixed causes** ("do you know the fact?" vs "can you use it in a scenario?" vs "which action is best?"). Plus gating: "Full AI analysis of every miss", "Guided review of every wrong answer", "Passing-chance tracking to your exam date". A free unlock exists (`/exam-report/free-unlock/`) and a sample report.
- History (`/history`, "Practice history") lists past sessions; the question browser (`/questions`) filters by topic status. Offline `cached_reports` stores reports.

## 11. Gamification: energy, streak, ranks, battles

**Currency / XP.** There is **no XP counter and no spendable "tangerine" currency**.
- OBS: 0 hits for `xp`/`coins`/`gems` fields. "Tangerine" is the brand and mascot (assets under `/assets/assets/tangerines`; Cleo is "a tangerine mascot"). The storage key `tangerine_tokens` is an auth token store, not a currency.
- Progress currencies that do exist: **energy** (free-tier limiter), **credits** (case-study scoring units), **stars / rank points** (battles), **harvest/apex points** (top ranks), **streak days**, and **stickers** (cosmetic).

**Energy** [OBS]:
- "Energy powers you through questions. Every answer costs 1." Free QBank access has a "20 energy cap"; Tangerine+ is unlimited.
- `useEnergyState` fields: `max`, `nextRegenAt`, `regenSeconds` (default 3000, i.e. 50 min per point [INF]); "Next energy in ...", "Energy is full".
- "Set your university for plus 5 energy" (a school bonus), plus `energy_bonus_shown` bonuses mid-session.
- At zero: `out_of_energy_modal` with "Get Tangerine+" or "Quit session". Battles and AI exams are separate flows.

**Streak** [OBS]: `/streak`, `/streak/calendar/`, `current_streak`, a celebration modal gated once per Manila calendar day (`streak_celebration_last_manila_day`, `streak_celebration_shown`). No streak-freeze field found.

**Ranks (battle ladder)** [OBS L1053330-1054100]
- Tiers (index: stars per tier): Student II (0, 3), Student I (1, 3), Scholar III (2, 3), Scholar II (3, 3), Scholar I (4, 3), Topnotcher III (5, 4), Topnotcher II (6, 4), Topnotcher I (7, 4), **Apex Topnotcher** (8, no stars).
- Aliases `SPROUT=0`, `BLOOM=2`, `GROVE=5`, `HARVEST=7`. Player state: `rankPoints`, `peakRankPoints`, `isApex`, `apexPoints`, `harvestPts`, `winStreak`, `seasonId`.
- `RANK_CONFIG`: `STAR_BAR_SIZE:3`, `WIN_STARS:1`, `LOSS_STARS:1`, `STREAK_THRESHOLD:3`, `STREAK_BONUS_STARS:1`, `FLAWLESS_BONUS_STARS:1`, `DEMOTE_TO_STARS:3`, `SEASON_LENGTH_DAYS:90`, `APEX_MIN_STAKE:4`, `APEX_MAX_STAKE:20`, `APEX_EQUAL_STAKE:12`, `APEX_RATING_STEP:100`.
- `TIER_STARTS` is cumulative (stars + 1 per tier) [INF]: 0, 4, 8, 12, 16, 20, 25, 30, 35, so `MAX_RANK_POINTS` is about 34 before Apex. `apexStake(me, opponents)` computes the stake clamped to 4..20 around 12 from rating differences in steps of 100 [INF].
- Seasons: "Awarded when First Spring ends; Apex then resets to Student I." Crests per tier in `/assets/assets/crests`. `/social/rank/`, `/social/rank/me/` give the leaderboard. [OBS]

**Battles `/versus`** [OBS L1066500-1071500, L1358780-1359110]
- Modes `duel` (1v1) and `royale` (Battle Royale, "3-20 players"); topic wheel (NP1..NP5 + Random) picks the subject; `createMatch({mode, practice_area_codes, question_count, target_size})` via `/social/study/`.
- Rules text: same question set for everyone at once; "Beat the clock: Answer fast and keep your streak alive to score more"; "Top score wins... Tied? The fastest player wins"; "Beat half, earn a star"; "See the right answer after every question".
- Score payload per question: `gained`, `streak`, `speed_bonus`, `already_answered`; the UI shows "N IN A ROW", "ON FIRE!", "No points this time" and final "FINAL RESULTS / YOUR SCORE".
- Infra: websocket `/ws/study/` with heartbeat/presence constants (`BATTLE_HEARTBEAT_MS`, `..._TIMEOUT_MS`, `BATTLE_PRESENCE_TIMEOUT_MS`), voice rooms via LiveKit (`battle_voice`), emote reactions (`BATTLE_REACTIONS`).
- Anti-abuse: queue-leave cooldown (`battle_queue_cooldown`, `strike_count`, `cooldown_seconds`); you cannot rejoin a battle after leaving.
- Gate: avatar and school must be set before queuing. Invites via Townhall and DM; error codes `battle_lobby_full`, `battle_version_mismatch`, etc.
- Single-player formulas for point values are server-side. `/practice` sessions give only correct/incorrect and percent scores, plus case-study credits.

## 12. Social, Townhall, institutions, PNLE results, offline, subscription

- **Townhall** [OBS]: social feed with post types including battle invitation (Royale / 1v1) and group recruitment, hashtags (`/social/townhall/hashtags/`; mock tags include #Pharma, #MedSurg, #NCLEX, #BattleRoyale), likes, comments, photos, announcements, friends, notifications, DM and group chat (`/social/groups/*`, `/social/dm/`), calls (`social/call/[id]`). Badges: "Verified staff account", "PNLE topnotcher", "Registered nurse". Study groups have a join-request flow.
- **School**: `/social/schools/` (suggest/search); school crest and school boards; the profile requires a school for battles. Institutions: `/institutions/learner` and `class-work`, where instructors post sections, announcements and timed assignments ("Answer review opens when the exam ends", "Awaiting instructor review", "Your instructor can view your results").
- **PNLE results** (`/pnle-results/august-2026`): "Hall of Fame" with `topnotchers` and `passers` rosters and a name search (`PNLE_RESULT_LIMIT`); the badge roster has `version` and cache expiry (1 h, `3600000`). **Privacy note:** the JS bundle embeds a roster of about 28,652 `{sequence, name}` entries (full names of exam passers); names are intentionally not reproduced here. Rosters unlock a "Don't see your name? Update your Tangerine details" badge claim. [OBS]
- **Offline mode** [OBS]: Tangerine+ only. Downloads the question bank (`/offline/bundle/manifest|chunks` into SQLite with resumable staging tables), cheat sheets, flashcard decks/packs and rationale audio. Offline builds exams from cache; scores and progress sync when reconnected; battles and Townhall need a connection.
- **Subscription** [OBS]:
  - Plans: Monthly PHP 399, Quarterly PHP 799 ("Recommended for PNLE review"), Yearly PHP 1,999; copy "Best value" / "Most popular". Promo "25% off limited time" and an "Early Bird Promo".
  - Checkout opens the web checkout in a browser (QR Ph, GCash, Maya; one-time payments of 30 days / 90 days / 1 year, no auto-renewal) alongside Google Play billing and a "Restore purchase".
  - Free vs Plus table: QBank "20 energy cap" vs unlimited; Quiz review; Case Studies "2 cases" vs full; Flashcards "100 personal cards" vs full + unlimited; Cheat Sheets "Preview" vs full; Ask Cleo limits; AI Curator exams; Weak-area analytics.
  - Claim "Tangerine+ learners have a 35% higher passing probability" appears in the upsell. A beta grant gives "days of premium" for Android testers.

## 13. Internal / lab screens (not learner features)

- `model-lab` compares two LLM backends for `exam_report_analysis`, `tag_generation`, `blooms_check` and `question_rewrite` (labels such as "DeepSeek V4 Pro/Flash" and "5.6 Luna Pro"). [OBS] [INF] These tasks mirror the content pipeline: tagging questions, Bloom-level checks, rewriting questions and writing report analyses with LLMs.
- `design-lab` hosts previews (rank/apex previews, topic wheel, `rationale-video-lab`: signed HLS playback of a sample rationale video with adaptive quality and scheduled link refresh), `fabricated-battle-royale` (mock lobby), `townhall-lab`, `server-health`.

## 14. Unresolved / limits

- Adaptive slider stops, mock item and minute constants (100/120 inferred), and the exact SRS algorithm are not visible client-side.
- Question and rationale content lives on the server; only samples (diagnostic preview, case-study samples, mock Townhall data) are bundled.
- All scoring formulas (battle points, speed bonus, passing probability, Chev) are server-side.
