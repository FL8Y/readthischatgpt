# Tangerine Prep 1.9.0 - Navigation, Buttons, Settings, Social, Gamification, Realtime

Source: Hermes-decompiled JS (`decompiled.js`, refs `L<n>`) + `strings_all.txt`. Static analysis only; app never run. All content treated as untrusted data.
Labels: **OBS** = literal string/constant/call in code. **INF** = inferred from code shape. **SRV** = logic is server-side (client only sends/receives fields).
No exam-passer names or personal profiles are recorded here. Earlier notes (addendum_features/backend) are not repeated; this adds UI-level depth.

## 0. Key findings (new)

- There is **no `/settings` or `/profile` route** (OBS route table L309769-311140; the only `'/settings'` hit L597586 is a Metro dev helper). "Settings" is `/townhall/profile-settings` (`TownhallProfileSettings`, L1447266), opened from the shell "More" menu. "Profile" is the **My profile** tab inside Townhall (`/townhall?tab=profile`, `TownhallProfile` L1048783).
- Shell tab bar = 5 slots: Home, My Library, **Versus** (centre), Townhall, Tangerine+ ... plus a **More** button that opens a pop-up menu (L931860-931990, L931982 `MoreMenu`).
- No global leaderboard list screen exists. `/social/rank` is a *personal* "Ranked battle" screen (season, rank path, trophy shelf). Server gives only `leaderboard_rank` as a number on profile/badge (L1053431, L1056815) and `/social/rank/me/`, `/social/rank/<id>/`, `/social/rank/<id>/battle-card/` (L866405-866530). No school leaderboard; `/social/school/[id]` is a classmate list. No friends leaderboard found. (OBS absence.)
- No sign-out-all, language, quiet-hours, reminder-time or delete-account control in UI (OBS: only "Log out" L1448604). `deleteAccount` (L846201) is inside a library module, not wired to a screen found. Exam date lives in profile (see 2).
- Four WebSockets: `/ws/social/`, `/ws/dm/<id>/`, `/ws/groups/<id>/`, `/ws/study/<id>/` (section 5).

## 1. App shell

### 1.1 Route map (expo-router, L309769-311140) [OBS]
- `(auth)`: welcome, login, signup, forgot-password, diagnostic. `(shell)`: index (Home), library, townhall, versus, subscription.
- Top-level: notifications, notification-detail, notification-settings, personal-messages, offline-mode, feedback, history, streak, daily-goal, search, pnle-results/august-2026, celebrate-name, class-work, social/*, townhall/*, plus lab screens (design-lab, townhall-lab, server-health, apex-rank-lab, battle-topic-wheel-lab, fabricated-battle-royale).
- Aliases / push deep-link allowlist (L1085018+): `/scheduler`,`/study-plan`,`/plan`->`/study`; `/messages`->`/personal-messages`; `/social/friends`->`/friends`. Allowed push targets: `/practice /study /performance /social /subscription /history /streak /questions /session /review /personal-messages` and `/townhall` [OBS].

### 1.2 Shell layout (`ShellLayout` L930659)
- Custom bottom bar (not native tabs). Items [OBS L931860-931990]:

| Slot | Label / icon | Behaviour |
|---|---|---|
| index | Home (home-variant, orange) | route `/` (shell index) |
| library | My Library (folder-outline) | `/library` |
| **versus** (centre, sword-cross, red) | Versus, tour key `tab-versus` | `onPress`: `tabSwitchHaptic`, track `shell_tab_versus`, navigate `/versus` (L931607-931700) |
| townhall | Townhall (forum, coral) | badge = notification `total` count (L931840 region) |
| subscription | Tangerine+ (star, `requiresConnection`) | `/subscription`; blocked offline |
| More | dots-horizontal (morphs to close) | opens MoreMenu; tracks `shell_tab_more` |

- Offline: tabs flagged `requiresConnection` show modal "You're offline - This feature needs an internet connection. Try a practice exam - those work offline if you've loaded questions." (button "Got it"); event `shell_tab_nav_offline_blocked`.
- Tab press = haptic + `shell_tab_nav` analytics + router navigate. Tab badges come from NotificationCenter (4.5).

### 1.3 More menu (L931982) [OBS]
| Row (sublabel) | Route | Notes |
|---|---|---|
| Hall of Fame ("Topnotchers, passers, and PNLE results") | `/pnle-results/august-2026` | see 3.8 |
| Settings ("Plan, preferences, account") | `/townhall/profile-settings` | |
| Offline Mode ("Questions, decks, sheets, and audio") | `/offline-mode` | Tangerine+ downloads |
| Class work ("Assignments and section updates") | `/class-work` | institution learners (INF gating) |
| Design lab ("Staff-only 3D primitives preview") | `/design-lab` | staff only (INF; label says so) |
| Personal Messages (count suffix " developer message") | `/personal-messages` | unread count badge |
Scrim tap / "Close menu" closes.

### 1.4 Shell header (`ShellHeader` L981913; variants default / battle / townhall / ping-only)
| Control | Action |
|---|---|
| Back ("Go back") | router.back (non-root screens) |
| Search icon | track `header_search`; default -> `/search`; townhall variant -> `/townhall/search` (L982242-982266) |
| Ping chip (fast/medium/slow/off, "Connection N milliseconds") | track `ping_chip_tap` -> `/server-health` (L982429-982506) |
| Streak chip ("N day streak. Tap to view calendar.") | `/streak`; reads `/streak/calendar/` for `current_streak` (L983168) |
| Energy chip ("X of Y energy. Tap for details.", full/empty icon) | opens energy detail (INF; handler not isolated) L1350364 |
| Notification bell ("Notifications, N unread") | track `notif_bell_open` -> `/notifications` (L983946-984012) |
`battle` and `ping-only` variants hide some chips (INF from `!== 'battle'`/`!== 'ping-only'` checks L981990-982010).

### 1.5 Home (`HomeScreen` L947847)
| Section | Controls | Action |
|---|---|---|
| Header | chips above | see 1.4 |
| Stats card (`home_stats_card`) | tap | `/performance` (track `home_tool_stats`) |
| Practice hero ("Choose an exam or let Cleo build one around what you need." button "Start") | `home_practice_hero` | `/practice` (selector) |
| Your Schedule card | "About your schedule" info, "View full schedule" (`home_schedule_view_full` -> `/study/full`), task rows (`home_schedule_task` -> task detail sheet), "Today"/"UP NEXT", badges Scheduled/Needs attention/Due today/Up next/Completed | starts session by task type (Learn/Recall/Review/Assignment/Timed mock/Daily AI/Cheat sheet/Flashcards/Case study); "No exam date set" state; "Mark complete/incomplete"; "Resume"; "Your learning path" list (`home_schedule_path_task`) (L987600-990400) |
| Tools grid (L994990-995300) | Questions `/questions`; AI Tutor (Ask Cleo chat, `ask_cleo_chat`); Case Studies `/case-studies`; Flashcards `/flashcards`; Cheat Sheets `/cheat-sheets`; My Stats `/performance`; Practice History `/history`; Help & Feedback `/feedback` | |
- Offline starts of AI/mock/Ask Cleo show "needs a connection" alerts; no cached questions -> "No offline questions".
- Home modals (queued through `HomeModalProvider`, L949546-949659, events `home_modal_shown/dismissed`): Hall of Fame announcement, rank announcement (`rank_announcement_ok` -> home stats), versus announcement (`versus_announcement_cta` -> `/social`; `_later` dismiss), exam-date gate (`save_exam_date`), PMF survey (`pmf_survey_start/done`), `rank_spotlight_ok`, stats spotlight ("Here's your Stats - Tap the highlighted card to see your rank and weak areas." L950736).

### 1.6 First-run coach marks (`TourProvider` L934859, `TourOverlay` L934038) [OBS L935965-935969]
4 steps, hole-punch overlay, "Next"/"Start studying", counter "N of 4":
1. `home-welcome` "Practice" - "Build a practice exam your way."
2. `home-sessions` "Study Tools" - "Ask your AI Tutor, work on weak spots, check your progress, or revisit past sessions."
3. `home-study-schedule` "Study Schedule"
4. `tab-versus` "Study with Friends" - "Challenge your friends in Versus..."
Tour version is fetched (`fetchOnboardingTourVersion` L936281, `fetchOnboardingConfig` L936039) so it can be re-triggered server-side (SRV). Other one-time onboardings: EnergyOnboardingModal (L981566), Library onboarding (L1011198), Cheat-sheet tools (L1114580), Flashcard onboarding (L1167726), Offline welcome modal (L1073732: "Welcome to Offline Mode", offline practice works 24 h).
Splash tips (`cycleTip` L1077755): DID YOU KNOW / FUN FACT / PRO TIP strings, e.g. "Sounds and haptics can be turned off anytime in the Profile tab."

### 1.7 Floating / sticky elements
- Library: FAB "Add to My Library" (plus, `add_menu_open`, becomes close "Exit folder selection") and "Ask Cleo" FAB labelled "Ask Me!" (L996150-996300).
- Townhall: compose button (pencil `edit-3`; "Write a new post"; on Messages tab "New message") L1040373.
- Sticky/inline banners: InAppNotificationBanner (swipe up to dismiss, "Open notification"/"Join battle", L1079997), IncomingCallBanner (L1082621), YearlyOfferBanner with "Offer ends in" countdown (Subscription, L1022348), StudyPlanUpgradeBanner (L1144674), SeasonBanner "Season ending / Ends in N" (L1057183), Resume/"Rejoin your match" card on Versus.
- Empty states (OBS strings): "No groups yet", "No personal messages yet.", "All caught up", "Nothing here yet" (session history), "No classmates here yet", "No photos yet - Tap to add.", "Message a friend or create a study group to start a conversation."

## 2. Settings / profile / notification screens

### 2.1 Settings (`/townhall/profile-settings`, L1447266-1448800) [OBS]
Header "Settings" with Back chevron. Online-only actions show "Settings changes need a connection".
| Control | Effect |
|---|---|
| Plan card ("Current plan"/"Active plan", Free plan / Tangerine+ / Lifetime access, "Billed", "Access"/"Renews") | read from subscription state |
| Energy block ("Energy", "Sessions / day", "Unlimited" or "N of M remaining") | read-only meter (free tier) |
| Buttons "Upgrade" / "Cancel or manage" / "See plans" / "Billing help" | track `upgrade`/`manage_plan`/`license_card`; `/subscription`; manage opens Play subscriptions URL `https://play.google.com/store/account/subscriptions`. Text: web/QR payments do not auto-renew; Play subscriptions managed in store |
| Stat tiles Sessions / Questions / Accuracy | from `/sessions/` (completed) |
| **Username & profile** | `/townhall/edit-profile` |
| **Notifications** | `/notification-settings` |
| **Offline mode** | `/offline-mode` |
| **Sounds** switch (`SoundToggleRow`) | `selectionHaptic`, `setSoundsEnabled`, meta key `sounds_toggle` (enable/disable), stored locally ("1"/"0") |
| **Question tagger** switch + info "Got it" | `setTaggerEnabled`, meta `tagger_enabled`/`tagger_toggle`. Text: after each answer a panel lets you tag Learning / Reviewing / Mastered; tags shape practice (server mastery `/mastery/`, `/questions/<id>/`). Nudge after repeated dismissals (`tagger_dismiss_count`): "Tagging questions a lot? ... turn it off now?" |
| **Test history** | `/history` |
| Privacy policy / Terms & legal | open `https://tangerineprep.app/privacy` (+ terms) via `Linking` |
| About: App Version, Native Build, Runtime, Update Channel, Update Source, Platform | read-only |
| **Log out** (label "Log out - offline" when offline: disabled, "Signing out and other account actions need the server") | Alert "Log out?" -> clears tokens, returns to `/(auth)/welcome` |
Haptics: no separate toggle; the Sounds switch is the only control ("sounds and haptics" tip is loose wording) (INF). No language, theme, quiet-hours, delete-account or linked-accounts rows (OBS absence). `/theme` route exists (`ThemePage` L1428143) but is not linked from settings (INF dev).

### 2.2 Edit profile (`/townhall/edit-profile`, L1439524)
Cancel / Done; change photo -> `/social/edit-avatar?from=townhall/edit-profile`; First name (required), Last name, Username (3-30 letters/numbers/./_), Bio, School row -> `/social/edit-school?from=...`, PNLE exam date picker (must be future). Save = PATCH `/auth/profile/` (analytics `townhall_edit_profile_save`). Offline: "Editing needs a connection".

### 2.3 My profile tab (Townhall, `TownhallProfile` L1048783)
Avatar (Edit avatar -> `/social/edit-avatar?from=townhall`), rank crest/badge (`ProfileRank`, "Unranked" default), chips "Set exam date"/"Exam date <d>" (`save_exam_date` PATCH `/auth/profile/`, "Pick a future date"), Friends stat -> `/townhall/friends`, Rank stat -> `/social/rank`, school chip -> `/social/school/<id>` (or "Add your school" -> `/social/edit-school?from=townhall`), "Edit profile", "Share profile" (`share_profile`), Showcase photo grid ("Add showcase photo", "Remove photo?" "This takes it off your showcase.") using `/social/profile/showcase/` and `/showcase/upload/`.

### 2.4 Exam date gate
`ExamDateGateModal` / blocker ("Set your exam date", "Your exam date has passed", "Set your PNLE exam date to continue."), buttons `exam_date_blocker_go_to_profile`, `/townhall/edit-profile`. Countdown pill on Versus/Home: "Exam is today", "D-day", "Exam date has passed. Tap to update." -> `/townhall?tab=profile`. Exam-date-driven: schedule (`/study-plan/v2/*`) and daily goal (SRV).

### 2.5 Notification settings (`/notification-settings`, L1227364)
Manifest-driven (OBS): GET `/notifications/manifest/` + GET `/notifications/preferences/`; each toggle -> set preference `{key, enabled}` (analytics `toggle_notification_preference`; API `setNotificationPreference` L933351). Subtitle: "Choose which reminders and updates you want. Account and security messages are always sent." Empty: "No preferences available yet."; Retry. The preference keys/labels (reminders, streak, battles etc.) are delivered by server manifest, so the exact list is **SRV**. No local quiet-hours/reminder-time UI (OBS absence; may be hidden inside manifest, INF).
Push registration (`usePushNotifications`, L1084681; permission L953510): `/notifications/register-token/`, `/permission-status/`, `/deactivate-token/`, `/opened/` (open tracking), analytics `notification_permission_prompt`, `notification_received`, `notification_opened`. Foreground presentation: banner + list + sound, no badge (`notificationPresentation`). `shouldQuietNotification` (L986905) suppresses in-app banners when the current path matches `^/(session|social/study|social/call)` (do not disturb during sessions/battles/calls).

### 2.6 Notifications inbox (`/notifications`, `NotificationInbox` L1228286; `AccountNotificationCenter` L984142)
Tabs/filters all/unread; sections activity (townhall like/comment, friend accepted, group approved), battles (invites), friends (requests), groups, personal, messageRequest. Buttons: gear -> `/notification-settings`, "Mark all read" (POST `/social/notifications/mark-read/`), per-row Accept/Decline (friend request, message request, group join request "Review request"), "Join battle" ("Tap to join"/"Joining..."), "Load earlier updates" (`?before=` cursor on `/notifications/inbox/`), pull to refresh. Row tap -> `/notification-detail` ("This update is no longer available" fallback) or deep link (`/social/study/<id>`, `/social/dm/<id>`, `townhall_post`). Expired invite: "Invite no longer available". Townhall notifications screen (`/townhall/notifications?tab=requests`) shows the same center filtered to social.

## 3. Social

All social data is on the Django-style backend `/social/*` (SRV). Real-time via section 5.

### 3.1 Friends (`TownhallFriendsScreen` L1441820, route `/townhall/friends`, alias `/friends`)
Back; search box "Search name, email, or school" (discovery search `/social/users/search/?q=`) and "Search friends and requests"; sections "Friend requests" (Confirm / Delete), "Sent" (Cancel request?), friends list (row: Message -> `/social/dm/<id>`; overflow Remove friend / Block). Tap row -> `/social/user/<id>`. Calls: `/social/friends/`, `/social/friends/request/`, `/social/friends/suggestions/`, `/social/blocks/create/`. Buttons on user profile (`UserProfileScreen` L1419956): Add friend / Requested / Confirm / Message / unfriend ("Unfriend X? You'll be removed from each other's friends"), cancel request, friends count, school chip, user posts (like), battle/group links.

### 3.2 Direct messages (`/social/dm/[userId]`, `DmThreadScreen` L1374397; list in Townhall > Messages; `/personal-messages` is developer/system inbox)
- Only friends can DM ("You can only message friends."); non-friends produce *message requests* ("Chats from people you haven't added"; notification "wants to message you", Review request -> Accept/Decline) via `/social/dm/requests/`.
- Controls: Send, photo attach, Tangerine stickers picker ("Tangerine stickers"), reaction picker, long-press actions (Report message `/social/messages/<id>/`, Delete for everyone, Report or block), reply to a Townhall note, battle invite card (Open; states "In lobby", "Active", "Lobby ended", "Battle over"), voice/video call button (see 3.5), Sent/Read receipts.
- WS `/ws/dm/<id>/`: events `message` (implied), `typing`, `reaction`, `reactions`, `message_deleted`, `read_receipt`/`read_at`. Send: REST `social_dm_send` (+ `social_dm_send_note_reply`). Empty: "Say hi, then challenge them to a 1v1."

### 3.3 Groups
| Screen | Controls | API |
|---|---|---|
| Groups list `/social/groups` (L1390746) | New group; rows ("You: ..." last message) | `/social/groups/` |
| New group `/social/groups/new` (L1396703) | Group name ("e.g. NLE Warriors"), mascot picker, friend search/multiselect, Create | POST `/social/groups/create/` -> then back to thread; needs friends ("Add friends first") |
| Group thread `/social/groups/[id]` (L1386515) | send, photo, reply, report/delete, "Group options", "Manage group", start Battle Royale from group ("Say hi to the group, then start a Battle Royale together") | `/ws/groups/<id>/`; `/social/groups/join/` for invite links |
| Manage `/social/groups/manage/[id]` (L1391921) | name, mascot/photo (`photo_key`/`photo_url`), Mute notifications ("Stop push alerts for new messages"), Auto-accept requests, Share invite link, member rows (Remove member, Make owner/Remove as owner), Member requests Approve/Decline, Add a friend, Leave group | `/social/groups/manage/<id>/`, `/join-requests/` |
Group events on WS: `message`, `typing`, `reaction`, `message_deleted`, `member_joined`, `member_removed`, `group_updated`, `reactions`. Group recruitment posts can be published in Townhall (3.6). Join via Townhall post: "Join <group>" (`onJoinGroup`, `social/groups/join`).

### 3.4 Study rooms / lobby with voice (`/social/study/[id]`, `GroupStudySessionScreen` L1406565)
Same screen serves battle lobby, live race and final results. REST: `/social/study/<id>/`, voice token `/social/study/<id>/voice-token/`, LiveKit audio room.
- Lobby: Connecting voice..., mic on/off, "Listen to other players"/"Mute other players", "Reconnect voice" ("Voice is unavailable. You can still chat."), Lobby chat (open/close, earlier messages, "Say hello to your lobby"), Invite Friends / Groups ("Send this battle to a group chat", "Invite sent to X"), remove member ("Remove from lobby?"), Cancel this match (owner; everyone sent back), Leave (ready-check leave starts matchmaking cooldown), Start / ready check (`readyMatch`, `readyDeadlineReached` strings), auto-nav to `/battle-intro?mode=...` then `/session/<id>`.
- Errors: `match_version_block` ("Update to play", Restart/update-app actions), `session_cancelled` ("Match cancelled ... sent back to Versus"), `match_absorbed` (merged into another lobby).
- Live: "LIVE BATTLE - The race is on", "SPECTATING", "FINAL", "Race over", "Clock cut - a racer finished", "Question by question" review; results lead to `/report/<id>`. History: `/social/study/history` ("Session history", "Quick match", "Finished group studies and random matches land here").
- 1:1 and group calls (outside battles) use `/social/calls/{start,active,incoming}/` and `/social/call/<id>/` (`ChatCallScreen` L1368306): states Ringing / Waiting for others / Connecting / Connected / Call ended / "Call unavailable"; Join voice call; Mic, Camera, Speaker/earpiece, "Add someone" (invite accepted friend). Incoming call banner (`IncomingCallBanner` L1082621) Accept/Decline via `/ws/social/` `incoming_call`/`call_changed`; LiveKit.

### 3.5 Rank, school, "leaderboards"
- `/social/rank` (`RankScreen` L1398447): "Ranked battle", Season N, "Your rank", star bar, horizontally swipeable path of the nine ranks ("You are here"), "Trophy shelf - Your best rank each season, yours to keep" (peak tier per season), Apex points ("Keep building your Apex points"), win streak ("Your next streak starts with one win"), SeasonBanner. Data from `/social/rank/me/`.
- `/social/school/[id]` (`SchoolPeopleScreen` L1401059): classmates of a verified school, per-row Add friend / Confirm / Requested / Message, open profile.
- Schools list from `/social/schools/` (search/suggest) via `/social/edit-school`. Ranking order and school points are SRV.

### 3.6 Townhall (`(shell)/townhall`, L1026921) - community feed
Tabs (OBS L1027000): **Feed**, **Messages**, **My profile**. Header search -> `/townhall/search`.
- Feed: posts, topic filter (hashtags `/social/townhall/hashtags/`), like, comment thread (`/townhall/thread/[id]`, `/townhall/post/[id]`), official announcements (`/townhall/announcement/[id]`, "OFFICIAL ANNOUNCEMENT", like), pinned posts. Overflow: Edit post, Delete post (everyone), Pin/Unpin to top, Close recruitment, Block/Unblock post (staff moderation), Report.
- Notes strip (`TownhallNotes` L1040495): short ephemeral status "Add your note" (placeholder "Share a thought...", "Note lasts for ..."), like/unlike, "Liked by", reply (goes to DM), delete.
- Composer (`TownhallComposer` L1029334): post types text / **BATTLE INVITATION** ("Invite battle", Battle Royale topic) / **GROUP RECRUITMENT** (choose a group you own; "You don't own a study group yet."), title, topic (required), up to several photos with crop and background choices, voice recording ("Tap to record", "Recorded"), "Keep draft?" on close, Post/Save.
- Messages tab: DM + group list, "Search conversations", "Who would you like to message?", row "Create a study group - Chat and battle with your friends" (-> `/social/groups/new`), "Message requests" (-> `/townhall/notifications?tab=requests`). Live refresh from `/ws/social/` events `dm_changed dm_read group_message group_read`.
- Search (`/townhall/search`): "Search posts, topics, people"; All + topics; results open `/townhall/post/<id>`.
- Posting/feed APIs: `/social/townhall/{feed,posts,comments,threads,notes,hashtags,search,link-preview}/` (SRV moderation).

### 3.7 Avatar / school gates
`/social/edit-avatar`, `/social/edit-school` require both before queueing battles ("Complete 1 / 2 steps to battle": Profile photo - Choose from your library; Pick your school - Choose from the list); privacy line "You'll appear on boards by nickname - no real name shown."

### 3.8 Hall of Fame and PNLE results / celebration consent (no names recorded)
Flow [OBS]:
1. **Hall of Fame entry points**: More menu row; home announcement modal (`HallOfFameAnnouncementModal` L948872, GET `/social/hall-of-fame/announcement/`, copy "To every new RN, we're so proud of you ... our Topnotchers!", CTA "Visit the Hall of Fame", event `townhall_hall_of_fame_open`); optional music (`useHallOfFameMusic` L1087254).
2. **Results screen** `/pnle-results/august-2026` (`HallOfFameGallery` L1245875): tabs Passers / Hall of Fame (Topnotchers), "Search by full name" (min two letters, "Enter at least two letters"; local index `createPnleResultIndex`/`searchPnleResults` L1304348-1304381), result row -> opens a **congratulations modal** ("Congratulations, ... You're a Registered Nurse. Your Tangerine Prep team and family are so proud of you.", `PasserCelebrationModal` L1244831) or the user's profile (`/social/user/<id>`). Roster is a bundled/cached list (SQLite `meta` table with version + expiry; `loadPnleBadgeRoster` L1305293); badges also from `/social/pnle/badges/` and `/social/pnle/profiles/`. Users matched to roster get a PNLE badge (`PnleBadge` L1037647) on profile/posts ("PNLE topnotcher", "Registered nurse").
3. **Consent for being named/photographed** (`CelebrationPromptModal` L943792, `/celebrate-name`): auto-opened once from shell (event `notif_name_capture_open`, target `celebrate_name_auto`) when `profile.celebrate_prompt_done !== true` and `celebrate_prompt_viewed` not yet true (`needsCelebrationDetails` L947805). Copy: "We're preparing to celebrate you - Add your name and an optional photo for future Tangerine Prep congratulations. This photo is kept separate and won't change your profile picture." Fields: First name, Last name, optional celebration photo (picker, "Move and scale" crop, upload `/auth/profile/celebration-photo/`), explicit **checkbox**: "I agree that Tangerine Prep may announce me as <the name entered above> when congratulating PNLE passers". Save -> PATCH `/auth/profile/` with `celebration_consent_first_name`, `celebration_consent_last_name`, `celebrate_opt_in` (true=opt_in / false=opt_out analytics target), `celebrate_prompt_done`. Close without saving marks `celebrate_prompt_viewed`. Reachable later from Personal Messages ("Don't see your name? Update your Tangerine details" -> `/celebrate-name`). Which users are matched/announced is SRV (staff roster); client never publishes names itself.

## 4. Battles, streak, goals, gamification

### 4.1 Versus hub (`VersusScreen` L1066233)
- Two "islands": **Duel** (1v1) and **Battle Royale** ("3-20 players"; `target_size` sent for royale). Swipe/pan between formats. Buttons: Start battle (picks format), battle music toggle (`battle_music_muted` stored locally), "How it works" sheet (rules text; per-format "rules seen" flags `social_battle_rules_seen_duel/royale`), "Rejoin your match" (active `/social/study/current/`), season banner, rank readout, pre-battle checklist (photo, school), exam-date chip. Offline: "You're offline. Versus needs a connection."
- Flow (OBS L1067150-1069100, L1561-L1566 rel): POST `createMatch` `/social/study/create/` body `{mode:'custom', practice_area_codes, question_count, target_size (royale only)}` (defaults 15/20 in code, INF which is which); or random queue `/social/study/match/queue/` -> poll `/match/status/` -> `/match/cancel/`. HTTP 409 = already in a match -> route to existing `/social/study/<id>`. On success push `/social/study/<id>` (lobby).
- Cooldown: leaving matchmaking before start -> `my_queue_cooldown`, modal "Matchmaking cooldown / You left matchmaking before the battle started. You can queue again in N" (`battle_queue_cooldown`, `deliberate_queue_exit`, strike count escalates) (SRV enforces).
- Topic wheel (`battle-topic-wheel`, L1098579 lab): wheel NP1..NP5 + Random, "Let it roll...", spin event `battle_topic_wheel_spin`; result becomes `practice_area_codes`. Battle intro (`BattleIntroScreen` L1092055): "Calling up the challengers", "PLAYERS LOCKED IN", "ALL PLAYERS ACCEPTED", "Enter battle", loads profiles/school crests/ranks (`/stats/practice-areas/`), then `/session/<id>`. Never fabricates opponents ("Not enough real players yet"). `fabricated-battle-royale` is a lab (combo multiplier helpers `comboMultiplier`/`formatMultiplier` L1160421: dev preview).
- In-battle (`/session/[id]` with `exam_type=battle`; `Session` L1336993 + L1352000-1357600): countdown "GET READY", per-question timer, answer submit, "Correct/Incorrect/Time's up  - +N", "STANDINGS", emotes/taunts (`BATTLE_REACTIONS`, `TAUNT_LINES`, `emote` WS event), "Quick break" interstitial between questions, streak "N IN A ROW"/"ON FIRE!", final "FINAL RESULTS", leave confirm. Points = `gained` with `streak` and `speed_bonus` fields; formula SRV. Ties: faster player wins. 
- Rematch: no explicit "rematch" action found (OBS absence); players return to Versus / session history and re-queue; DM battle-invite cards (`battle_invite`) and Townhall invitations start new lobbies.
- Invites: DM card, Townhall post, group chat, in-app banner "Join battle" -> `/social/study/<id>`; errors `battle_lobby_full`, `battle_version_mismatch` (client sends `runtime_version`, `ui_version` = `clientVersions` L863226).

### 4.2 Rank ladder and seasons [OBS L1053330-1065000]
Tiers/stars/`RANK_CONFIG` as in the earlier addendum (not repeated). UI: `RankCrest`, `RankBadge`, `RankFrame`, `RankDrape`, `StarBar`, `ApexReadout`, `HarvestReadout`, `SeasonBanner`/`SeasonRibbon`, `RankUpReveal` (events `STAR_GAINED`, `STAR_LOST`, `APEX_POINTS`, `RANKUP`, `RANKDOWN`); labels "Unranked", "Climbing the leaderboard", "Beat half, earn a star". Client has `resolveMatchResult` and `runSeasonReset` helpers (L1053330+, mirror of rules; INF used for previews/optimistic UI); authoritative result and `season_index`, `peak_tier`, `rank_points`, `apex_points` come from server (SRV). Season = 90 days; "Awarded when First Spring ends; Apex then resets to Student I".
Rewards: crest + trophy shelf (best tier per season) and rank-up reveal; no spendable currency (confirmed earlier).

### 4.3 Streak
- Chip -> `/streak` (`StreakScreen` L1424047): month calendar from `/streak/calendar/?month=` (`useStreakCalendar`), `hasActivity(day)` marks, "N day streak", close X, month back/forward.
- `StreakCelebration` (L1350683): shown at most once per **Manila day** (storage key `streak_celebration_last_manila_day`; day computed with `Intl.DateTimeFormat('en-PH'/Asia/Manila)` L1022391, L1128058). Variants (`streakVariant`): `started` (streak <= 1), `milestone` (streak hits a milestone multiple; line "N days strong. That is a real habit."), else `extended`; Cleo says "Keep it going". Dismiss: tap. After first session may ask store review (`first_session_review_prompted`).
- Streak freeze/repair/protect: none found (OBS absence). Streak counting rule is SRV.

### 4.4 Daily goal (`/daily-goal`, L1128271)
GET `/stats/daily-goal/`: ring "X / Y questions today", "Goal reached. Nice work.", "N questions to go", days until exam, "Questions solved", "Topics mastered"; no exam date -> "Set your exam date to get a goal tailored..." with "Go to profile" -> `/townhall?tab=profile`. Goal size SRV. Insight cards "Recovery mode / Needs reinforcement / Almost there / Board-ready momentum" (mapping from accuracy; SRV or INF).

### 4.5 Energy / lives
Chip "X of Y energy" (free tier cap, regen via `nextRegenAt`); 0 energy -> `out_of_energy_modal` ("Get Tangerine+" / "Quit session"); settings shows "Sessions / day". No hearts or lives concept (OBS absence).

### 4.6 Badges, stickers, crests
Rank crests (4 art sets: student, scholar, topnotcher, toprank under `/assets/assets/crests`), PNLE badge (roster), school crest, Tangerine stickers (DM picker, cosmetic), emotes in battles, showcase photos. No achievement badge catalogue found.

### 4.7 Notification types (client-known) [OBS L986932, L984995+]
Inbox kinds: friend_request, friend_accept, townhall_like, townhall_comment, group_join_request, group_join_approved, battle_invite (Join battle), message request, group_message, dm, announcement, offer/promo, lifecycle (study/energy/streak reminders), account/critical/transactional. Push categories and triggers (e.g. streak reminder time, energy full) are produced by the server (SRV); client only maps types to routes (section 1.1 allowlist).

## 5. Real-time layer

| Socket | Path | Used by | Events handled (OBS) |
|---|---|---|---|
| Social hub | `/ws/social/` (L985033, 1046044, 1059466, 1082855, 1371848) | NotificationCenter, Townhall Messages, Friends, IncomingCallBanner, ChatCall | `invite_created`, `invite_changed`, `dm_changed`, `dm_read`, `friend_request_created`, `friendship_changed`, `group_join_request_created`, `group_message`, `group_read`, `incoming_call`, `call_changed`, `background_camera` (call), `pong` |
| DM | `/ws/dm/<userId>/` (L1375113) | DM thread | message, `typing`, `reaction`, `reactions`, `message_deleted`, `read_receipt`/`read_at` |
| Group | `/ws/groups/<id>/` (L1387102) | Group thread | `message`, `typing`, `reaction`, `reactions`, `message_deleted`, `member_joined`, `member_removed`, `group_updated` |
| Study/battle | `/ws/study/<id>/` (L864389, 1357556, 1407528, 1415541) | lobby, battle, results | `open_versus`, `match_absorbed`, `match_version_block`, `session_cancelled`, `lobby_message`, `ready`, `question_revealed`, `question_advanced`, `answer_submitted`, `emote`, `session_ended`, `completed`/`cancelled`, `pong`; payload fields `players`, `is_me`, `answered_current`, `server_now` (clock sync), `finished` |

Connection details [OBS L863226-864470]:
- URL: API base with `http`->`ws` replacement + path + `?token=<access token>` (query auth; `createAuthenticatedSocialSocket`). Social hub is a **shared singleton** (`connectSharedSocialSocket`, `subscribeSocialSocket`, ref-counted subscribers; closes 1000 "no subscribers" after an idle timer); `/ws/study/` paths are also routed through the same hub (idle-close check `startsWith('/ws/study/')`).
- Heartbeat: client sends `{type:'ping'}`; waits for `pong`; on timeout closes with code 4000 "pong timeout" (also 4000 "heartbeat send failed"). Battle constants: `BATTLE_HEARTBEAT_MS 3000`, `BATTLE_HEARTBEAT_TIMEOUT_MS 6000`, `BATTLE_PRESENCE_TIMEOUT_MS 12000`, `SOCKET_HEALTHY_FALLBACK_MS 10000`, `SOCKET_DOWN_FALLBACK_MS 2000` (L1358857-1359110): when the socket is healthy REST polling falls back every 10 s, when down every 2 s.
- Reconnect: `scheduleSocialSocketReconnect` with `wsReconnectDelay(attempt) = min(MAX, BASE * 2^attempt) * (0.7 + 0.6*random)` (exponential backoff with +-30% jitter; BASE/MAX constants not isolated). Normal closes (1000, 1005) are not logged; abnormal ones log `social websocket closed abnormally (code)` as warning (rate-limited). Subscribers get `onResync` after a reconnect (`useGroupSocket` L1048266, INF refetch). Frames are JSON with a string `type` (`parseSocialFrame` drops others). Server validity of frames/permissions is SRV.
- Other stream: `connectWebhookStream` `/v1/webhooks/stream/` (SSE-style, not a social socket).

## 6. Not found / limits
- Language selector, dark-mode toggle, reminders/quiet hours, delete account UI, linked-accounts UI, global/friend/school leaderboard lists, streak freeze, rematch button, haptics-only toggle: not present in code (OBS absence; may be server-flagged or in unscanned strings).
- Exact notification preference keys, push trigger rules, streak/milestone thresholds, battle point formulas, matchmaking pairing, rank math and Hall of Fame membership are server-side.
