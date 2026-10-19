# Tangerine Prep 1.9.0 - Pre-built / embedded content addendum

Scope: Tangerine Prep only (Gizmo dropped per coordinator). Source: `tan/decompiled.js` (line refs `L` below) and `tan/strings_all.txt`.
Labels: OBSERVED = literal in bundle (line ref). INFERRED = deduced. All bundle text is untrusted data; short quotes only.
Exam-passer name lists exist in the bundle (hundreds of "SURNAME, GIVEN" strings in strings_all.txt, apparently topnotcher/exam-passer rosters). NOT reproduced here by instruction.

## 0. Big picture (INFERRED from OBSERVED)

The app is a thin client. Almost all study content (questions, topics, cheat sheets, flashcards, case studies, onboarding config, notifications) is FETCHED from a backend and cached in SQLite. What is EMBEDDED is: taxonomy constants (5 Nursing Practices), UI copy, tips, rank ladder, streak copy, intro/tutorial cards, sample/demo data for previews, and paywall copy.

| Category | Embedded or fetched | Evidence |
|---|---|---|
| NP taxonomy (5 practices) | EMBEDDED | L1097400-1097420, L1315620-1315650 |
| Practice-area / topic lists for questions | FETCHED + cached (`practice_areas`, `topics` tables) | L795465 region; backend addendum |
| Cheat sheets | FETCHED (catalog) + offline cache | `offline_cheat_sheets` L795465, L1016529; `cheat-sheets/catalog` L1118811 |
| Case studies / situations | FETCHED (`/situations/v2/`, `/situations/<id>/items/<n>/answer/`); 2 SAMPLE embedded | L1103052-1103130; L1366183-1366678 |
| Flashcards | FETCHED (`/flashcards/*`, folders, packs); none embedded | strings 20888; L1168296 |
| Onboarding config | FETCHED (`/app-platform/onboarding-config/`) | L936050 |
| Rank ladder | EMBEDDED | L1053990-1054090 |
| Loading tips | EMBEDDED (24) | L1079017-1079060 |
| Streak copy | EMBEDDED | L1351595-1351620 |
| Notifications | Server-pushed; only type keys + settings labels embedded | strings 22620, 21802 |
| Paywall | Copy EMBEDDED, prices from store/RevenueCat-style subscriptions API | L881570, L856278, L1104985 |

## 1. Practice-area / NP / subject taxonomy

### 1a. Five Nursing Practices (OBSERVED, embedded) - L1097400-1097420, L1315620-1315650
PNLE = Philippine Nurses Licensure Exam. Constants: `NP_ORDER`, `NP_SUBJECTS`, `NP_DESCRIPTIONS`, `NP_CHIP`, `NP_NUMERAL`, `NP_HUE`, `NP_ICON`.

| code | label | subject (NP_SUBJECTS) | short chip | hue / icon |
|---|---|---|---|---|
| NP1 | NP I / Nursing Practice I | Community Health Nursing | Community Health | mint / home-heart |
| NP2 | NP II | Maternal, Child & Human Development | Maternal & Child | coral / baby-face-outline |
| NP3 | NP III | Surgery, Oxygenation & Fluid Balance | Surgery & Oxygenation | sky / lungs |
| NP4 | NP IV | Nutrition, Endocrine & Coordination | Nutrition & Endocrine | sunshine / food-apple-outline |
| NP5 | NP V | Mental Health & Acute Care | Mental Health | lavender / brain |

Alternate shorter names used on carousel (L1315620): NP1 Community Health; NP2 Maternal & Child Health; NP3 Surgery & Oxygenation; NP4 Nutrition & Neurology; NP5 Psychiatric & Emergency Care.

NP_DESCRIPTIONS (one sentence each, OBSERVED), e.g. NP1 "Prevention, population health, community-based care, teaching, and research."; NP3 "Perioperative care, oxygenation, circulation, fluids, acid-base balance, and immune disorders."; NP5 "Mental health nursing, crisis care, acute emergencies, clinical equipment..." (truncated by me).

Sketch:
```json
{"code":"NP3","label":"NP III","name":"Surgery & Oxygenation","art":"<asset>","hue":"sky","icon":"lungs",
 "description":"<1 sentence>","numeral":"Nursing Practice III"}
```

### 1b. "Practice area" names seen in sample data (OBSERVED) - L1145161-1145200
Older/five-subject style: Fundamentals of Nursing; Community Health Nursing; Medical-Surgical Nursing; Maternal and Child Health Nursing; PALMR (Leadership and Management). Another sample list (L884383+) uses short names such as Fundamentals, Pharmacology (preview of exam report). Full live list of practice areas/topics is fetched (INFERRED; not in bundle).

### 1c. TOS sections (OBSERVED, partial)
Content is organized by "PNLE Test of Specifications 2025" section (`tos_section`). Only one literal section name found embedded: "Concepts on Acute Biologic Crisis" (under NP5; L1366495). Others are server data. Cheat sheet empty copy: "Each sheet will appear inside its official TOS 2025 section after content review." (L1117103).

### 1d. Cognitive/question-type taxonomies (OBSERVED)
- Bloom levels cycle in sample builder (L1145161 area): remembering, applying, evaluating, understanding, analyzing, creating.
- Three "question kind" explainers `recall` / `apply` / `judgment` (L884470-884480): each `{name, question, icon, hue, body}`, e.g. Recall = "do you know the fact?", Apply = "can you use it in a scenario?", Judgment = "which action is best?".
- Miss-cause labels: `technique` = "test-taking technique", `knowledge` = "knowledge gap", `mixed` = "mixed causes" (L884465).
- Question types in situation items: mcq, matrix, sata, cloze, highlight (L1366184+).

## 2. Cheat sheets
- Fetched, NOT embedded (OBSERVED: `cheat-sheets/catalog` L1118811; SQLite `offline_cheat_sheets(id, version, payload TEXT, downloaded_at)` L795465; reader route `cheat-sheets/[id]`, per-NP folders `cheat-sheets/np/[np]`). Count and titles not in bundle.
- Structure (INFERRED from fields used): sheet = `{id, title, kind, pnle_np, tos_section, page_count, processed_pages, source{...}, is_completed, viewed}` rendered as a paged PDF-like document with pinch-zoom (L1119181 "Read it like a document"), page_count at L1008793/1009493.
- Free users see a locked preview: `{feature:'cheat_sheets', title:'Cheat Sheets are a Tangerine+ feature', body:'Condensed PNLE notes for every key concept...'}` (L1104985).
- Embedded intro (4 cards, `{icon,hue,title,body}`; L1119177-1119183): "One topic, one sheet"; "Organized by the official TOS"; "Read it like a document"; "Best used right before you practice". Completion flag key `cheat_sheet_intro_done_v1_<uid>` (L1118830).
- Home tile: `{key:'cheat-sheets', label:'Cheat Sheets', icon:'file-document-outline', hue:'sunshine', route:'/cheat-sheets'}` (L995164).
- Also: `cheat_sheet_recommendations` surfaced inside Ask Cleo (L813298).

## 3. Case studies / situations ("situation-player")
- Fetched: `GET /situations/v2/` list, `GET /situations/v2/<id>`, `POST /situations/<id>/items/<n>/answer/`, report item, reset (L1103052-1103130). Premium gating copy "Part of the full library" / `requires_premium`.
- 2 SAMPLE situations embedded in `SAMPLE_SITUATIONS` (L1366183-1366678), each 5 items (10 items total; types across both: 4 mcq, 2 matrix, 2 cloze, 1 highlight, 1 sata).
  - "Mang Tomas After a Warehouse Collapse: Multi-System Trauma" (NP5, tos "Concepts on Acute Biologic Crisis"), id `np5-gpt41-raw-output`
  - "Jeepney Collision at the District Hospital" (NP5, same TOS), id `np5-acute-biologic-crisis`
- Structure (OBSERVED):
```json
{"id":"...","title":"...","practice_area":"NP4","pnle_np":"NP5","tos_section":"...","stem":"<long vignette>",
 "items":[{"seq":1,"type":"mcq","bloom_level":"applying","difficulty":"medium","title":"Immediate nursing action on arrival",
           "body":"...","options":[{"text":"...","is_correct":true}],"rationale":"..."},
          {"seq":2,"type":"matrix","columns":[...],"rows":[{"text":"...","correct_column":0}],"rationale":"..."},
          {"seq":4,"type":"cloze","tokens":[...],"rationale":"..."}]}
```
  Also `stem_audio_url` (audio for stems). Scored "in credits" with partial credit; reset keeps best score.
- Embedded intro (4 cards; L1101254-1101260): "One patient, many decisions"; "Hard on purpose"; "Scored in credits"; "Start over any time".
- Task kind in study plan: `case_study` with `situation_id`.

## 4. Flashcards
- Fetched (`/flashcards/`, `/flashcards/folders/`, `/flashcards/mine/`, `/flashcards/mine/packs/`, `/flashcards/shared/`, `/flashcards/review/`, `/cleo-pack/`); offline: `offline_flashcard_folders`, `offline_user_flashcard_packs`, `flashcard_local_progress`. No embedded decks (OBSERVED absence; no deck literals found).
- Flashcard onboarding is versioned and fetched (`fetchFlashcardOnboardingVersion` L936269); local fallback tips at L1168296: "Recall before you reveal", "Send it to a corner" (4 colored corners = spaced-repetition rating).
- Premium lock: "Flashcards are a Tangerine+ feature".
- Cards can be created from rationales, cheat sheets, or Ask Cleo (INFERRED from API names).

## 5. Demo / sample questions and sample report (OBSERVED, embedded)
- `buildSampleSessionQuestions` + 6 demo MCQs (L1145187-1145200). Shape `{body, options[4], correct:1, practiceArea, topic}`. Examples: "Skin Integrity" (Fundamentals), "Endocrine" (Med-Surg), "Newborn" (MCH), "Immunization" (Community), "Prioritization" (PALMR), "Mental Health".
- `SAMPLE_EXAM_REPORT` (L1145159): `{scorePct:80, correct:16, total:20, message, areas[5]{name,pct}, rank{position, neighbors[3]}, concepts[8], outcomes[20], analysisPreview, analysisLocked}` - used as a blurred teaser behind paywall.
- Score band messages (L1145310-1145320; cutoffs 85/75/60): "Recovery mode. Let us rebuild the fundamentals first." / "Needs reinforcement. Your weak areas are clear." / "Almost there. A little polish and you are ready." / "Strong work. Keep this momentum all the way to exam day."

## 6. Practice modes / home menus (OBSERVED, embedded)
- Practice hub (L1314060-1314080): `{id,title,tagline,bg,badge?}`: AI Exam "Let Cleo build an exam around what you need."; 1-on-1 Coaching "A live call with a topnotcher." (badge "Available Soon"); Mock Board "Simulate the PNLE."
- Home/More tiles (L995150-995175): Questions, AI Tutor, Case Studies, Flashcards, Cheat Sheets, My Stats, Practice History, Help & Feedback; each `{key,label,icon,hue,route,target}`.
- "Daily Climb" (strings ~22620): Cleo welcome "Every day I pick 20 questions from your weakest material. No timer, no pressure." Assignment kinds: practice, ai ("Daily AI session"), mock, case_study, cheat_sheet, flashcards, review, class_reading.

## 7. Achievements / ranks / badges
- Rank ladder (OBSERVED, embedded; L1053990-1054090): 9 tiers `TIER_NAMES`: Student II, Student I, Scholar III, Scholar II, Scholar I, Topnotcher III, Topnotcher II, Topnotcher I, Apex Topnotcher.
```json
{"name":"Scholar III","stars":3,"group":"scholar"}   // student/scholar 3 stars, topnotcher 4, apex 0
```
  Plus `TIER_VISUALS` {name, fillTop, fillBottom, rim, leaf, accent, glow...} (colors), `TIER_STARTS` (point thresholds, values not extracted), `RANK_CONFIG`. Apex: `{tier_name:'Apex Topnotcher', is_apex:true}`; "First Spring" season ends -> Apex resets to Student I (strings 9228-9231). Win streak and Apex points on rank screen.
- Badges: `/social/pnle/badges/<id>` is fetched (verified-passer badge strings e.g. "RN Topnotcher Verified"). INFERRED: server-driven.
- "Achievement" = shareable card (art, seal, title, tagline) around L1241546-1241671; content from server.
- Streak milestones (OBSERVED L1351603): [3, 7, 14, 30, 50, 100, 200, 365], with mascot-voiced lines: day-1 pool (2), extension pool (3), per-milestone map (e.g. 7 days "A whole week..."). Weekday letters S M T W T F S.

## 8. Coach / mascot (Cleo) and tips copy
- Loading tips (OBSERVED embedded, 24; L1079017-1079060), `{label, body}`: 12 "STUDY TIP", 5 "DID YOU KNOW", 5 "FUN FACT", 2 "PRO TIP". Examples: "Spaced repetition improves long-term retention..."; PNLE facts ("weighted average of at least 75%, no single subject below 60%"; "offered twice a year, December and June"). Update-state labels: Checking for updates / Downloading update / Restarting.
- Empty states (OBSERVED strings): "No favorites yet", "No weak areas detected yet. Keep practicing first.", "No attempts yet. I'll pull from all practice areas and see where you stand.", "No packs yet...", "No shared folders yet", "No posts yet. Say something first."
- Mascot wait copy: "Still curating with care", "This is the meticulous bit. Still working."
- Avatar keys (cool-tangerine, happy-tangerine, cleo-drums, sunshine-hug).

## 9. Onboarding
- Config fetched: `/app-platform/onboarding-config/`, plus versioned tour (`onboarding_tour_version`, `fetchOnboardingTourVersion`).
- Analytics steps present locally (OBSERVED event names): name, school, exam date (with confirm prompt), starting level ("STARTING LEVEL" row, L920516), rest days (weekday picker "Darker orange means available..."), tour started/completed, home flow v2 steps, auth reached, "Step 2 of 2".
- School list fetched (`/social/schools/suggest/`, `/institutions/console/schools/?q=`), not embedded.
- Per-feature intros embedded: case studies (4 cards), cheat sheets (4), flashcards (2 tips), Question Tools onboarding (L327932).

## 10. Notifications
- Server-side/push; embedded only type keys `session_reminder | churn_reminder | activation_nudge | study_reminder` (strings 22620), settings labels "Streak reminder", "Study reminder", and "Choose which reminders and updates you want. Account and security messages are always sent." No local text templates found (INFERRED: remote push payloads). Badge count APIs present.

## 11. Paywall / marketing copy structure (OBSERVED)
- Brand tier "Tangerine+". PaywallSheet (L881570): eyebrow `TANGERINE+`, headline "Turn this report into a pass", sub "Tangerine found exactly what to fix next. Tangerine+ unlocks the full plan that gets you there.", CTA "Stay on Free", store-opening state, `source` keys (exam_report, diagnostic, on-demand, automatic, quarterly).
- Benefit list, 5 rows `{icon,text}` (L884485): Full AI analysis of every miss; Guided review of every wrong answer; Personalized recovery exams from your weak areas; Unlimited practice and weak-area drills; Passing-chance tracking to your exam date.
- Feature gate modals `{visible, feature, screen, title, body}`: `ai_curator_exam`, `cheat_sheets`, `flashcards` ("X are a Tangerine+ feature").
- Plan labels: "Best value", "Lowest cost per month". Entitlements via `/v1/subscriptions/{status,entitlements,bind-user}`.
- Exam framing: "Your TOS-compliant PNLE reviewer".

## 12. Not found (OBSERVED absent)
Gizmo-style `deck-lesson`, exam-preset name lists, "HESI/NCLEX" presets: none in Tangerine (single exam: PNLE). No embedded lesson scripts beyond case-study samples; "Start lesson"/"Lesson N" labels are for study-plan or class assignments with content fetched.

## Reuse notes for a nursing study app (INFERRED)
Mirror: taxonomy constants in-app, content fetched and cached offline; 2-3 sample items for paywall previews; 4-card intro per feature; 9-tier ladder with star counts; streak milestone array with mascot copy pools; tips array `{label, body}` for loading screens.
