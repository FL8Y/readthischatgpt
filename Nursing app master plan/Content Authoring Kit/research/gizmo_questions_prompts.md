# Gizmo 3.2.130 - Questions, Decks/Topics, AI Request Params, Embedded Prompt Texts (strings-only addendum)

Source: `strings_all.txt` only (Hermes string table, bytecode v98, no decompiled code). Labels: **OBSERVED** = literal string present; **INFERRED** = assembled from names or neighbours.
Caveat: the table is deduplicated and unordered, so adjacency says nothing about which schema owns a field. Field-to-type mapping is INFERRED unless a literal description sentence states it. The table contains many long engine-docstring sentences (the quiz/game engine documents its own components in prose), which are the best evidence below. No secrets reproduced. Quotes are short fragments only.

## 1. Question / activity model

### 1.1 Architecture (OBSERVED, from engine docstrings)
- A question is an **Activity** (the "question activity") carrying: a generic activity spine, a question-family marker, optional image illustration, one **content component per answer method**, opt-in `time_limit` / host-gate capabilities, and "opaque backend passthroughs".
- Content is split into **public content** and a **separate redacted answer key** so the key can be hidden per game: `multiple_choice` + `multiple_choice_answer`, `matching` + (private groups), `ordering` + `ordering_answer`, `cloze` + `cloze_answer`, typing content holds the expected text. Quote: "so the key can be redacted without hiding the choices".
- **Segments** = static assessable parts of an Activity (OBSERVED): "Choice stamps one per correct option; Ordering stamps one per destination position; Flashcard stamps one whole-card Segment; Matching stamps one per correct group; Typing stamps one whole-answer Segment; Cloze stamps one per blank." "distractors are not Segments".
- **Inputs** = activity-owned configured answering alternatives: "stable identity, explicit target Segments, and an authoritative CommitPolicy". **InputGroup** addresses a unique Segment set. Input kinds: Choice, Typing, Matching, Ordering, Flashcard, Cloze (`inputKindSchema`). "Ordering has no InputGroup".
- Per-learner state: `question_attempt`, `segment_attempt`, `*_input_state` (`choice_input_state`, `typing_input_state`, `matching_input_state`, `ordering_input_state`, `flashcard_input_state`), `input_selection` (Attempt Input Selection: active input, targeted segment, hinted options, skip intent, owner reveal), `answering_preference`.
- Answer methods can be combined ("dual-channel MCQ+typing", Cloze with tapping or typing, "typed/mixed Cloze").
- Policies (OBSERVED names): `commitPolicy` = `on_change` | `on_check` | `on_submit` (Typing rejects `on_change`); `mistakePolicy`; `stoppingRule` (`first_mistake` | `exhaust_distractors`); `hintPolicy`/`hint_capability` ("fixed successful-use cap or exhaustion until one distractor remains"); `skipPolicy` (`immediate`...), `skipReveal` (skip reason -> owner/peer answer visibility; reasons `reveal`, `next`); `sharedReveal`; `afterMistake` (ordering: `retry` keeps wrong items tappable, `disable`); ordering `progression` = `next_position` | `any_position`; `orderingMistakeLimitMode`; matching `selection.completion` = `fixed` (uses `bankCounts`) | `explicit`; `RewardConfig` (XP/coin pots on Activity or Segment).

### 1.2 Per-type payload sketches (INFERRED; field names OBSERVED, nesting assumed)
```jsonc
// Choice / MultipleChoice  (OBSERVED sentence: "question text (lead_in) and the full list of selectable options")
{ "multiple_choice": { "lead_in": "...", "options": [{ "id": "...", "text": "..." }], "answerOptionsType": "..." },
  "multiple_choice_answer": { "correct_ids": ["..."] },        // choiceCorrectIds / answerKey
  "choice": { "commitPolicy": "on_change", "stoppingRule": "first_mistake|exhaust_distractors" },
  "hintPolicy": { "...": "cap | until-one-distractor-remains" } }   // choiceEligibleDistractors, choiceRemainingDistractors, distractorTexts
// Typing
{ "typing": { "lead_in": "...", "answer": "exact expected text", "commitPolicy": "on_check|on_submit", "skipReveal": {} },
  "typingHintMask": "...", "acceptedInputValues": [], "answerVariants": [] }   // accepted/alias/answerVariants names exist
// Cloze  (OBSERVED: "the prompt with inline blanks, the spawn-time ordered playable segment list, each playable segment's public options, optional per-segment reward policies")
{ "cloze": { "prompt": "text with [blank](#segment-t1) markup", "segments": [{ "id": "segment-t1", "options": ["..."] }], "skipReveal": {} },
  "cloze_answer": { "<segmentId>": ["correct option(s) or typed text"] },  // "held apart from the public options"
  "blanks": [], "blankCount": 0, "clozeKind": "tapping|typing|mixed" }
// Matching  (OBSERVED: "public bank content (lead_in + banks, at least one bank)"; "private groups of public option ids")
{ "matching": { "lead_in": "...", "banks": [{ "id": "", "options": [{ "id": "", "text": "" }] }],
                "selection": { "completion": "fixed", "bankCounts": {} }, "commitPolicy": "on_submit" },
  "matching_answer": { "groups": [{ "id": "g1", "memberIds": ["optA", "optB"] }] } }  // correct iff exact unordered member-set equality
// Ordering  (OBSERVED: "public positional content (lead_in + items + ordered positions)"; "private position->item bijection")
{ "ordering": { "lead_in": "...", "items": [{ "id": "", "text": "" }], "positions": [{ "id": "" }],
                "commitPolicy": "on_check", "progression": "next_position", "afterMistake": "retry|disable" },
  "ordering_answer": { "<positionId>": "<itemId>" } }
// Flashcard  (OBSERVED: "front content is visible while the back stays hidden until a per-player reveal; Good/Not sure rate the whole card")
{ "flashcard": { "front": "...", "back": "..." }, "rating": ["Good", "Not sure"] }
```
Validation messages OBSERVED: "Matching content requires at least one correct group / bank / pair"; "Ordering content requires at least one item"; "Matching group size must equal the sum of selection bankCounts"; "Matching key must map each group id to exactly one option per bank".
Other Matching names seen (possible legacy shape): `leftItems`, `rightItems`, `pairs`, `matchingSourcePairs`, `matchingConvertiblePairs`, `matchingFormats`, `matchingLayout`, `matchingVariant`, `answerPairs`.

### 1.3 Markup used inside question/card text (OBSERVED)
- Markdown-ish text: `**bold**`, `*italic*`, tables, lists, `<sub>`, `<sup>`.
- Math: `<latex>...</latex>` inline, `<latex_block>...</latex_block>` display (regex `(<latex>[\s\S]*?<\/latex>)`). Strict-mode KaTeX; a "Missing command slashes" repair path exists (`intcos(x)` form).
- **Segment links**: a blank/label/typing target is a Markdown link whose href is `#segment-<id>`, e.g. fixture "the [mitochondria](#segment-m) powers it" (Label/Tap/Type fixtures). Related names: `rewriteSegmentLinks`, `findSegmentLinkSpans`, `segmentLinkVariants`, `processSegmentSpan`, `answerMask`/`answer_mask`, `segment_masks`.
- `<chart>{...}</chart>` block embedded in question text (regex `^<chart>([\s\S]*?)<\/chart>`); `<step>...</step>` "Step tags are invisible" (fixture); `<ai_only>` / `<user_only>` wrappers (content shown only to the model or only to the user, INFERRED); `<card-content>`, `<deck-name>`, `<can_create_lesson>`, `<can_eli5/>`, `<plan>`, `<explanation>`, `<followup-question>` (tutor chat message grammar, INFERRED).
- Labelled-image / occlusion: sibling `labelled_image` component with regions; `renderSegmentLabelledImage`, `LabelledImageChips`, `multiWordOcclusion`.
- Chart types (OBSERVED in a generator field description): scatter (with optional best-fit curve), line, bar (grouped via multiple series), histogram, dotplot, boxplot, pie, function (linear/quadratic/exponential/absolute/sqrt/polynomial/circle/points/sin/cos/tan/logarithmic/rational), polar, numberline, geometry.

### 1.4 Free response / procedural step questions
- OBSERVED names: `FreeResponseQuestionSchema`, `FreeResponseQuestionStatic`, `FreeResponseAnswerCard`, `FreeResponseReviewCard`, `FreeResponseDraftProvider`, `freeResponseMachine`, `ExamPracticeFreeResponseQuestion`, `markScheme`/`mark_scheme`, `maxMarks`/`max_marks`, `marksAwarded`, `rubric`, `credited`.
- Free-response marking prompt skeleton (INFERRED from literal tags): `<student-answer>...</student-answer>`, optional `<student-answer-photographs>The student also attached N ... of handwritten working. They are not included here, but the marks below were awarded from them as well as the text above.</student-answer-photographs>`, `<mark-scheme>`, `<marks-awarded>` (fallback text "could not be marked"), `<credited-outside-mark-scheme>`.
- Procedural (maths) questions: tutor shows a problem and the student "choos[es] each operation from a menu/set of options", one step at a time. Names: `ProceduralQuestionCard`, `TutorProceduralQuestion`, `ProceduralWorking`, `proceduralStepNumber`, `proceduralDifficulty`, `ProceduralDifficultyBadge`, `skipProceduralWorking`, `withProceduralStepBonus`, `pickProceduralTool`, `visibleProceduralTools`, `currentProceduralTools`, `hasProceduralNodes`, `isProceduralPracticeDeck`, `PROCEDURAL_DRILLS_NODE_TYPE`, `procedural_drills`, `proceduralDrillsRoundSize`, `procedural-step-row`, `procedural-lesson-sidebar`.
- Procedural eval/sandbox: routes `/kitchen-sink/procedural-eval-generate|run|perf|maths`; playground text OBSERVED: "...procedural questions through the AI worker and plays them with the same engine as the built-in examples."

### 1.5 Question sources / generators (OBSERVED)
- `question_source` = shared async buffer owned by a generator: "starts cold; the host fills it via the question_provider:next request seam", plus "the prefetch top-up target, and the content spec that says what kind of questions it wants". States/events: `question_source:prepared|failed|drain`, `question_provider:next`, `question_provider:deck_progress`, `questionPreparationDeadlineAt`, `questionPreparationRetryDelayMs`, `questionSourceTargetBufferTotal`, `questionSourceSelectionSchema`, `QuestionGeneratorSystem`. Generator kinds: question generator, wager generator, Round Program (beats, permits, scenes).
- `question_format` / `question_format_version`, `question_variants`, `question_presentation`, `question_card`, `questionCardType`, `questionTypes`, `activity_type`, `questionTypeForPresetId` (presets).
- Explain: data-less tag attached when Explain enabled; command `viewer:explain` accepted for Choice/Typing/Ordering/Matching/Cloze/Flashcard; "Typing and typed/mixed Cloze wait for in-flight evaluation". Stale claims drop as no-ops (carry question id).
- Async answer evaluator (OBSERVED): `answer_evaluator:evaluate` fired when "local fuzzy matching misses"; host decides (default local fuzzy; injectable AI `mark-answer`); `/v2/mark-answer`, `/v2/mark-speech-answer`; speech: `matchSpeechInputAgainstSegment`. `ai_verdict`, `answer_grader`.

## 2. Deck / card / class / topic taxonomy (names; mapping INFERRED)
- Hierarchy: **school -> class/course -> subject -> exam board -> deck tree (parent/child decks, subdecks) -> cards**; **topics** are a separate generated layer; **study path** = units/steps.
- Class/course: `classId`, `classCode`, `className`, `classExamBoard`, `classDisplayEmoji`, `classGroups`, `classDecksQuery`, `courseId`, `courseName`, `courseLevel`, `courseDeckLevel`, `courseTree`, `courseUnits`, `courseObjectId`, `examBoard`, `examBoards`, `examBoardRequired`, `examId`, `examType`, `exam_board`, `subjectId`, `subjectSlug`, `subjectTopics`, `subjectNeedsExamBoard`, `schoolBoard`, `schoolCourse`, `schoolSubjectCourses`.
- Deck: `deckId`, `deckName`, `deckTitle`, `deckTags`, `deckColor`/`deckColour`, `deckPassword`, `deckLevel`, `deckTree`, `deckHasChildDecks`, `deckDescendantIdsQuery`, `deck_descendant_cards_count`, `deckTotalCards`, `deckMasteryPercent`, `deckTopics`, `deckStudyTopicsQuery`, `deckMaterials`, `deckClassSuggestionEffect`, `deckClassUpdatePlan`, `deck_permission_id`, `deck_user_permissions`, `deck_questions_asked`, `deck_covered_card_ids`, `deck_progress`/`deckProgressPayloadSchema` (asked/deckTotal/remaining/isComplete per engine docstring).
- Card: `card_id`, `card_type`, `card_source`, `card_metrics`, `card_attributes`, `cardTemplate`, `cardQuality`, `deckCardView`, `deckCardStudyPathStatus`; flashcard front/back; `cardCreated` events.
- Topics/study path: `topicId`, `topicKey`, `topicKind`, `topicTitle`, `topicSource`, `topicExtractionId`, `topicProcessingProgress`, `topicRotation`, `topic_tree`, `topic_unknown`, `topic_unavailable`; `pathStep`, `pathStepId`, `pathUnits`, `unitId`, `unitTopics`, `unitTitle`, `lessonId`, `lessonTopic`, `lessonNodes`, `study_node_id`, `study_path_step`, `program_node`, `program_enrollment`, `nodeKind`.
- Study notes: `study_note_id`, `STUDY_NOTE_GENERATION_LIMITS`, `..._FAILURE_CODES`, "note sources" (`CreateStudyNoteSourcesRequestSchema`, `ListStudyNoteSourcesResponseSchema`, `MarkStudyNoteSourceNotesGeneratedResponseSchema`).
- Import source kinds (OBSERVED event names): audio, image, PDF, PowerPoint, sheet, text, YouTube, note, contacts-excluded; `source_kind`, `source_type`, `source_format`, `source_lang`, `import_source_metadata`.

## 3. AI features: request parameters visible as strings
Endpoints (OBSERVED in routes.txt): `/generate-procedural-questions`, `/create-procedural-quiz`, `/generate-live-practice-questions`, `/v2|v3/create-hard-round-questions`, `/generate-challenge-topics` + `/v2/generate-challenge-topics`, `/explain-tutor-question`, `/ai-explain`, `/ai-tutor`, `/ai-tutor/course-deck-cache-version`, `/ai/study-note-generation/v2`, `/ai/import-title-from-content`, `/magic-import/2026-05-01`, `/v2/mark-answer`, `/v2/mark-speech-answer`, `/generate-profile-picture-v2`.
Caution: bare string pool => request-body schemas below are INFERRED name pools, not typed.

| Feature | Schema/handler names (OBSERVED) | Candidate params (INFERRED) |
|---|---|---|
| Procedural questions | `fetchProceduralQuestions`, `createProceduralQuiz`, `useStartProceduralPractice`, `startingProceduralProgress` | `proceduralDifficulty`, step number, tool id/name (`pickProceduralTool`), `questionCount`/`numQuestions`, round size, deckId; response: question with steps/operations |
| Study-note generation | `StudyNoteGenerationRequestSchema`, `StudyNoteGenerationPayloadSchema`, `StudyNoteGenerationResultSchema`, `pollStudyNoteGenerationResult`, `StudyNoteGenerationError`, `CreateStudyNoteRequestSchema`, `UpdateStudyNoteRequestSchema` | note id, source ids ("requires a prepared source"), language, delivery/ack constants (`STUDY_NOTE_GENERATION_DELIVERY_INTERVAL_MS`, `..._ACK_TIMEOUT_MS`, `..._MAX_ACK_RETRIES`); async create-then-poll with partial results kept/discarded; recording sources (captions, parts) |
| Magic import | `MAGIC_IMPORT_OPTION_KEYS`, `magicImportApiBaseUrl`, `BASE_MAGIC_IMPORT_PROXY_URL`, `magicImportAssetsFromUploadedFile|Text|TextUri`, `magicImportAssetToSourceMetadata`, `MagicImportAcquireError`, `magic_import_event_id`; flag `magic-import-prompt-language-v2` | assets (file/text/uri), source metadata, option keys (unknown values), prompt language, content language |
| Daily quiz | `DailyQuizGeneratePayloadSchema`, `DailyQuizRefillPayloadSchema`, `DailyQuizFirePayloadSchema`, `DailyQuizBatchFlushPayloadSchema`, `DailyQuizConfigPatchSchema`, `ChatSyncDailyQuizPayloadSchema`, `ChatDailyQuizRespondedOutputPayloadSchema`, `DailyQuizStreakAtRisk/RolloverPayloadSchema`, `QueryDailyQuizHistory/StreakPayloadSchema`, `AdminDailyQuizPostPayloadSchema` (these are conversation/actor events, event+payload schema pairs) | `deckIds`, `includeDecks`, `sourceDeckId`, `postAtMinutes`/`post_at_minutes` (max `MAX_DAILY_QUIZ_POST_AT_MINUTES`), `DAILY_QUIZ_TIME_PRESETS`, `questionCount`, `difficulty`, streak/freeze fields (`daily_quiz_streak`, `daily_quiz_streak_freeze`, `daily_hearts`), `daily_quiz_enabled|disabled_reason` |
| Conversation questions | `ConversationQuestionSchema`, `ConversationQuestionGeneratePayloadSchema`, `ConversationQuestionRespondPayloadSchema`, `ConversationQuestionExplainPayloadSchema`, `ConversationQuestionAttachment`, `questionNextPayloadSchema`, `questionNextResultSchema`, `deckProgressPayloadSchema` | question id, attachment (image), learner id, answer, inputId + draftRevision (docstring: "Required even for a single-Input question") |
| Explain / tutor | `buildFreeResponseExplainContext`, `/explain-tutor-question`, `/ai-explain`, `ai_explain_explanation`, `AIExplain`, `AI_TUTOR_PROCEDURAL_STEP_EXPLAIN_CLICKED`, `AI_TUTOR_ACTIVITY_EXPLAIN_CLICKED`, `AI_TUTOR_ACTIVITY_HINT_USED`, `AI_TUTOR_ACTIVITY_MORE_DETAIL_CLICKED` | free-response context = question + `<mark-scheme>` + `<student-answer>` (+ photos note); step context = problem + list of steps taken so far (see 4.2). `buildStepExplainContext` was NOT found as a literal in the table (only buildFreeResponseExplainContext, line 16276). |
| Challenge topics | `CHALLENGE_TOPIC_PICKER_*` events (SUGGESTED_TOPIC_CLICKED, OWN_TOPIC_SUBMITTED, SUGGESTIONS_LOADED/FAILED), `ChallengeTopicPickerNavScreen`, string "challenge topic suggestions failed" | topic text (own or suggested), deck/class context (INFERRED); returns a list of suggested topics |
| Hard-round / live practice | `create-hard-round-questions` v2/v3, `generate-live-practice-questions`, UI text "Generate hard round questions", flags `create-questions-model-heads-v1..v6`, `create-questions-stable-prefix-v1` (from addendum_data.md) | round, deck/topic, count; chart-capable generator |
| Practice exam | `/practice-exam/`, actor `practice-exam-actor`, `practice_exam`, strings "Practice exam V2 created", "Failed to create practice exam from seed/unlock interstitial" | exam board/title (`exam_title`, `examBoard`), `curriculumTierInstructions` (name only) |
| Tutor chat | `/ai-tutor`, `aiChatId`, `AI_TUTOR_*` analytics (course generated, deck selected, convert to flashcards/note, generate suggestions, attachment added), `can_ask_again`/`canExplain`/`canCreate` flags | message, attachment, deck/course context, follow-up suggestion chips |

## 4. Embedded prompt / instruction texts (OBSERVED; short fragments only)
Most system prompts live server-side. Only the fragments below are in the client table.

### 4.1 Misconception explanation (wrong-step feedback)
Purpose: after a student picks a wrong operation in a procedural step question, the model explains why that move is tempting but wrong. Structure: a prefix (the wrong move is interpolated, text then `", which is NOT a correct move at this point.`) + fixed instruction. Parameters: the chosen wrong step label. Fragments: "Explain the misunderstanding that makes that move tempting and why it is wrong here." / "Do NOT reveal or hint at the correct next step, and do not state the final answer".

### 4.2 Next-step explanation (Explain button on a step question)
Purpose: explain the question, recap prior working, explain the next step only. Fragment: "Explain what the question is asking, briefly recap why the working so far makes sense, and then explain what the next step is" ... "Do NOT work past that one step, and do not state the final answer". A related variant (line ~120112): "Explain what the question is asking, and why each step above makes sense ... Stop after step ..." (for completed working).
Context preambles (prepended, step history appended after `\n\n`):
- "The student is working through this problem one step at a time, choosing each operation from a menu. These are the steps they have taken so far:"
- variant "...from a set of options. These are the correct steps they have taken so far:" (note "correct")
- empty-history variants: "...and has not taken a step yet." / "...and has not taken a correct step yet."
So context = problem text + enumerated steps; menu vs options = two UI presentations (`proceduralPresentationForFlag`, `tutor-procedural-format-v1`).

### 4.3 Chart planning / generation field descriptions (question-generation JSON schema docs)
Purpose: describe fields of an LLM structured-output schema for generating questions that may include a chart. Two long descriptions: (a) a "plan" field: "Decide here, before writing anything else, whether this is best taught or tested by reading a chart." with instructions to list exact data values, axis ranges, tick intervals, name points; (b) a `chart` field: "Emit data and parameters only (never an image)", "the correct answer MUST be exactly derivable from these values, and every distractor must be wrong against them", "PICK THE TYPE FROM THE SHAPE OF YOUR DATA", plus per-type guidance (e.g. bar carries category names; dotplot/histogram/polar draw no names). Order hint (OBSERVED): "the chart is emitted before the question text". These show the generator emits JSON with a chart-plan field, chart data, then question text, options, distractors.

### 4.4 Free-response marking prompt tags
Tags observed: `<student-answer>`, `<student-answer-photographs>`, `<mark-scheme>`, `<marks-awarded>`, `<credited-outside-mark-scheme>`, fallback "could not be marked". Purpose: client-side rendering/parsing of the AI marking result (marks per criterion, extra credit outside scheme).

### 4.5 Output-format directive
"You MUST answer with a JSON object that matches the JSON schema above." (line ~82295) - generic JSON-mode suffix, likely from a bundled AI SDK, INFERRED. Fixtures "You are a helpful assistant" / "You are now a clown." are test strings for a library (INFERRED), not Gizmo prompts.

### 4.6 Tutor chat / quick replies
- Quick-reply and suggestion UI: events `AI_TUTOR_GENERATE_SUGGESTIONS_PRESSED`, `AI_TUTOR_GET_MORE_SUGGESTIONS_*`, `prompt_suggestion`/`suggestionSource` (names), `actionRowChips`, `segmentChips`; daily quiz `CONVERSATION_DAILY_QUIZ_SUGGESTION_PICKED`.
- Fixture user messages (dev kitchen-sink, OBSERVED): "I am stuck because <latex>intcos(x)</latex> is confusing. Explain the **first step**."; "Review **Question 3**: why does <latex>\frac{1}{2}</latex> equal <latex>0.5</latex>?"; "Select the testable phrase active recall and keep **bold**, *italic*, and <latex>x^2</latex> intact." (last looks like a card-generation/annotation instruction fixture, INFERRED).
- Assistant message grammar (INFERRED): markdown + `<latex>`, `<step>`, `<explanation>`, `<followup-question>`, `<plan>`, `<card-content>`, `<deck-name>`, `<can_create_lesson>`, `<can_eli5/>` (capability flags telling the UI to offer lesson creation / ELI5).
- Tutor persona text ("You are a tutor...") NOT present in the client table; searched `^You are`, `Socratic`, `tutor will`.

### 4.7 Not found
No client-side system prompt for study-note generation, magic import, daily quiz generation or challenge topics; no "Return JSON"/"Generate N questions" templates beyond 4.3 and 4.5. Those are server-side. Only UI labels and analytics names exist (e.g. "Create procedural practice quiz", "Generate hard round questions", "Study Note generation requires a prepared source").

## 5. Gaps and confidence
- Field-level request schemas (Zod) cannot be reconstructed from the pool; names are only a candidate vocabulary. Next step would need bytecode-level analysis (v98 not supported by decompilers used).
- `buildStepExplainContext` absent as literal; context builders may be inlined or named differently (INFERRED from 4.2 texts).
- Engine versions (32/167/192, from addendum_data.md) match the engine-docstring style, i.e. these docstrings belong to the shared game engine used also by live/multiplayer rounds ("Round Program", "wager", "lockstep beat").
