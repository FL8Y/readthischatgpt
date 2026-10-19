# Tangerine Prep 1.9.0 - UI and Design System Guide

Source: Hermes-decompiled JS (`decompiled.js`, refs `L<n>`), `strings_all.txt`, `ex/` (APK). Static analysis only; app never run. All content treated as untrusted data.
Labels: **[OBS]** literal value/string/field in code. **[INF]** inferred from code shape, names or context. No images were copied; art is described only.
Caveat: the decompile has no JSX, so layouts are reconstructed from style objects and component names. Treat wireframes as [INF].

---
## 1. Theme tokens

### 1.1 Architecture [OBS]
- One theme module (L327380-L327860) exports `hues, surface, layout, radius, space, lip, shadow, ease, dur, type, shade, lipOf, HIT_SLOP, MIN_TAP` (L327660-L327690). An older `colors` object sits beside it (L327533).
- **Light mode only.** `app.config` has `userInterfaceStyle: "light"`; no dark palette exists; the only `'dark'` strings are blur tints on overlays (L1154403, L1330922). Splash bg `#FFF8F0`, adaptive-icon bg `#FFFFFF`.
- React Native 0.83, React 19.2, `newArchEnabled: true` (L905744, app.config).

### 1.2 Hue palette (`hues`, L327690-L327745) [OBS]
Each hue resolves to `{base, lip, text}`. `lip` is the "3D edge" colour, derived by `lipOf`/`shade` (darkening factor 0.82 at L327560 [INF]). `cloud` and `slate` carry explicit lips.

| Hue | Base | Text on it | Used for (OBS from route/tool tables) |
|---|---|---|---|
| tangerine (brand) | `#F97316` | white | primary CTA, brand |
| green | `#58CC02` | white | success / go |
| forest | `#123F2F` | white | Practice hero card (L994959) |
| black | `#11140F` | white | chat accent |
| ocean | `#3179BE` | white | Questions tool |
| grape | `#4A3AA8` | white | - |
| red | `#FF5D5D` | white | - |
| sky | `#1CB0F6` | white | My Stats |
| navy | `#244A78` | white | Case Studies |
| coral | `#FB7185` | white | - |
| peach | `#FB923C` | white | - |
| lavender | `#9D7BF5` | white | AI Tutor / Help |
| mint | `#2BC58A` | `#FFFFFF` | Practice History |
| sunshine | `#FFC400` | `#221A12` (dark ink) | Cheat Sheets, highlighter |
| sand | `#FFD27A` | `#221A12` | - |
| fundamentals / maternal | `#3F8A4E` / `#C6584F` | - | NP subject colour-coding [INF] |
| cloud | base `#FFFFFF`, lip `#E4E1DA`, text `#221A12` | | neutral tile |
| slate | base `#F4F4F2`, lip `#DAD8D2`, text `#221A12` | | neutral/disabled |
| callAccept / callEnd | `#15803D` / `#B42318` | | voice call buttons |

Older `colors` set (L327533-L327534): bg `#FFFFFF`, surface `#FFFFFF`, sidebar `#FAFAFA`, text `#1A1A1A`, textMuted `#888888`, textLight `#BBBBBB`, border `#E0E0D8`, orange `#F97316`, chatAccent `#11140F`, chatAccentSoft `#EEEDEA`, rankedRed `#EF4444`. Legacy hue map (L327534): coral `#FB7185`, sky `#38BDF8`, mint `#34D399`, peach `#FB923C`, lavender `#A78BFA`, sunshine `#FACC15` (superseded by 1.2 values; both ship).

### 1.3 Surfaces and text (`surface`, L327747) [OBS]
screen `#FFFFFF` | screenAlt `#F7F7F5` | card `#FFFFFF` | border `#ECEAE4` | groove `#DAD7CF` | grooveBorder `#CFCBC2` | ink `#221A12` | inkMuted `#7C7669` | inkLight `#B4AEA2` | onColor `#FFFFFF`.
Warm brown-black ink and warm greys (never pure black or cool grey) are a deliberate warmth choice [INF].

### 1.4 Semantic colours seen in components [OBS]
- Correct: border `#15803D`, bg `#F0FDF4`; incorrect: border `#B91C1C`, bg `#FEF2F2` (L889120-L889145). Answer marks filled with the same greens/reds.
- Unread/notification badge `#EF4444`, tab top border `#D4D4CC` (2px) (L931700s).
- Tab icon "shadow" (lip) colours: Home `#C2510A`, Library `#1184C2`, Townhall `#C7445A`, Tangerine+ `#CA9A04`, Settings row `#475569` (L931620s).
- Streak chip text `#9A3412` on warm tint (L983168). Flag icon `#C25510`.

### 1.5 Typography [OBS, L320833-L320846]
Fonts are bundled `@expo-google-fonts` (+2 custom) loaded by expo-font (L320690-L320830, assets at `/assets/assets/fonts`).

| Role key | Family | Weights |
|---|---|---|
| `font` (UI/body) | **DM Sans** | 400, 400i, 500, 600, 700, 700i (also 800/900 in strings) |
| `heading` | **Fraunces** (soft serif display) | 400, 600, 700, 700i, 900 Black |
| `editorial` | **Newsreader** | 400, 500, 600, 700 (long-form reading, e.g. rationales/sheets [INF]) |
| `responseFont` | **Lora** | 400, 400i, 600, 700 (Cleo answer text [INF]) |
| `askCleoFont` | bundled custom serif file family named "AnthropicSerif" | 400, 400i, 600, 700 (Cleo chat [INF]) |

- `theme.type` = `{heavy: bold, semibold, medium, regular, display, capsTracking: 0.8}` (L327800-L327830); `heavy` = DM Sans 700, `display` = Fraunces. All caps labels use `letterSpacing` 0.8 ("GET READY", "UP NEXT").
- Size scale (most frequent literal `fontSize`, count): 15(32), 14(31), 13(28), 12(20), 16(18), 11(12), 17(9), 20, 10, 28, 21, 18, 32, 30. Tab labels 9.5 / letterSpacing -0.1 (L931700s); nav sheet title 20/25 -0.3; option text 15/22 400, letter 13/700 (L327334).
- Screens specify weights via `fontWeight` strings AND family keys; mixed [OBS].

### 1.6 Spacing, radius, shadow, sizing [OBS, L327750-L327770]
| Scale | Values |
|---|---|
| space | xs4 sm8 md12 lg16 xl20 xxl28 xxxl40 |
| radius | sm12 md16 lg20 xl24 xxl30 pill999 (option rows use 10; letter chip 6-8; small pills 18) |
| lip (3D edge height) | sm4 md5 lg6 xl8 |
| layout.content max width | 680 (tablet cap) |
| HIT_SLOP | 8 each side; MIN_TAP 44 |
| shadow.card | colour `#8A5A1E`, opacity .10, radius 10, offset 0/4, elev 3 |
| shadow.raised | colour `#5A3A12`, opacity .16, radius 20, offset 0/10, elev 9 |
Shadows are tinted warm brown, not black [OBS].

### 1.7 Motion tokens (`ease`, `dur`) [OBS, L327770-L327805]
`dur = {press 90, release 320, pop 360, count 520}` ms. `ease` includes `out` (Easing.out cubic), `pressIn`, `bounce` / `bounceBig` as bezier curves with overshoot (control values 0.34/1.56/0.64 and 0.34/1.8/0.5).

### 1.8 Icons [OBS]
- `@expo/vector-icons` (L320498): **Feather** (~451 references in app code, general UI) and **MaterialCommunityIcons** (~150, tabs, tools, domain icons); Ionicons 7 uses; FontAwesome5/Brands glyph maps are bundled but unused in app code.
- Most used names: x(52), chevron-right(49), chevron-left(47), check(40), cards-outline(21), plus(20), arrow-left(17), search(15), lock(15), award(14), clock, crown, wifi-off, trash-can-outline, calendar, zap, users, star, play, image, file-document-outline, book-open, refresh-cw, flag, alert-circle, sword / sword-cross, bar-chart-2, mic, video, target. ~392 distinct names total.
- Domain icons: home-variant, folder-outline, forum, star (Tangerine+), sword-cross (Versus), dots-horizontal (More), format-list-checks, message-processing, clipboard-text-outline, cards-outline, chart-bar, history, crown-outline, cloud-download-outline, school-outline.
- Custom SVG icons (react-native-svg): `StreakFlameIcon` (L983360), `SwordsIcon` (L978818), `BatteryIcon` (L862964), `SignalBars` (L982641), `GoogleIcon`, `TangerineMarker` (L885722), `NativeIcon` (L811880).

---
## 2. Component library

| Component | Evidence | Notes |
|---|---|---|
| **PushButton** (L545321) | props: `hue, label, icon, iconSize, onPress, disabled, loading, size(md/lg), radius, lip, round, pill, flat, iconOnly, outline, fullWidth, haptic, popIn, accessibilityLabel` | Core "3D" button: a lip layer sits under the face; on press the face translates down by lip height (`usePush`, `translateY`), `popIn` entrance, `ActivityIndicator` for loading, `useReducedMotion` honoured. Calls `lightImpactHaptic` by default. `accessibilityState.busy`. |
| ChunkyButton (L1069554, L1414769), Round3DButton (L1065962), BattleButton, FooterButton (L1361257), LipPill / LipCircle (L1425587/43), ArrowButton, CancelButton, CallActionButton | older / screen-local variants of the same lip idiom | FooterButton scale-pulses 1 -> 1.04 (110 ms) -> 1 (150 ms). |
| **PushCard / PressableTile / GlassCard** (L862664, L907680, L854105) | design lab text "A pressable cloud card with a soft lip" | Card = white surface, 1-2 px warm border, bottom lip, warm shadow. GlassCard uses `BlurView`. |
| Chips / pills | StreakChip (L983168: h36, radius 18, tinted bg), EnergyChip, DDayChip, PingChip, MetaPill, HashtagPill, PinnedPill, MutedPill, SamplePill, SpeakerChip, PhotoAddChip; "FILTER PILLS" in design lab | Pill = radius 999 / half-height. |
| Badges | HighYieldBadge, VerifiedBadge, PnleBadge, BetaBadge, AchievementBadge, ProfileBadge, ResultBadge, CheckBadge, LiveBadge | Tab badge: 18px circle `#EF4444`, 2px white border. |
| **Bottom sheets** (custom) | SessionQuestionNavigatorSheet (L1348180), SaveToPackSheet, PaywallSheet, FreeUnlockSheet, DailyGoalSheet, TopicPreviewSheet, ReportQuestionSheet, SourcePickerSheet, LobbyInviteSheet, BattleGateSheet, RequiresConnectionSheet, BillingHelpSheet, NoteReplySheet | Built on RN `Modal` (`transparent`, `animationType:none`, `presentationStyle:overFullScreen`, `statusBarTranslucent`) + `Animated` slide + PanResponder; absolute bottom, overflow hidden, **grabber 40x5**. No gorhom/bottom-sheet. |
| **Modals/dialogs** | ~30 `*Modal` components (HomeModalHost/Provider queue L949467-L949841, Energy, Celebration, Passer celebration L1244831, UpdateAvailable, ForceUpdate, ExamDateGate, CaseStudyIntro, tour intros), LibraryDialog (L997764) | Home modals are queued through a provider [INF]. `accessibilityViewIsModal` set (L327900s). |
| **Toasts/banners** | ToastBody (L1075449), SyncToast (L1075617; role `alert`, min 220/max 480 width, radius 12, shadow), SessionStartToast, RatingGuideToast, ToggleFeedbackToastHost (L803281), InAppNotificationBanner (L1079997), IncomingCallBanner, SeasonBanner, YearlyOfferBanner | Absolute, centered, 16 px gutter. |
| **Tabs** | ShellTabBar (L931139): Home / My Library / **Versus (centre, sword-cross, own press target)** / Townhall / Tangerine+ / More; TopTabButton + FeedTab (L1023252-1023489) | Tab bar: 2px top border `#D4D4CC`, each icon sits on a 50x36 pill with a lip layer in the tab's shadow colour; label 9.5px. "More" opens an in-app menu (Hall of Fame, Settings, Offline Mode, Class work, Personal Messages). |
| **Progress** | `SplashProgressBar` (L1079240), `LoadingBar` (L885779), `UploadStatusBar`, `CountdownBar` (L1336575), `TimerBar` (L1414551), `ProgressSegments` (L907248, segmented bar), `StarBar`, `AreaBar`, `QuestionStatsBar` | Bars are plain `View`s with animated width. |
| **Rings/gauges** | `EnergyRing` (L860913), `HeroRing` (L1128456, daily goal), `ScoreRing` (L1148435), `ProgressGauge` (L1178959), `HeroGauge` (L1235695) | react-native-svg `Circle` + `strokeDasharray/Dashoffset`, `strokeLinecap:round`; Gauge uses `Path` arcs. |
| **Answer option row** (L327334 style set; session L1364043-L1366108) | row, border 1.5, radius 10, overflow hidden; left letter square 28x28 radius 6 (A/B/C/D, 13/700); text 15/22; `optionRowActive`, `optionLabelActive`, `optionHint`; `optionTextEliminated` = 2px animated strike-through line drawn over the text (`position:absolute; height:2`); long-press/toggle via `onToggleEliminated` (L1176423, L1225431, L1318561, L1344304). | States: default, selected/active (accent border+tint), eliminated (struck, dimmed), **correct** (`#15803D` border, `#F0FDF4`), **wrong** (`#B91C1C`, `#FEF2F2`) with letter chip turning solid green/red and a check/x glyph (L889120-145). |
| Option variants | `ChunkyOption` (L1312945: lip + 12-radius chip, `accessibilityState.selected`), `SataOptions` (L1359647, select-all), `MatrixTable` (L1359893), `ClozeSheet` (L1360619), `MasteryOption`, `PlanOption`, `BillingOption` | NGN item types exist (matrix, cloze, SATA). |
| **Timers** | TimerBar (L1414551, clock icon + flag), CountdownBar, SeekingTimer (L1404324, matchmaking), session header time (13/600, tabular numerals via `fontVariant`) | |
| **Skeleton/loading** | `useSkeletonPulse` (L1321434: Animated loop opacity 0<->1, 750 ms each way, native driver), PaRailSkeleton, TopicListSkeleton, CatalogSkeleton (L1099773), LockedAnalysisSkeleton (L880280), ReportLoadingScreen (L874781), `TangerineLoader` (L830610, SVG tangerine animation), rotating copy "Reading your forecast... / Crunching the numbers... / Mixing your stats... / Almost there..." (L1238778) | Pulse, not shimmer sweep [INF]. |
| **Empty/error states** | FlashcardEmptyState (L1167038), ErrorNotice, NetworkErrorScreen (L1075968), AuthOfflineScreen, "No data yet", "No topic-level data yet for this subject.", "Your learning path appears when tasks are scheduled." | Copy is friendly and action-oriented ("Try again.", "Reconnect to let Cleo build your exam, or use a Custom Exam offline."). |
| **Charts** | PerformanceBarChart (L815814, Views), PerformanceDonutChart (L816004, SVG Circle dash), PerformanceHeatmap (L816262, Views grid), PerformanceLineChart (L816789, SVG Path/Line), PerformanceDataTable (L816662), RankTrendCard, ForecastTrendCard, AreaBar, TrendCard | **No Skia, no chart lib**: hand-built from `react-native-svg` + Views. Data-table fallback exists (accessibility-friendly) [INF]. |
| **Calendar** | MonthCalendar (L1425884; "Today", "Exam day" markers), StudyScheduleCard (L987229), TasksList, ScheduleProgress, FullScheduleScreen (L1424732), RebalanceScreen | Custom, no react-native-calendars. |
| **Keyboard** | RN core `KeyboardAvoidingView` (behavior `padding` iOS / `height` Android, L838982), `KeyboardDismissBoundary` (L998444), `keyboardDidShow` listeners (L169945, L839171), `Keyboard` dismissal on library page | No keyboard-controller lib. |
| **Gestures** | `PanResponder` throughout (sheets, ZoomableSheetCanvas pinch/pan L1110014, sliders `ChunkySlider` L1204253, FlippingCard L1091668). `GestureDetector` string exists only inside libs (L280528) | No Reanimated; **RN core `Animated` + `useNativeDriver`** everywhere. `react-native-worklets` only as a dep name (L905744). |

---
## 3. Layout patterns per screen type [INF unless noted]

**Home** (HomeScreen L947847; components `PracticeHero`, `StudyToolsRow`, `HomeModalProvider` L995000): header (ShellHeader L981913: avatar, StreakChip, EnergyChip, DDayChip) -> big forest-green "Practice" hero card with play icon and "Start" (hue forest, lip 8, padding 20; label "Practice - choose an exam", subtitle "Choose an exam or let Cleo build one around what you need.") -> "Your Schedule" card (today's tasks, "View full schedule") -> "Study Tools" grid/rows (Questions, AI Tutor, Case Studies, Flashcards, Cheat Sheets, My Stats, Practice History, Help & Feedback, each with hue + icon) [OBS list L995000-L995177] -> tab bar. Modal queue on top (onboarding, exam-date gate, energy, announcements).

**Practice setup** (PracticeScreen L1313543: "How would you like to practice?"): vertical list of mode cards - AI Exam (Cleo-built, needs connection), Custom Exam (CustomExamScreen L1310192), Adaptive (L1305394), Mock Board (L1314197), Coaching (L1308949). Offline-aware: disabled card + "needs a connection" copy [OBS].

**Session player** (SessionScreen L1336993): SessionHeader (back arrow, title, timer 13/600, flag) -> progress/timer bar -> question stem card (Newsreader-like reading text [INF]) -> option rows (A-D, SATA, matrix, cloze, essay composer L1222592) -> footer with chunky Submit/Next (chevron-right) -> after submit: inline correct/wrong colouring + rationale panel + "Ask Cleo", read-aloud, report-a-problem sheet. Question-navigator sheet (grid of 48x48 cells; legend Current / Answered / Not answered / Flagged).

**Results / report** (ReportReviewScreen L1332991, ResultBadge L1243548, ScoreRing): hero score ring + badge + confetti on good runs -> section cards (AreaBar per subject, "Concepts to review" lavender card, Rationale summary) -> review list (SessionReviewGrid L1150227) -> CTA to retry weak topics. Locked AI analysis shown as skeleton with paywall [OBS: LockedAnalysisSkeleton].

**Stats** (PerformanceScreen L1238778): "Practice rank" hero gauge + range + "Steady this week", "Estimated passing chance" with "More evidence needed" gate and "About this estimate" explainer -> accuracy line chart (14 days) -> practice-area cards -> drill-down "Topics, weakest first / Tap to practice" (L1232967).

**Study-plan calendar** (FullScheduleScreen L1424732): back + header -> MonthCalendar (today + exam day markers) -> TasksList for selected day with statuses Scheduled / Needs attention / Due today / Up next / Completed -> "Your learning path" (path to exam day, "Exam day awaits", "Path complete").

**Cheat-sheet reader** (CheatSheetReaderScreen L1103943): BlurView translucent header (L1106078) over a ZoomableSheetCanvas (pinch/pan via PanResponder L1110014) holding a document render; highlighter ("Turn highlighter on/off", sunshine marker) and favourite button; capture protection component (L1103349).

**Cleo chat** (AskCleoPage L1089959, AskCleoDock L818396): message list with CleoTextBubble + CleoReplySticker, typewriter reveal (CleoTypeWriter L918399), welcome with mascot (CleoWelcome L812941), bottom dock with text input, voice record (waveform bars), attachments, response language picker (English / Filipino / Bisaya, L827182-827186), quota LimitCard, exam-draft card, flashcard pack card, read-aloud.

**Library** (LibraryScreen L995415): Page + ActionTray + FloatingActionButton (create), UploadStatusBar, folder cards, material lists, sources, search, refine; sheets for pickers.

**Social / battles**: VersusScreen (L1066233: lobby, matchmaking, rejoin card, how-it-works, battle music toggle); lobby with player cards, chat sheet, invite sheet; battle Result (L1160542: "GET READY / ANSWER / FINAL RESULTS / YOUR SCORE"); BattleWinScreen (WinnerRumble L1414298); Rank screen + RankCrest/SeasonBanner; Townhall feed (PostCard, ThreadCard, FeedTab); DM / group / call screens.

### Wireframes
```
HOME                              PRACTICE SETUP
+-----------------------------+   +-----------------------------+
| (av) [flame 12] [bolt 5] D-40|   | <  Practice                 |
|-----------------------------|   | How would you like to       |
| +-------------------------+ |   | practice?                   |
| | PRACTICE (forest, lip)  | |   | [AI Exam   - Cleo builds ]  |
| | Choose an exam...  >Start| |   | [Custom Exam            ]   |
| +-------------------------+ |   | [Adaptive               ]   |
| Your Schedule  View full >  |   | [Mock Board             ]   |
| [ today task card ]         |   | [Coaching               ]   |
| Study Tools                 |   |  (offline: card disabled)   |
| [Qs][AI][Cases][Cards]      |   +-----------------------------+
| [Sheets][Stats][Hist][Help] |
+-----------------------------+
|Home|Lib| (X) |Town|T+|More |
+-----------------------------+

SESSION PLAYER                    RESULTS
+-----------------------------+   +-----------------------------+
| <  Title        12:30   flag|   |          (score ring)       |
| [=====-----] 7/20           |   |      badge  "Nice work!"    |
|-----------------------------|   |  confetti falls (good run)  |
| Stem text (serif)...        |   | Subject bars  ##### 82%     |
|                             |   | [Concepts to review]        |
| (A) Option text             |   | Rationale summary           |
| (B) Option ~~struck~~       |   | Review list >               |
| (C) Option  [green+check]   |   | [ Retry weak topics ] (CTA) |
| (D) Option  [red + x]       |   +-----------------------------+
|-----------------------------|
| [grid]   [ Submit / Next > ]|
+-----------------------------+

STATS                             STUDY PLAN CALENDAR
+-----------------------------+   +-----------------------------+
| My Stats                    |   | <  Schedule                 |
| Practice rank (gauge) range |   |  Mo Tu We Th Fr Sa Su       |
| Est. passing chance  [?]    |   |  . . o . . . .  (today ring)|
| Accuracy line (14 days)     |   |  [Exam day marker]          |
| Areas: bar bar bar          |   | Today: Due today / Up next  |
| Topics weakest first >      |   | Learning path ---o---o--[*] |
+-----------------------------+   +-----------------------------+
```

---
## 4. Motion and feedback

- **Animation stack [OBS]**: RN core `Animated` (timing/spring/loop, `useNativeDriver:true`), `PanResponder`, `Easing.bezier`, `react-native-svg`, `expo-image`, `expo-linear-gradient`-style gradients (26 `LinearGradient` refs, L62954 RN lib + app), `BlurView` (L811859, L1154403). **No Lottie, no Reanimated, no Skia.**
- Press feel: lip button translateY with `dur.press 90 / release 320`, `bounce` overshoot; `popIn` on entrance (L545321).
- Celebrations: `ConfettiFall` (L928516, falling pieces) and `ConfettiBurst` (L978289, radial burst; ~140 px travel param, 16 px base) used in CelebrationPromptModal (L943792), PasserCelebrationModal (L1244831), battle Result [INF]; `EnergyBonusBurst` (L1142348, zap-tangerine art + zapFlick); `WinnerRumble` (L1414298); `useCleoWelcomeMotion` (L866731).
- Skeleton pulse 750 ms; `TangerineLoader` SVG (L830610).
- Reduce motion: app hook `useReducedMotion` (L327414, reads `AccessibilityInfo.isReduceMotionEnabled` + `reduceMotionChanged` L327438-L327472) used by PushButton and others [OBS].

### Sounds [OBS names from `ex/res/raw`; where-played mostly INF]
Player is `expo-audio`; feedback manager L546250-L547240 (`areSoundsEnabled`, `setSoundsEnabled`, storage key `sounds_enabled` L547476; toggle "Sounds" in settings L1447035/L1448363). Haptic + sound are paired in named cues: `selection`, `lightImpact`, `success`, `warning`, `error`, `nextQuestion`, `zapFlick`, `thock`.
| File | Played at |
|---|---|
| assets_sounds_selection.mp3 | option selected (selectionHaptic L546575) |
| assets_sounds_correct.mp3 / incorrect.m4a | answer reveal, session + battle (L801269, L880685, L1145071) |
| assets_sounds_nextquestion.mp3 | advance (nextQuestionHaptic L546509) |
| assets_sounds_warning.mp3 | timer low / warning (L546646) |
| assets_sounds_replythock.wav | Cleo streaming tick / reply (chatStreamTickFeedback L546460) |
| assets_sounds_zapflick.mp3 | energy bonus (L1142494) |
| assets_sounds_callringback.mp3 | outbound call ringback (L547223) |
| assets_sounds_majesticarrival.m4a | pre-battle player reveal (L1087319) [INF] |
| assets_lobbymusicaa1.mp3 / aa2.mp3 | battle lobby music (L1071286, stopLobbyMusic L1071131; "Turn battle music on/off") |
| assets_countdowntotheanswer.mp3 | battle answer countdown [INF] |
| assets_quizwinnerfanfare.mp3 | battle/quiz winner [INF] |

### Haptics [OBS]
`expo-haptics` wrapper (L796569-L797075) with Impact (Light/Medium/Heavy/Soft/Rigid) and Notification (Success/Warning/Error) plus Android `performAndroidHapticsAsync`; app functions `lightImpactHaptic, selectionHaptic, notificationHaptic, nextQuestionHaptic, revealHaptic, revealStepHaptic, thockHaptic, chat*Haptic` (L546377-L546636). `Vibration` used in places. Default for PushButton = light impact.

### Mascot, stickers, crests (counts and names only) [OBS]
- Mascot = a tangerine character plus "Cleo" (tutor persona). Rendered as **static PNGs** in `expo-image` (CleoMascot L830290, TangerineSticker L833526) with a state machine in the Design Lab: idle -> random gesture after 5 s -> sleeping after 10 s -> completion smile (L1130821 text). Welcome art `tangerines/welcome` (2).
- `assets/tangerines/` 30 images: action-practice/-performance/-study-plan, cleo-drums, coach-cleo, sad-cleo, cool/happy/ok/party/jumping/running/donut/family/headphones tangerine, tangerine-wave, mock-board-tangerine, royal-royale, royal-swords, zap-tangerine, np1..np5-scene (per-subject scenes), more-tangerines, default.
- `assets/stickers/` 25 chat stickers named by emotion (beach-day ... you-got-this); sent as `stickerMessageBody` in chat (L833694).
- `assets/crests/` 4 (scholar, student, topnotcher, toprank) -> RankCrest (L1052768), RankBadge; `results/` 6 hall-of-fame/badge art + `results/guardians/` 6 portrait files (names withheld); `group-avatars/` 5 animal avatars (fox, rabbit, bear, cat, owl); `coaching/` 5. User avatars: photo upload + "pick a mascot" (EditAvatarScreen L1382984, AvatarCropModal L945584).

---
## 5. Accessibility and localisation
- **A11y [OBS]**: `accessibilityLabel` ~743 occurrences in the bundle (484 in app code), `accessibilityRole` 391 in app code (253 `button`, 49 `text`, 45 `image`, 15 `alert`, 10 `radio`, 9 `checkbox`, 6 `header`, 4 `switch`, 4 `progressbar`, 3 `tab`), `accessibilityState` 114, `accessibilityHint` 17, `accessibilityLiveRegion` 45 (RN), `announceForAccessibility` (L820408, L1095669), `isScreenReaderEnabled` (L1080097), `accessibilityViewIsModal` on modals. Labels read like "Practice - choose an exam", "Close question navigation", "Skip question tools introduction", "Report a problem with this question". Mascot images carry labels. Min tap 44 + hitSlop 8 tokens.
- **Font scaling**: React Native default scaling (`allowFontScaling` only in RN internals/error screen); `PixelRatio.fontScale` read once (L981953). No global `maxFontSizeMultiplier` found in app code [INF: large fonts could overflow fixed-height chips].
- **Languages**: UI strings are **English only** (no i18n lib, no locale files). Only Cleo's `responseLanguage` is selectable: English / Filipino / Bisaya (L821647, L827182-L827186, flags shown). Some localisation of content (Taglish rationales) happens server-side [INF].
- **RTL**: `I18nManager` present in RN; app sets nothing (`allowRTL`/`forceRTL` unused) -> no RTL support [INF].
- Reduce-motion: supported (see 4). Dark mode: not supported. Screen capture protection on cheat sheets (L1103349).

---
## 6. Inferred design principles and borrow/avoid

**Principles [INF]**
1. Duolingo-style "physical" UI: every tappable has a coloured lip, presses sink, and bounce with sound + haptic.
2. Warm, friendly identity: one saturated brand orange, dark forest hero, soft pastel hues per feature, warm brown ink/shadows, serif display type (Fraunces) over geometric sans (DM Sans).
3. Colour = meaning per feature (hue tokens map to tools, subjects, NP areas), so the home screen is scannable.
4. Gamified loop: streak chip, energy (lives), daily goal ring, ranks/crests, battles, confetti, mascot reactions.
5. Offline-first honesty: cards disable with explanation; sync toast; offline mode screen.
6. Hand-rolled primitives (charts, sheets, calendar) on a tiny dependency set, keeping JS fast and visuals consistent.
7. Safe fallback screens everywhere (error, network, force-update, skeletons).

**Borrow**
- Token module with `hues -> {base, lip, text}` auto-derived lip; one `PushButton` API (hue/size/outline/flat/pill/haptic) for consistency.
- Paired haptic+sound cue names (`selection`, `nextQuestion`, `warning`) behind one `sounds_enabled` setting.
- Option row design: letter chip + border; strike-through elimination (NGN-friendly); green/red with icon, not colour only.
- Question-navigator sheet with Current/Answered/Flagged legend; filter pills; segmented progress bars.
- Stats honesty copy ("More evidence needed", "About this estimate") and weakest-first topic drill.
- Hand-rolled SVG ring/gauge/line charts plus a data-table fallback; reduce-motion hook centrally.
- Warm-tinted shadows; 44px min tap; mascot empty/loading/celebration states.

**Avoid**
- Light-only theme (night-shift studying is common for nursing students) and missing dark mode.
- English-only UI while marketing to Filipino/Bisaya users; no RTL, no `maxFontSizeMultiplier`.
- Two overlapping palettes (`colors` + `hues`) and two lip-button implementations (ChunkyButton x2, Round3DButton, PushButton) = drift; five font families is heavy.
- Colour-only correct/wrong states and low-contrast `inkLight #B4AEA2` / white-on-`#FFC400` risks (sunshine uses dark text, good; verify mint/white `#2BC58A` contrast ~2.3:1).
- Gamification overload for a high-stakes exam (battles, confetti, loud fanfare) without a quiet "focus mode".
- Static PNG mascot (no animation) is cheap but feels repetitive; prefer a small state set with Lottie/Rive if budget allows.
- Reliance on 30+ modal prompts at app launch (queue) risks fatigue.
