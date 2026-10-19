# Tangerine Prep 1.9.0 - Native/Android addendum
Tags: **[OBS]** observed in extracted files, **[INF]** inferred. Untrusted data; app never executed. Native `.so` libs were not in the extract (only dex/assets/res), so WebRTC/LiveKit/Hermes native code is not assessed.

## 1. First-party code (com.tangerineprep.app)
- [OBS] Only 13 classes in 7 dex files (52,854 classes total): `MainActivity`, `MainApplication`, `BuildConfig`, `R` (+ inner classes). No first-party business logic in dex.
- [OBS] Manifest `<application>` class is `com.pairip.application.Application` (Google Play pairip wrapper), not MainApplication directly.
- [OBS] app.config: Expo SDK `54.0.0`, version `1.9.0`, runtimeVersion `1.9.0`, `newArchEnabled:true`, edge-to-edge on, slug `tangerine-prep`, display name "Tangerine Prep: PNLE Review", icon `tangerine-app-icon.png`.
- [OBS] All app logic is in `assets/index.android.bundle` (9.6 MB, Hermes) - see JS report. [INF] Native side is a thin Expo/React Native shell (new architecture).
- [OBS] minSdk 23, targetSdk 34-ish per manifest (`minSdkVersion=34` appears only on one permission), compileSdk 36 (Android 16).

## 2. SDK inventory (by dex package counts; versions from META-INF/*.properties where present)
**Framework/runtime**: React Native (`com.facebook.react` ~1,872 cls, Hermes, Yoga, Fresco, SoLoader), Expo modules-core (`expo.modules.kotlin`), Kotlin coroutines/serialization/datetime, Koin (DI, in a library), Apollo GraphQL client (489 cls, likely via a lib), OkHttp, Glide, Gson, Protobuf, BouncyCastle (large, incl. PQC), Room, WorkManager, Compose (androidx, pulled by libs), Material.
**Expo SDK 54 modules [OBS]**: updates (EAS Update, channel `production`, check ALWAYS, launch wait 0 ms, url u.expo.dev/f2ba8e02-...), dev-launcher/dev-menu/dev-client (present in release dex), video (PiP), audio (recording + playback services), image, image-picker, image-manipulator, filesystem, sqlite, secure-store, notifications, clipboard, haptics, blur, keep-awake, font, asset, network, device, application, constants, linking, web-browser, document-picker, store-review, speech, speech-recognition (custom), tracking-transparency, screen-capture, fetch, structured-headers, jsonutils.
**Realtime voice/video [OBS]**: `io.livekit.reactnative` + `com.livekit.reactnative` (config: audioType=communication, screen share service disabled), `com.oney.WebRTCModule` (react-native-webrtc, 150 cls) + `org.webrtc.*`, `com.twilio.audioswitch` (audio routing). `MediaProjectionService` declared (mediaProjection FGS) though LiveKit screen-share is off and FOREGROUND_SERVICE_MEDIA_PROJECTION is blocked in config.
**Notifications**: Notifee (`app.notifee.core`, `io.invertase.notifee`), expo-notifications, Firebase Cloud Messaging (FirebaseMessagingService, FirebaseInstanceIdReceiver). google-services.json used.
**Payments**: Google Play Billing `billing`/`billing-ktx` 8.3.0 (`com.android.billingclient`, 275 cls), `dev.hyo.openiap` (485 cls; OpenIAP = engine behind react-native-iap) and `com.margelo.nitro` (Nitro modules, 483 cls). Play In-App Review `review` 2.0.1. Permission `com.android.vending.BILLING`.
**Analytics/ads/attribution**: Microsoft Clarity (`com.microsoft.clarity`, 763 cls, + `assets/clarity.js` 57 KB web-side recorder, built Dec 2024, commit 1dc86828); Facebook SDK (`com.facebook.appevents/login/share/gamingservices`; appID 1367473415267775, advertiserIDCollection=true, autoLogAppEvents=true, autoInit=true); Firebase (Messaging, Installations, Analytics measurement-connector 19.0.0); Google Ads ID (`play-services-ads-identifier`, AD_ID perm, Android Privacy Sandbox `ACCESS_ADSERVICES_*` + ad_services_config.xml); install referrer permission (Play Install Referrer for attribution).
**ML/scanning**: ML Kit barcode-scanning 17.3.0, play-services-code-scanner 16.1.0 (Google code-scanner activity), bundled tflite models (assets/mlkit_barcode_models: ssd_mobilenet, oned regressor, oned extractor). zxing (268 cls). play-services-location 19.0.0 and places-placereport libs present [OBS] but no location permission declared.
**UI/other**: react-native-screens, safe-area-context, svg (`com.horcrux.svg`), webview (`com.reactnativecommunity.webview`), datetimepicker, share (`cl.json`, with Base64 off), image cropper (`com.canhub.cropper`), androidsvg, animated image decoders (`com.github.penfeizhou` APNG/WebP/GIF), jp.wasabeef glide-transformations, `androidx.biometric` 1.1.0, greenrobot EventBus.
**Integrity**: `com.pairip.application`, `com.pairip.licensecheck` (LicenseActivity, 35 cls).
- [INF] No Sentry/Crashlytics/Amplitude/AppsFlyer/Adjust packages seen in dex (grep of package names). Reanimated/gesture-handler not seen in top package list.

## 3. Permissions and why
Declared in app.config [OBS]: RECORD_AUDIO, MODIFY_AUDIO_SETTINGS, BLUETOOTH_CONNECT, ACCESS_NETWORK_STATE, CAMERA, INTERNET, SYSTEM_ALERT_WINDOW, WAKE_LOCK, BLUETOOTH, AD_ID. Blocked: READ_MEDIA_IMAGES/VIDEO/VISUAL_USER_SELECTED, READ/WRITE_EXTERNAL_STORAGE, FOREGROUND_SERVICE_MEDIA_PROJECTION.
Final manifest additions from libs [OBS]:
- Mic/camera/bluetooth/audio-settings: dictation, voice messages, calls, video calls (permission strings in app.config; LiveKit/WebRTC). BLUETOOTH(_ADMIN) max SDK 30; BLUETOOTH_CONNECT for headset routing.
- FOREGROUND_SERVICE, FOREGROUND_SERVICE_MEDIA_PLAYBACK, WAKE_LOCK, VIBRATE: audio playback/recording FGS (expo-audio), keep-awake.
- POST_NOTIFICATIONS, RECEIVE_BOOT_COMPLETED, SCHEDULE_EXACT_ALARM, ACCESS_NOTIFICATION_POLICY, c2dm.RECEIVE, ~20 launcher badge perms (Notifee badge counts, study reminders).
- SYSTEM_ALERT_WINDOW: overlay; [INF] from WebRTC/LiveKit config plugin or call UI; unusual for a study app, worth noting.
- BILLING: subscriptions/IAP. AD_ID, ACCESS_ADSERVICES_*, BIND_GET_INSTALL_REFERRER_SERVICE: ads attribution/measurement (tracking-transparency string: "measure ad performance so we can keep tangerine free").
- DETECT_SCREEN_CAPTURE (SDK 34+): expo-screen-capture screenshot detection. USE_BIOMETRIC/USE_FINGERPRINT: androidx.biometric (library-merged).
- ACCESS_WIFI_STATE, ACCESS_NETWORK_STATE: connectivity checks.
- No location, contacts, SMS, storage permissions. Photos are via system picker.

## 4. Components, intent filters, deep links
- [OBS] `MainActivity` exported, singleTask, PiP supported, LAUNCHER + VIEW/BROWSABLE for schemes `tangerineprep://` and `exp+tangerine-prep://` (the latter is dev-client scheme left in release).
- [OBS] A second VIEW filter with `<data scheme="https">` exists (query-intent/browser visibility, no host/autoVerify found in the grep) - no verified App Links host observed. [INF] Web links are not claimed by the app; deep link surface is custom scheme only.
- [OBS] Facebook: `CustomTabActivity` exported (schemes `fb1367473415267775`, `fbconnect://cct.com.tangerineprep.app`), `FacebookActivity`.
- [OBS] Other exported: `com.canhub.cropper.CropImageActivity`, `androidx.compose.ui.tooling.PreviewActivity` (debug tooling shipped in release), `ClipboardFileProvider` (exported=true), FirebaseInstanceIdReceiver (protected by c2dm SEND), WorkManager DiagnosticsReceiver and SystemJobService (platform-protected).
- [OBS] FileProviders (non-exported, grant URI): webview, rnshare, image-picker, cropper, notifee init provider. Clarity `UploadSessionJob` service (BIND_JOB_SERVICE).
- [OBS] `MediaProjectionService` (FGS type mediaProjection) declared by react-native-webrtc.
- [INF] Deep link handling (expo-router) happens in JS; see JS report for routes.

## 5. Bundled assets
- `assets/`: `index.android.bundle` (Hermes), `app.config`, `app.manifest`, `clarity.js`, `expo-root.pem` (Expo Updates code-signing root cert), `dexopt/`, `mlkit_barcode_models/` (3 tflite).
- `res/raw/` sounds (11): correct, incorrect, selection, next question, warning, countdown-to-the-answer, quiz winner fanfare, majestic arrival, lobby music x2, call ringback, reply thock, zap flick. [INF] Game/quiz-lobby, battle and call features.
- `res/drawable*` has ~98 distinct `assets_*` images (png/webp): ~32 `tangerines_*` mascot poses (Coach Cleo, sad Cleo, cleo drums, happy/cool/jumping/donut/family/headphones/mockboard tangerines, onboarding scenes np1-3, paywall jumper), 25 `stickers_*` chat stickers (celebrating, thumbsup, yougotthis, onfire, sleepy, etc.), 12 `results_*` (e.g. guardians), 5 `groupavatars_*` (bookfox, focusrabbit, nursebear, studycat, wiseowl), 4 `crests_*` (student, scholar, topnotcher, toprank), 5 `coaching_*` (stepplan), battle tangerine left/right, duel, royale, practice, calendar, splash icon, app icon (adaptive bg #FFF8F0).
- No Lottie JSON or .lottie found in res/raw or assets [OBS]; animations are likely JS-driven or APNG/WebP (penfeizhou decoder) [INF]. Fonts excluded from the extract.
- [INF] Product theme: nursing board prep (PNLE = Philippine Nurse Licensure Exam), gamified (duels, royale, crests, groups), AI coach "Cleo", social chat with stickers and voice/video calls.

## 6. Security and privacy posture
- [OBS] `allowBackup="true"`, with `fullBackupContent` and `dataExtractionRules` that exclude only `sharedpref/SecureStore` (expo-secure-store). [INF] Other app data (SQLite, AsyncStorage/shared prefs, files) is backed up to Google cloud/device transfer; adb backup is possible on older Androids.
- [OBS] `debuggable` not set (release). No `usesCleartextTraffic` and no `networkSecurityConfig` attribute. [INF] With targetSdk >= 28 cleartext defaults to blocked; user CA trust follows platform defaults (no pinning config observed).
- [OBS] Dev tooling shipped in release: expo-dev-launcher/dev-menu/dev-client classes, `rn_dev_preferences.xml`, Compose `PreviewActivity` exported, `exp+tangerine-prep` scheme. [INF] Increased attack surface; EAS dev-client artifacts likely not stripped.
- [OBS] Anti-tamper: pairip wrapper Application + `LicenseActivity` + licensecheck classes (Google Play "Play Integrity/licensing" protection added by Play at distribution). [INF] This APK is a Play-distributed (pairip-injected) build; repackaged copies would fail license check unless the pairip native lib is patched out. No custom root/emulator detection seen in dex.
- [OBS] Expo Updates (OTA) with `expo-root.pem`; [INF] code-signing enabled so JS can be updated outside Play review within runtime 1.9.0.
- Screen capture [OBS]: DETECT_SCREEN_CAPTURE permission + `expo.modules.screencapture` classes; JS bundle references `ScreenCapture`/`expo-screen-capture` (3 hits). [INF] Used to detect screenshots (possibly for exam/content protection or social "screenshot" events), not necessarily to block them (no FLAG_SECURE confirmed).
- Biometrics [OBS]: androidx.biometric 1.1.0 + USE_BIOMETRIC/USE_FINGERPRINT, but no expo-local-authentication package or JS `authenticateAsync` found. [INF] Biometric permission is a transitive manifest merge; no first-party biometric feature evident.
- Microsoft Clarity [OBS]: native SDK + clarity.js (web recorder for WebViews) + upload job service; JS bundle contains `Clarity`/`ClarityConfig` strings. Project ID not extracted here. [INF] Clarity records session replay (screen content as masked wireframes/screenshots, taps, scrolls, gestures, device/OS/network info, screen names, crashes). Implications for a chat/calls/voice/health-adjacent study app: user-typed text, chat and profile images/stickers may appear in replay unless masked; Clarity uploads to Microsoft servers (third-party processing, needs disclosure). Default Clarity masking hides text inputs but not all labels; actual mask settings are in JS config (not verified).
- Advertising [OBS]: Facebook auto-event logging, advertiser-ID collection enabled, Google AD_ID, Privacy Sandbox attribution/topics perms, install referrer. [INF] Ad attribution and audience building with Meta; consent gate (expo-tracking-transparency is iOS-focused) may not apply on Android.
- Data stored in secure-store (Keystore-backed) is excluded from backup. [INF] Auth tokens likely there.
- Hardcoded identifiers [OBS]: Facebook client token and app ID in app.config/resources (client tokens are meant to be public-ish), Expo project id. No other secrets reviewed in this pass.
