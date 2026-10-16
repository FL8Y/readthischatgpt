# AnkiDroid 2.25.1 (com.ichi2.anki): Android-layer addendum

Method: regex over class descriptors (`Lpkg/Name;`) in the three dex string tables, the decoded manifest, decoded `res/values|xml`, and `strings` over the dex files. OBSERVED means a class, string or manifest literal is present. INFERRED means deduced from names and context.
Caveat (OBSERVED): the build is R8-minified. Manifest-registered components and some UI classes keep real names. Many others (`com/ichi2/anki/a..u`, `dialogs/a..z`, `widget/a`) are single-letter, so function mapping for them is INFERRED.
Version (OBSERVED, apktool.yml): versionName 2.25.1, versionCode 322501300, compileSdk 36. Native lib: arm64-v8a `librsdroid.so` (Rust Anki backend) and `libandroidx.graphics.path.so`.

## 1. First-party package structure (OBSERVED descriptors; 339 `com/ichi2/**` descriptors, 316 without inner classes)

| Package | Count | Real names retained (examples) | Role |
|---|---|---|---|
| `com.ichi2.anki` (root) | 39 | AnkiDroidApp, IntentHandler, IntentHandler2, DeckPicker, StudyOptionsActivity, Reviewer, CardBrowser, NoteEditorActivity, FieldEditText, CardTemplateEditor, CardTemplateBrowserAppearanceEditor, NoteTypeFieldEditor, Info, IntroductionActivity, SingleFragmentActivity, AnkiActivity, SyncActionProvider | Main screens |
| `anki.databinding` | 49 | `*Binding` (view binding) | Layout bindings |
| `anki.dialogs` | 38 | ChangeNoteTypeDialog, EmptyCardsDialogFragment, ImportFileSelectionFragment, InsertFieldDialog, SaveBrowserSearchDialogFragment, SavedBrowserSearchesDialogFragment, TtsVoicesDialogFragment, LoadingDialogFragment (+ a..z obfuscated) | Dialogs |
| `anki.ui` | 30 | BottomFadeFrameLayout, RecyclerFastScroller, ResizingDivider; manifest also shows `ui.windows.managespace.ManageSpaceActivity` and `ui.windows.permissions.{PermissionsActivity, AllPermissionsExplanationActivity}` | UI widgets, permission screens |
| `anki.preferences` | 24 | PreferencesActivity + 17 settings fragments (see section 9) | Settings |
| `anki.browser` | 20 | CardBrowserFragment, BrowserColumnCollection, BrowserColumnSelectionFragment, ColumnSelectionDialogFragment, FindAndReplaceDialogFragment, RepositionCardFragment, SortChangeNotification, CardOrNoteId | Card browser |
| `com.ichi2.preferences` | 12 | NumberRangePreferenceCompat, SliderPreference, ControlPreference, ReviewerControlPreference, WhiteboardControlPreference, HtmlHelpPreference, VersatileTextPreference | Custom preference widgets |
| `com.ichi2.ui` | 9 | CardBrowserSearchView, AccessibleSearchView, CheckBoxTriStates, GestureDisplay, AxisValueDisplay, FixedEditText, TextInputEditField | Custom views |
| `anki.settings` | 8 | PrefsRepository | Prefs repository |
| `anki.exception` | 8 | (mostly obfuscated) | Exceptions |
| `anki.multimedia` | 7 | MultimediaActivity, MultimediaFragment, MultimediaImageFragment, AudioRecordingFragment, AudioVideoFragment | Add image/audio/video to fields |
| `anki.libanki` | 6 | CardOrdinal, DeckId, NotetypeJson | Thin model types; the engine is the Rust backend |
| `com.ichi2.widget` (+`deckpicker`, `cardanalysis`) | 11 + 2 + 2 | AnkiDroidWidgetSmall, AddNoteWidget, DayRolloverAlarm, WidgetPermissionReceiver, DeckPickerWidget(+Config), CardAnalysisWidget(+Config) | Home-screen widgets |
| `anki.pages` | 5 | PageFragment, CardInfoFragment, ImageOcclusion, AnkiPackageImporterFragment, RemoveAccountFragment | WebView pages hosting the Svelte/TS UI |
| `anki.previewer` | 4 | CardViewerActivity, CardViewerFragment, PreviewerFragment, TemplatePreviewerFragment | Card/template preview |
| `anki.deckpicker` | 4 | DeckDeletionResult, EmptyCardsResult, OptionsMenuState, ShortcutData | Deck list state |
| `anki.services` | 3 | BootService, NotificationService, SnoozeService | Reminders |
| `anki.reviewreminders` | 3 | ReviewReminder, ScheduleRemindersFragment, ReminderTroubleshootingFragment | Scheduled review reminders |
| `anki.analytics` | 3 | AnkiDroidCrashReportDialog, AcraAnalyticsInteraction, AnalyticsDialogFragment | Crash/analytics UI |
| `anki.account` | 3 | AccountActivity, LoginFragment, LoggedInFragment | AnkiWeb login |
| `anki.shareddeck` | 3 | SharedDecksActivity, SharedDecksDownloadFragment, SharedDecksDownloadUiState | Shared decks browser/download |
| `anki.snackbar` | 3 | (UI helpers) | Snackbars |
| `anki.worker` | 2 | SyncWorker, SyncMediaWorker | WorkManager sync jobs |
| `anki.notetype` | 2 | ManageNotetypes, NoteTypeItemState | Note type manager |
| `anki.scheduling` | 2 | SetDueDateDialog | Set due date |
| `anki.receiver` | 2 | CopyToClipboardReceiver, SdCardReceiver | Receivers |
| `anki.cardviewer` | 2 | Gesture, MediaException | Reviewer gestures |
| `anki.provider` | 1 | CardContentProvider | Public API provider |
| `anki.noteeditor` | 1 | Toolbar | Editor toolbar |
| `anki.instantnoteeditor` | 1 | InstantNoteEditorActivity | Quick card from shared text |
| `anki.filtered` | 1 | FilteredDeckOptionsFragment | Filtered deck options |
| `anki.mediacheck` | 1 | MediaCheckFragment | Check media |
| `anki.export` | 1 | ExportDialogFragment | Export |
| `anki.security` | 1 | DangerousJsPermissionDeniedException | JS API permission |
| others | 1-2 each | workarounds(2), utils(2), common(2), model(1), introduction(1) | Misc |

Backend and third-party packages (OBSERVED descriptors):
- `net.ankiweb.rsdroid` (40): Backend, BackendException, NativeMethods. This is the JNI bridge to the Rust core in `librsdroid.so`.
- `anki.*` protobuf messages (448 descriptors): scheduler 74, stats 54, notetypes 34, search 34, decks 30, card_rendering 28, deck_config 28, import_export 26, collection 23, image_occlusion 20, config 18, sync 8, ankiweb 5, ankihub 3. This is the whole collection engine's RPC surface: scheduling, search, import/export, sync, stats and image occlusion all run in Rust.
- `anki.ankidroid.*` requests: GetNextResultPageRequest, SchedTimingTodayLegacyRequest, DebugActiveDatabaseSequenceNumbersResponse. This is a DB-access RPC for AnkiDroid-specific database calls.
- `fi.iki.elonen.NanoHTTPD`: an embedded local HTTP server.
- `org.acra` (about 50 classes): crash reporting. `leakcanary` (12) plus `shark` (2).
- `androidx.media3.exoplayer`, `androidx.work`, `androidx.room`, `androidx.compose` (UI/runtime), `com.canhub.cropper`, `com.google.protobuf`, `org.chromium.support_lib_boundary` (WebView compat), and `j$.*` (desugared java.time/nio).

## 2. Manifest summary: launcher, components and intent filters (all OBSERVED)

Application flags: `allowBackup=true`, `largeHeap`, `hasFragileUserData=true`, `requestLegacyExternalStorage` and `preserveLegacyExternalStorage`, `usesCleartextTraffic=true`, and a networkSecurityConfig that permits cleartext and trusts both system and user CAs. `manageSpaceActivity=ManageSpaceActivity`. `debuggable` is not set.

| Component | Exported | Intent filters / notes |
|---|---|---|
| `IntentHandler` | yes | LAUNCHER and MULTIWINDOW_LAUNCHER. This is the single entry point and a translucent trampoline (INFERRED). It also handles VIEW for `.apkg`, `.colpkg`, `.tsv`, `.csv` and `.txt` over http, https, content and file. VIEW and SEND handle mime types apkg, colpkg, `application/vnd.anki`, octet-stream, tsv, csv and text/plain. |
| `CardBrowserDeepLink` (alias to IntentHandler) | yes | VIEW, BROWSABLE, `anki://x-callback-url/browser`. |
| `IntentHandler2` | yes | `org.openintents.action.CREATE_FLASHCARD`; SEND `text/plain`; SEND and VIEW for images (jpg, png, webp, gif, svg, tiff, ico). It opens the note editor with the shared content (INFERRED). |
| `AnkiCardContextMenuAction` (alias, enabled) | yes | PROCESS_TEXT `text/plain`. The "Anki card" entry in the text-selection menu. |
| `CardBrowserContextMenuAction` (alias, disabled by default) | yes | PROCESS_TEXT. A card browser search on selected text (INFERRED). |
| `Reviewer` | yes | VIEW and DEFAULT with no data filter (programmatic entry from shortcuts, widgets or other apps). Parent is DeckPicker. |
| `InstantNoteEditorActivity` | yes | SEND `text/plain`; singleInstance. "Instant card". |
| `DeckPicker`, `StudyOptionsActivity`, `CardBrowser`, `NoteEditorActivity`, `ManageNotetypes`, `NoteTypeFieldEditor`, `CardTemplateEditor`, `CardTemplateBrowserAppearanceEditor`, `AccountActivity`, `MultimediaActivity`, `PreferencesActivity`, `Info`, `IntroductionActivity`, `SharedDecksActivity`, `CardViewerActivity`, `SingleFragmentActivity` | no | Internal screens. |
| `AllPermissionsExplanationActivity` | yes | Guarded by `START_VIEW_PERMISSION_USAGE`; handles VIEW_PERMISSION_USAGE (Android privacy dashboard rationale). |
| `CropImageActivity` | yes | From the canhub cropper library. |
| `CardContentProvider` | yes | Authority `com.ichi2.anki.flashcards`, meta `provider.spec=2`. This is the AnkiDroid public API, guarded by the custom `READ_WRITE_DATABASE` permission (protectionLevel dangerous). |
| FileProviders | no | `apkgfileprovider` (export sharing), `cropper.fileprovider`, `acra` content provider, LeakCanary file provider. |
| `SdCardReceiver` | yes | `MEDIA_MOUNTED` and `MEDIA_EJECT` (scheme file), plus internal `com.ichi2.anki.action.MEDIA_MOUNT` and `MEDIA_EJECT` actions. |
| `BootService` | no | `BOOT_COMPLETED`. |
| `NotificationService`, `SnoozeService` | no | Alarm and notification receivers. |
| `DayRolloverAlarm` | no | `TIMEZONE_CHANGED` and `TIME_SET`. |
| `CopyToClipboardReceiver`, `WidgetPermissionReceiver` | no | Internal. |

Deep links and external entry points (OBSERVED): `anki://x-callback-url/browser`, VIEW on `*.apkg|colpkg|tsv|csv|txt`, `org.openintents.action.CREATE_FLASHCARD`, and PROCESS_TEXT and SEND for text and images. Other strings: `com.ichi2.anki.DO_SYNC`, `com.ichi2.anki.COPY_DEBUG_INFO`.

Package-visibility `<queries>` (OBSERVED): TTS_SERVICE, VIEW https and http (browsable), PROCESS_TEXT, `android.speech.RecognitionService`, GET_CONTENT `*/*`, `IMAGE_CAPTURE`, plus others.

## 3. Permissions and why

| Permission | Evidence and likely purpose |
|---|---|
| INTERNET, ACCESS_NETWORK_STATE | OBSERVED. AnkiWeb sync, shared decks WebView, media download, ACRA upload. The network-state check is INFERRED to support the "metered network" check; JS API has `ankiIsActiveNetworkMetered`. |
| RECORD_AUDIO, MODIFY_AUDIO_SETTINGS, uses-feature microphone (required=false) | OBSERVED. `AudioRecordingFragment`, strings "MediaRecorder started in wrong state", "AudioRecorder::startRecording", `SpeechRecognizer` and `RECOGNIZE_SPEECH`. Used for voice notes in fields and speech input. |
| POST_NOTIFICATIONS | OBSERVED. Review reminders, deck due notifications, sync and media-sync progress notifications (strings "SyncMediaWorker: showing failure notification"). |
| RECEIVE_BOOT_COMPLETED | OBSERVED. `BootService` re-arms alarms (INFERRED). |
| FOREGROUND_SERVICE, FOREGROUND_SERVICE_DATA_SYNC | OBSERVED. WorkManager `SystemForegroundService` declared with type dataSync. Used for long media sync (INFERRED). |
| WAKE_LOCK | OBSERVED. WorkManager and media playback. |
| VIBRATE | OBSERVED. Haptics (INFERRED, gesture or timer feedback). |
| READ/WRITE_EXTERNAL_STORAGE (+ requestLegacyExternalStorage) | OBSERVED. Legacy shared-storage collection path and import and export. |
| GET_PACKAGE_SIZE (maxSdk 25) | OBSERVED. Legacy storage-size computation. |
| `com.ichi2.anki.permission.READ_WRITE_DATABASE` (declared + used) | OBSERVED. Gate for third-party apps using `CardContentProvider`. |
| `com.ichi2.anki.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION` (signature) | OBSERVED. Added by androidx for non-exported dynamic receivers. |
| uses-feature `app_widgets`, `audio.output`, `draganddrop` (all optional) | OBSERVED. |

## 4. Main screens and what each does (names OBSERVED; behaviour INFERRED from names, resources and strings)

- **IntroductionActivity** shows first-run onboarding and a choice to sync or start fresh (INFERRED).
- **DeckPicker** (`Theme_Dark.Launcher`) is the home screen. It lists decks with new, learn and due counts. It offers sync (SyncActionProvider, `SyncWorker`), import (ImportFileSelectionFragment), check database, check media (MediaCheckFragment), empty cards (EmptyCardsDialogFragment), deck delete (DeckDeletionResult), create filtered deck, shortcuts (ShortcutData) and a navigation drawer. On a tablet it embeds StudyOptions as a side fragment (INFERRED, since StudyOptionsState is a state class).
- **StudyOptionsActivity** is the deck overview. It shows counts and has a Study button, deck options (a WebView page via `anki.pages`) and custom study.
- **Reviewer** is the study screen (section 5).
- **CardBrowser** (section 6), **NoteEditorActivity** (section 7), **ManageNotetypes** with **NoteTypeFieldEditor**, **CardTemplateEditor** and **CardTemplateBrowserAppearanceEditor** (section 8).
- **AccountActivity** handles AnkiWeb login and logout (section 11). **PreferencesActivity** holds settings. **Info** is the About screen. **SharedDecksActivity** is a WebView of `https://ankiweb.net/decks` with a download manager (SharedDecksDownloadFragment); download then opens as an `.apkg` import.
- **MultimediaActivity** attaches images (with cropper and camera `IMAGE_CAPTURE`), audio (record) and video to note fields.
- **ManageSpaceActivity** and **PermissionsActivity** cover storage management and permission rationales.
- **anki.pages.PageFragment** hosts the SvelteKit web UI bundled in `assets/backend/sveltekit`: statistics, card info (CardInfoFragment), image occlusion, deck options, the new importer (AnkiPackageImporterFragment) and RemoveAccount (RemoveAccountFragment).

## 5. Reviewer flow (card rendering)

Assets (OBSERVED, `assets/`): `card_template.html`, `flashcard.css` (2.8 KB), `ankidroid.css` (261 B), `mathjax/mathjax.css`, `scripts/{card.js, js-api.js, ankidroid-reviewer.js, ankidroid-cardviewer.js}`, `backend/css/{reviewer.css, reviewer_extras.css, root-vars.css}`, `backend/js/{jquery.min.js, mathjax.js, reviewer.js, reviewer_extras_bundle.js, vendor/}`, and `README.md` (jQuery 3.5.1, MathJax 3.1.2).

`card_template.html` (OBSERVED, a skeleton with `::style::`, `::script::`, `::class::` and `::content::` placeholders):
- `<html class="mobile android linux js">`, title "AnkiDroid Flashcard".
- Loads `file:///android_asset/flashcard.css`, `mathjax/mathjax.css` and `backend/css/reviewer_extras.css`.
- Loads `backend/js/jquery.min.js`, `scripts/card.js`, `scripts/js-api.js` and `backend/js/reviewer_extras_bundle.js`.
- The body is `<div id="content" dir="auto">::content::</div>`.

Flow (INFERRED from these parts, with literals noted):
1. `Reviewer` (WebView activity) asks the Rust backend over `net.ankiweb.rsdroid.Backend` for the next queued card and its rendered question and answer HTML (protobuf `anki.card_rendering`, `anki.scheduler`).
2. Kotlin injects the HTML, the note type CSS and the CSS class into the template placeholders. The template loads from `file:///android_asset`.
3. A show-answer click or gesture reveals the answer. `ankidroid-reviewer.js` contains `showAnswer`, `buttonAnswerEase`, `getScrollDirection`, `isInteractable`, `isTextInput`, `isTextSelected`, `taFocus`, `onResize`, `reloadPage` and `localRequest`.
4. An answer button sends the ease. The backend reschedules (FSRS and SM-2 are in the Rust core, protobuf `scheduler` and `deck_config`; INFERRED), and the next card loads.
5. Media (`<img>`, audio and video tags, `[sound:]`) is resolved by the embedded NanoHTTPD server on 127.0.0.1 (INFERRED from the strings), with ExoPlayer/media3 for audio (see section 12). The server's route prefixes are `/_anki/` (shared assets, for example `/_anki/js/vendor/mathjax`), `/_app/` (SvelteKit chunks), `/ankidroid/` and `/jsapi/` (OBSERVED strings).
6. Note types can add a "type in the answer" box (`#typeans`, styled in ankidroid.css with Noto Sans Mono). A whiteboard overlay is stored per deck in the `whiteboardState` table via MetaDB (OBSERVED SQL strings).
7. Gestures (`cardviewer.Gesture`, `ui.GestureDisplay`), an optional proximity or shake sensor (INFERRED from the `SensorEventListener` reference), and custom buttons and controls (preferences: ControlsSettingsFragment, CustomButtonsSettingsFragment, ReviewerOptionsFragment, "New study screen") drive the study screen.

JS API for card scripts (OBSERVED in `js-api.js`, version 0.0.3, calls `/jsapi/<endpoint>`):
- Card info: `ankiGetCardId|Nid|Did|Type|Queue|Due|Interval|Factor|Reps|Lapses|Mod|Left|ODid|ODue`, `ankiGetNextTime1..4`, `ankiGetNew|Lrn|RevCardCount`, `ankiGetETA`, `ankiGetCardMark`, `ankiGetCardFlag`, `ankiGetDeckName`.
- State: `ankiIsInFullscreen`, `ankiIsTopbarShown`, `ankiIsInNightMode`, `ankiIsDisplayingAnswer`, `ankiIsActiveNetworkMetered`.
- Actions: `ankiBuryCard|Note`, `ankiSuspendCard|Note`, `ankiAddTagToCard`, `ankiResetProgress`, `ankiMarkCard`, `ankiToggleFlag`, `ankiSearchCard(+WithCallback)`, `ankiSetCardDue`, `ankiShowNavigationDrawer`, `ankiShowOptionsMenu`, `ankiShowToast`, and scrollbar toggles.
- Text-to-speech: `ankiTtsSpeak|SetLanguage|SetPitch|SetSpeechRate|IsSpeaking|Stop`, `ankiTtsFieldModifierIsAvailable`.
- `security.DangerousJsPermissionDeniedException` (OBSERVED) indicates that the sensitive calls are gated by a per-note-type or user opt-in (INFERRED).

`CardViewerActivity`/`CardViewerFragment`/`PreviewerFragment`/`TemplatePreviewerFragment` reuse `ankidroid-cardviewer.js` for read-only previews (from the browser or the template editor).

## 6. Card browser (OBSERVED classes)

`CardBrowser` (plus `CardBrowserFragment`) shows a list of cards or notes (`CardOrNoteId`). It has a search view (CardBrowserSearchView) and saved searches (SaveBrowserSearchDialogFragment, SavedBrowserSearchesDialogFragment). Columns are configurable (BrowserColumnCollection, BrowserColumnSelectionFragment) and sorting is persisted (SortChangeNotification). Bulk operations (INFERRED from the class names): find and replace (FindAndReplaceDialogFragment), reposition (RepositionCardFragment), set due date (SetDueDateDialog), change note type (ChangeNoteTypeDialog), export, tag, flag, suspend, delete and move. A card or note can be opened in the editor, and in a tablet layout the editor or previewer sits beside the list (INFERRED). `CardBrowserContextMenuAction` (disabled alias) lets other apps send selected text as a search.

## 7. Note editor (OBSERVED classes)

`NoteEditorActivity` hosts the editor. Its field-editing widgets are `FieldEditText` and the `noteeditor.Toolbar` (formatting buttons, cloze, custom toolbar buttons). Other pieces: `InsertFieldDialog`, `ChangeNoteTypeDialog`, and multimedia attachments via `MultimediaActivity`/`MultimediaImageFragment`/`AudioRecordingFragment`/`AudioVideoFragment`. Entry points: the DeckPicker add button, `IntentHandler2` (CREATE_FLASHCARD, SEND text and images), the `AddNoteWidget`, and `AnkiCardContextMenuAction` (PROCESS_TEXT). `InstantNoteEditorActivity` is a lightweight overlay for creating a cloze or basic card from shared text (INFERRED).

## 8. Note types and templates (OBSERVED classes)

- `ManageNotetypes` lists note types (`NoteTypeItemState`): add, rename, delete, clone.
- `NoteTypeFieldEditor` handles fields (add, reorder, rename, sort field).
- `CardTemplateEditor` edits front, back and styling.
- `CardTemplateBrowserAppearanceEditor` edits the browser question and answer format.
- `TemplatePreviewerFragment` previews the result.
- `libanki.NotetypeJson` holds the JSON model; the protobuf `anki.notetypes` (34 types) is the backend interface.

## 9. Preferences (OBSERVED fragments and XML)

`PreferencesActivity` is split into the following fragments, with matching `res/xml/preferences_*.xml` files: General, Reviewer options ("New study screen"), Reviewing, Sync, Notifications, Review reminders (`ScheduleRemindersFragment`, `ReminderTroubleshootingFragment`), Appearance, Switch profile (`preferences.profiles.SwitchProfilesFragment`), Controls (`ControlsSettingsFragment`/`ControlsTabPreference`, reviewer and previewer controls), Accessibility, Backup limits, Advanced, Custom buttons, Custom sync server, Developer options, About. The `pref_cat_*` strings include Plugins, Workarounds, Whiteboard, Security, Gestures and System-wide (OBSERVED). `PrefsRepository` (in `anki.settings`) wraps SharedPreferences (INFERRED).

## 10. Widgets (OBSERVED manifest and `res/xml/widget_provider_*.xml`)

| Widget | Class | Behaviour |
|---|---|---|
| AnkiDroid small | `AnkiDroidWidgetSmall` (+ inner `UpdateService`) | Compact home-screen widget (40dp). `updatePeriodMillis` is 3600000 (1 h). Shows the due count (INFERRED) and opens the app. |
| Add note | `AddNoteWidget` | 40dp quick-action button. No periodic update. Opens the note editor (INFERRED). |
| Deck Picker | `DeckPickerWidget` + `DeckPickerWidgetConfig` | Resizable widget (120x50dp minimum) with a configure activity to choose decks. Shows deck due counts and starts review (INFERRED). |
| Card Analysis | `CardAnalysisWidget` + `CardAnalysisWidgetConfig` | Resizable (84x56dp minimum) widget with configure activity. Shows information about the current or next card (INFERRED from the label "Card Analysis"). |

Support classes: `WidgetPermissionReceiver` (internal), `DayRolloverAlarm` (updates widgets and counts when the day rolls over or the clock and timezone change; INFERRED, since only TIME_SET and TIMEZONE_CHANGED are registered).

## 11. Notifications, reminders, boot and day rollover

- `BootService` (BOOT_COMPLETED) re-schedules deck-due and review reminder alarms (INFERRED).
- `NotificationService` (non-exported receiver) posts the due-cards notification. `SnoozeService` handles the notification Snooze action (INFERRED from the names).
- `reviewreminders.ReviewReminder` is a per-deck scheduled reminder, configured in settings (`ScheduleRemindersFragment`); `ReminderTroubleshootingFragment` helps with battery or permission issues. The string key `reminderNotifsRequestShown` records that the notification permission prompt has been shown (OBSERVED).
- `DayRolloverAlarm` is a receiver on TIME_SET and TIMEZONE_CHANGED (OBSERVED). It refreshes widgets and recomputes the next rollover (INFERRED).
- `SyncMediaWorker` posts progress and failure notifications (OBSERVED strings) and uses a dataSync foreground service. `SyncWorker` is the collection sync job.
- WorkManager (`androidx.work`) with the system job service. The system alarm service is disabled (OBSERVED bool).

## 12. AnkiWeb sync and account

- Classes (OBSERVED): `account.AccountActivity`, `LoginFragment`, `LoggedInFragment`, `pages.RemoveAccountFragment`, `worker.SyncWorker`, `worker.SyncMediaWorker`, `preferences.SyncSettingsFragment`, `CustomSyncServerSettingsFragment` (custom sync URL and certificate: strings `getCustomSyncUri()`, `getCustomSyncCertificate()`), `SyncActionProvider` (toolbar sync button).
- The backend protocol is in Rust. Protobuf `anki.sync` (8 types) and `anki.ankiweb` (5 types) are present. Related strings: `clearHkey`, `syncMedia`, `FullSync`, `Progress$FullSync`, `BackendSyncAuthFailedException`, `DIALOG_MEDIA_SYNC_ERROR`, and `com.ichi2.anki.DO_SYNC`.
- URLs (OBSERVED): `https://ankiweb.net`, `/account/login?afterAuth=1`, `/account/verify-email`, `/decks`.
- INFERRED flow: login sends the credentials to AnkiWeb through the backend and stores the returned host key (hkey) in preferences. A normal sync is incremental. A full sync (upload or download) is offered on a schema conflict. Media sync runs separately in a worker.
- `anki.ankihub` protobuf (3 types) is present, but no AnkiHub UI class was found in the retained names.
- Clear-text traffic is allowed and user CAs are trusted by the network security config (OBSERVED). This is needed for self-hosted sync servers (INFERRED).

## 13. Crash reporting, analytics and LeakCanary in this build

- ACRA (OBSERVED): `org.acra.*` is bundled with `CrashReportDialog` and `AnkiDroidCrashReportDialog` in a separate `:acra` process, `JobSenderService` (enabled), `LegacySenderService` (disabled), and `AcraContentProvider`. Strings: "ACRA Crash Handler", "ACRA handling crash, sending analytics exception report", "ACRA-approved/unapproved", "ACRA-limiter.json", and the report URL `https://ankidroid.org/acra/report`. The reports are user-confirmed through a dialog (INFERRED from the dialog class and the approved/unapproved files).
- `AcraAnalyticsInteraction` and `AnalyticsDialogFragment` handle analytics consent (INFERRED). Usage events are strings like `OPENED_DONATE`, `OPENED_ANKI_FORUMS`, `OPENED_REDDIT` (OBSERVED). No Firebase or Google Analytics class prefix appears in the top package list (a `com/google/android` count of 86 is mostly framework/material; not examined further).
- LeakCanary (OBSERVED): `leakcanary.internal.*` (12 descriptors), `shark.*` and the manifest entries `LeakActivity`, `LeakCanaryFileProvider`, `NotificationReceiver`, `RequestPermissionActivity`, `MainProcessAppWatcherInstaller` (`leakcanary-installer`) and `PlumberInstaller`. Resource bools: `leak_canary_allow_in_non_debuggable_build=true`, `leak_canary_plumber_auto_install=true`, `leak_canary_add_launcher_icon=false`. Also `jacoco-agent.properties` is in the APK (`output=none`, so coverage is off).
- Together these indicate a build with developer tooling kept in (INFERRED: a debug-like or CI flavor). Observed side effects: a LeakCanary exported launcher-like activity and a VIEW filter for `*.hprof` files. These would normally be absent from a Play Store release build.

## 14. TTS, audio recording and multimedia

- TTS (OBSERVED): `android.speech.tts.TextToSpeech` and `UtteranceProgressListener` (INFERRED from the SDK use), a manifest query for `TTS_SERVICE`, `TtsVoicesDialogFragment` (browse and test voices, filter by "Install" or "Internet"), and strings "Language not supported / Change engine / Voice options". The preference `tts` ("Reads out question and answer if no sound file is included") and the JS API `ankiTts*` calls are present. Card-template `{{tts ...}}` tags go through the Rust `card_rendering` module (INFERRED).
- Playback (OBSERVED): `androidx.media3.exoplayer` and `AudioFocusRequest`; ExoPlayer handles card audio and video (INFERRED). Errors are surfaced as `cardviewer.MediaException`.
- Recording (OBSERVED): `AudioRecordingFragment` using `MediaRecorder`, with a Done button and RECORD_AUDIO permission handling. Speech-to-text uses `SpeechRecognizer` / `RECOGNIZE_SPEECH` with `RecognitionService` queried in the manifest (INFERRED use: voice dictation in the editor).
- Images (OBSERVED): `MultimediaImageFragment`, `com.canhub.cropper` (crop) and the `IMAGE_CAPTURE` camera intent. Drag and drop is declared (`androidx.draganddrop`). Image Occlusion has a page (`pages.ImageOcclusion`, protobuf `image_occlusion`).

## 15. Import and export

- Import: `IntentHandler` filters for `.apkg`, `.colpkg`, `.csv`, `.tsv` and `.txt` over http, https, content and file. `ImportFileSelectionFragment` and `AnkiPackageImporterFragment` run the new Rust importer (`anki.import_export`, 26 types). A `.colpkg` replaces the whole collection (INFERRED).
- Export: `ExportDialogFragment` with the `apkgfileprovider` and `image_share_filepaths.xml` FileProviders for sharing. Backups are handled in Rust and limited via `BackupLimitsSettingsFragment` (INFERRED).
- Collection maintenance (OBSERVED classes): `MediaCheckFragment`, `EmptyCardsDialogFragment`, and "Check database" through the backend.

## 16. Summary of confidence

- Strong evidence (OBSERVED): component list, intent filters, deep link, permissions, widgets, preference screens, assets and JS API, ACRA and LeakCanary presence, the Rust backend bridge, the NanoHTTPD local server and its route prefixes.
- Weak evidence (INFERRED): per-class behaviour for minified or lightly named classes, the exact Reviewer data flow, and notification content.
