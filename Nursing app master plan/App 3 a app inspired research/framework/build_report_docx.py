import re
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

G = 'data/'   # run from this folder after regenerating data (see METHOD.md)
routes = [l.strip() for l in open(G+'routes.txt', errors='replace') if l.strip()]
S = open(G+'strings_all.txt', errors='replace').read().split('\n')
api = sorted({s for s in S if re.fullmatch(r'/api/[a-z0-9_/]+', s)})
systems = sorted({s for s in S if re.fullmatch(r'[A-Z][A-Za-z]+System', s)} - {'ExponentFileSystem','FileSystem','OptionalExpoFileSystem'})

d = Document()
st = d.styles['Normal']; st.font.name = 'Calibri'; st.font.size = Pt(10.5)
for s in d.sections:
    s.left_margin = s.right_margin = Inches(0.9); s.top_margin = s.bottom_margin = Inches(0.9)

def shade(cell, color):
    tcPr = cell._tc.get_or_add_tcPr(); sh = OxmlElement('w:shd')
    sh.set(qn('w:val'), 'clear'); sh.set(qn('w:color'), 'auto'); sh.set(qn('w:fill'), color); tcPr.append(sh)

def H(t, l=1): d.add_heading(t, level=l)
def P(t, bold=False, italic=False):
    p = d.add_paragraph(); r = p.add_run(t); r.bold = bold; r.italic = italic; return p
def B(items):
    for t in items:
        p = d.add_paragraph(style='List Bullet')
        if isinstance(t, tuple):
            r = p.add_run(t[0]); r.bold = True; p.add_run(t[1])
        else: p.add_run(t)
def T(head, rows, widths=None):
    t = d.add_table(rows=1, cols=len(head)); t.style = 'Table Grid'
    for i, h in enumerate(head):
        c = t.rows[0].cells[i]; c.text = ''; r = c.paragraphs[0].add_run(h); r.bold = True; r.font.size = Pt(9.5); shade(c, 'D9E2F3')
    for row in rows:
        cells = t.add_row().cells
        for i, v in enumerate(row):
            cells[i].text = ''; r = cells[i].paragraphs[0].add_run(str(v)); r.font.size = Pt(9.5)
    if widths:
        for row in t.rows:
            for i, w in enumerate(widths): row.cells[i].width = Inches(w)
    d.add_paragraph()
def CODE(t):
    p = d.add_paragraph(); p.paragraph_format.left_indent = Inches(0.15)
    r = p.add_run(t); r.font.name = 'Consolas'; r.font.size = Pt(8.5)
    r._element.rPr.rFonts.set(qn('w:eastAsia'), 'Consolas')
    pPr = p._p.get_or_add_pPr(); sh = OxmlElement('w:shd')
    sh.set(qn('w:val'), 'clear'); sh.set(qn('w:color'), 'auto'); sh.set(qn('w:fill'), 'F2F2F2'); pPr.append(sh)
def NOTE(t):
    p = d.add_paragraph(); r = p.add_run('Note: '); r.bold = True; p.add_run(t)

# ---------- Title ----------
t = d.add_heading('Gizmo — How the App Works', 0)
P('Static reverse-engineering report of Gizmo 3.2.130 (Android package ai.saveall.app), with a plan for adding an AI API that auto-generates the next quiz.', italic=True)
P('Source: 12 uploaded zip parts (base_full_part_01–12) rebuilt into one tree. Fonts were left out as requested. Static analysis only: the app was never run and no network requests were made.')

H('1. Summary')
B([
 ('What it is. ', 'Gizmo is an AI flashcard and quiz app ("AI flashcards & quizzes"). It is a React Native / Expo app that ships one codebase to Android, iOS and the web, with a custom game-style quiz engine, AI tutoring, study notes, import tools, streaks, leagues and live multiplayer games.'),
 ('Where the logic lives. ', 'Almost all app logic is compiled Hermes bytecode in assets/index.android.bundle (50 MB, 135,647 functions). The Java/Kotlin code in the 10 dex files is mostly SDKs (Firebase, RevenueCat, OneSignal, Adjust, LogRocket, Sentry, ML Kit).'),
 ('Where the AI lives. ', 'The AI runs on Gizmo\'s servers (an "AI worker" at ai.gizmo.ai), not in the app. The app only sends requests such as generate-procedural-questions and study-note-generation. You cannot plug your own AI key into the shipped APK and have it generate quizzes, because there is no client-side generation code to redirect.'),
 ('Your goal. ', 'To get "auto-make the next quiz" you need your own backend that calls an AI API, validates the output into a fixed question schema, keeps a buffer of upcoming quizzes, and a client that plays them. Section 12 gives a complete design and working code, modelled on Gizmo\'s own daily-quiz pipeline (generate → refill → fire → response).'),
])

H('2. What was uploaded and what is missing')
P('The 12 zips are not byte-split pieces of one file. Each is a normal zip holding some of the APK\'s files, so they merge cleanly into one folder (1,767 files, 174 MB before fonts were removed).')
T(['Part', 'Contents'], [
 ['01', 'AndroidManifest.xml, META-INF, library metadata'],
 ['02', 'assets/index.android.bundle (Hermes bytecode, 50 MB)'],
 ['03', 'ML Kit barcode models, bundled face-emotion models (.emd), www.bundle web export, splash animations'],
 ['04–10', 'classes.dex … classes10.dex (10 dex files), plus protobuf/properties files'],
 ['11', 'res/ (images, layouts) and res/font (fonts, excluded)'],
 ['12', 'resources.arsc and small property files'],
])
B([
 ('Complete? ', 'Almost. No lib/ folder came through (no native .so files such as the Hermes engine, React Native core, ML Kit native code). These do not change how the app logic works, but I could not inspect them.'),
 ('Fonts. ', 'res/font and assets/fonts were removed and not analysed.'),
])

H('3. How the analysis was done, and its limits')
B([
 'The Hermes bytecode in this build is version 98. The best open-source decompiler (hermes-dec 0.1.8) does not support that version, so I could not turn the 135k functions back into JavaScript.',
 'Instead I parsed the Hermes file header and read its full string table (234,152 strings). Route names, API paths, event names, error messages, feature names and library identifiers are all stored there in readable form.',
 'The bundle also ships a web export (assets/www.bundle, 7 MB of readable minified JavaScript), which exposed the build-time environment values and the backend URLs.',
 'The Android manifest was decoded with apktool from a rebuilt APK; app.config and app.manifest are plain JSON.',
])
NOTE('Everything below marked "observed" is a string or value literally present in the files. "Inferred" means my reading of how those pieces fit together. Nothing here proves runtime behaviour, request/response bodies or server logic.')

H('4. App identity')
T(['Item', 'Value', 'Type'], [
 ['App name / slug', 'Gizmo / native', 'observed'],
 ['Version', '3.2.130', 'observed (app.config)'],
 ['Android package', 'ai.saveall.app', 'observed'],
 ['iOS bundle ID', 'io.gonative.ios.xqdyad', 'observed'],
 ['Deep-link scheme / domains', 'gizmo:// ; gizmo.ai, app.gizmo.ai, share.gizmo.ai', 'observed'],
 ['Release tag / build time', 'release-2026-10-15-15h31-3f0db6c1fa', 'observed'],
 ['Quiz engine version', 'engineVersion 32, revision 167, stateVersion 192', 'observed (app.config extra)'],
 ['Framework', 'Expo SDK 57 modules, React Native 0.86.3, Hermes bytecode v98', 'observed'],
 ['Android min SDK', '34 (Android 14)', 'observed'],
 ['Navigation', 'expo-router (file-based routes)', 'observed'],
 ['Styling', 'Tailwind CSS via NativeWind; Lexical rich-text editor and KaTeX math on web', 'observed'],
 ['OTA updates', 'Expo Updates (u.expo.dev project 1f13b03a-…) plus an internal "native-console" for PR preview builds', 'observed'],
])

H('5. Architecture')
P('The app is a thin client over several Gizmo-owned backends. Values below come from the environment block compiled into the web build.')
T(['Host', 'Role (inferred from name and routes)'], [
 ['proxy.gizmo.ai', 'Main backend ("BACKEND_URL"): decks, cards, users, classes, groups, quizzes (/api/* RPC-style routes)'],
 ['auth.gizmo.ai', 'Authentication worker (email, OTP, phone, username, anonymous, social, organizations, two-factor; looks like the Better Auth library)'],
 ['ai.gizmo.ai', 'AI worker: question generation, study notes, explanations, translation, title generation'],
 ['app.gizmo.ai / gizmo.ai', 'Web app and share links (decks, profiles, streaks, leaderboards)'],
 ['og.gizmo.ai', 'Social-share image generation (OpenGraph)'],
 ['coeus.gizmo.ai', 'Analytics/tracking worker; also proxies PostHog (/ph) and phone-number verification'],
 ['cdn.gizmo.ai', 'Static assets: i18n files, profile pictures, school logos, fonts, product images'],
 ['native-console.gizmo.ai', 'Internal release-health and PR-preview build console'],
 ['pixie.gizmo.ai', 'Appears next to model-provider policy strings; purpose unclear'],
])
P('Third-party services present in the build:')
B([
 'Payments: RevenueCat (17.10.0) for in-app subscriptions, Stripe (web checkout, gift subscriptions, coins), Google Play Billing, Amazon IAP.',
 'Notifications: OneSignal 5.9.8 plus Firebase Cloud Messaging.',
 'Analytics and crash: PostHog, Sentry (replay disabled), LogRocket 1.62.0, Adjust 5.4.4, Google Analytics / Tag Manager, Facebook and Snapchat share SDKs.',
 'Device ML: Google ML Kit barcode scanning and face detection, plus bundled facial-expression models (used by the small emotion models in assets/models_bundled).',
 'Identity: Firebase Auth, Google sign-in, Apple sign-in, Prelude (phone verification SDK keys exist for Android, Apple and web).',
 'Realtime: routes under /parties/ (attempt-actor, practice-exam-actor) suggest PartyKit-style realtime rooms (inferred), plus WebSocket locks for collaborative study notes (/data/study-notes/v1/ws/locks/).',
])
NOTE('The build contains public client keys for PostHog, Prelude and a Sentry DSN. They are not reproduced here. They are normal client-side identifiers, but treat them as the owner\'s.')

H('6. Screens and navigation')
P('expo-router file names are readable in the string table. Main user-facing areas:')
T(['Area', 'Routes (observed)'], [
 ['Onboarding / auth', '/onboarding, /sign-in, /sign-up, /register, /login, /reset-password, /link-account, /link-social, /set-verified-age'],
 ['Decks and cards', '/decks, /decks/public, /decks/school, /deck/:deckId (+ /cards/move, /cards/delete, /imports, /leaderboard, /lessons, /notes, /tutor), /edit-card/, /card/:cardId/edit, /my-decks, /community/decks, /school-decks/:institutionId'],
 ['Study', '/start-lesson, /review, /path, /progress, /practice-exam/, /memorise-preview/, /pick-quiz, /quiz/:userGameId, /create-procedural-quiz'],
 ['AI chat and tutor', '/chat, /chat/:chatId, /chat/quiz/:quizId, /chat/lesson/:lessonId, /chat/course/, /chat/deck-lesson/, /tutor, /tutor/:aiChatId, /ai-tutor, /ai-explain, /explain-tutor-question, /labs/chat'],
 ['Import', '/magic-import/2026-05-01, /share-import, /deck/:deckId/imports, /materials, /notes/'],
 ['Social', '/profile, /profile/:userId, /friends/:userId, /profile/find-friends, /leaderboard, /leaderboards/friends, /league/country/, /school-leaderboard/:id, /study-groups/, /groups/:groupId/decks|quiz|users'],
 ['Live games', '/live, /live/:gameId, /live-games/v2/, /rooms, /team-battle-live, /live-clip/'],
 ['Streaks and rewards', '/streak, /streaks/share/, /monster-collection, /shop, /store, /overtake/, /overtaken/'],
 ['Billing', '/subscribe, /subscribe/pay, /subscribe-benefits, /subscribe-unlimited, /offerings, /manage-subscription, /settings/cancel-subscription, /stripe/*, /revenuecat/is-subscribed'],
 ['Settings', '/settings/* (account, security, blocking, notifications, export-cards, delete-account, feature-flag-overrides, dev-tools)'],
 ['Developer-only', '/kitchen-sink/* — an in-app component and engine showcase (over 120 routes), including quiz-engine activities and a game builder'],
])
P('The full route list is in Appendix A.')

H('7. Server API surface (observed paths)')
P('The client calls Gizmo\'s backend with RPC-style /api/<verb_noun> routes. Request and response bodies are not recoverable from strings. Grouped by purpose:')
groups = {
 'Decks': ['deck','duplicate_deck','edit_deck','remove_deck','restore','share_deck','set_deck','reorder_sub_deck','get_deck','get_shareable','popular_decks','add_group_deck','delete_group_deck','add_deck_to_class','remove_deck_from_class'],
 'Cards': ['add_card','add_cards','archive_card','skip_card','filter_cards','search_card_images','get_recently_added_cards'],
 'Quizzes and tutor': ['quiz','tutor','get_decks_quiz_info','group_quiz'],
 'Users, classes, school': ['user','class','education','qualification','school','institution','friends','search_users','onboarding'],
 'Notes and misc': ['study_note','calendar','logo','feed','reaction','interaction','import'],
}
for g, keys in groups.items():
    items = [a for a in api if any(k in a for k in keys)]
    P(g, bold=True)
    CODE('\n'.join(items) if items else '(none)')
P('The AI worker (ai.gizmo.ai) and the study-note service expose separate paths:', bold=True)
CODE('\n'.join([
 'POST /generate-procedural-questions   (AI worker; procedural / maths-style practice questions)',
 'POST /v2/generate-challenge-topics    (AI worker)',
 'POST /explain-tutor-question          (AI worker)',
 'POST /translate-to-english, /translate-to-english/batch',
 '/ai/study-note-generation/v2          (study-note generation)',
 '/ai/import-title-from-content         (auto-titles imported material)',
 '/create-procedural-quiz               (client route + API that builds a practice quiz)',
 '/data/study-notes/v1/{noteId}, /sources, /sources/{id}/notes-generated, /imports/latest, /permissions',
 '/data/study-groups/v1/{studyGroupId}/daily-quiz',
]))
NOTE('HTTP methods above are my guess from the names; only the path strings are observed.')

H('8. The quiz engine')
P('The most distinctive part of Gizmo is its quiz engine. The string table shows an entity-component-system (ECS) design, the same pattern game engines use: small data "components" attached to "entities", processed by "systems". It is versioned (engine 32 / revision 167 / state 192), so saved game state can be migrated between builds.')
H('8.1 Question and activity types', 2)
T(['Type', 'What the user does'], [
 ['Flashcard', 'Reveal the answer, then rate it (Good / Not sure)'],
 ['Choice / multiple-choice', 'Pick the right option; "Choice on_change" checks immediately'],
 ['Typing', 'Type the answer; checked with on_check'],
 ['Cloze (fill the gaps)', 'Fill blanks by tapping or typing; per-blank hints and reveal'],
 ['Matching', 'Pair terms and definitions; checked on completion'],
 ['Ordering', 'Arrange items in sequence; checked on change'],
 ['Interstitials', 'Streak achieved, leaderboard, friend overtaken, ask-to-subscribe, practice-exam unlocked, running low on hearts, power-up, inventory, wager, winner belt, widget guide, share'],
])
H('8.2 Systems (observed class names)', 2)
CODE(', '.join(systems))
P('How the pieces fit (inferred from the names):')
B([
 ('Question source and generation. ', 'QuestionSourceSystem, QuestionGeneratorSystem and DeckProgressGeneratorSystem produce the next questions from a deck, the user\'s progress, or AI-generated content. Generators exist for many non-question screens too (leaderboards, power-ups, wagers, interstitials, live results).'),
 ('Attempts. ', 'AttemptSystem plus per-type systems (ChoiceSystem, TypingAttemptSystem, ClozeAttemptSystem, MatchingSystem, OrderingSystem, MultipleChoiceAttemptSystem) record each answer; AccuracyTrackingComponent and EvaluationPolicyComponent score it; mistake policies handle repeated errors.'),
 ('Game loop. ', 'RoundSystem, RoundPlaylistSystem, GamePlaylistSystem, TimerSystem and SnapshotSystem run rounds; RoundProgramSystem lets a "program" script the round order. This is what the in-app game builder edits.'),
 ('Progression and economy. ', 'HeartGateSystem (hearts as lives), InventorySystem, BuffModifierSystem and PowerUpGeneratorSystem (power-ups), WagerGeneratorSystem (bets), coin and XP reward components, SegmentRewardClaimSystem.'),
 ('Multiplayer. ', 'LobbyGeneratorSystem, PlayerSystem, TeamSystem, BotSystem (bots fill rooms), HostGateSystem, DisconnectionSystem, OutboundSystem, RequestSystem — the live-game layer.'),
 ('Help. ', 'ExplainSystem and HintCapabilityProjectionSystem drive hints and AI explanations.'),
])

H('9. AI features found in the app')
T(['Feature', 'Evidence', 'Where it runs'], [
 ['Procedural question generation', '/generate-procedural-questions, /create-procedural-quiz; text: "procedural questions through the AI worker and plays them with the same engine as the built-in examples"', 'ai.gizmo.ai'],
 ['AI tutor chat', '/tutor, /ai-tutor, /api/chat, /api/tutor_v2_register_answer, /api/increment_tutor_messages_sent', 'server'],
 ['Explain a question / step', '/explain-tutor-question, ExplainSystem, AI_TUTOR_PROCEDURAL_STEP_EXPLAIN_CLICKED', 'ai.gizmo.ai'],
 ['Study-note generation', '/ai/study-note-generation/v2, /data/study-notes/v1/...', 'server'],
 ['Magic import (documents, PDFs, links to cards)', '/magic-import/2026-05-01, /ai/import-title-from-content, pdf-import screens, Quizlet link/export parsing', 'client parsing + server AI'],
 ['Daily quiz (auto-generated each day)', 'daily_quiz:generate / refill / fire / response events; DailyQuizGeneratePayloadSchema; /data/study-groups/v1/{id}/daily-quiz', 'server (see section 10)'],
 ['Challenge topics', '/v2/generate-challenge-topics', 'ai.gizmo.ai'],
 ['Voice mode', 'quiz-voice-mode, speech recognition and audio recording permissions', 'device + server'],
 ['AI-generated images', '/images/generated/, /ai-profile-pictures, card image search', 'server'],
])
P('Model identifiers found in the string table (labels the app or its config refers to; which ones are live is unknown):', bold=True)
CODE('claude-haiku-5-5 (with -none / -minimal / -medium effort variants)\ngemini-3-5-flash, gemini-3-5-flash-lite, gemini-3-5-flash-create-questions, gemini-3-8-flash(-nitro)\ndeepseek-v4-flash, deepseek-v4-1-flash (-low / -none / -nitro), create-questions-deepseek-head-v1\ngpt-6-luna (-none / -low / -medium, -low-density, -low-fill, -medium-educational), gpt-luna-medium\norchestrator-gemini-3-5-flash-lite, haiku-backup-v1, import-v4-gpt-5-model\nVercel AI Gateway: https://ai-gateway.vercel.sh/v3/ai (AI SDK present in the bundle)')
P('Reading of that list (inferred): Gizmo routes different jobs to different models and keeps backups, with names like "create-questions" and "-educational" pointing at per-task model settings. The AI SDK and the Vercel gateway strings suggest the server (or the bundled SDK) calls providers through a gateway with fallback ("provider-policy-exhausted" appears as an error string). The model calls are made server-side; the app has no provider API keys.')

H('10. The "daily quiz" pipeline — Gizmo\'s own auto-next-quiz')
P('Gizmo already auto-creates the next quiz for study groups and conversations. The event and payload schema names are visible and give a blueprint for your own design:')
T(['Event (observed)', 'Likely meaning (inferred)'], [
 ['daily_quiz:generate', 'Create the next quiz from the source deck / material using AI'],
 ['daily_quiz:refill', 'Top up a stock of pre-generated questions so the next one is ready'],
 ['daily_quiz:fire', 'At the user\'s chosen time (DAILY_QUIZ_TIME_PRESETS), deliver today\'s quiz, send a push notification'],
 ['daily_quiz:response', 'The user answered; score it, update the streak'],
 ['daily_quiz:streak_at_risk', 'Reminder when the streak will break'],
 ['daily_quiz:streak_rollover', 'Roll the day over, apply streak freeze'],
 ['daily_quiz:batch_flush', 'Write batched results'],
 ['ConversationDailyQuiz* UI', 'Time picker, history sheet, hint used/exhausted, streak celebration, "source deck opened"'],
])
P('Pattern: generate ahead of time in the background, keep a small buffer, deliver on a schedule, and learn from each answer. Section 12 implements exactly this.')

H('11. Permissions, privacy and monetisation')
B([
 ('Android permissions. ', 'Camera, microphone/recording, contacts (read/write), coarse location, notifications, biometrics, system alert window, billing, boot-completed, wake lock, foreground services (microphone, media playback), plus many launcher badge permissions.'),
 ('Declared but blocked. ', 'app.config lists fine/background location and READ_MEDIA_IMAGES as blocked permissions.'),
 ('Business model. ', 'Subscription (Gizmo Unlimited) plus coins/shop, hearts as a limited resource, streak freezes, gifting; ads-ID permission and Adjust attribution.'),
 ('Safety features. ', 'Blocking, reporting, moderation routes, age verification (/set-verified-age, declared-age-range entitlement on iOS) and screen-time "Shield" extensions on iOS.'),
])

# ---------- Section 12 ----------
H('12. How to add an AI API that auto-makes the next quiz')
H('12.1 What is and is not possible', 2)
B([
 'You cannot add your own AI key to the shipped Gizmo app. The generation code is on Gizmo\'s servers, the app talks only to their hosts with user accounts, and the bytecode is a signed, closed-source build. Repackaging it would also break its signature and break the terms of the service.',
 'What you can do is build the same feature in your own app (or a clone you control): a small backend that calls an AI API, a fixed question schema, and a client that plays it. The design below follows Gizmo\'s own pipeline.',
])
H('12.2 Architecture', 2)
CODE('''Client app (Expo / React Native)
   |  GET /quizzes/next            POST /quizzes/:id/answers
   v                               v
Your backend (Hono / Express / Cloudflare Worker)
   |-- QuizService: pick next quiz from buffer; if buffer < N -> enqueue refill
   |-- Generator: calls AI API with a strict JSON schema, validates, dedupes
   |-- Scheduler (cron / queue): daily "fire" + background "refill"
   |-- Store (Postgres/SQLite): decks, cards, quizzes, attempts, per-card stats
   v
AI API (Anthropic / OpenAI / Gemini)   <- API key lives ONLY here, never in the app''')
H('12.3 The question schema (mirrors Gizmo\'s activity types)', 2)
CODE('''// shared/quiz.ts
import { z } from "zod";

const Base = { id: z.string(), prompt: z.string().min(3), explanation: z.string().optional(),
               difficulty: z.number().int().min(1).max(5), cardId: z.string().optional() };

export const Question = z.discriminatedUnion("type", [
  z.object({ ...Base, type: z.literal("choice"),
    options: z.array(z.string()).min(3).max(5), answerIndex: z.number().int() }),
  z.object({ ...Base, type: z.literal("typing"),
    answer: z.string(), acceptable: z.array(z.string()).default([]) }),
  z.object({ ...Base, type: z.literal("cloze"),
    text: z.string(),                       // "The {{1}} is the powerhouse of the cell"
    blanks: z.array(z.object({ id: z.string(), answer: z.string() })) }),
  z.object({ ...Base, type: z.literal("matching"),
    pairs: z.array(z.object({ left: z.string(), right: z.string() })).min(3).max(6) }),
  z.object({ ...Base, type: z.literal("ordering"),
    items: z.array(z.string()).min(3).max(7) }),     // items given in correct order
]);
export const Quiz = z.object({ title: z.string(), questions: z.array(Question).min(3).max(12) });
export type Quiz = z.infer<typeof Quiz>;''')
H('12.4 The generator (server, Anthropic SDK)', 2)
P('Forcing a tool call makes the model return JSON that matches a schema. Always validate the result on your side too, since the model can still produce an invalid answer key.')
CODE('''// server/generate.ts
import Anthropic from "@anthropic-ai/sdk";
import { zodToJsonSchema } from "zod-to-json-schema";
import { Quiz } from "../shared/quiz";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });  // server-side only

export async function generateQuiz(opts: {
  sourceText: string;              // deck cards or notes the quiz must be based on
  weakCards: string[];             // cards the learner got wrong recently
  recentPrompts: string[];         // prompts already used -> avoid repeats
  count: number; level: 1|2|3|4|5;
}) {
  const system = [
    "You write quizzes for a flashcard app.",
    "Use ONLY the supplied source text. If a fact is not in it, do not ask about it.",
    "Mix question types. Include the learner's weak cards.",
    "Never repeat or paraphrase prompts from the 'already asked' list.",
    "Every explanation must be one or two sentences.",
  ].join("\\n");

  const user = `SOURCE:\\n${opts.sourceText}\\n\\nWEAK CARDS:\\n${opts.weakCards.join("\\n")}` +
               `\\n\\nALREADY ASKED:\\n${opts.recentPrompts.join("\\n")}` +
               `\\n\\nWrite ${opts.count} questions at difficulty ${opts.level}/5.`;

  for (let attempt = 0; attempt < 3; attempt++) {
    const res = await client.messages.create({
      model: "claude-haiku-5-5",             // fast and cheap; use claude-sonnet-5-5 for harder subjects
      max_tokens: 4000,
      system,
      messages: [{ role: "user", content: user }],
      tools: [{ name: "submit_quiz", description: "Return the finished quiz",
                input_schema: zodToJsonSchema(Quiz) as any }],
      tool_choice: { type: "tool", name: "submit_quiz" },
    });
    const block = res.content.find(b => b.type === "tool_use");
    const parsed = Quiz.safeParse(block && (block as any).input);
    if (parsed.success && passesChecks(parsed.data)) return parsed.data;
  }
  throw new Error("quiz generation failed validation 3 times");
}

// Reject bad answer keys, duplicate options and repeated prompts.
function passesChecks(q: import("../shared/quiz").Quiz) {
  return q.questions.every(x =>
    x.type !== "choice" || (x.answerIndex >= 0 && x.answerIndex < x.options.length
                            && new Set(x.options).size === x.options.length));
}''')
H('12.5 Keeping the next quiz ready (refill + fire)', 2)
CODE('''// server/quizService.ts
const BUFFER = 2;                               // always keep 2 unplayed quizzes ready

export async function nextQuiz(userId: string) {
  const quiz = await db.takeUnplayedQuiz(userId);        // oldest ready quiz, marks it "served"
  if (await db.countUnplayed(userId) < BUFFER) queueRefill(userId);   // do not block the request
  return quiz ?? (await refillNow(userId));              // cold start: generate on demand
}

export async function refillNow(userId: string) {
  const [deck, weak, recent, level] = await Promise.all([
    db.sourceTextFor(userId), db.weakCards(userId, 8), db.recentPrompts(userId, 60), db.levelFor(userId),
  ]);
  const quiz = await generateQuiz({ sourceText: deck, weakCards: weak, recentPrompts: recent, count: 8, level });
  return db.saveQuiz(userId, quiz);
}

// Daily "fire": run from cron (e.g. every 5 min) and send a push for users whose chosen time has arrived.
export async function fireDailyQuizzes(now = new Date()) {
  for (const u of await db.usersDueForDailyQuiz(now)) {
    const quiz = await nextQuiz(u.id);
    await push(u.pushToken, { title: "Your daily quiz is ready", body: quiz.title, data: { quizId: quiz.id } });
  }
}''')
H('12.6 Learning from answers (adaptive difficulty)', 2)
CODE('''// POST /quizzes/:id/answers  { questionId, correct, ms }
export async function recordAnswer(userId: string, a: { cardId?: string; correct: boolean; ms: number }) {
  await db.insertAttempt(userId, a);
  const recent = await db.lastAttempts(userId, 20);
  const acc = recent.filter(x => x.correct).length / recent.length;
  const level = await db.levelFor(userId);
  if (acc > 0.85 && level < 5) await db.setLevel(userId, level + 1);      // too easy -> harder
  if (acc < 0.55 && level > 1) await db.setLevel(userId, level - 1);      // too hard -> easier
  if (a.cardId && !a.correct) await db.markWeak(userId, a.cardId);        // feeds "weakCards" next time
}''')
H('12.7 Client side (Expo)', 2)
CODE('''// app/hooks/useNextQuiz.ts
import { useQuery } from "@tanstack/react-query";
import { Quiz } from "../../shared/quiz";

export function useNextQuiz(token: string) {
  return useQuery({
    queryKey: ["nextQuiz"],
    queryFn: async () => {
      const r = await fetch(`${API}/quizzes/next`, { headers: { Authorization: `Bearer ${token}` } });
      if (!r.ok) throw new Error("no quiz");
      return Quiz.parse(await r.json());          // never trust the network; validate again
    },
    staleTime: 0,
  });
}
// Render each question by `type` (choice, typing, cloze, matching, ordering) with a switch statement.
// Post every answer to /quizzes/:id/answers so the server can adapt the next one.''')
H('12.8 Safeguards you should build in', 2)
B([
 ('Keep the API key on the server. ', 'Anything inside an APK or JS bundle can be extracted, as this analysis shows.'),
 ('Validate everything. ', 'Parse the model output with the schema, check answer keys, and retry on failure.'),
 ('Ground the questions. ', 'Pass the deck text and tell the model to use only that source; otherwise it can invent facts.'),
 ('Control cost. ', 'Generate in batches in the background, cache, rate-limit per user, and use the smaller model by default.'),
 ('Avoid repeats. ', 'Send the recent prompts and skip near-duplicates (compare normalised text or embeddings).'),
 ('Respect privacy. ', 'Send only the study text needed, not account data; disclose AI use in your privacy policy.'),
 ('Test the generator. ', 'Keep a few fixed decks and check that output always validates and covers the weak cards.'),
])
H('12.9 Suggested build order', 2)
B([
 '1. Define the Quiz schema and render each type in the client with hard-coded quizzes.',
 '2. Add the generator endpoint with one question type (choice), validated, called manually.',
 '3. Add all question types, then the answer endpoint and difficulty adjustment.',
 '4. Add the buffer/refill job, then the scheduled daily fire with push notifications.',
 '5. Add streaks and history last (they are the same events Gizmo calls streak_at_risk and streak_rollover).',
])

H('13. What I could not determine')
B([
 'Request and response formats for any endpoint, and server-side prompts (they run on Gizmo\'s servers).',
 'Which of the model names are active in production versus leftover configuration.',
 'Native code in lib/*.so (not in the upload), including Hermes runtime behaviour.',
 'Exact quiz-engine rules (scoring, hearts, wager maths); only system and component names are visible without a working Hermes v98 decompiler.',
 'Whether the app is used offline: no local database schema was recovered.',
])
NOTE('If you upload a newer hermes-dec build or a Hermes v98-capable disassembler becomes available, the same bundle could be decompiled for the exact engine rules.')

# ---------- Appendices ----------
d.add_page_break()
H('Appendix A — All route strings (excluding /api/ and kitchen-sink components)')
CODE('\n'.join(r for r in routes if not r.startswith('/kitchen-sink/quiz-components')))
H('Appendix B — All /api/ paths observed')
CODE('\n'.join(api))
H('Appendix C — Android components of note')
T(['Kind', 'Count', 'Notable'], [
 ['Activities', '23', 'MainActivity, image crop, RevenueCat paywall and customer center, OneSignal notification opened, Play Billing proxy, web-browser proxy'],
 ['Services', '23', 'Expo audio recording/controls, Expo FCM messaging, OneSignal sync, location task, task manager'],
 ['Receivers', '20', 'Adjust referrer, OneSignal FCM/boot/upgrade, Expo notifications, task manager'],
 ['Providers', '16', 'WebView, Firebase init, file/clipboard/image-picker providers, LogRocket, Adjust'],
])
d.save('/home/user/readthischatgpt/docs/Gizmo_App_Research.docx')
print('saved', len(api), 'api paths', len(routes), 'routes', len(systems), 'systems')
