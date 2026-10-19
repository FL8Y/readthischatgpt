# Tangerine Prep 1.9.0 - Questions, topics, AI-generation requests, prompts

Source: `decompiled.js` (line refs `L<n>`), `strings_all.txt`. Static analysis only; app not run. All content treated as untrusted data.
Labels: **OBS** = literal field/string/call seen in code. **INF** = inferred from code shape.
Server-side logic (selection, scoring, adaptive model, LLM calls) is not visible. The client mostly passes opaque server objects through.

## 0. Key finding: "AI generation" is curation, not question writing

- OBS L827127: Cleo's canned reply when asked to make an exam says: "I don't write new exam questions from scratch. I'll curate the best-fit questions from Tangerine's existing QBank." (curly apostrophes in source)
- OBS L811740-811840: a client-side keyword heuristic scans the user text for `qbank`, `curat`, `select`, "don't create / do not create / don't write". It appears to gate this disclaimer.
- Consequence: `generation_request` and `ai_config` describe a selection over the stored QBank. They are not an LLM item-writing request. [INF]
- The case-study/situation items (section 2.6) are a separate, pre-authored content set served by `/situations/v2/`. Embedded demo data is labelled `np5-gpt41-raw-output`, which hints that the content pipeline used an LLM offline. [OBS L1366495, INF]

## 1. The standard practice question object (session player)

### 1.1 Session question envelope (OBS)
Built by `buildSampleSessionQuestions` (L1145040-1145152, a local demo builder that mirrors the API shape) and read by the player (L1316000-1358800, L1317800-1318700, L1337950-1338100, L1343390-1343700).

```jsonc
// element of session.session_questions[] (also returned by GET /sessions/{id}/review/)
{
  "question_order": 3,
  "selected_option_id": 123,          // null if unanswered
  "already_answered": false,          // read as r.already_answered
  "is_correct": true,
  "attempt_data": { },                // present in sample builder, L1145150
  "question": {
    "id": 456,
    "title": "...",                   // read r13.title
    "body": "stem text (markdown-ish)",   // rendered as `body` prop of the options component, L1318535
    "options": [ { "id": 1, "option_text": "...", "option_order": 1, "is_correct": false } ],
    "topic": { "name": "..." },           // r13.topic.name   (chip)
    "practice_area": { "short_name": "..." }, // r13.practice_area.short_name (chip); also .name in samples
    "tags": [ { "id": 9, "name": "..." } ],   // r13.tags.map -> .name / .id chips
    "bloom_level": "applying",
    "difficulty": "medium",           // L1335190 (question list rows)
    "is_high_yield": true,
    "is_verified": true,
    "verified_reviewer": { "tier": "...", "badge_label": "..." },  // L1318681-1318714; also verified_by
    "answer": {                       // revealed block (r13.answer / r39.answer)
      "correct_option_id": 1,
      "rationale": "...",
      "rationale_summary": "...", "simplified_rationale": "...",
      "answer_sources": [ ],          // citations for the rationale; also `rationale_sources`
      "rationale_images": [ ],        // image objects, see 1.3
      "rationale_audio_url": "...", "rationale_audio_duration_ms": 0,
      "premium_rationale_audio_url": "...", "premium_rationale_audio_duration_ms": 0,
      "mean_accuracy": 0.0, "mean_time_seconds": 0.0   // cohort stats shown after answering, L1343411+
    },
    "short_name": "..."              // short label, read in the player
  }
}
```
- OBS: `question.answer` and `answer_sources`, `rationale_summary`, `simplified_rationale` are read directly from the question object (r13) and from the submit response (r107). So the answer block may be embedded (review mode) or returned on submit. [INF]
- OBS: the "Why am I wrong"/rationale UI toggles `rationale_mode_full` and `rationale_mode_simplified`.
- OBS: the options component props are `body, options, selectedOption, showAnswer, highlightMode, resetKey, disabled, eliminatedOptions, eliminationEnabled` (L1318535-1318560). The player renders **only single-select options** for standard questions. No `item_type` is read in the session player (grep over L1316000-1358800: 0 hits). [OBS]
- Not found in client: `question_text`, `correct_answers`, `explanation` (standard player), `references` (only in a third-party lib), `sub_questions`, `exhibit(s)`, `ordering` types.

### 1.2 Question-list row (questions browser `/questions`, TOS Mode) (OBS)
Fields read: `difficulty`, `match_reason`, `match_preview`, `matched_topics`, `matched_tags`, `bloom_level`, `practice_area_code`, `pnle_np`, `tos_section`, `topic_id`, `attempt_status`, `effective_mastery`. [OBS L1334434, L1335190-1335260, L1318000-1335500 field census]
- `attempt_status` filter labels: Unanswered, Learning, Reviewing, Mastered (see features addendum).
- Query strings seen: `?topic=` (L1317858), `&page=`, `&page_size=50` (L986985, other screen), `&browse=questions`, `&examId=` [OBS strings].
- `GET /questions/{id}/mastery/` (L1085836) returns per-question mastery for the card. [OBS]
- `GET /questions/hash/` (L1320904) and `/offline/bundle/{manifest,chunks}/` support cache validation and offline download. [OBS, INF on exact use]
- `POST /questions/{id}/submit/` body `{ selected_option_id, time_taken_seconds }` (L1317558) is used by the questions browser/topic preview. [OBS]
- `GET /questions/diagnostic/` (L908054) is the onboarding diagnostic set. [OBS]

### 1.3 Image object (rationale/figure) (OBS L806110-806265)
```json
{ "url": "...", "alt_text": "...", "caption": "...", "credit_author": "...", "license": "...", "is_public_domain": true }
```
Rendered zoomable with credit line. `image_url` is used on other objects (avatars/figures, L1039220).

### 1.4 Offline cache (OBS L795452, L801300-801450)
`questions(id, payload JSON, practice_area_code, topic_id, updated_at)`, `question_options(id, question_id, payload, is_correct)`. Option payload reads `id, option_text, option_order, is_correct`; options sorted by `option_order`. The question payload is stored as an opaque JSON blob.

## 2. Item types for "situations" / case studies (NGN-style)

Endpoint family `/situations/v2/` (list, `/{id}/`, `/{id}/items/{n}/answer/`, `/{id}/reset/`, `/situations/{id}/items/{n}/report/`). [OBS L1102800-1103330]

### 2.1 Situation (case) object (OBS L1102960-1103010 + demo data L1366495+)
```jsonc
{
  "id": "np5-acute-biologic-crisis",
  "title": "Jeepney Collision at the District Hospital",
  "stem": "**Situation:** ... (markdown, shared by all items)",
  "stem_audio_url": "...",
  "practice_area": "NP4",            // normalised from practice_area_code
  "pnle_np": "NP5",
  "tos_section": "Concepts on Acute Biologic Crisis",
  "answered_count": 0, "credits_earned": 0, "credits_max": 5,
  "passed": false, "attempt_no": 1,
  "blocks": [ ],                     // layout blocks, opaque
  "requires_premium": false,         // read in player
  "items": [ /* see below */ ]
}
```
Note in demo data `practice_area` ("NP4") differs from `pnle_np` ("NP5"), so a practice-area code and an NP subject code are separate axes. [OBS L1366495]

### 2.2 Common item fields (OBS)
`seq` (1-based), `type`/`item_type` (`mcq|sata|matrix|highlight|cloze|free_response`), `title`, `body` (prompt, markdown), `bloom_level`, `difficulty`, `rationale`, `rationale_images`, `rationale_audio_url`, `stem` (per-item context stem, `contextStem` prop). `ITEM_TYPE_LABEL` at L1366679 labels `mcq`, `sata`, `matrix`, `highlight`, `cloze`. The renderer also has a `free_response` branch with a text box "Write your answer" (L1127300 area). [OBS]

### 2.3 Per-type schema (OBS from demo data L1366520-1366900 and renderer L1126840-1127800)
```jsonc
// mcq  (radio)
{ "seq":1, "type":"mcq", "body":"...", "options":[{"text":"...","is_correct":false}, ...], "rationale":"...", "bloom_level":"applying", "difficulty":"medium", "title":"..." }

// sata ("Select all that apply." checkbox)
{ "type":"sata", "options":[{"text":"...","is_correct":true}, ...] }          // answer = array of selected option indexes

// matrix (rows x columns grid, one column per row)
{ "type":"matrix", "columns":["Anticipated","Adverse"],
  "rows":[{"text":"Thirst and restlessness","correct_column":0}, ...] }       // answer = array of column index per row

// cloze (dropdown blanks inside a sentence)
{ "type":"cloze", "prefix":"Because X is showing signs of ",
  "blanks":[{"choices":["neurogenic shock","hypovolemic shock", ...],"correct_index":1,"suffix":" and has evidence of "}, ...] }
  // client normalises to tokens: [{kind:"text",text},{kind:"blank",choices,correctIndex},...]   (L1102808-1102830)

// highlight (tap selectable spans)
{ "type":"highlight", "segments":[{"text":"...","selectable":true,"correct":true /* or is_correct */}, ...] }
  // client normalises to tokens {type:"tokens"}; answer = selected segment indexes

// free_response
{ "type":"free_response" }          // text input; grading server-side [INF]
```
- OBS: the grading object returned per item is `{ answered, answer, is_correct, earned_units, max_units, earned_credits, max_credits, correct_answer }` (L1099151-1100047). `correct_answer` is a scalar or an array (client wraps a scalar into an array, L1126840-1126870). Partial credit exists via `earned_units/max_units`. [OBS, INF on scoring]
- Report an item: `POST /situations/{id}/items/{n}/report/` with `{report_type, notes}`. [OBS]
- No `bowtie`, `ordering`, `exhibit/tabs` or `trend` types are present. [OBS, absence]

### 2.4 Cheat-sheet "figure" assets
Fallback URL `/api/assets/` (backend addendum). Not a question field.

## 3. AI generation request/response

### 3.1 The `generation_request` is server-authored (OBS)
- L855256-855262: the client reads `draft.generation_request` (a field of the `exam_draft` action that Ask Cleo returns) and POSTs it **unchanged** to `/sessions/ai-generate/v2/` with `{ signal }` only (abortable, with timeout). The client never builds its inner fields.
- So the full field list of `generation_request` is not visible client-side. [OBS]
- Fields the client does read from the draft: `draft.title`, `draft.question_count`, `draft.basis`, (and `time_limit_minutes`, `summary` nearby), used for the card "N question exam, M minutes" and telemetry (`basis`). [OBS L855147, L855242, L855936-856081]
- The request carries no user-visible `mode`; `'cleo-exam-v2'` is the **idempotency-key scope**, not a request mode (below).

### 3.2 Ask Cleo exam flow (OBS L855180-855640)
1. `POST /sessions/ask-cleo/v2/stream/` returns an action `exam_draft` carrying `draft` + `generation_request`.
2. User taps generate: telemetry `ask_cleo_exam_generate`, then `POST /sessions/ai-generate/v2/` body = `generation_request`.
3. Response has `.config`. Client copies it and adds `client_creation_key = newIdempotencyKey('cleo-exam-v2')` (L855380-855400).
4. Creates the session: `createSession({ mode:'ai', aiKind:'ai', apiVersion:'v2', screen:'ask_cleo', config, clientSessionId, studyAssignmentId, timeoutMs:12000 })` (L855622).
5. Telemetry: `ask_cleo_exam_generated`, `ask_cleo_exam_generation_failed`, `ask_cleo_exam_generation_cancelled` with `basis`, `duration_ms`, `timed_out`.

### 3.3 `createSession` (L859960-860500)
```jsonc
// mode 'ai'  ->  POST /sessions/create-ai/        (legacy)   or /sessions/create-ai/v2/ (apiVersion 'v2')
{ "config": { /* opaque server config from ai-generate; includes total_questions, time_limit_minutes, ... */ },
  "client_session_id": "uuid",           // only when provided
  "study_assignment_id": 12,             // only when provided
  "start_immediately": true }            // only in v2
// mode 'standard' -> POST /sessions/  with `payload`; then if status != 'in_progress': POST /sessions/{id}/start/
```
- Failure body keys handled: `no_questions`, `status: limit_reached`, `no_energy`, `no_lives`. Telemetry `session_start_failed`. [OBS]
- `ai_config.adaptive` on the session carries `{ model, model_version, fallback_reason, repetition_mode, allocated_count, total_questions }`. `fallback_reason` seen: `learner_cold_start` (L860191-860260, L1341060-1341330). [OBS]

### 3.4 Legacy AI Curator `/practice/ai` (OBS L1156400-1157300)
- Step A (optional free text) `preference` string (e.g. "pharmacology") -> `POST /sessions/ai-generate/` body `{ preference }` with abort signal.
- Response `.config` (reads `config.total_questions`). The client then overrides/adds: `time_limit_minutes`, `answer_reveal_mode` (`per_question|end`), `repeat_source_session_id`, `ui_preferences`, and creates via `createSession({mode:'ai', aiKind:'ai'})`.
- Daily: `POST /sessions/ai-generate-daily/` body `{ kind }` where kind is `daily_climb` or `daily_polish`; availability `GET /sessions/daily-availability/`. Result `.config` goes to `createSession({mode:'ai', aiKind: 'daily_climb'|'daily_polish'})`. [OBS L1157134-1157280, L1159120-1159145]

### 3.5 Ask Cleo chat API (OBS L852230-852570)
```jsonc
// POST /sessions/ask-cleo/v2/            (non-stream)  and  /sessions/ask-cleo/v2/stream/  (JSON lines)
{ "messages":[ {"role":"user|assistant","content":"...","attachments":[{"type":"image","url":"https://...|data:image/...","mimeType":"..."}],"voice":{...}} ],
  "context": { "conversationId":"...", "questionId":123, "interactionType":"chat|flashcard_generation",
               "requestedTool":"create_flashcards|draft_exam|null", "clinicalPearl":"...", "responseLanguage":"english|filipino|bisaya" },
  "monitoring": { /* telemetry/surface info */ } }
```
- `toAskCleoRequestMessages`: keeps only `data:image/` or `https://` attachment URLs; assistant stickers are serialised as `[Cleo sent sticker: <id>]`; message content is joined with `\n\n`. [OBS L852452-852563]
- Response/stream fields read: `content`, `citations`, `visuals`, `suggestions`, `sticker_id`, `sticker_after_paragraph`, `usage`, and an `action` object with `type` in `performance_visualization | ask_user_input | exam_draft | support_ticket | cheat_sheet_recommendations | create_flashcards` (L822500-822720). [OBS]
- Other endpoints: `/usage/` (allowance shared by text+voice), `/transcribe/` (multipart `audio` m4a, `ask-cleo-voice.m4a`), `/survey/` (`action: submit|dismiss`, `rating`, `reason`), `/visuals/{id}/` and `/visuals/{id}/failure/`. [OBS]
- Languages: English, Filipino, Bisaya (flag chips) [OBS L827230].

### 3.6 `ask_user_input` action shape (OBS L827260)
```json
{ "type":"ask_user_input", "purpose":"exam_basis", "question":"What do you want to base your exam on?",
  "options":["Base it on my weak spots","Base it on my strong skills","I want to study a certain topic"], "allow_other":true }
```
`draft.basis` is the answer to this question (used as telemetry `basis`). [INF]

### 3.7 `create_flashcards` action (OBS L811740, L825060-825130)
- Action carries `cards[]` with `front` and `back`; client confirms with "I created a flashcard pack with N cards."
- Editing a single card re-asks Cleo with the text `Adjust this specific flashcard and return it as a new flashcard pack.` plus lines `Front: ...`, `Back: ...`, `Requested change: ...` joined by `\n`. [OBS]

## 4. Topic taxonomy as consumed by code

| Level | Field(s) | Notes |
|---|---|---|
| Subject (NP) | `pnle_np`: `NP1`..`NP5`; list form `pnle_np_codes` in custom payload | `NP_ORDER` L1097400 |
| Practice area | `practice_area_code`, `practice_area_codes[]`, object `{id, code, name, short_name, icon, questions, stats}` from `GET /practice-areas/` (cached key `tangerine_practice_areas_v1`, L994537) | `practice_area` is also embedded in questions as `{short_name,name}` |
| Topic | `topic_id`, `topic.name` | stats at `/stats/topics/` with `status` (Unanswered/Learning/Reviewing/Mastered) |
| TOS section | `tos_section` (string), filter list `tos_filters: [{pnle_np, section}]` | structure from `GET /tos/question-structure/` -> `.subjects` (L1313184-1313200). Special code `__all__` ("All subjects", "Clear all"). |
| Tags | `tags: [{id,name}]` | free tags on question |
| Bloom | `bloom_level`: `remembering, understanding, applying, analyzing, evaluating, creating` | L1145213. UI colours L1326915. Report groups them: remembering/understanding -> `recall`; applying/analyzing -> `apply`; evaluating/creating -> `judgment` (L1367177) |
| Difficulty | `difficulty` (`medium`, `hard` seen; `easy` [INF]) | |

- Practice-area names visible in strings and demo data (OBS): Community Health Nursing; PALMR (Leadership and Management); Medical-Surgical Nursing; Maternal and Child Health Nursing; Fundamentals of Nursing. Also "Mental Health", "Nursing Administration" and topic labels such as Immunization, Newborn, Pediatrics, Postoperative Care, Assessment (L1145163-1145260, L884391).
- NP labels (OBS): Nursing Practice I-V. Names: NP1 Community Health Nursing; NP2 Maternal, Child & Human Development; NP3 Surgery, Oxygenation & Fluid Balance; NP4 Nutrition, Endocrine & Coordination; NP5 Mental Health & Acute Care. Mock Board short names: NP I Community Health, NP II Maternal & Child Health, NP III Surgery & Oxygenation, NP IV Nutrition & Neurology, NP V Psychiatric & Emergency Care (see features addendum, section 1).
- Only TOS section string literal found in the client: "Concepts on Acute Biologic Crisis" (L1366495, strings L82614). All other section names are server data. [OBS]
- The `practice_area` and `pnle_np` axes are independent (demo: practice_area NP4, pnle_np NP5). [OBS L1366495, INF]

## 5. Session creation payloads (standard sessions)

`createSession({mode:'standard', kind, screen, payload})` -> `POST /sessions/` with `payload`. [OBS]

| Screen / kind | payload fields | Line |
|---|---|---|
| `/practice/custom` (`kind:practice`) | `exam_type:'practice'`, `total_questions`, `answer_reveal_mode`, `time_limit_minutes`, `practice_area_codes`, `practice_area_code`, `pnle_np_codes`, `tos_filters:[{pnle_np,section}]` (when Advanced Selection) | L1311267-1311351, L1323094 |
| `/practice/mock` (`kind:mock`) | `exam_type:'mock'`, `pnle_np`, `total_questions`, `time_limit_minutes`, `answer_reveal_mode` | L1314714+ |
| `/practice/adaptive` (`kind:adaptive`) | `exam_type:'adaptive'`, `total_questions`, `answer_reveal_mode:'per_question'` | L1305576-1305580 |
| `/questions` topic preview (`kind:topic`) | `exam_type`, `topic_id`, `pnle_np`, `tos_section` | L1324936 |
| Study plan task (`kind:study`) | `exam_type:'practice'` or `'mock'`, `total_questions`, `study_assignment_id`, `pnle_np`, `tos_section` | L991141-991190, L991494 |
| Offline custom | local only: `exam_type:'practice'`, `question_ids`, `total_questions`, `practice_area_code` via `sessionsRepo` | L1311083, L991312 |

- Other session payload fields seen on the session object: `question_ids`, `repeat_source_session_id`, `ui_preferences`, `study_plan_v2_stage_id`, `client_session_id`, `ai_config`, `server_now`, `paused_at`, `question_ends_at`, `question_phase`, `current_question_index`. [OBS, features addendum]
- **Coaching** (`/practice/coaching`) creates no session. It is a pilot/waitlist card (events `coaching_pilot_*`, `coaching_waitlist_joined`, target `raysha-1x1-pilot`). No question payload. [OBS L1309078-1309260]
- Session lifecycle endpoints (strings): `/sessions/{id}/start|pause|resume|abandon|complete|recalibrate|go_to_question|review|submit`. Adaptive calls `POST /sessions/{id}/recalibrate/` (sends `repetition_mode`, `model_version`) and `/go_to_question/` (`question_order`). [OBS L1341060-1341330]
- `POST /sessions/{id}/complete/` body `{answers:[...]}` (batch of pending answers, mainly offline sync) and reads `score`, `correct`, `total`. Offline attempts: `{question_id, selected_option_id, is_correct, time_taken_seconds, answered_at}`. [OBS L1340780-1341700]

## 6. Results and report fields

- Completion event telemetry: `{client_session_id, score_pct, correct, total}` (L1341647). [OBS]
- Exam report input to `POST /exam-report/analysis/` (and `/analysis/premium/`): `{ sessionId, scorePct, correct, total, readiness, areas, concepts, misses }`; optional query `?variant=`, `&model=`, `&refresh=1` (L890100-890230). [OBS]
- `areas`: `[{name, pct}]` built from `practice_areas[].name/accuracy` (L314860-314900). `concepts`: topic names list. `misses`: wrong-answer list. [OBS, INF on contents]
- `GET /exam-report/bloom/{sessionId}` returns `bloom_breakdown` (computed locally as `computedBloom` if present); shown as three tiers recall/apply/judgment. [OBS L883760-883860, L1367177]
- Report sections by session kind: `session: [result, ranking, concepts, analysis, review]`, `diagnostic: [result, concepts, analysis]`, `case: [result, review]` (L884320). [OBS]
- Report model shape (sample, L1145150): `{ scorePct, correct, total, message, areas[{name,pct}], rank{position,from,delta,percentile,neighbors[{pos,name,score,you,avatarKey}]}, concepts[], analysisPreview, analysisLocked }`. [OBS]
- Persisted on session: `report_json`, `analysis_json` (L796086-796088, L1333731). [OBS]
- Situation result: per item `{earned_units,max_units,earned_credits,max_credits,is_correct}` and case `credits_earned/credits_max/passed/score_pct/case_complete` (L1099142-1100048, L1363332). Credits are partial-credit units for multi-part items. [OBS]
- Per-topic breakdown outside a session: `/stats/topics/`, `/stats/practice-areas/`, `/stats/overview/` (fields `total_attempts`, `accuracy`, `weakest`, `strongest`, `status`). Adaptive/mastery fields: `effective_mastery`, `mean_accuracy`, `mean_time_seconds`, `p_incorrect`, `chev_prediction`. [OBS]

## 7. Pre-built prompts and templates visible in the client

### 7.1 Prompts the client sends to an LLM endpoint (OBS)
Two full instruction prompts are built client-side and sent as `message` to `POST /sessions/cleo-reply/` with `monitoring: { surface:'ai_curator', interactionType:'generated_copy' }` (L1155594-1155640).
1. **Curator stats analysis** (L1155860-1156022; strings L14446, L311). Template: a stats block (Weak/Strong/Untouched areas, Weakest/Strongest topics with percentages, or "User has ZERO attempts. Complete blank slate.") followed by a strict-JSON instruction. Output schema: `{title (<=6 words), subtitle (2 sentences), pills:[{label, value (number|null), type:'weak|strong|untouched'}]}`. Rules include 4-8 pills, thresholds weak <60%, strong >75%, be specific, never use em dashes. Starts: "You are Cleo, a warm but witty AI test curator. Analyze this user's nursing test stats..."
2. **Specialize acknowledgement** (L1156500-1156620; strings L14362, L14564, L3161). Two variants.
   - User skipped: persona line plus "Respond with ONE short sentence (max 12 words). Be casual, funny."
   - User typed a focus: `The user wants to focus on: "<text>"` plus "Respond with ONE short sentence (max 15 words)... If it's unrelated to nursing tests, react with humor".
   - Fallback local lines on failure: "Alright, full control to me. Let's see what happens." and `<focus>, got it. Let me build something around that.`
   - User free text is interpolated directly into the prompt (prompt-injection surface). [INF]

### 7.2 Suggested-prompt chips and quick actions (OBS L827127-827240)
Chip object `{label, icon, color, kind}` with kind in `exam | performance | flashcard | chat`.
- Home/empty-state chips: "Create an exam for me" (exam), "Analyze my performance" (performance), "Create an exam based on my blind spots" (exam), "What should I study today?" (chat), "Create pharmacology flashcards" (flashcard), "Explain a nursing concept simply" (chat).
- Per-question (rationale) chips: "Explain simply", "Create a flashcard for this" (flashcard), "Why are the other options wrong?", "Quiz me on this concept", "How would this appear clinically?", "What should I review next?".
- `explainItPrompts(a0)` (L852163-852197) returns one of two 3-chip sets by context: report context `['Why did I get this score?', 'What should I improve?', 'Why am I wrong?']`; question context `['Why is my answer correct?', 'Quiz me on this concept', 'Explain this another way']`. The switch on `a0` is a numeric threshold compare. [OBS, INF on trigger]
- Entry buttons elsewhere: "Ask Cleo about this rationale", "Create flashcard with Ask Cleo", "Create a flashcard from this clinical pearl" / "...from this question summary" (these set `requestedTool: create_flashcards`, `interactionType: flashcard_generation`, and pass `clinicalPearl`). `requestedTool: draft_exam` is used for exam chips. [OBS L821518-821620, L823620-823640]
- Loading copy: "Preparing your flashcards...", "Preparing your exam...", "Thinking...", "Cleo is cooking something up...". [OBS]

### 7.3 Canned client-side Cleo text (OBS)
- The QBank-curation disclaimer (section 0).
- Local correct/wrong feedback pools and sticker ids (features addendum, section 2).
- Image warning: "An image from this older chat is no longer available. Reattach it before asking a follow-up about it."
- Allowance copy: "Your remaining Ask Cleo allowance. Text and voice messages share this allowance."

### 7.4 Library material generation (OBS L1197380-1197470, L1214440-1214500)
- `POST /library/folders/{id}/generate/` body `{ kind, count, focus, source_ids }` plus an idempotency key (`requestId`/`key`) and a `retry` option. `kind` values: flashcard, question, Explain It, cheat sheet (UI labels "Flashcard", "Question", "Explain It", "Cheat Sheet"; the code shows a `sheets` string for the cheat-sheet kind). [OBS, INF on exact enum]
- `POST /library/materials/{id}/refine/` body `{ item_ids, instruction }` with `key` and optional `version`; undo through `/revision/` (`action:'undo'`, `key(s)`). Refine hint text: "What should Cleo change?" and placeholder "Make the answers shorter...". Focus placeholder: "e.g. pharmacology, maternal health..." and "e.g. Cardiac medications". [OBS strings L1482, L2173, L25640, L28887]
- Materials are started as a session through `POST /library/sessions/` with `{material_id}` (`startSession`). [OBS]
- The generation instructions themselves (how Cleo writes flashcards/questions from the user's source) are server-side. The client only passes `kind, count, focus, source_ids, instruction`. [OBS]

### 7.5 Other templates
- Case study: no client-side generation template. Content is served pre-authored from `/situations/v2/`; the client only renders `stem`/`items`. Demo data is embedded as the sample case (L1366495-1366900). [OBS]
- Explain It: voice m4a to `/sessions/ask-cleo/v2/transcribe/`, then grading output sections ("Your understanding", "Your feedback", "Not included", "One way to explain it"). Rubric/prompt is server-side. [OBS strings, INF]
- Question report types (wording confusing, too_long, incorrect, other) go to a report endpoint with `report_type` and `notes`. [OBS]

## 8. Limits and unknowns

- `generation_request` field list, `ai_config` contents beyond `adaptive`, and the `config` returned by `/sessions/ai-generate*` are server-defined and opaque to the client. [OBS: pass-through only]
- No client-visible mode strings other than the idempotency scope `cleo-exam-v2` and `aiKind` values `ai`, `daily_climb`, `daily_polish`.
- The question stem field in the standard player is `body` (not `stem`); `stem` belongs to situations. The offline payload JSON was not inspected beyond the column list.
- The exact enum for library `kind` and the sets of `report_type` values are not fully confirmed.
