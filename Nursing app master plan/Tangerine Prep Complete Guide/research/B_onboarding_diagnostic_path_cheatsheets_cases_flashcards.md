# Tangerine Prep 1.9.0 - Onboarding, Diagnostic, Study Path, Cheat Sheets, Case Studies, Flashcards

Scope: screen-by-screen deep dive. Source: `decompiled.js` (L = line), static only, app never run.
**OBS** = literal string/field/call in code. **INF** = inferred. **SRV** = logic is server-side (client only sends/receives fields).
Adds to (does not repeat) `addendum_features.md` sec 4, 5, 8, 9. Corrections to earlier notes are flagged "CORR".

---------------------------------------------------------------------
## 1. ONBOARDING (guest, pre-account) - route `/(auth)/welcome` (L910808, state machine L919000-926000)

### 1.1 Step machine [OBS]
Step ids (strings in L919151-L925078): `splash` -> `landing` -> `cleoWelcome` -> `examDate` -> `restDays` -> `school` -> `levelChoice` -> (`loadingTest` -> route `/(auth)/diagnostic` L919924) OR (`studyPlan`) -> `auth` -> `/(auth)/signup` (L921552). Also a `customExams` marketing step (L921698, copy "{name}, Cleo creates custom exams based on your weaknesses" L924091) and an error state `error`.
Step lists are duplicated for progress dots/back-navigation (L920565-920723, L922096-922112, L925015-925078). Telemetry screen name is `welcome` for every step.

| Step | Purpose / UI (OBS) | Tap -> action -> state | Telemetry / data |
|---|---|---|---|
| splash | Brand splash, auto-advances | timer -> `landing` | - |
| landing | "Your TOS-compliant PNLE reviewer." (L924637). Buttons "Get started" (L924755), "I already have an account" (L924796) with sub-copy "Already use tangerineprep.app? Sign in with the same account." (L924810) | Get started -> `cleoWelcome`; account -> `/(auth)/login` (L909846) | `onboarding_next`-style events |
| cleoWelcome | Cleo greets and asks first name: "Tell us your first name." (L921715, validation message). Name stored in `pendingOnboarding` store (L915250: `firstName`, `email`, `password`) | Continue -> `examDate` | `onboarding_name_continue` (L921692) |
| examDate | Date picker (`minimumDate`/`maximumDate` bounds L926413-926414). On Continue an Alert "Is this your exam date?" with "Change date" (cancel) / "Yes, that's right" (L921052, L921000-921060); the confirm CTA reads "Confirm exam date" (L923795). Helper text "N days from now" (L920971-920978). | Yes -> store `exam_date` in pending state -> `restDays` | `onboarding_examdate_confirm_prompt` (L920987), `onboarding_examdate_continue` {exam_date, days_to_exam} (L921027) |
| restDays | Heading "When do you like to study, {name}?" (L920628). Calendar with legend "Darker orange means available. Tap a weekday or date to cross out that weekday." (L929442; variant L929445: tapping a weekday crosses out every one, tapping a date crosses out only that date). Button "No days off, continue" when nothing crossed (L923759). | Continue -> `school` | `onboarding_restdays_continue` {rest_days, rest_day_count, rest_dates, rest_date_count} (L920889). Data: `rest_days` = weekdays, `rest_dates` = specific ISO dates (L921594-921600). |
| school | "Which school are you from, {name}?" (L920623). Suggested-school chips + typeahead "Start typing to find your school." (L923133), "Change" link (L923237). Validation: "Pick your school, or type it in if it's not listed." (L920763). Free-typed school allowed. | Continue -> `levelChoice`. Stored in `pendingSchool` store; applied after login by `applyPendingSchool` (L918243, error "Failed to apply pending school"). | `onboarding_school_continue` {school_id, school_name, source: `suggested`\|`directory`} (L920828). INF: directory = server school list (see backend notes). |
| levelChoice | "How would you like to start your review?" (L920619). Two cards: **Find my level** (badge `RECOMMENDED`, "Let Cleo recommend where you should start." L922564-922593) and **Skip the test** ("Start from the easiest questions and build up from the basics." L922703-922716). Error "Pick one to continue." (L920739). | choice `diagnostic` -> step `loadingTest` (L920763-920788); choice `scratch` -> step `studyPlan` | `onboarding_level_choice_continue` {choice} (L920751) |
| loadingTest | "Loading your test..." (L924491); short timer then `router.push('/(auth)/diagnostic')` (L919924) | -> diagnostic screen (sec 2) | `onboarding_loading_test` (L919845) |
| studyPlan | Animated reveal: internal phases `building` -> `revealed` (timers 500/1000/2000 ms, L919633-919720). Shows "YOUR DAILY GOAL" (L924253) = study time per day, "a day to stay on track." (L924315), "Hi {name}" (L924346), CTA "Lock it in" (L924417). | Lock it in -> `auth` | `onboarding_study_plan_commit` {days_to_exam, study_time} (L924120-924125). INF: daily goal is computed client-side from days-to-exam / rest days or from a server default; no input control for the number was found in this step. |
| auth | "Create an account to save your N-day study plan and start practicing." (L922198-922206). Buttons "Continue with Google" (L922344), "Sign up with email" (L922422), "Log in" (L923925), Terms/Privacy links. | email -> `/(auth)/signup`; Google/Apple -> OAuth (Apple errors L914169-914550) | `onboarding_auth_reached` (L920078) |

### 1.2 Signup screen `/(auth)/signup` (L915250-916700) [OBS]
- Fields: "What should we call you?" (first name, prefilled from onboarding, L915957), email, "Pick a password" ("At least 8 characters. Make it memorable." L916276-916289). Errors: "Password must be at least 8 characters.", "Tell us your first name." (L915629-915680). CTA "Create account" (L915730), "Continue with Google" (L916112), "Log in" (L916619).
- After account creation the client PATCH/POSTs `/auth/profile/` with `{exam_date, rest_days, rest_dates}` (L915369; failure logged "Failed to save onboarding profile after signup" L915464), then applies the pending school and publishes `examDateBus` (L915280) so Home updates.
- Events: `signup_completed` {has_exam_date, prefilled_name}, `onboarding_completed` {method:'email', has_exam_date} (L915500-915540).
- Tokens (`Bearer`) then enable auto plan generation (sec 3.1).

### 1.3 Other onboarding-adjacent behaviors
- **ExamDateGateModal** (L951700-952100) [OBS]: after login, if profile has no exam date, a blocking modal asks for it. Events `exam_date_gate_shown`, `save_exam_date`; `exam_date_restored_from_pending` restores a date typed pre-signup. Save = POST/PATCH `/auth/profile/` `{exam_date, rest_days, rest_dates}`; "Invalid date" client check.
- **/app-platform/onboarding-config/** (GET, Bearer, L936074-936160) [OBS]: response is `{tour_version, flashcard_tour_version}` mapped to `{tourVersion, flashcardTourVersion}` (L936147-936160). It is NOT the question list. It versions the in-app walkthrough: Home tour (`onboarding_tour_started/completed`, key `onboarding_tour_version` L935758, replay `onboarding_replay` L996058, `onboarding_walkthrough_return` L1012022) and the flashcard tour (`flashcard_onboarding_started/skipped/completed/dismissed` L1166652-1168235, "Step N" + "Start studying"). When server version > locally stored one, the tour re-shows (INF).
- **Notification permission**: NOT asked in the onboarding steps. It is requested lazily by `maybeRequestNotificationPermissions` (L953510-953700; called from the main shell L951738/951818/952069). Flow: `getPermissionsAsync` -> if `undetermined` -> `requestPermissionsAsync` -> fetch Expo push token (error "Failed to fetch Expo push token") -> POST `/notifications/register-token/` `{expo_token,...}` (L932828); status reported to `/notifications/permission-status/` (L932893). Telemetry `notification_permission_prompt` {status, can_ask_again, has_push_token, platform}. Preferences at `/notifications/preferences/`, manifest `/notifications/manifest/`, inbox `/notifications/inbox/`, open ack `/notifications/opened/`, deactivate `/notifications/deactivate-token/`. Android channels "Study reminder" and "Streak reminder" (L1081411, strings). Server notification kinds regex `session_reminder|churn_reminder|activation_nudge|study_reminder` map to the "lifecycle" bucket (L986086). Reminder timing is SRV.
- Goals: only exam date, rest days/dates, school, level choice and name are captured. No target-score or hours-per-day question was found (OBS by absence). `study_minutes_per_day` exists on the study plan v2 (sec 3.4) and can be changed in Rebalance.

---------------------------------------------------------------------
## 2. DIAGNOSTIC TEST - route `/(auth)/diagnostic` (screen component L313280-316800)

API wrapper `src/api/diagnostic` (L907981-908311) [OBS]:
| Fn | Call | Body |
|---|---|---|
| fetchDiagnosticQuestions | GET `/questions/diagnostic/?questions_per_area=N&total=M` (L908000-908060) | query only |
| checkDiagnosticAnswer | POST `/diagnostics/check/` | `{question_id, selected_option_id, time_taken_seconds}` |
| previewDiagnostic | POST `/diagnostics/preview/` | `{attempts:[{question_id, selected_option_id}]}` |
| fetchDiagnosticAnalysis | POST `/diagnostics/analysis/` | `{attempts:[...]}` |
| submitDiagnosticBulk | POST `/diagnostics/submit-bulk/` | `{attempts:[...]}` |

### 2.1 Question selection (how chosen) [OBS + SRV]
- Client asks for `questions_per_area` (constant `_closure1_slot15`, value not resolved) and optional `total`; response is grouped `[{practice_area:{name,short_name,code}, questions:[...]}]`; client flattens, tags each question with `areaName`/`areaCode` (L314283-314284) and slices to a client max (`_closure1_slot16`, L314290). Empty result -> phase `empty`.
- So: balanced N-per-practice-area sample, selection/difficulty SRV; the client does no adaptive branching (INF).
- Same screen works for guests, it uses the shared api client (`r1[2]`) - no account is required (OBS: it runs before `/(auth)/signup`).

### 2.2 Phases (state `phase`) [OBS L314905-314935]
`loading` ("Building your diagnostic..." L316494) -> `quiz` -> `grading` ("Finding your level..." L316498) -> `celebration` -> `results` -> `commit`; side states `empty` ("No diagnostic available yet" L316159) and `error` ("Failed to load diagnostic questions" L314374).
- **Intro/loading**: button "Skip Diagnostic" (L316566) -> abandons; event `diagnostic_intro_start` (L316756).
- **Quiz** (L314411-315900): one MCQ per page, lettered options with an eliminate/restore long-press (`answer_option_eliminate/restore` {question_id, option_id} L315289-315304). Progress bar. Button "Submit" / "Checking..." (L315683-315686). `diagnostic_started` {question_count} (L314425).
  - Submit -> POST `/diagnostics/check/` -> response `{is_correct, correct_option_id, rationale, rationale_summary, simplified_rationale, sources, rationale_sources, verified_reviewer, images}` (L315446-315500) -> reveal card (shared `RationaleCard`, `screen:'diagnostic'` L315366) with result, rationale, sources, reviewer. Button becomes "Continue" or, on last question, "See my level" (L315840-315843). Per-question answers accumulate in a ref Map (`question_id -> selected_option_id`).
  - Check failure -> phase stays, toast style `error`; (INF) user can retry.
- **Abandon**: back/skip fires `diagnostic_abandon` {answered, total} (L314533-314544).
- **Grading** (L314555-314700): POST `/diagnostics/preview/` with all attempts. Failure -> `Failed to grade diagnostic` (L314692) -> `error`.
- **Celebration**: confetti interstitial, `diagnostic_completed` {accuracy,total} (L314664-314674). Also stores `pendingDiagnosticSummary` `{accuracy, levelLabel, focusAreas}` (L314625-314650) for the signup/home UI.
- **Results**: Level buckets from accuracy (client fn L313300-313330, OBS): `>=80 Advanced` ("You're exam-ready in most areas. We'll sharpen the edges."), `>=60 Proficient` ("Strong foundation. We'll focus your plan on the gaps."), `>=40 Developing` ("Good base to build on. Your plan will target weak spots."), else `Foundational` ("Perfect. We'll start with the fundamentals and build up."). Result object (L314860-314905): `{scorePct, correct, total, message, areas:[{name,pct}], neighbors/rank:{position,from,delta}, concepts}`; footer "Your misses cluster in a few areas. A short, targeted review will move your score fast." Source of `accuracy`: `preview.overall.accuracy`, `overall.label`, `practice_areas[].accuracy`, `concepts` (L314606-314650). Button "See my results" (L316477) / "Continue" -> `diagnostic_results_continue` {accuracy} (L314816).
- **Report modal** (shared ExamReport component, `mode:'diagnostic'`, L316061 + L882300-884460): steps "Review my answers", "See my ranking", "See what to review", "See my AI analysis" / "See my Bloom analysis" (L883663-883728, AI steps behind `analysis_unlock` premium gate). Props `analysisFetcher` = POST `/diagnostics/analysis/` (SRV narrative; sample copy in code "The pattern: you pick the correct action but miss the first action in multi-step scenarios..." L884428 looks like placeholder/demo text). Loader copy "Building your report..." "Adding everything up..." "Almost there...". `onSignUp` -> event `diagnostic_report_sign_up` (L883809) -> signup.
- **Commit**: button "Let's go!" (L315976, `diagnostic_commit_lets_go`) -> `/(auth)/signup`.

### 2.3 Submission & seeding the plan [OBS + SRV]
- Guest attempts are persisted locally under key `pending_diagnostic_attempts` (strings L13416; `setPendingDiagnostic/getPendingDiagnostic/clearPendingDiagnostic`).
- `PendingDiagnosticSubmitter` (L977100-977260) runs after login: reads pending attempts -> POST `/diagnostics/submit-bulk/` `{attempts}` -> response `{session_id, created}` -> event `diagnostic_submitted` {session_id, created} -> clear local copy. Failure "Failed to submit pending diagnostic" (retry next launch, INF).
- What the server does with it (readiness baseline per practice area, priority of stages in the plan) is SRV. Client evidence only: `created` boolean (idempotent), and a `session_id` (a real exam session is created so it shows in History/Performance - INF). Plan order/priority from weaknesses is stated in marketing copy ("Strong foundation. We'll focus your plan on the gaps.") but computed server-side.
- Skipping the test: no submit; plan starts "from the easiest questions" (copy L922716), SRV.

---------------------------------------------------------------------
## 3. LEARNING PATH / STUDY PLAN

### 3.1 Plan creation (`StudyPlanAutoGenerator`, L976740-977000) [OBS]
After login the app: GET `/study-plan/status/` (has_schedule) + GET `/auth/profile/` (has exam_date, `rest_days`, `rest_dates`, `schedule_created_at`). If an exam date exists and no schedule: POST `/study-plan/create_schedule/` `{rest_days, rest_dates}` -> event `study_plan_auto_generated` {rest_day_count, rest_date_count}. Failure "Failed to auto-generate study plan". Plan content/ordering is SRV. Guest copy "Create an account to save your N-day study plan" (L922205).

### 3.2 Home card "Your Schedule" (L987364-989100) [OBS]
- Header "Your Schedule" + info "About your schedule" sheet (L987394, copy L993951: "checks how your skills align with the exam's Table of Specifications (TOS), then adapts what you study based on your progress and time remaining. You can rebalance, reschedule, or reset your plan whenever your timeline changes.").
- Shows "N of M" progress, "{n} days until exam" or "No exam date set" (L987465-987490), link "View full schedule" -> `/study/full` (L987665-987672).
- Task chips: "Needs attention" (overdue), "Due today", "Up next"/"UP NEXT" (L988161-988247). Learning path list "Your learning path" - "Follow the path from today to exam day." (L988588-988601); end states "Path complete" / "You finished every scheduled task." / "Exam day awaits" / "Complete the path to arrive prepared." (L988947-988966). Empty: "Your learning path appears when tasks are scheduled." (L989012).
- Data load (L989720-990000): GET `/study-plan/v2/status/` (fallback `/study-plan/status/`) -> `{has_schedule, active, total_stages, completed_stages, plan_version, study_minutes_per_day, exam_date, rest_days, rest_dates}`; GET `/study-plan/blocks/?lazy=1` (v1 blocks); GET `/institutions/learner/reading-assignments/` merged as `class_reading` tasks titled "Cheat Sheet: ..." with "Assigned by {teacher}. Viewing is recorded automatically when the reading opens." (L989988-990002).
- Task kind labels: `AI Curator` (L989319), "Timed mock exam" (L989519), "Daily AI session" (L989522).

### 3.3 Calendar & week views (`/study/full`, L1424700-1427000, and Study tab L992000-995200) [OBS]
- `/study/full` = month calendar. Legend: Today / Exam day / Rest; day status classes `muted, scheduled, rest, past, today, exam` (L990802-990817, L1425717-1425742); banner "Exam day. Top the boards!" (L1425205). Day cell tap -> entries list "N items" (L1425252).
- Sources: GET `/study-plan/v2/calendar/` -> `{rest_days, rest_dates, exam_date, occurrences:[...]}` (L990072-990400); GET `/study-plan/week/?week_start=YYYY-MM-DD` (L990409) for v1 week view. Dates parsed as `T00:00:00` local. Each day: `{date, is_rest, assignments}` (L990214+).
- Occurrence/assignment fields (OBS L990195-990330): `id, title ("Study: ..."), stage_type (qbank|mock|cheat_sheet|flashcards|case_study|readiness|ai), stage_status, stage_id, binding{id, items[], situations[]}, target_count -> target_questions, estimated_minutes, pnle_np, tos_section, completed_source_ids, plan_version, situation_id, status('completed'|due|overdue|upcoming), is_completed`. Special: `stage_status==='blocked_content'` -> alert "Sheet unavailable / This curriculum stage is waiting for reviewed content." (L991686-991687); cheat_sheet stage shows count from `binding.items.length`.
- Day detail: empty "Nothing scheduled for this day." / "Rest day. You earned it." (L993824-993865). Row states "To do" / "In progress" / done (L993516-993519) with "Resume - N answered" (L992796). Row actions: "Open reading", "Practice again", "Start lesson", toggles "Mark as done"/"Mark as not done" (L993570-993649); class readings: "Reading viewed", "Open reading to record viewing" (L992637-992640), "Viewed. Your instructor can see that this reading was opened." (L993667).

### 3.4 Task launch (L991100-991720) [OBS]
Telemetry `_schedule_task` target `start_assignment` {assignment, pnle_np, kind}. Branching by `source`/`stage_type`/`kind`:
| Kind | Action | Notes |
|---|---|---|
| `class_reading` / `cheat_sheet` | `router.push('/cheat-sheets/[id]')` with `cheat_sheet_id` (L991694-991715) | Opening records the view (instructor-visible for class readings) |
| `flashcards` (v2) | `router.push('/flashcards/[folderId]')` with param `source:'study-plan'` (L991632-991646), `study_plan_v2_stage_id` is attached to later reviews (L938032 queue payload) | |
| `case_study` | `router.push('/situation-player?id=<situation_id>')`; if no id: alert "Case study unavailable / This case study isn't ready yet. Try another assignment." (L991605-991621) | |
| `readiness` / `mock` | creates a mock exam session; offline -> warning "Mock Exam needs a connection / Reconnect to take a mock exam." (L991581-991587) | |
| `ai` | Ask Cleo session; offline -> "Ask Cleo needs a connection / Reconnect to start an Ask Cleo session." (L991475-991481) | |
| `practice`/qbank (default) | creates session `{mode:'standard', kind:'study', exam_type:'practice', total_questions: target_questions, study_assignment_id (v1) \| study_plan_v2_stage_id (v2), pnle_np, tos_section}` then `router.push('/session/<id>')` (L991180-991265). Offline: pulls cached questions by `pnle_np` from `offline/questionsRepo`, creates local session in `offline/sessionsRepo`; if none: "No offline questions / No cached questions match this assignment. Reconnect to download fresh content." (L991359-991360). Errors: "Could not start practice session." / "Could not start mock exam." / "Could not start offline session." | session creation endpoint itself is the generic exam-session API (SRV) |

### 3.5 Completion tracking [OBS]
- Automatic: finishing the launched session/flashcard review/case/cheat-sheet reading posts server side with the stage id (practice session carries `study_plan_v2_stage_id`; flashcard reviews carry it too). Completion rules (e.g. targets reached) are SRV; client reads `completed_source_ids`, `stage_status`, `status`.
- Manual toggle (L990930-991025): v2 assignment (has `stage_id`) -> POST `/study-plan/v2/events/` `{events:[{stage_id, event_type:'completed'|'reset', idempotency_key:'mobile:<id>:<ts>', source_type:'schedule_manual', source_key:<assignment id>}]}`; v1 -> POST `/study-plan/<id>/complete/` or `/uncomplete/` (L990954).
- Progress ring/bar = `completed_stages / total_stages` from v2 status.

### 3.6 Rebalance (`/study/rebalance`, L1425100-1429000) [OBS]
- Entry: button on `/study/full` header (push `/study/rebalance` L1425167) and the one-time upgrade banner (`study_plan_upgrade_banner_shown/dismiss`, seen-key `study_plan_upgrade_banner_seen_v1` L1425429).
- Screen: "Rebalance schedule - Adjust your days off, then redistribute." Link "Change in Account" (L1427559: rest days are edited in Account settings, not here). Section "Daily study target" - radio options (minutes) shown as "{x} per study day"; copy "We'll group activities up to this target and keep your selected days off clear." Warning "This redistributes every uncompleted lesson from today up to your exam. Finished lessons stay put." Button "Rebalance now"; footnote "You can rebalance again anytime."
- Load: GET `/study-plan/status/` and `/study-plan/v2/status/` in parallel (L1427066-1427074) -> `exam_date, rest_days, rest_dates, active, study_minutes_per_day`. Failure: "Could not load your schedule. Go back and try again."
- Submit: POST `/study-plan/v2/rebalance/` (if v2 active) or `/study-plan/rebalance/` (v1) with `{rest_days, rest_dates, study_minutes_per_day}` (+`plan_version` in telemetry `study_plan_rebalance_submit`) -> status `success` -> router.back; failure "Failed to rebalance. Try again."
- Triggers: user-initiated only in client (no auto-rebalance call found); automatic overdue shifting, if any, is SRV (INF). Daily goal elsewhere = `/daily-goal` route (out of scope).

---------------------------------------------------------------------
## 4. CHEAT SHEETS

Backend name is **study-sheets**: GET `/study-sheets/` -> `{results:[...]}` (catalog; L1016285) and GET `/study-sheets/<id>/` (detail with `figures[].url`; L1016338-1016400) [OBS]. Client module `src/api/cheatSheets`. (CORR: the path is `/study-sheets/`, not `/cheat-sheets/` - the latter is the app route only.)

### 4.1 Catalog `/cheat-sheets` (L1117500-1119300) [OBS]
- Title "Cheat Sheets" - "Condensed PNLE notes for key concepts, nursing priorities, and exam-day recall." Search box "Search cheat sheets" / "Search every subject"; result count "N found". Toggle tabs All vs Favorites (empty states: "No favorites yet - Tap the star on a sheet to find it here.", "No favorites downloaded - Download your favorite sheets while online to read them here.", "No favorites match that search"). Loading "Loading the TOS library..."; empty "Sheets are being prepared / Each sheet will appear inside its official TOS 2025 section after content review."; "No sheets match that search".
- Structure: grouped by NP (pnle_np) -> TOS section; header progress "Not started" / "N of M viewed" / "All sheets viewed" (L1116768-1116782).
- Filter event `cheat_sheet_filter`; `cheat_sheet_catalog_loaded`. First-time intro "HOW CHEAT SHEETS WORK" gated by key `cheat_sheet_intro_done_v1_` (L1118825, L1119156), reopen event `cheat_sheet_intro_reopened`.
- Row (L1119262-1119930): title, "N sections", "- Seen" badge (from local viewed set), lock/"Plus" pill when `is_locked`, star (favorite), download icon `tray-arrow-down` -> `check-bold` after offline. A11y: ", seen", ", Tangerine Plus required". Tap -> `cheat_sheet_open` (or `cheat_sheet_locked_open`) -> push `/cheat-sheets/[id]`.
- Offline: "Download {title} for offline" / "Remove {title} from offline" -> `offline/downloadCheatSheet` (SQLite/files; events `cheat_sheet_download_offline`, `cheat_sheet_remove_offline`; error "cheat sheet offline download failed"). Status machine idle/downloading/downloaded/removing. Gating on offline = Tangerine+ (INF from flashcards parallel).
- NP folder screen `/cheat-sheets/np/[np]` (L1121000-1121600): header "Lesson N of M"; event `cheat_sheet_folder_open/loaded`; empty "Sheets are being prepared / Check your connection, then try again."; "Loading this subject...".

### 4.2 Reader `/cheat-sheets/[id]` (L1103300-1117000) [OBS]
- Load: detail fetch (or local offline copy, `from_cache` flag) -> `cheat_sheet_reader_loaded` {sheet_id, version, section_count, from_cache}. "Loading cheat sheet / Preparing the compact reader...". Error: "Invalid cheat sheet".
- Content model: sections with blocks (paragraph, callout, list, group, table, figures; "see $1" cross-refs; sources/APA citations). Figures: `figures[].url` with "Cheat sheet figure" alt, failure "Image didn't load / Check your connection, then try again.", "Open figure source: ..." link.
- Header "PNLE Cheat Sheets", "Tangerine Prep" watermark (L1109009-1109022), "Table of Contents" sheet (L1109081, breadcrumbs "A -> B").
- Zoom controls: "Zoom out", "Fit page width", "Zoom in" (events `cheat_sheet_zoom_*`); pinch/pan; chrome toggles on tap `cheat_sheet_reader_chrome_toggled` ("Tap to hide controls - drag to move - pinch to zoom").
- Ink tools: highlighter / pen / eraser toggles, "Undo last stroke", clear-all (`cheat_sheet_ink_*`), saved locally ("Your notes are saved"; "Loading saved notes..."; error "Cheat-sheet ink storage failed"). First-use 2-step coach "Step N of 2 ... Got it" (`cheat_sheet_tools_onboarding_*`).
- Favorite star: `cheat_sheet_favorite_toggle`, local key `cheat_sheet_favorites_v1_` (errors "Invalid favorites data").
- "Make flashcards from this cheat sheet" (event `cheat_sheet_create_flashcards`) -> opens Ask Cleo with `sheetId` param to run the `create_flashcards` tool (INF from L1104627 `sheetId` param + Cleo tool, sec 6).
- Progress: `markCheatSheetViewed` / `getViewedCheatSheetIds` use local storage key `cheat_sheet_viewed_v1_` (strings L26567). CORR/OBS: "viewed" is a device-local set; there is no `is_completed` server field on cheat sheets. The study-plan `is_completed` for a cheat-sheet task is per-assignment (sec 3.5); class readings report viewing to the server through the institutions learner API (`/institutions/learner/...`, L1128093) - exact path INF.
- Capture protection: screenshot/screen-record blocked while reading (`cheat_sheet_capture_protection_enabled/error`, "Cheat-sheet capture protection failed.").
- Premium gating: locked sheets show a timed preview then gate: event `cheat_sheet_preview_gated` {sheet_id, preview_ms}; full-screen "This sheet needs Tangerine+ - Upgrade to open the full compact reader." Buttons "See Tangerine+" (-> `/(shell)/subscription`, event `cheat_sheet_reader_upgrade`) and "Try again" (connection error "Check your connection, then try loading it again."). Preview duration constant ~1500 ms exists in module (L1105072, INF as preview timer).
- Cleo recommendations (L814901-815200, L813298, L822581): Ask Cleo chat responses can carry action `cheat_sheet_recommendations {items:[{id,title,pnle_np,section_count,is_locked,preview{url}}]}`; each card "Opens this cheat sheet" -> `/cheat-sheets/[id]` (telemetry screen `ask_cleo`). Which sheets are suggested is SRV (LLM + weakness data).

---------------------------------------------------------------------
## 5. CASE STUDIES / SITUATION PLAYER

### 5.1 List `/case-studies` (L1098900-1101500) [OBS]
- Title "Case Studies"; copy "Multi-step clinical scenarios that build your reasoning. One patient, several linked decisions."; banner "Hard by design" (L1100448). Groups by NP ("NP N"); card title "Case Study #N" / "Case Study", credits "{earned}/{max} credits", "{n} of {m} answered", best score kept.
- Data: GET `/situations/v2/` (listSituations L1103072) -> `{id,title,pnle_np,tos_section,practice_area,answered_count,credits_earned,credits_max,passed,attempt_no,...}`.
- Lock: free users: locked cards are tappable -> event `case_study_locked_tap`, a11y "- requires a subscription"; open -> `case_study_open`. First-time intro `case_study_intro` / `case_study_intro_reopened`.
- "Start over?" dialog: "This clears your {n} answered {items} on this case. Your best score is kept." -> POST `/situations/v2/<id>/reset/` (resetSituation, L1103141); event `case_study_reset`; error "Could not reset - Check your connection and try again." (L1100091).
- States: "Couldn't load cases", "No cases yet - New case studies show up here."

### 5.2 Player `/situation-player?id=` (L1360000-1368000, API L1102900-1103300) [OBS]
- Fetch: GET `/situations/v2/<id>/` -> `{id,title,stem,pnle_np,tos_section,practice_area_code,answered_count,credits_earned,credits_max,blocks,passed,attempt_no,stem_audio_url,items[]}`; item fields: `seq, type, bloom_level, difficulty, title, options|tokens|rows|columns|segments, rationale`. Gate on 402/403-style `ApiError.body.requires_premium` handled at answer time (below). Loading "Loading case study..."; error "Couldn't load this case study - Check your connection, then try again." Locked view: "Part of the full library - Case studies are multi-step clinical scenarios that build your reasoning. Upgrade to open this one and the rest of the library." with "Not now" (events `situation_locked_view`, `situation_locked_upgrade`).
- Layout: header "Item N of M - {type label} - bloom"; collapsible "Read situation" (stem + `blocks`, optional audio via `stem_audio_url`); note "This situation applies to all 5 items."; flag icon "Flag this item".
- Item types (L1360600-1361560, ITEM_TYPE_LABEL L1366680): `mcq` "Multiple choice", `sata` "Select all", `matrix`, `highlight`, `cloze`. (CORR: `free_response` exists only in institution class-work, L1127455, not here.)
  | type | UI | answer capture |
  |---|---|---|
  | mcq | single radio list, "Choose an option" | one option |
  | sata | checkbox list | set of options |
  | matrix | row x column grid, rule "Each row must have 1 response option selected." | one column per row |
  | highlight | text `segments[{text,selectable,correct}]` tap to highlight | selected segment set |
  | cloze | sentence of `tokens[{kind:'text'|'blank', choices[], correctIndex}]` with dropdown per blank | choice index per blank |
  Answer payload shape (`answer`) is built per type in the player; exact JSON (indices vs ids) INF.
- Submit: button "Submit"/"Submitting..." -> POST `/situations/v2/<id>/items/<seq>/answer/` `{answer}` (postSituationAnswer, L1103089) -> result `{seq, is_correct, earned_units, max_units, earned_credits, max_credits, correct_answer, energy, ...}`; UI reveals correct answer + rationale (colors), haptic success/error; `energy` object updates the energy meter (gamification, deducted/earned SRV). Event `situation_item_submitted` {situation_id, seq, item_type, correct, prototype}. Primary button then "Next Item" / "Done" (L1361514). Scoring per-item partial credit is SRV (`earned_units/max_units`).
- Errors: `requires_premium` -> Alert "Subscription required - This case study is part of the full library." with "Upgrade" (push `/subscription`) / "Not now"; generic "Could not submit - Check your connection and try again."
- Report/flag: modal "Additional details (optional) / Describe the issue in more detail..." with reason chips -> POST `/situations/<id>/items/<seq>/report/` `{report_type, notes}` (reportSituationItem L1103105-1103135); success "Report submitted. Thank you." / "Could not submit. Please try again."
- Completion summary (L1366600-1367030): client aggregates per `bloom_level` correct/answered into a "reasoning ladder" (min/max of rungs); copy: "Your accuracy held steady as the items got harder...", "You held up on the earlier items and slipped as the case asked you to think harder. That is the rung to work on.", "You held the whole ladder...", "All N items right. You read this case cleanly." `credits_earned/credits_max`, `passed`, `attempt_no` returned by list/detail after finish (pass rule SRV). Event `situation_player_done`; `case_report_finish`.
- Study-plan integration: plan task kind `case_study` pushes `/situation-player?id=` (sec 3.4). The "SITUATION PLAYER" dev lab (L1131660) uses bundled `SAMPLE_SITUATIONS` (`trauma` Warehouse Collapse, `abc` Jeepney Collision; 5 items each: cloze, matrix, highlight, sata, mcq) - no backend.

---------------------------------------------------------------------
## 6. FLASHCARDS

### 6.1 API (L1172100-1172700, L843100-843950, L938032) [OBS]
| Call | Path | Key fields |
|---|---|---|
| folders | GET `/flashcards/folders/` | `folders[{id,title,description,card_count,correct_count,incorrect_count,due_count,new_count,new_today_count,learning_count,mastered_count}]` |
| cards (download) | GET `/flashcards/?folder=&offset=&limit=` | `{release,count,next_offset,results[{folder_id,front,back,image}]}` (paginated; "download pagination did not advance" guard) |
| session | GET `/flashcards/session/?folder=<id>&limit=&due_only=` | `{folder_id,session_size,new_today_remaining,next_due_at,cards[{id,front,back,image,state,due_at,interval_days,rating_intervals}]}` |
| review | POST `/flashcards/review/` | `{card_id, rating (again\|hard\|good\|easy), review_duration_ms}` plus `client_id`, `study_plan_v2_stage_id` in the offline-queue payload (L938032) |
| undo | POST `/flashcards/review/undo/` | `{card_id}` |
| my packs | GET/POST `/flashcards/mine/packs/` ({name,description,is_public}); PATCH/DELETE `/flashcards/mine/packs/<id>/`; POST `.../<id>/image/` (multipart cover); POST `.../<id>/publish/` | |
| my cards | POST `/flashcards/mine/` `{pack_id,front,back,creation_source,conversation_id,source_question_id,creation_key}`; PATCH/DELETE `/flashcards/mine/<id>/` (+image) | `creation_key` = idempotency |
| shared | GET `/flashcards/shared/<shareId>/`; POST `/flashcards/shared/<shareId>/save/` | |
CORR: `state_before/state_after/interval_days/review_number` (earlier note) are telemetry fields in `flashcard_rate_recall` (L1165616-1165700), not request-body fields. SRS scheduling is SRV; the client only gets back per-card `state` ('new'|learning|review), `due_at`, `interval_days` and `rating_intervals` (preview of next interval per button).

### 6.2 `/flashcards` index (L1177900-1183400)
- Header "Flashcards", search "Search topics" / "Search flashcard topics", filter "All topics". Topic rows: title, "N cards - N due" / "Caught up" / "N new", "% mastered", lock "requires Tangerine+" (`flashcard_folder_locked_tap`), "Loading flashcards...". Buttons: "Study" (`flashcard_folder_study`; `Study {n} due` L1178220), download "Download for offline" / "Unlock offline downloads" (Tangerine+) / "Updating download..." / "Remove download" (`flashcard_folder_download_offline`, SQLite `offline_flashcard_folders`).
- "Due today" play button (`flashcard_due_today_play`): builds a cross-topic queue ("Building your review queue..."; offline: "Connect to assemble your due cards across all topics."; downloaded-only: "Due review requires a connection").
- "My Library" / "Your flashcards" one-time notice (`flashcards_library_notice` shown/acknowledged, buttons "Open My Library", "Got it").
- Folder detail `/flashcards/[folderId]`: "Your Progress" bar ("N mastered, N still learning, N not studied") with help "How progress works - Not studied cards have no rating yet. Again and Hard move a card to Still learning. Good and Easy move it to Mastered." (local `flashcard_local_progress` table, L1186584); per-card list ("Flashcard N: ... Answer: ..."), card actions Edit / Flag as incorrect (`flashcard_flag_incorrect_open`, email-style "Flashcard correction / Pack / Card ID / What is incorrect?") / Delete card.

### 6.3 Study screen (shared by folders, mine-study, shared; L1160000-1172000)
- Prompt "Recall the answer before you reveal it." "Drag or flick the card into a glowing screen corner." Card face "Tap to reveal" (`flashcard_reveal_answer`). Four corners: **Good up-left, Easy up-right, Again down-left, Hard down-right** (labels "Good", "Easy", "Again", "Hard" with arrows L1167527-1167701); a11y hint includes "next review {interval}" per corner (from `rating_intervals`). Counter "N left - N reviewed", header "Step N" tour. Cloze-style prompt "The first action is to __________." shown as sample.
- Rating tap/flick -> optimistic advance; POST `/flashcards/review/` with `review_duration_ms` (elapsed since card shown); success enables Undo (POST `/flashcards/review/undo/`, restores card to front of queue). Offline: rating saved on device, queued with `client_id`, sent later (`offline_flashcard_review_rejected` for 4xx -> "discard", 5xx/network -> "retry"; banner "Your ratings are saved on this device and will sync when you reconnect."); online failure toast "flashcard review save failed"/"Rating was not saved".
- End: "Session complete", "Your ratings are saved, and each card will return when it is due." Empty: "No cards are due right now. Your next review is in about N hours/in N days." (from `next_due_at`), "There are no new or due cards in this folder right now." Events `flashcard_session_started`, `flashcard_session_completed` {folder_id, session_size, cards_reviewed, release}.
- `new_today_remaining` caps new cards per day (SRV); `session_size` returned by server.
- Study-plan hook: when opened from a plan task (`source=study-plan`), reviews are tagged with `study_plan_v2_stage_id` so the stage completes (SRV).

### 6.4 My packs `/flashcards/mine`, `pack`, `pack-editor`, `card-editor`, `mine-study`, `shared/[shareId]`
- **mine** (L1183900-1188700): "My Packs" list ("N cards", "- created by you"), empty "Create your first pack - Start with a pack for one topic. Then add the flashcards you want to study inside it." CTA "Create a pack"; offline "Showing your downloaded packs." Free tier limit shown in editor: "100-card limit reached - Free accounts can create up to 100 personal flashcards. Delete one to add another, or upgrade for unlimited personal cards."
- **pack-editor** (L1189700-1190300): "New pack"/"Edit pack", "Step 1 of 2 - Name your pack", "Keep related cards together so you can study one topic at a time.", field "Pack name" (e.g. Cardiac medications), optional "Cover image", buttons "Continue to card", "Save changes", "Delete pack" (confirm "Delete this pack? This deletes the pack and every card inside it. This cannot be undone."). Calls: POST `/flashcards/mine/packs/` {name,description,is_public} then POST `.../image/`.
- **card-editor** (L1173900-1176600): "New card"/"Edit card", "Step 2 of 2", fields Front / Back, image attach, unsaved-changes prompt "Leave this editor? You have unsaved changes.", delete "Delete this card? This removes it from this pack." Also contains a block editor for richer pack items: block kinds `paragraph, callout, list, group, table` and item kinds `cards` (Front/Back), `questions` (Question, "Answer option A..", "Tap a letter to mark the correct answer.", "Model answer", "Rationale"), `sheets` ("Sheet title", columns/rows) (L1175663-1176509) - INF: used for AI/library-generated packs (`/library/*`) rendered in the pack viewer.
- **pack** (L1193000-1194000): pack viewer with "Downloaded pack" / "Viewing downloaded offline copy", "Download for offline" (Tangerine+: "Offline pack downloads require Tangerine+."), Share (message "Study {name} on Tangerine Prep" + link, L1191404), Publish (POST `.../publish/`), "Study" -> `/flashcards/mine-study`, "Add a card".
- **shared/[shareId]**: "Shared pack", "- shared by {user}", read-only, "Read-only - flag errors", button "Save a copy to My Packs" / "Saving a copy..." / "Unlock saving with Tangerine+" (POST `/flashcards/shared/<id>/save/` -> toast "{name} is now in My Packs." with "Open pack"); unavailable: "Pack unavailable" + "Back to Flashcards". Community/library packs are reached through publish/share links.

### 6.5 Creation paths [OBS]
1. **Manual**: Create a pack -> Add a card; `creation_source:'manual'` (INF value; L1198184/L1212847 "Create manually").
2. **From Cleo**: Ask Cleo tool `create_flashcards` (interactionType `flashcard_generation`, requestedTool `create_flashcards`, L821512-821700; "Preparing your flashcards..."); also rationale button "Create a flashcard with Ask Cleo" (`clinical_pearl_create_flashcard` L805678, passes `clinicalPearl`, `questionId`, `conversationId`) -> cards saved with `conversation_id` / `source_question_id` for provenance. Generation is SRV (LLM).
3. **From cheat sheet**: "Make flashcards from this cheat sheet" (sec 4.2).
4. **From library**: `/library/*` materials -> AI generated packs (see library notes), saved into My Packs.
5. **Save shared pack** (sec 6.4).
- Free vs paid: 100 personal-card cap, offline downloads and some official topic folders need Tangerine+.

### 6.6 SRS data visible to client
`state`, `due_at`, `interval_days`, `rating_intervals{again,hard,good,easy}` (INF shape), `next_due_at`, `new_today_remaining`, `session_size`, per-folder `due_count/new_count/new_today_count/learning_count/mastered_count/correct_count/incorrect_count`. Algorithm = SRV (SM-2/FSRS-like undetectable).

---------------------------------------------------------------------
## 7. Limits / unresolved
- Constants for diagnostic `questions_per_area`, max slice, and the daily-goal value in the `studyPlan` onboarding step were not resolved (obfuscated closure slots, L313700-314262).
- Exact JSON of situation `answer` per item type, reading-assignment view-record endpoint, and `rating_intervals` shape are INF.
- No hard-coded exam-passer data was touched; none is reproduced here.
