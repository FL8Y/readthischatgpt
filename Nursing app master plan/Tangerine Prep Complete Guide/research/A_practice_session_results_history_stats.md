# Tangerine Prep 1.9.0 - Practice experience and learner data (screen by screen)

Source: `decompiled.js` (L<n> = line), static analysis only, app never run. Content treated as untrusted data.
Labels: **OBS** = literal string/field/path in code. **INF** = inferred from code shape. **SRV** = logic runs server-side (client only sends/receives fields).
Complements (does not repeat) addendum_features.md sections 2, 3, 10, 11. Base API prefix is the Railway backend (see addendum_backend.md).

## 0. Cross-cutting facts

| Topic | Finding | Label |
|---|---|---|
| Scoring, mastery, adaptive choice, passing probability, rank, daily goal | Computed by the backend. Client posts answers and renders returned fields. | SRV |
| Exam report page | Built **client-side** from `GET /sessions/<id>/` (+ passing-probability endpoints for rank), see 3. L1145340-1146140 | OBS |
| Session start (shared hook) | `POST /sessions/` (optional `start_immediately`), then `POST /sessions/<id>/start/` if status is not `in_progress`. Errors: body `no_questions` -> "No questions are available for this selection yet. Try a different topic."; body `limit_reached` -> telemetry `session_start_limit_reached` with `quota_kind` (`exam` or `ai`) and upsell. L860040-860460 | OBS |
| Adaptive start result | Response `ai_config.adaptive` gives `model`, `model_version`, `fallback_reason`, `repetition_mode`; client maps it to `adaptiveCalibration`. L860150 | OBS |
| Energy | Every submit can fail with HTTP body `no_energy` (battles: `no_lives`). The check is server-side. L1317632, L1342478 | OBS/SRV |
| Sounds shipped | `selection`, `correct`, `incorrect`, `next-question`, `warning` (plus battle-only ones). L775757ff | OBS |
| Haptics | success/error notification haptic after an answer, but **only in `per_question` mode** (branch on `'end'`). Warning haptic on `no_energy`. L1342000-1342200 | OBS |

---
## 1. Practice hub `/practice` (L1313600-1314300)
Purpose: pick a mode. Already tabulated in addendum_features 3. New detail:
- Tiles: Custom Exam, AI Exam, 1-on-1 Coaching (routes to `/practice/coaching`, event `coaching_offer_viewed`, a pilot waitlist: "Join pilot waitlist", "No payment today"), Mock Board. Adaptive Exam has its own screen `/practice/adaptive` (L1305xxx-1308xxx), reached from the hub or study plan.
- Query param `?practice_area=<code>` on the hub forwards to `/practice/custom?practice_area=<code>` (L1313690). `/performance/[code]` "Practice this subject" uses this.
- Offline: AI tile shows alert "AI Exam needs a connection" / "Reconnect to let Cleo build your exam, or use a Custom Exam offline." (L1313900-1314000). Mock: "Mock Board needs a connection". Custom works offline.

## 2. Mode setup screens

### 2a. Custom Exam `/practice/custom` (L1308900-1313300)
| Control | Detail | Label |
|---|---|---|
| Subject tree | Practice areas > topics. Tri-state checkboxes (checked/mixed/unchecked), "Select all <area>", Expand/Collapse chevrons, "Clear all", "All subjects". | OBS |
| Advanced Selection switch | Swaps tree to official TOS sections (`GET /tos/question-structure/`). Texts: "Loading TOS topics...", "Connect to load the official TOS sections.", "TOS structure failed to load". Offline: alert "Advanced Selection needs a connection". | OBS |
| Questions slider | stops `[10,25,50,75,100,125]`, label "<n> questions", icon list. **Default 25**. | OBS (default INF from useState constants 25/30) |
| Time limit slider | stops `[5,10,20,30,60,90,120]`, label "<n> min". **Default 30**. | OBS/INF |
| Answers toggle | "Show as you go" (`per_question`, default) / "Show at end" (`end`). | OBS |
| Start Exam button | Label becomes "Starting..." and is disabled+loading while the request runs. | OBS |

Tap Start Exam:
- Online: `POST /sessions/` with `exam_type:'practice'`, `total_questions`, `answer_reveal_mode`, `time_limit_minutes`, `practice_area_codes[]` (or single `practice_area_code`), `pnle_np_codes[]`, `tos_filters:[{pnle_np, section}]`; then `/session/<id>`. Telemetry `{mode:'standard', kind:'practice', screen:'/practice/custom'}`. L1311100-1311372.
- Offline: builds from the local `questions` table via `questionsRepo`/`sessionsRepo` (`exam_type:'practice'`, `question_ids`, `total_questions`, `practice_area_code`) and goes to `/session/<local id>`. Errors "No offline questions" / "No cached questions are available for that selection. Reconnect to download fresh content." / "Could not start offline exam." L1311000-1311100.
- Online failure alert "Could not start exam." (title "Error"); no-question and limit cases per section 0.
- How many questions come back when the pool is smaller than the slider: SRV (not visible).

### 2b. Mock Board `/practice/mock` (L1314000-1315700)
- UI: NP artwork carousel (swipe; accessibility "Previous NP"/"Next NP", adjustable), stat strip "Items", "Minutes", "After exam: Answers & rationales", button "Start <NP> Mock Board" (-> "Starting..."), no sliders (fixed). Constants 100 and 120 sit next to the config (L1315652-1315654); INF they are items/minutes.
- NP names/chips: NP1 Community Health, NP2 Maternal & Child, NP3 Surgery & Oxygenation, NP4 Nutrition & Endocrine, NP5 Mental Health (`NP_CHIP`, L1097415). OBS.
- Request: `{exam_type:'mock', pnle_np, total_questions, time_limit_minutes, answer_reveal_mode:'end'}`. Failure: alert "Could not start Mock Board" / "Please try again." Offline: "Mock Board needs a connection ... Your selected NP will be ready when you return."

### 2c. Adaptive Exam `/practice/adaptive` (Chev, L1305300-1308900)
- One slider "Questions", stops `[20,50,100]` (L1306453); label "<n> questions"; subtitle "Set the length. Chev handles the rest." No time limit, answers always `per_question`. Default stop not resolved. OBS stops.
- Request `{exam_type:'adaptive', total_questions, answer_reveal_mode:'per_question'}`. State machine (OBS strings): `connecting` ("Connecting to Chev", "Calibrating..."/"Recalibrating..."), `connected` ("Chev is connected and your first question set is ready" or "... revisits useful material based on your history" when `repetition_mode`), `scout` (shows "<n> answers recorded"), `fallback` ("Chev could not be reached, so this set uses Tangerine's coverage-safe selection"; button "Retry Chev", "Continue with safe set", "Switch to Custom Exam / AI Exam"). A "Model <version>" caption shows `model_version`.
- Fallback is only flagged when `fallback_reason !== 'learner_cold_start'`; cold start shows scout instead. OBS L1341100-1341140.
- Chev difficulty choice itself: SRV.

### 2d. Topic preview (from `/questions`) - see 6.
Tapping "Practice topic" on a topic creates a `practice` session from that topic's cached questions (local sessionsRepo, `topic_id`, `total_questions = questions.length`), then `/session/<id>`; failures log "offline topic session creation failed", reason `limit_reached` or `error` shown as alert. L1324700-1325030.

---
## 3. Session player `/session/[id]` (L1336400-1353600; question card L1316000-1322000; rationale L866000-874000)
Purpose: answer questions one at a time. Also used as the "Final results" screen when the session is completed.

### 3a. Load
- `GET /sessions/<id>/?summary=1` (L1338130) then `GET /sessions/<id>/current_question/` for the current item (L1338210). Error "Could not load session." / "Could not load question." / "Question not found". Offline: local repo; "Offline session not found. The local cache may have been cleared.", "Offline question missing from local cache.", "Question not available offline." Loading texts rotate: "Fetching your question...", "Loading something good...", "Almost there...".
- `GET /sessions/<id>/submitted-answers/` (fields `attempts[]`, `question_ids`, `submitted_indices`) rebuilds the question map. L1342790.
- Reveal mode comes from `ai_config.ui_preferences.answer_reveal_mode` (default `per_question`); `already_answered`/`answered_current` flags restore the answered state on resume. L1339000, L1339715.
- Resume of a paused session: `POST /sessions/<id>/resume/` when `paused_at` is set. L1338315.
- Group study sessions (`ai_config.group_study_id`) finish to `/social/study/<id>?finalized=1`.

### 3b. Elements and actions
| Element | Tap -> action -> API -> state | Label |
|---|---|---|
| Option rows | Select an option (single choice). Each option can be eliminated/restored (telemetry `answer_option_eliminate` / `answer_option_restore`, a local Set of ids). The gesture is not resolved (no onLongPress string found). L1318636 | OBS/INF |
| Submit | `POST /sessions/<id>/submit_answer/` `{selected_option_id, time_taken_seconds}` (timeout set). Response: `is_correct`, `correct_option_id`, rationale fields, `energy`, `energy_bonus.amount`. Per-question mode reveals correct/wrong immediately, plays `correct`/`incorrect`, haptic. End mode: records the pick and moves on, no feedback. L1342015-1342200 | OBS |
| Submit failure | Alert "Could not submit" / "Check your connection and tap Submit again." Offline: `recordAttempt` into `local_attempts` (`question_id`, `selected_option_id`, `is_correct`, `time_taken_seconds`, `answered_at`), correctness computed locally from cached options. | OBS |
| Out of energy | On `no_energy` the Submit button label becomes "Out of energy" (disabled), warning haptic, `out_of_energy_modal` ("Get Tangerine+" / "Quit session"). Energy pill: "<n> energy. Tap for details." Mid-session `energy_bonus` toasts. | OBS |
| Next Question / Finish | After an answer the CTA reads "Next Question" (last item: "Finish"). Next: if more items allocated -> `POST /sessions/<id>/go_to_question/` `{question_index}`; sound `next-question`. Error "Could not advance." Last item -> `POST /sessions/<id>/complete/` (online sends `answers` only in offline sync path, offline uses `completeLocalSession`). Error "Could not complete session." L1341260-1341700, L1340790 | OBS/INF |
| Previous | No previous-question button found in the session player. Revisit via the question map. | OBS (absence) |
| Question map (grid) | Opens "Question navigation": numbered cells with states answered / current / not answered, `dimmed`/`disabled` cells; a11y "Go to question <n>". Tap -> `POST .../go_to_question/` `{question_index}`; error "Could not jump to question." / "Could not load question navigation." L1347900-1348900, L1343005 | OBS |
| Flag icon "Tag this question" | **Not a report.** It opens the mastery tagger (Learning / Reviewing / Mastered), see 7. | OBS |
| "Report a problem with this question" | Sheet with types: Unclear ("Wording or phrasing is confusing."), Too long ("Stem is longer than it needs to be."), Incorrect ("Answer or rationale looks wrong."), Other; optional "Additional details (optional)". `POST /questions/<id>/report/` `{report_type, content_type:'question', notes, metadata}`; success "Report submitted. Thank you."; error "Could not submit. Please try again." L1319780-1320600 | OBS |
| Timer | Total = `time_limit_minutes*60` measured from `started_at`, frozen at `paused_at`; `secondsLeft` passed down; a `warning` sound plays near the end (threshold not resolved). When it reaches zero a prompt appears: "Your time limit is up. Do you want to submit now, or keep answering?" with "Submit now" / "Continue answering"; if submit fails: "Your exam could not be submitted. Check your connection and try again." -> "Try submission again". So the limit is **soft** on the client. L1343898, L1345833-1345916 | OBS/INF |
| Back / leave | Alert "Leave this session?" "End this attempt, take a break and return later, or keep answering." Buttons: **End Session** (destructive) -> `POST /sessions/<id>/abandon/` (error "Could not end session" / "Try again, or keep answering."); **Take A Break** -> `POST /sessions/<id>/pause/` (error "Could not pause session" / "Check your connection, then try again."); **Keep Answering**. L1359153, L1340380-1340560 | OBS |
| Adaptive set boundary | When the next index reaches `ai_config.adaptive.allocated_count` (< `total_questions`) the client calls `POST /sessions/<id>/recalibrate/`, shows "Recalibrating Adaptive Exam" and refreshes `model_version`/`repetition_mode`/`fallback_reason`; then `go_to_question`. L1341040-1341160 | OBS/INF |
| Chev card (adaptive only) | Per question label: "Chev prediction", "Chance of an incorrect answer" from `chev_prediction.p_incorrect`; bands (percent): <=40 "Likely very hard"? see note, <=60 "Likely hard", <=80 "Balanced challenge", else "Likely easy" (mapping of p to band direction is INF). Role cards: Range check, At your challenge boundary, Diagnostic challenge, Stretch question, Skill check, Reset challenge. "Mistake Probability" meter. L1349960-1350260 | OBS (bands INF) |
| Adaptive completion | "ADAPTIVE EXAM COMPLETE": "How accurate were Chev's predictions?" rating, optional comment "How was it? (optional)", "Submit feedback" -> `POST /feedback/` `{content_type:'adaptive_exam', content_id, rating, comment}`. L1349420-1349740 | OBS |

### 3c. Rationale panel (shared card; fields from submit response or question)
- Tabs Full / Simplify (preference persisted: `useRationaleSimplifyPreference`; telemetry `rationale_mode_full|simplified`; fields `rationale_summary`, `simplified_rationale`). Sections: rationale text (markdown), "Clinical pearl", images (`rationale_images`, credit "Photo by ... Wikimedia Commons"), sources (`answer_sources`/`rationale_sources`), verified-reviewer badge (`verified_reviewer`, `is_verified`), high-yield flag, Bloom level, "Question summary", "Flashcard" button.
- Audio: "Listen to <title>" play/pause, speed stops `[1,1.25,1.5,1.75,2]`, scrubber "Rationale narration position", voice picker "Tangerine" (standard `rationale_audio_url`) vs "Premium Voice" (`premium_rationale_audio_url`); premium intro modal "Try it now for free." and a 1-5 star feedback modal gated by local keys `premium_voice_intro_seen_v1`, `premium_voice_play_count_v1`, `premium_voice_feedback_done_v1`. Errors "Audio needs an internet connection.", "Audio couldn't load. Check your connection." L866000-874000 OBS.
- Cohort stats shown after answering: **Answered Correctly** (`mean_accuracy` %) and **Avg Time Spent** (`mean_time_seconds`), per question across users (SRV aggregate). L1318721, L873583-873665.
- Video rationale exists as a lab (`rationale-video-lab`, HLS "Video rationale") not in the normal player.
- Post-answer mastery tag appears here; "can be turned off in the Profile tab" (strings_all L16307).

### 3d. Completion flow
1. Last answer -> `complete` (online `POST /sessions/<id>/complete/`; offline local complete, synced later by `/sessions/sync/`).
2. Session screen for a `completed` session shows "Final results" with a per-question list and **Start review** (-> `/review/<id>?start=0`) or **Upgrade to review** (-> `/subscription`) depending on `is_review_gated`. L1346600-1346720
3. Normal flow instead navigates to the report (`/report/<id>`), with watchdog texts "Timed out waiting for post-session Exam Report." / "Could not build post-session Exam Report." Diagnostic exams take a different path.
4. After completion: streak celebration (`GET /streak/calendar/`, gated once per Manila day by `streak_celebration_last_manila_day`) and a first-session store review prompt (`first_session_review_prompted`, ExpoStoreReview). L1346482, L1355300.

---
## 4. Review and report screens
### 4a. `/review/[id]` (L1333040-1333480)
OBS: thin legacy route. It loads `GET /sessions/<id>/`; if the session is a battle it `replace`s to `/versus`, otherwise to the review/report route (telemetry `legacy_review`). `/review/<id>?start=<n>` is the deep link used from "Start review" and history rows. INF: actual question-by-question review lives inside the report screen (below).

### 4b. `/report/[id]` (L855000-890300, data L1145340-1146140)
Paged flow (step ids `result`, `areas`, `bloom`, `ranking`, `concepts`; "previous-step" / "clear-review-focus" / "close-question" back actions). Building copy: "Building your report...", "Adding everything up...".
| Page | Content | Data | Label |
|---|---|---|---|
| Result | Score % (`round(correct/total*100)`), counts correct/incorrect/unanswered, readiness chip, buttons "Review my answers", "See my ranking", "See what to review", "See my AI analysis", "See my Bloom analysis" | `GET /sessions/<id>/` -> `session_questions[].attempt_data.is_correct` | OBS |
| Readiness chip | >=85 "Board-ready momentum", >=75 "Almost there", >=60 "Needs reinforcement", else "Recovery mode". Case sessions: >=80 "Strong on this case", >=60 "Needs another pass", else "Worth revisiting" | L874393-874436 | OBS |
| By practice area | Bars per `question.practice_area.short_name`: correct/total %, colour green >=75, tangerine >=55, red below (`areaHue`) | client-computed | OBS |
| Ranking | "Your Rank" (or "Your Rank Range"/"Unranked"), percentile, delta, neighbours list, "Your ranking climb" ("Higher is better. Your Topnotcher rank across sessions."); badges "Answered Correctly", "Avg Time Spent" | `GET /stats/passing-probability/`, `/rank-history/`, `/neighbors/` | OBS |
| What to review | Concepts from misses (top slice), "Focus here before your next session." Empty states "Nothing flagged to review", "Clean sweep" | client from `short_name`/`tos_section` of misses | OBS |
| Exam Analysis (AI) | "The diagnosis", "The key pattern", "Where your thinking slips", "Your next steps", causes test-taking vs knowledge gap vs mixed. Locked preview text; "Unlock full analysis". `POST /exam-report/analysis/` (free preview) and `/exam-report/analysis/premium/`; payload `{correct,total,readiness,areas,concepts,misses}`; params `?variant=`, `&model=`, `&refresh=1` on sample `GET /exam-report/sample/`. Analysis is LLM output: SRV. | OBS |
| Free unlock | Modal "You have one free unlock!" ("ON THE HOUSE"), "Unlocking..." -> `POST /exam-report/free-unlock/` (`free_analysis_unlock` flag) | OBS |
| Bloom | "Your performance by thinking level", "Questions at this tier: <n>", `POST /exam-report/bloom/` -> `bloom_breakdown`; empty "No Bloom breakdown yet" (mock without enough answers), loading "Building your Bloom breakdown..." | OBS |
| Exam Review grid | Numbered grid with legend Correct / Incorrect / Skipped; hint "Tap any question to see the answer and rationale."; focus bar "<n> you missed here. Tap one to review it." with "Show all". Footer "Review Exam"/"Review My Answers" (lock icon if gated) and "Finish Session"/"Finish Case". | OBS |
| Upsell | "Turn this report into a pass" ("Stay on Free"); guest variant "Create my free account". | OBS |
Offline: reports cached in SQLite `cached_reports(session_id, report_json, analysis_json, created_at)` (L1333711ff).

---
## 5. Practice history `/history` (L1195400-1197100)
- Header "Practice history", back arrow, pull-to-refresh, loading lines "Pulling up your sessions...", "Stacking your study history...". Empty state "No tests yet" / "Start a practice session to see it show up here." with CTA "Start practicing" (-> `/practice`). Error event `history_load_failed` ("Failed to load study history"), offline variant.
- Data: `GET /sessions/` (limit/ordering not shown) **merged** with social battle history and library study sessions (rows id prefixed `battle-` / `library-`). Row fields: `exam_type` (chip text for practice/mock/diagnostic/study_schedule/etc.), `status` (`created`,`in_progress`,`completed`,`abandoned`), `score`, `total_questions`, `correct_count`, `answered_count`, practice area `short_name`, `created_at`/`started_at`, `total_time_seconds`.
- Filters/sorting: **none found** in UI (OBS absence).
- Row action by status: `in_progress`/`created` -> button **Resume** -> `/session/<id>` (event `history_row_resume`); otherwise **Review** -> `/review/<id>` when `exam_type` is null, else `/report/<id>?examType=<type>` (event `history_row_review`). Battle rows -> result / `/social/study/<id>`, library rows -> `/library/study`. (Status-to-action mapping INF.)
- Retake: `repeat_source_session_id` exists only in the AI-exam request (L1157112); no retake button in history. OBS.

---
## 6. Question browser `/questions` (L1322000-1328200)
- Search bar "Search questions, topics, or tags..." -> `GET /questions/search/?q=` ("Question search failed"). Hint: "Search by question title, body content, topic, or tag name."
- Topic list: `GET /topics/with-questions/?page_size=&page=` ("Question topics failed to load"), grouped by practice area (`GET /stats/practice-areas/`), chips "Filter by <area>", "Clear filter", empty "No topics found.". Topic card stats: Correct / Wrong / Unseen / Total; button "Practice topic" (section 2d).
- **Mastery chips** (status filter, event `questions_status_filter`/`status_filter_<key>`, with clear/apply): Learning (red), Reviewing (amber), Mastered (green), Unanswered (grey). Question rows carry `attempt_status` and `effective_mastery`; "unanswered" matches rows where status is unanswered. OBS L1326918, L1321046.
- **TOS Mode** switch ("TOS Mode"): regroups by official TOS NP sections (`/tos/question-structure/`), "Start Practice" opens `/practice/custom?tos_np=<np>`. Failure "TOS structure failed to load".
- Offline: cache from SQLite (`questions` table); empty state "Visit this tab online first to load your questions. Practice sessions still work offline." Telemetry labels `QuestionsScreen.initialCacheLoad` etc.
- `/questions/[id]`: single-question detail, same question card; `?browse=questions&qids=` enables swipe through a list; "Report a problem" and mastery tagger available.

## 7. Question mastery (user tag + AI)
- Question detail endpoint returns per question: `attempt_count`, `correct_count`, `accuracy`, `ai_mastery`, `has_enough_data`, `user_mastery` (`mastery_level`), `is_user_defined`, **`effective_mastery`** (user tag wins when set, otherwise AI; INF from field names, rule is SRV). L1086290-1086400.
- Tagger: "Tag this question" flag, "Loading mastery data...", pick learning / reviewing / mastered -> `PUT /questions/<id>/mastery/` `{mastery_level}`; events `mastery_tag_select`, `mastery_tag_dismiss`, `mastery_update(_failed)`. After repeated dismissals a nudge appears ("Tagging questions a lot? You can permanently turn this feature off in the Profile -> Settings menu"); settings keys `tagger_enabled`, `tagger_dismiss_count`. OBS.
- `effective_mastery` drives the chips in section 6 and per-topic status. How AI mastery is computed: SRV, not visible.

---
## 8. My stats `/performance` and `/performance/[code]` (L1228500-1262500, L1233090-1236000)
### 8a. `/performance`
- Loads in parallel: `GET /stats/passing-estimate/`, `/stats/passing-estimate/history/`, `/stats/practice-areas/` (+ practice area meta). Pull-to-refresh with armed/refreshing states, light haptic ("Pull more to refresh", "Release to refresh", "Refreshing...").
- Hero ring "Estimated passing chance" (`probability` rounded %), status words: `passing` "On track to pass.", `at_risk` "Closing the gap.", `failing` "Time to dig in."; no data "Practice more to see your forecast." / "Estimate unavailable" / "More evidence needed". Week delta `week_change` (trending-up / trending-down / "Steady this week"). Rank card "Practice rank" / "Practice rank range" "of active users" using `pnle_rank`/`pnle_rating`/`pnle_badge`. "Bank covered" shows answered/`total_questions`.
- "About this estimate" sheet: "Based on recent first answers across five subjects.", "This estimate is based on recent practice and has not yet been validated against exam outcomes. Practice accuracy is not your board rating." Evidence block uses `sufficient_subjects`, `subjects_needing_evidence`, `required_questions`: "More recent practice needed: <subjects>", "Build recent evidence in <subject>", "Answer <n> more questions".
- Practice Areas list: per subject accuracy + attempts ("Not enough attempts yet"). Colour: <60 red, 60-74 amber, >=75 green (L1234431).
- Trend chart "Your passing probability over time"; empty: "Your trend appears once there is enough recent evidence across all five subjects." Free users (`is_premium` false / `is_gated`): blurred preview "Preview - what unlocked looks like", "Unlock your forecast", "Upgrade to see your weak areas and 30-day trend." -> `upgrade_url`/"See plans".
- Probability, status, thresholds for passing/at_risk/failing: SRV.
### 8b. `/performance/<code>`
- `GET /stats/practice-areas/<code>/details/` -> `practice_area{name}`, `summary{accuracy,status,total_attempts}`, `topics[]` (name, accuracy, questions_answered, total_questions), `trend`, `probability`, `has_enough_data`. Header "Practice area"; "Passing probability" with the same status words; chart "Your accuracy over the last 14 days" (empty "Not enough daily attempts yet..."); list "Topics, weakest first" ("Tap to practice" -> practice that topic); button "Practice this subject" -> `/practice?practice_area=<code>`. Error "Could not load this practice area." A constant 0.85 appears near the topic code (purpose unresolved).

## 9. Daily goal, streak (L1128290-1130200, L1351600, L1355300, L1424100)
- **Daily goal** modal (`GET /stats/daily-goal/`): fields `has_exam_date`, `daily_goal`, `completed_today`, `exam_passed`, `unique_correct`, `total_questions`, `mastered_count`, `target_total`, `days_remaining`, `pass_rate_7d`, `status_message`. UI: ring with "<n> questions today" or "Goal reached. Nice work."; stat tiles "Questions solved", "Topics mastered", "Pass rate - 7d"; days remaining. No exam date -> "Set your exam date to get a goal tailored to your timeline." ("Go to profile"; variant "Update your exam date ..."). Goal sizing is SRV.
- Pass-rate wording (client): >=85 "Board-ready momentum", >=75 "Almost there", >=60 "Needs reinforcement", else "Recovery mode" (same `readinessFor`).
- **Streak** `/streak`: month calendar (`GET /streak/calendar/` -> `current_streak`, `best_streak`, `calendar[]{date, has_activity}`, month/year paging). Celebration milestones at 3, 7, 14, 30, 50, 100, 200, 365 days with canned Cleo lines ("Day one. I already told the other tangerines." etc.). No streak freeze found.

## 10. Mastery status language (where each appears)
| Term | Where | Source |
|---|---|---|
| Unanswered / Learning / Reviewing / Mastered | question browser chips, topic status | `attempt_status`, `effective_mastery` (SRV derived) |
| Topics mastered | daily-goal tile | `mastered_count / target_total` |
| Passing / at_risk / failing | performance hero and subject page | SRV status |
| Daily Climb / Daily Polish unlock | AI Exam daily recs | `mastery_threshold` (see addendum_features 3d) |

## 11. Unresolved / not found
- Exact Adaptive default length, mock items/minutes (100/120 INF), offline window length (`OFFLINE_WINDOW_MS` value not decoded), time-up `warning` sound threshold, option-elimination gesture, which endpoint returns the cohort numbers (arrive inside question payload: `mean_accuracy`, `mean_time_seconds`).
- All scoring/mastery/readiness probability formulas are server-side.
