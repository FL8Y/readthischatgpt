# Tangerine Prep 1.9.0 - Ask Cleo and Library guide

Source: Hermes-decompiled `decompiled.js` (line refs `L<n>`) and `strings_all.txt`. Static analysis only; the app was not run.
Labels: **OBS** = literal string, field or constant in code. **INF** = inferred from code shape.
All LLM behaviour, usage metering, grading, source reading and generation are **server-side**. The client only sends and receives fields.
Base path for Library API is `/library` + path (L839469). Ask Cleo base is `/sessions/ask-cleo/v2/` (L852243).

---
## PART 1. ASK CLEO (AI tutor)

### 1.0 Architecture
- The chat UI is one component, `AskCleoDock` (L818396-827020, about 8,600 lines). Props: `visible`, `showHead`, `initialRequest`, `questionId`, `question`, `optionsText`, `rationale`, `screen`, `surface` (defaults at L852707). OBS
- It is mounted in 3 ways. OBS
  1. Full route `/ask-cleo` (file `ask-cleo.tsx`, L309951; wrapper `AskCleoPage` L1089959, `showHead` true, animation `simple_push`, gesture off). Params `request` and `sessionId` (L820653-820660).
  2. Bottom sheet hosted in shell (L930634, screen `'shell'`) and in the schedule screen (L1425377, screen `'schedule'`). Both use `showHead:false`, `surface:'general'`.
  3. Opened by a context helper `openAskCleo(arg)`: a string becomes `{quote:arg}` (L811577). Related helper `openAskCleoFlashcards` (L827020).
- Client API object `askCleoApi` (L852230-852440), listed in 1.6.

### 1.1 Entry points (OBS)
| Where | Trigger | Line |
|---|---|---|
| Practice home "StudyToolsRow" tile titled **AI Tutor** (icon message-processing) | tap, event `ask_cleo_chat` | L995157 |
| Question rationale | long-press text, event `ask_cleo_rationale_long_press`, target `ask_cleo_chat`; also a button **Ask Cleo about this rationale** | L805373, L804586 |
| Rationale / question summary | **Create a flashcard from this question summary** (event `question_summary_create_flashcard`), calls `openAskCleoFlashcards` | L874234, L805678 |
| Cheat sheet reader | create flashcards (`cheat_sheet_create_flashcards`), `buildCleoCheatSheetContext` | L1104638, L1103728 |
| Explain It review | **Ask Cleo** button on the grading result; sends `explainIt` context | L1221758, L1219788 |
| Library essay session (`library/study`) | event `essay_ask_cleo` | L1219668 |
| Shell and schedule floating sheet | floating pill "Ask Cleo" / "Ask Me!" | L824478-824495 |
| Limit card, cheat-sheet rec locked row | go to `/subscription` | L825604, L815030 |
Offline: starting a study-plan task that needs Cleo shows a toast "Ask Cleo needs a connection / Reconnect to start an Ask Cleo session." (L991458). Chat itself has no offline mode; a send failure shows the connect error (1.5).

### 1.2 Screen: Ask Cleo chat
**Purpose.** Multi-turn tutoring chat with context from a question, review or Explain It result.
**Layout (OBS).**
- Header: title "Ask Cleo", history button (opens `HistoryDrawer` L817395), "New chat", back.
- Empty state `CleoWelcome` (L812941): time-based greeting ("Good morning/afternoon/evening"), subtitle variants ("What's up?", "Ready for a little review?", "What are we learning today?", "Let's review your answer"), mascot `CleoMascot` (L830290) and suggestion chips.
- Message list: user bubbles (`ChatBubble` L834426), assistant text, sticker, citations, visuals, action cards, thinking shimmer ("Thinking…", `ThinkingShimmer` L833186; the label changes to "Preparing your flashcards…" or "Preparing your exam…" while those tools run, L821511-821521).
- Composer: text input "Message Ask Cleo", `+` attach, mic (voice), send. While a reply is streaming, the send button's label becomes "Queue message" and a "Queued message" chip appears (L825415, L826494). Per-message response language chip " response language. Tap to change." (L826108-826338).
- First-use tip: "Ask Cleo can read images / Tap + to add a question or study image." Flag key `ask_cleo_image_tip_v1:<user>` (L826880, L820758).

**Suggestion chips (OBS, L827100-827190; `kind` decides behaviour).**
| Label | kind |
|---|---|
| Create an exam for me | exam |
| Analyze my performance | performance |
| Create an exam based on my blind spots | exam |
| What should I study today? | chat |
| Create pharmacology flashcards | flashcard |
| Explain a nursing concept simply / Explain simply | chat |
| Create a flashcard for this | flashcard |
| Why are the other options wrong? | chat |
| Quiz me on this concept | chat |
| How would this appear clinically? | chat |
| What should I review next? | chat |
Rationale surface chips: "Why did I get it wrong?" / "Why am I right?" (L819305-819308). Explain It chips (L852189-852192): "Why did I get this score?", "What should I improve?", "Why am I wrong?" for wrong answers; "Why is my answer correct?", "Quiz me on this concept", "Explain this another way" for good ones.
Chip tap (L823940-824140): `flashcard` -> send label with `requestedTool:'create_flashcards'`; `performance` -> `requestedTool:'analyze_performance'`; `exam` -> if label contains "blind spots" go straight to a `draft_exam` request, otherwise the client injects a **local** `ask_user_input` card (`purpose:'exam_basis'`, "What do you want to base your exam on?", options "Base it on my weak spots / my strong skills / I want to study a certain topic", `allow_other:true`, L827190). An attached image appends "Base it on the nursing coverage in my attached image." Canned reply when asked for new questions: Cleo curates from the existing QBank (L827118). Details of exam generation: see `addendum_questions_prompts.md` 3.1-3.2.

**Send flow (OBS L821250-823500).**
1. Tap send. Event `ask_cleo_send` (name, screen, `question_id`, queued flag; L823494).
2. Build request via `toAskCleoRequestMessages` (L852452): each message `{role, content, attachments?}`. Assistant stickers are serialised as text `[Cleo sent sticker: <id>]`. Image attachments `{type:'image', url:dataUrl, mimeType}`; only `data:image/` or `https://` URLs are kept.
3. `POST /sessions/ask-cleo/v2/stream/` with body `{messages, context, monitoring}` (L852268). `context` keys: `question, optionsText, rationale, questionId, userAnswer, answerWasCorrect, explainIt{sessionId,itemId,score,maximum,feedback,referenceAnswer}, clinicalPearl, responseLanguage, conversationId, interactionType ('chat'|'flashcard_generation'), requestedTool, screen, surface, voice`. A non-streaming `POST /sessions/ask-cleo/v2/` with the same body also exists (`chat`, L852225).
4. Stream parser `streamJsonLines` (L781799): reads `data:` lines; event types seen: `sticker` (early sticker id, `sticker_id`), `result` (final), `error`. Stream ended early -> "Cleo ended the response before finishing." Network failure sets `isNetworkError`.
5. Final `result` fields mapped to the message (L822488-822700): `content, suggestions, citations, visuals, sticker_id, sticker_after_paragraph, action{type,...}, usage{daily|weekly bucket}, runId`. Actions kept: `performance_visualization`, `ask_user_input`, `exam_draft`, `support_ticket`, `cheat_sheet_recommendations`, `create_flashcards`.
6. Rendering is **client-side pseudo-streaming**: `splitReplyParagraphs` (L852816) splits the answer into paragraphs; they are revealed in order with `CleoTypeWriter` (L313333) and a `scrollToEnd` animation. `STICKER_REPLY_BEAT_MS = 400` is the pause before a sticker (L852900). A sticker appears after paragraph `sticker_after_paragraph`.
7. Image attach (L823700-823880): `launchImageLibraryAsync` (multi-select; `selectionLimit` = remaining slots, max constant not resolved) via expo-image-picker; each image goes through expo-image-manipulator, longest side 1280, JPEG, base64 `data:image/jpeg;base64,...`, name "Image n". Attachments carry a remove button ("Remove <name>"). Stored history drops images: "An image from this older chat is no longer available. Reattach it before asking a follow-up about it." (L826772).
8. Voice (`VoiceInput` L867085): states idle -> recording -> ready -> transcribing. Mic permission off -> "Microphone access is off. Enable it in Settings to speak to Ask Cleo." Empty result -> "I couldn't hear a message. Try speaking a little closer to your phone." Failure -> "I couldn't transcribe that recording. Check your connection and try again." Upload: `POST /sessions/ask-cleo/v2/transcribe/` multipart `audio` (ask-cleo-voice.m4a, audio/mp4), `duration_ms`, `format:'m4a'`, `language` (L852303-852332); response `{text, usage}`. The text is then sent as a normal message with `voice` metadata (duration, waveform). Message shown as `VoiceMessageBubble` ("Voice message ...", "Sent voice message, ...", L866984). Voice and text share one allowance.

### 1.3 Action cards (what each does in the UI)
| Action type | UI | Tap -> effect | Line |
|---|---|---|---|
| `performance_visualization` | `PerformanceVisualization` card "Performance snapshot": metrics Accuracy, Attempts, Readiness (`summary.accuracy`, `attempts`, `passing_probability`) plus bar, donut or line chart (`chart`, `value_suffix`); line chart shows "3-day rolling total" and "3-day moving average"; empty: "No trend data is available yet." | read-only (data computed server-side) | L815506-817216 |
| `ask_user_input` | inline choice card: `purpose`, `question`, `options[]`, `allow_other` ("Something else", "Or describe something else"); purposes seen: `exam_basis`, `exam_item_count` ("Number of items", "Enter a number from 5 to 50."), topic ("Which topic should I focus on?", "Heart failure, diuretics...") | choosing sends the choice text as the next user message (e.g. "I want an exam about ...") | L856308, L827190 |
| `exam_draft` | `AskCleoExamDraftCard` | confirm posts `draft.generation_request` unchanged to `/sessions/ai-generate/v2/` with key scope `cleo-exam-v2`; events `ask_cleo_exam_generate/generated/generation_failed/generation_cancelled` | L854996, L855240-855385 |
| `support_ticket` | `SupportTicketArtifact` "Support ticket draft", shows `category` + `message`, button "Review ticket" | push `/feedback` with params `{category, prefill:message}` (default category `other`); user submits through the feedback screen | L817216, L825317 |
| `cheat_sheet_recommendations` | list of sheets: title, `pnle_np`, `section_count` ("sections"), lock icon and " - Plus" when `is_locked` | open: `/cheat-sheets/[id]` (event `ask_cleo_cheat_sheet_open`); locked: event `ask_cleo_cheat_sheet_locked_open` -> paywall. Free users see locks | L814901-815506 |
| `create_flashcards` | `AskCleoFlashcardPack`: pack header, RevealCard per card (front/answer reveal), per-card delete, "Adjust this flashcard" overlay (sends "Front: ... Back: ... Requested change: ..." back to Cleo, button "Ask Cleo to adjust"), "Give feedback on card n", **Save Flashcard / Save All** (button "Save to a pack") | `SaveToPackSheet` ("Which folder should I save this in?") lists Library folders (`libraryApi.folders`), search "Search your packs", "Create a new pack" -> `createFolder`; resolves pack via `POST /library/folders/<id>/cleo-pack/`; cards saved with `creationSource:'cleo'`, key scope `cleo-card-v2`, `conversationId`. Partial failure: "Saved n of m flashcards", "Some flashcards weren't saved" (`CleoFlashcardPackSaveError`) | L837385, L835480, L844132-844302 |
| `sticker` (not an action) | `CleoReplySticker`, image from `sticker_id` | decorative | L813450 |

**Citations / visuals (OBS).** "Sources" section lists citations; entries whose title is the generic "pnle test-taking strategy playbook" or "tangerine prep editorial team" are filtered out (L813120). Visuals carousel (`AssistantVisualCarousel` L813889): "n related images. Swipe horizontally", alt_text, "View source" (`source_page_url`), `license_url`. Image fetched with `GET /sessions/ask-cleo/v2/visuals/<id>/`; on error "This visual couldn't load." + "Try again", and failure reported with `POST /sessions/ask-cleo/v2/visuals/<id>/failure/` (L852405-852440).

### 1.4 Usage meter, paywall, survey
- `GET /sessions/ask-cleo/v2/usage/` -> `{is_paid, daily_used, daily_limit, daily_remaining, daily_remaining_percent, daily_reset_at, weekly_* same}` (L817781-817844). The `usage` bucket (`daily` or `weekly`) also arrives on each stream result and on a 429. OBS
- Warning text from module 34 `cleoQuotaWarning` plus " Your allowance refreshes <today at / tomorrow at / date>." (L817844, L817975). `hasCleoQuotaRecovered` is true when `daily_remaining>0 && weekly_remaining>0` (L852654); it clears the limit state.
- `AskCleoLimitCard` (L818105): title "Free plan"; "Upgrade to keep chatting with Cleo after your free credits run out."; "You have N% left, but not enough to start this response. Upgrade to keep chatting."; "Free credits refresh automatically."; button "Upgrade for more Ask Cleo access" (event `ask_cleo_limit_upgrade`) -> `/subscription`. Composer placeholder becomes "Usage limit reached" (L824183) and input is blocked. Screen-reader announcement is posted when the allowance changes (L820396).
- HTTP 429 -> limit state; other statuses -> "Ask Cleo couldn't finish that response. Try again."; network error -> "Ask Cleo couldn't connect. Check your connection and try again."; response bigger than remaining credit -> "This response needs more Ask Cleo credits than remain. Open usage for details." (L823005-823080). Failed turn offers "Try again".
- Usage screen `UsageView` (L828691), reached as `/library/usage` ("My usage", L1226806, folder-actions item `see_usage` L1208308): "Your remaining Ask Cleo allowance. Text and voice messages share this allowance." Rows "Today" and "This week" with "% remaining", "Resets in ..." / "Resetting now", button "View Tangerine+" -> `/subscription`. OBS
- Plans table (L1017313+): Ask Cleo limits row, free vs Tangerine+ (details in the features addendum).
- Satisfaction survey: `GET /sessions/ask-cleo/v2/survey/` -> `{show, use_count}`; `AskCleoSurveyCard` (L812141) "How is your experience with Cleo so far?", 5 stars (radiogroup), optional "Explain your rating, optional". Submit -> `POST .../survey/ {action:'submit', rating, reason}`; dismiss -> `{action:'dismiss'}` (L852347-852400). Events `ask_cleo_survey_shown/dismiss/submit` (L812207). Errors: "Couldn't dismiss this right now. Try again.", "Couldn't send your feedback. Check your connection and try again." Display is inline in the chat when `show` is true. Eligibility is server-side.

### 1.5 History, language, local state
- Conversations are **local only** (no server list). AsyncStorage keys (L818571-818622): `ask_cleo_native_history_v2:<user|guest>` (v1 migrated), `ask_cleo_response_language_v1:`, `ask_cleo_context_attention_v1:` (event `ask_cleo_context_attention_shown`, L820061), `explain-it:` prefix for per-Explain-It threads. Record `{id, title ('New conversation' default), messages, updatedAt}`; list capped (a constant 30 sits next to the save code, L821250; INF it is the conversation cap). `HistoryDrawer`: "No conversations yet", "Open <title>", "New chat".
- Languages (L827180): English, Filipino, Bisaya. Sent as `context.responseLanguage`; the model replies in that language (server-side).
- Streaming can be cancelled via an AbortSignal (L821650). Queued message is sent after the reply ends.
- Cleo's other canned feedback pools in practice screens are client-side (see features addendum).

---
## PART 2. LIBRARY (`/library/*`)

### 2.0 Availability and structure
- Module `src/library/beta` exports `useLibraryBeta().enabled` and `LIBRARY_ENABLED`, set by `channel === 'testflight'` (L840855-840885). INF: the Library tab (`(shell)/library`, L309873; tab key `library` in shell L931176) is a TestFlight/beta feature; other channels may hide it. The Cleo pack picker also reads this flag (L835504).
- Hierarchy: **Folder** -> **Sources** (inputs) and **Materials** (outputs; kinds `cards`, `questions`, `essay` = Explain It, `sheets` = cheat sheet) -> **Items**. Kind metadata (L997150): Flashcards ("Review key concepts and build recall with spaced repetition."), Questions ("Practice multiple-choice questions and review your answers."), Explain It ("Practice explaining key concepts in your own words."), Cheat Sheets ("Condensed PNLE notes for key concepts, nursing priorities, and exam-day recall.").
- API (L839440-840700). All idempotent mutating calls use `requestId` = `library:<...>` keys (L839456, L840700 `newIdempotencyKey`/`stableIdempotencyKey`).
| Function | Call |
|---|---|
| folders / getFolder / createFolder / updateFolder / deleteFolder | `GET /library/folders/`, `GET/PATCH/DELETE /library/folders/<id>/`, `POST /library/folders/` |
| saveFolder | `POST /library/folders/<id>/save/` (save a community folder) |
| uploadCover / removeCover | `POST|DELETE /library/folders/<id>/cover/` |
| uploadSource | `POST /library/folders/<id>/sources/` (multipart `file`) |
| getSource / pollSource / processSource / unlinkSource | `GET /library/sources/<id>/`, `POST /library/sources/<id>/process/`, `DELETE ...sources/<id>/` (unlink from folder) |
| getMaterial / createMaterial / updateMaterial / deleteMaterial | `GET|PATCH|DELETE /library/materials/<id>/`, `POST /library/folders/<id>/materials/`; delete and update carry `version` |
| generate | `POST /library/folders/<id>/generate/` (retry enabled) |
| refine | `POST /library/materials/<id>/refine/` body + `version` |
| applyRevision | `POST /library/materials/<id>/revision/` `{key | keys, undo}` |
| sessions / startSession / startFolderSession / getSession / answerSession / grade | `GET /library/sessions/`, `POST /library/sessions/` `{material_id}` or `{folder_id, kind:'cards', resume}`, `GET /library/sessions/<id>/`, `PATCH ...` `{item_id, answer}`, `POST .../grade/` `{item_id, input_mode, answer, key}` |
Folder fields: `id, name, description, color, icon, cover_url, is_public, owned, saved_from{avatar_url, author}, saved_folder_id, source_count, item_count, card_count, counts.cards, sources[], materials[]` (L1207360-1209555). Source fields: `id, name, status, error, file_url, thumbnail_url`.

### 2.1 Screen: Library home (`/(shell)/library`, `LibraryScreen` L995415)
- Header: search icon (`search_open` -> `/library/search`); floating **+** "Add to My Library" (`add_menu_open`) with items: New folder (`/library/edit-folder`), Add sources (`/library/sources`), Create study material (`choose_material_type` -> sheet "Create study material" with kinds Flashcard set / Questions / Explain It / Cheat sheet -> `/library/create?kind=<k>`).
- Folder grid; long-press enters selection mode ("n folders selected", "Exit folder selection"), "Delete n folders" with confirmation -> `DELETE` per folder (`Promise.allSettled`; failure "Some folders couldn't be deleted. Try again.", L995619-995640).
- First-run onboarding `LibraryOnboarding` (L1011198): "Start here.", "Tap + to open your options.", "Show Me How", Previous/Back. Replayable (`onboarding_replay`).
- Offline cards: `OfflineLibraryCard`/`useOfflineLibrary` (L1020323) for downloaded cheat sheets.

### 2.2 Screen: Folder (`/library/folder?id`, `FolderScreen` L1207360)
- Cover photo + title; "Folder actions" menu: edit (`/library/edit-folder`), **Make Public / Make Private** (`PATCH {is_public}`, events `folder_make_public/private`), Add/Change cover photo (image picker, `cover_upload`), See usage (`/library/usage`), Delete folder (confirm, then back to `/(shell)/library`).
- Rows per kind with counts (`item_count`, `card_count`) -> `/library/materials?kind=` (L1209040 "Study" row -> practice). **Sources** row ("Add documents, photos, or notes to study from.", count `source_count`) -> `/library/sources`; "Source privacy" sheet: "Your sources stay private and aren't shared publicly."
- "Add to folder" FAB: `create_material_open`, `add_source_open`.
- Shared/community folder view (not owner): shows author "View <name>'s profile" (`/social/user/<id>`), **Save Folder** (`POST .../save/`, event `save_folder`) then **Open saved folder** (`saved_folder_id`). Search screen labels such folders "Community material" / "Saved to My Library".
- Downloaded cheat sheets: "No downloaded cheat sheets in this folder." when offline.

### 2.3 Screen: Create/Edit folder (`FolderEditor` L1206215)
Fields: name, description, Color (orange, teal, ... palette), Icon (default `folder-outline`), Header photo (actions menu). Buttons "Save folder"/"Saving...". `POST /library/folders/` or `PATCH`. Events `create_folder`, `edit_folder`. Then `/library/folder`.

### 2.4 Screen: Sources (`/library/sources`, `SourcesScreen` L998853)
**What can be added (OBS).**
| Source | UI | Handling |
|---|---|---|
| Documents / files | "Add sources" -> document picker (`getDocumentAsync`, type from picker, default mime `application/octet-stream`), event `upload_sources` | `enqueueUploads` |
| Photos | image library (multi-select) or camera; camera denied: "Allow camera access in Settings to take a photo."; event `upload_photos` | `enqueueUploads` |
| Pasted text | "Paste text" sheet, placeholder "Paste or type your notes...", button "Add text"/"Preparing..."; clipboard empty: "Your clipboard has no text."; over limit: "Paste a shorter selection of up to 160,000 characters."; saved as `library-<ts>` text/plain, event `upload_text` | same pipeline (`pastedSource` L1003711) |
Help text: "Sources are read once and reused. Scans, photos and documents over 100 pages may use more of your weekly credits." (L1000459). Section "Your sources", empty "Add your first source", "Save in" folder picker ("Choose a folder", default "My materials"), `confirm_uploads`.
**Pipeline (OBS L1001901-1003540).** `uploadSource` (multipart, via `createUploadTask`, background capable) -> `processSource` -> `pollSource` every 2000 ms until `status` is `ready` or `failed`. A 404 while polling clears the record. Queue persisted in AsyncStorage `library_uploads_<user>` ("Restoring source..."), owner-scoped (`setUploadOwner`), `retryUpload`, `forgetUpload`, concurrency via `pump`. Statuses shown: uploading ("Uploading..."), processing ("Processing..." / "Reading..."), ready ("Ready"), failed ("Upload failed", "Couldn't finish this source", "Couldn't read this source. Try again.", button "Retry n"). Footer `UploadStatusBar`: "Keep the app open until uploading finishes." then "You can close the app while we process your sources." then "Available in your folder." / "Tap retry to continue."; "Show/Hide upload details", "Retry uploads". Text extraction, OCR and page counting are server-side. File-size and format limits are not enforced client-side (not found). INF
Source tile (`SourceTile` L1008913): thumbnail, name, status; remove -> `unlinkSource` (source stays reusable; "unlink").

### 2.5 Screen: Create material (`/library/create`, `CreateScreen` L1197282)
Two methods (`CreationSources` L1203675, `GenerationAction` L1205298):
1. **Create with Cleo**: choose kind (cards, questions, essay, sheets), tick one or more **ready** sources from the folder ("No sources in this folder yet."; non-ready rows disabled, "Reading..." or "Couldn't read this source"), optional **focus** text, **count** via `ChunkySlider` (for `sheets` count is fixed 1), button "Generate <kind>" / "Creating ...". Request: `POST /library/folders/<id>/generate/` body `{kind, count, focus, source_ids}` with idempotency `key` (L1197444); response includes the draft material (`id, title, items, version`). Cooking screen `CleoCookingScreen` (L1200609, `CleoBakingAnimation`) with rotating copy ("Cleo is cooking something up...", "A little ube. A lot of brain food.", "Stirring in a pinch of genius."); notices "Keep this screen open. You'll review the draft next." / "Still working. Keep this screen open while Cleo finishes." Errors: server code `operation_failed` handled specially; generic "Try again". After success event `generate_material_review` -> editor with draft.
2. **Create manually** (`creation_manual`): editor with "Add card" / "Add question", title edit (`SheetTitleEditor`, "Edit title/Save title"), "Save material". `POST /library/folders/<id>/materials/ {folder_id, kind, title, items}` or `PATCH /library/materials/<id>/ {title, items, version}`. A target folder defaults to a created folder named "My materials". Local draft key `library_<id>_<version>`. Leave guard: "Leave this editor? / Your unsaved changes will be lost." / "A private copy is saved. Your latest edits will be lost." Event names `create_material`, `edit_material`, `creation_use_sources`. This is the main **user-authored content** feature (cards front/back; questions with options and correct flag; Explain It prompt plus rubric/answer).
Item shapes seen in the preview (INF): question `{prompt, options[{id, body, correct}], sections}`, Explain It `{prompt, answer, rubric[]}`, card `{front, back}`.

### 2.6 Screen: Materials list (`/library/materials?kind`, `MaterialsScreen` L1209555 + `LibraryMaterialsShell` L1213663)
- Search box "Search <kind>", empty states "No matching items" / "No <kind>", per-kind create button ("Create Flashcard/Question/Explain It/Cheat Sheet").
- Edit mode: select items (Select all), actions **Edit** (needs exactly one: "Select one item to edit"), **Refine** (`refine_selected_items`), **Delete n** (`delete_material_items`, `PATCH` items), "Done editing".
- Practice row: `practice_materials` with modes `random` and `due` -> `/library/study`.
- Sheet cards (`LibrarySheetCard` L1211475): favourite toggle, download for offline ("downloading", "downloaded", "removing"), errors "Could not save cheat sheet" / "Couldn't save changes. Please try again."
- `MaterialSetOverview` (L1212253): paged previews ("Previous preview / Next preview"), "View / edit", "What is this?" (opens `ExplainItIntroduction` L1213065: "Explain it in your own words - Answer a question as if you were explaining it to a classmate. Speak or type, then submit your answer to see what you understood and what to work on." / "Learn from your feedback" / "Got it"), "Generate more" (`generate_more_materials`) and "Create manually" (`create_more_materials`).

### 2.7 Screen: Refine (`/library/refine`, `RefineScreen` L1215474, `RefineMaterial` L1214381)
- Select items of a set (checkbox list; sheets list by section), enter an instruction ("What should Cleo change?", example "Make the answers shorter..."), submit.
- Request: `POST /library/materials/<id>/refine/` `{instruction, item_ids, key, version}`; response contains `revision{key}`; UI shows `RevisionItem` previews (question options "A. ... check mark", answer, rubric, sheet document) with tag `revision_<id>` (event `refine_preview`).
- **Apply** -> `POST /library/materials/<id>/revision/ {key}` (event `apply_refinement`, state `applied`); **Undo** -> same endpoint with `undo:true` (event `undo_refinement`). Revision history is kept server-side; stale `version` conflicts are enforced server-side. OBS fields, behaviour INF.

### 2.8 Screen: Search (`/library/search`, `SearchScreen` L1215771)
Tabs `mine` / `explore` ("Search your folders", "Search Library", events `search_filter`, `search_clear`). Explore shows community (public) folders via `folders` list with `ExploreFolderCard` (cover, "View <author>", `open_folder`, `open_author`; badges "Community material", "Saved to My Library"). Empty: "No matching folders", "No shared folders yet", "No folders yet", "Back to My Library". Ranking is server-side.

### 2.9 Study sessions from materials (`/library/study`, `StudyScreen` L1218141)
- Start: `POST /library/sessions/ {material_id}` (any kind) or `{folder_id, kind:'cards', resume}` for folder-wide flashcards (L1218231-1218332). Modes `random` / `due`; empty: "No items to practice yet."; offline sheet: "This sheet is no longer downloaded. Connect to download it again." Resume via `getSession`.
- **Flashcards** (`LibraryFlashcardSession` L1217530): reuses the shared flashcard session UI; ratings `again / hard / learning / remembered`, `saveRating` -> `PATCH sessions/<id> {item_id, answer}`; due scheduling server-side ("You're caught up. Come back when your cards are due."); edit a card (`edit_flashcard`).
- **Questions** (`LibraryQuestion` L1225263): options, eliminate/restore (`answer_option_eliminate/restore`), "Checking...", "Next Question"; answer sent via `PATCH`.
- **Explain It** (`LibraryEssay` L1220447, composer L1222592): "Your answer", "Explain it in your own words..." placeholder, "Your reasoning matters more than perfect wording."; text mode or **Speak instead**. Voice here uses on-device speech recognition events (`start, result, end, error: no-speech / speech-timeout / aborted / not-allowed`, `volumechange` waveform), not the Cleo transcribe endpoint (L1224200-1224400). Cap 12000 chars: "Answer limit reached. Submit this answer or start over." Controls: Start/Pause/Resume recording, "Start over", "Type my answer", hints "Tap to speak / Listening... / Pausing... / Getting ready...", errors "Recording couldn't start. Try again or type your answer.", "Recording paused. Your answer is kept...", "Allow microphone and speech recognition access in Settings, or type your answer."
  - Submit: `POST /library/sessions/<id>/grade/ {item_id, input_mode:'text'|'voice', answer (JSON), key}` ("Submit answer"/"Submitting..."). Loader copy "Reviewing your answer / Checking the key points / Putting your feedback together". Result (`EssayReview` L1221422): score/maximum with haptic (success or warning), sections **Your understanding**, **Your feedback**, **Key points**, **Not included**, **One way to explain it** (reference answer), per-criterion rubric (`criterion, explanation, feedback`), "Voice answer sent" marker, button **Ask Cleo** (opens chat with the `explainIt` context). Grading is LLM-based and server-side.
- Completion: "Session complete"; session history list from `GET /library/sessions/`.

### 2.10 Usage and gating
- `/library/usage` = Ask Cleo allowance (1.4). Library generation, refine and large-source reading consume the same weekly credits (OBS help text L1000459; counting server-side). Free vs Plus: Ask Cleo limits row and flashcard caps ("100 personal cards", offline packs need Plus) per `addendum_features.md`. Paywall navigation always `/subscription`.
- Sharing: only folder `is_public` toggle plus Save Folder by others; sources never shared. No per-user invite sharing found in these screens. Notes: there is no free-form notes screen in this scope; user-authored content = Library manual materials, pasted text sources, Cleo-saved flashcards.

---
## Gaps / unresolved
- Max image attachments in Cleo and max file sizes for sources: constants not located.
- `monitoring` request field contents (L852225, third arg) not resolved.
- Exact stream event names beyond `sticker`, `result`, `error` not confirmed.
- Server-side: all answers, grading, usage metering, generation, refine, ranking, survey eligibility.
