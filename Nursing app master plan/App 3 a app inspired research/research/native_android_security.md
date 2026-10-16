# Addendum: Native / Android Side of Gizmo (ai.saveall.app)

Labels: **[OBS]** = observed directly in the extracted tree; **[INF]** = inferred.
All content treated as untrusted data; nothing was executed. Secrets/keys/DSNs deliberately not reproduced.

## 0. Identity (OBS)
- Package `ai.saveall.app`, versionName 3.2.130, versionCode 872, minSdk 26, targetSdk/compileSdk 36 (apktool.yml, manifest).
- Expo config: name "Gizmo", description "AI flashcards & quizzes", slug `native`, scheme `gizmo`, Expo SDK 57.0.0, runtimeVersion policy `fingerprint`, owner `gizmo-ai`, portrait only, light UI style.
- Build metadata in app.config `extra`: gitSha 3f0db6c1..., releaseTag `release-2026-10-15-15h31-3f0db6c1fa`, quizEngine engineVersion 32 / revision 167 / stateVersion 192, `nativeConsoleOrigin` https://native-console.gizmo.ai, i18n CDN https://cdn.gizmo.ai/i18n/<hash>.
- The iOS bundle id in the same config is `io.gonative.ios.xqdyad` (GoNative-style id); Android package is `ai.saveall.app` (legacy "SaveAll" name). [INF] the product was renamed from SaveAll to Gizmo; the original package id was kept.
- Input is a base-split extraction (`requiredSplitTypes="base__abi,base__density"`): [OBS] no `lib/` directory and no density resources, so native `.so` files (Hermes, React Native, Sentry NDK, MMKV, etc.) were in ABI splits not present here.

## 1. First-party code in dex (OBS: counts from parsing class_defs of 10 dex files, 83,035 classes total)

Truly first-party app code is tiny (React Native/Expo app; logic lives in the Hermes JS bundle):

| Prefix | Classes | Notes |
|---|---|---|
| `ai/saveall/app` (MainActivity, MainApplication, BuildConfig, R*) | ~18 | standard Expo shell; `MainActivity$createReactActivityDelegate$1` |
| `ai/saveall/app/socialsharing` | 4 | custom share-to-social helper (matches `withSocialSharing` plugin; FileProvider `ai.saveall.app.socialsharing.fileprovider`) |
| `ai/saveall/app/notifications` | 1 | custom notification piece (matches `withCommunicationNotifications` / `withQuietHoursNotificationChannel` plugins) [INF] |

Other first-party-authored Expo-style local modules (not from public Expo SDK) [INF from names, not in the sentry library list as Maven artifacts]:
- `expo/modules/gizmopdf` (15 classes) - PDF handling; app bundles PdfBox-Android and AndroidPdfViewer fork alongside.
- `expo/modules/shareinbox` (36) - Android "share inbox" receiving shared files (plugin `withAndroidShareInbox`, variant production).
- `expo/modules/splashanimation` (24) - plays the Lottie splash (plugin `withSplashAnimationAssets`).
- `expo/modules/lottiecache` (6), `expo/modules/memorypressure` (6), `expo/modules/jsonutils` (3), `expo/modules/otasubsystemrecovery` (7), `expo/modules/webviewdatastore` (7), `expo/modules/structuredheaders` (21), `expo/modules/imagefacedetector` (11), `expo/modules/speechrecognition` (76, = `expo-speech-recognition` community module).

Expo/RN module class counts (OBS, top by size): expo/modules/kotlin 1556, ui 1250 (Jetpack Compose UI), contacts 726, medialibrary 473, filesystem 458, updates 436, audio 344, appmetrics 318, notifications 278, image 225, camera 189, observe 179, location 168, imagepicker 108, crypto 100, fetch 74, webview 64, imagemanipulator 61, clipboard 56, securestore 53.

Top-level dex prefixes by class count (OBS): com/google 15057, androidx/compose 11649, expo/modules 8128, org/bouncycastle 6183, com/revenuecat 3793, androidx/media3 3701, com/facebook (RN, Fresco, Hermes glue) 3323, androidx/camera 3240, kotlin/reflect 2014, io/opentelemetry 1700, io/sentry 1506, com/onesignal 1376, com/swmansion 1283 (reanimated, worklets, screens, gesture handler), com/tom_roush 903 (PdfBox), com/margelo 734 (Nitro modules), com/bumptech 667 (Glide), com/logrocket 579, com/amazon 402 (Amazon IAP), com/airbnb 364 (Lottie), com/adjust 284.
Also present: `org/wonday/pdf` (react-native-pdf), `com/ReactNativeBlobUtil`, `io/invertase/firebase`, `com/reactnativegooglesignin`, `com/reactnativepagerview`, `com/reactnativecommunity/webview`, `com/canhub/cropper`, `org/junit` + `androidx/test` (test libs shipped in release; minor bloat).

JS bundle (OBS): `assets/index.android.bundle`, 50,255,500 bytes, magic `c61fbc03c103191f` = Hermes bytecode (HBC). React Native 0.86.3, Hermes `250829098.0.17`, React Compiler enabled (`experiments.reactCompiler`), typed routes on, expo-router 57.0.17.

## 2. Manifest: components, deep links, implications

### Exported components (OBS)
| Component | Exported | Guard | Notes |
|---|---|---|---|
| `ai.saveall.app.MainActivity` | yes | none (singleTask) | launcher + deep links + SEND share target |
| `com.google.firebase.auth.internal.GenericIdpActivity` | yes | none | scheme `genericidp://firebase.auth/` (Firebase Auth OAuth redirect) |
| `com.google.firebase.auth.internal.RecaptchaActivity` | yes | none | scheme `recaptcha://firebase.auth/` |
| `com.onesignal.NotificationOpenedActivityHMS` | yes | none | Huawei push open handler, filter VIEW (no data) |
| `com.onesignal...FCMBroadcastReceiver` | yes | `c2dm.permission.SEND` | FCM receive |
| `com.google.firebase.iid.FirebaseInstanceIdReceiver` | yes | `c2dm.permission.SEND` | FCM |
| `com.adjust.sdk.AdjustReferrerReceiver` | yes | `INSTALL_PACKAGES` | Play install referrer |
| `com.amazon.device.iap.ResponseReceiver` | yes | Amazon NOTIFY permission | Amazon IAP |
| `com.google.android.gms.auth.api.signin.RevocationBoundService` | yes | GMS revocation permission | |
| `androidx.work...SystemJobService` | yes | `BIND_JOB_SERVICE` | |
| `androidx.work...DiagnosticsReceiver` | yes | `android.permission.DUMP` | |
All FileProviders (7: socialsharing, RNCWebView, ReactNativeBlobUtil, expo filesystem, clipboard, image picker, cropper) are `exported=false`, `grantUriPermissions=true`. All Expo services/receivers (audio, notifications, location, task manager) are `exported=false`.
No custom `<permission>` guarding MainActivity; two signature-level custom permissions exist (C2D_MESSAGE, DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION).

### Deep links on MainActivity (OBS)
1. `gizmo://` and `exp+native://` (VIEW, BROWSABLE, DEFAULT). `exp+native` is the Expo dev-client scheme left in a production build [INF: harmless but unneeded].
2. App Links (`autoVerify=true`): `https://gizmo.ai`, `https://app.gizmo.ai`, `https://gizmo.go.link` (all paths).
3. App Link: `https://share.gizmo.ai/s/*` (pathPrefix) - shared content/study-set links.
4. `SEND` (share-sheet target) for text/plain, markdown, csv, rtf, PDF, Word/Excel/PowerPoint/ODF/OOXML, images (jpeg/png/gif/webp/heic/heif), audio (aac/aiff/flac/mp4/mpeg/ogg/opus/wav/webm). Only `SEND`, not `SEND_MULTIPLE`/`VIEW`.

Implications [INF]: any app or web page can launch MainActivity with arbitrary `gizmo://` URIs or shared files, so expo-router route handling and the share-inbox must treat incoming URLs/files as untrusted. The share inbox accepts a broad document set, so the document/AI ingestion pipeline is a user-facing feature (import notes/lectures/slides to make flashcards and quizzes).
`assets/www.bundle/.well-known/assetlinks.json` (OBS) lists package `ai.saveall.app` with two SHA-256 signing cert fingerprints and a second entry for `ai.saveall.app.preview`; apple-app-site-association lists `io.gonative.ios.xqdyad` (+ `.preview`, `.dev`) with exclusions for `/oauth-redirects/*`, `/privacy`, `/terms-and-conditions`, `/cookies`, `/contact`, `/pdf` (paths kept on the web).

### Permissions (OBS)
Dangerous/notable: CAMERA, RECORD_AUDIO, READ_CONTACTS, WRITE_CONTACTS, ACCESS_COARSE_LOCATION, POST_NOTIFICATIONS, READ/WRITE_EXTERNAL_STORAGE (with `requestLegacyExternalStorage=true`), SYSTEM_ALERT_WINDOW, USE_BIOMETRIC/USE_FINGERPRINT, DETECT_SCREEN_CAPTURE (SDK 34+), RECEIVE_BOOT_COMPLETED, FOREGROUND_SERVICE(+MEDIA_PLAYBACK, +MICROPHONE), com.android.vending.BILLING, AD_ID (`com.google.android.gms.permission.AD_ID`), install-referrer, ~15 launcher-badge permissions (Samsung/HTC/Sony/Huawei/Oppo etc., from badge library).
app.config explicit blocklist (OBS): ACCESS_FINE_LOCATION, ACCESS_BACKGROUND_LOCATION, FOREGROUND_SERVICE_LOCATION, READ_MEDIA_IMAGES, and one more (list truncated) - location kept coarse. A `LocationTaskService` with foregroundServiceType=location is declared though the foreground-location permission is blocked [INF: dormant].
Usage strings (app.config iOS, OBS): camera "take pictures of your notes"; mic "record lectures and voice notes ... answer quiz questions or talk to your tutor"; speech recognition for live captions; coarse location "find nearby schools and universities"; contacts (invite/share flow) [INF].
`<queries>` (OBS): can detect Discord, Messenger, GroupMe, Instagram, Snapchat, TikTok (both package ids), WhatsApp, Facebook; schemes discord, fb-messenger, groupme, musically, sms, smsto, snssdk1233, whatsapp - social/viral sharing flows.

### Manifest meta-data (OBS)
- Facebook SDK app id `922993789321952` (value has a stray leading `\ ` in the manifest, harmless-looking packaging quirk), Snapchat Creative Kit client id (public), OneSignal app id (in app.config), Expo Updates: ENABLED, URL `https://u.expo.dev/1f13b03a-...`, channel header `expo-channel-name: production-ota`, check-on-launch NEVER, launch wait 0 ms, bsdiff patch support on. `io.sentry.auto-init=false` (Sentry started from JS). `app_data_collection_default_enabled=true` (Firebase).

## 3. SDK inventory (OBS from `assets/sentry-external-modules.txt`, 399 entries, plus manifest/dex)

**Runtime / framework**: React Native 0.86.3 (react-android), Hermes 250829098.0.17, Expo SDK 57 (~45 `expo.modules.*` at 57.0.x), expo-router 57.0.17, Fresco 3.6.0, SoLoader 0.12.1, fbjni 0.7.0, react-native-reanimated/worklets, screens, gesture handler (swmansion), Margelo Nitro, MMKV 2.4.0 (io.github.zhongwuzw), Kotlin 2.1.20, kotlinx-coroutines 1.10.2, kotlinx-serialization 1.9.0, Guava 33.3.1-android, Gson 2.13.2, Dagger 2.59, Tink 1.8.0, Wire 5.4.0, zstd-kmp 0.4.0, Okio 3.16.0, OkHttp 4.12.0 (okhttp-urlconnection 4.9.2).
**UI**: Jetpack Compose 1.11.0-beta02 (pre-release), Material3 1.5.0-alpha17 (pre-release), Material 1.9.5, material components 1.13.0, expo-ui (Compose), accompanist-drawablepainter 0.30.1, BlurView 3.1.0, Coil 2.4.0, Glide 5.0.5 (+avif), penfeizhou animated image libs 3.0.5, Lottie (airbnb) + LottieFiles dotlottie-android 0.15.0, AndroidMath (gregcockroft) v1.1.0 (LaTeX/math rendering, consistent with web `latex-keyboard` css), androidsvg 1.4.
**Media/camera/ML**: CameraX 1.7.0-alpha01 (pre-release), androidx.media3, ML Kit barcode-scanning 17.3.0, ML Kit face-detection 16.1.7, play-services-code-scanner 16.1.0, mlkit-barcode-scanning 18.3.1, mlkit-face-detection 17.1.0, ML Kit common 18.11.0, odml image 1.0.0-beta1.
**Documents**: pdfbox-android 2.0.27.0 (tom-roush) with fontbox resources in assets, AndroidPdfViewer fork (zacharee) 4.0.1, react-native-pdf, expo-print.
**Auth / identity**: Firebase Auth 24.0.1 (React Native Firebase), Google Sign-In (play-services-auth 21.5.0, googleid 1.1.1, androidx.credentials, play-services-fido 21.0.0, identity-credentials), reCAPTCHA 18.6.1, Play Integrity 1.3.0, Block Store 16.4.0, androidx.biometric, expo-secure-store.
**Push / messaging**: Firebase Messaging 25.0.1 (+ Cloud Messaging 17.2.0), OneSignal 5.9.8 (core, notifications, in-app-messages, location, otel), Huawei HMS push receiver, expo-notifications 57.0.15.
**Monetization / attribution / ads**: RevenueCat purchases 9.9.0 (+ UI 9.9.0, hybrid-common 17.10.0, Amazon store 9.9.0), Google Play Billing client 8.0.0 (manifest), Amazon Appstore SDK 3.0.5, Adjust 5.4.4 (+signature 3.47.0), play-services-ads-identifier 18.0.1, play-services-analytics 18.0.1, tagmanager, Google Play Age Signals 0.0.4 + `expo.modules.agerange` (age-gating), Play Review 2.0.1.
**Observability**: Sentry Android 8.49.0 (+NDK/native 0.15.3, replay; options: sendDefaultPii=false, session replay sample rates 0), LogRocket 1.62.0 (session recording), OpenTelemetry (16 artifacts, semconv 1.37.0, disk-buffering) used by OneSignal otel and expo-appmetrics/observe, Firebase Installations/measurement connector, Expo Insights/AppMetrics/Observe.
**Social**: Facebook SDK (app id in manifest), Snapchat Creative Kit client id, share via FileProvider.
**Crypto**: BouncyCastle (bcprov 1.81, bcpkix 1.72, bcutil 1.81; ~6183 classes), Tink.
**Storage/DB/background**: Room 2.8.3, DataStore, WorkManager 2.9.1, expo-task-manager/background-task, expo-media-library, expo-filesystem.
Notes [INF]: several androidx libs are alpha/beta (Compose 1.11.0-beta02, Material3 1.5.0-alpha17, CameraX 1.7.0-alpha01) and OkHttp 4.12.0 co-exists with okhttp-urlconnection 4.9.2 (version skew).

## 4. Bundled assets

### `assets/models_bundled/` (OBS, ~4.2 MB, 14 files)
`blazeface.tfl` (BlazeFace face detector), `contours.tfl` (face contour/landmarks, 1.1 MB), `fssd_25_8bit_v2.tflite`, `fssd_25_8bit_gray_v2.tflite`, `fssd_medium_8bit_v5.tflite`, `fssd_medium_8bit_gray_v5.tflite` (SSD-style face detectors, color and grayscale, 8-bit quantized), `fssd_anchors_v2.pb`/`v5.pb` and `MFT_fssd_accgray.pb`/`fastgray.pb` (tiny anchor/config protobufs), `LMprec_600.emd` (landmark model, 1.08 MB), `BCLjoy_200.emd`, `BCLlefteyeclosed_200.emd`, `BCLrighteyeclosed_200.emd` (classifier models for smile/joy and eye-closed). [INF] This is the model set shipped by Google ML Kit **face-detection** (bundled variant, classification of smile/eyes-open); the names match ML Kit's internal assets, not first-party training. `expo.modules.imagefacedetector` (11 classes) is a face-detector module using it.

### `assets/mlkit_barcode_models/` (OBS)
`barcode_ssd_mobilenet_v1_dmp25_quant.tflite` (390 KB, barcode localizer), `oned_auto_regressor_mobile.tflite`, `oned_feature_extractor_mobile.tflite` (1D barcode decoder). [INF] bundled ML Kit barcode-scanning models (used by expo-camera barcode scan and code scanner).

### Splash (OBS)
`splash_mascot.json` (424 KB, Lottie v5.9.0, 60 fps, frames 10-140, 1000x1200, name `Gizmo_Fist Pump_Intro`), `splash_wordmark_light.json` (227 KB), `splash_wordmark_dark.json` (225 KB). Played by `expo/modules/splashanimation` + dotlottie/Lottie; mascot "fist pump" intro with light/dark wordmarks.

### `assets/www.bundle/` (OBS, 7.4 MB)
An embedded Expo **web export** (Metro) packaged in-app, likely for WebView/embedded web UI and offline fallbacks: `index.html` (placeholders `%LANG_ISO_CODE%`, `%WEB_TITLE%` - templated at runtime), `ea6c220fb4838c2949a88012469cb6f2.html` (second page), `manifest.webmanifest`, icons, `OneSignalSDKWorker.js` (web push worker), `.well-known/{assetlinks.json,apple-app-site-association}`, `_expo/static/js/web/entry-897e...js`, CSS chunks (styles, tailwind, `latex-keyboard.web`, image, `modal.module`, `lexical-theme` - Lexical rich-text editor), expo-router asset PNGs. Plugin `withStripWwwBundleSourceMaps` indicates sourcemaps were intentionally stripped. [INF] The web app (Tailwind + Lexical + LaTeX keyboard) is shared code with the native app; `app.config` `extra.router.origin=false`.

### Other assets (OBS)
`app.manifest` (84 KB, Expo Updates manifest, id b9112fb9-..., commitTime 1792082052519 ms = Oct 2026, lists fonts such as MaterialSymbols under `/assets/_node_modules/.pnpm/...` - pnpm monorepo), `app.config` (12.8 KB, full Expo config embedded), `fingerprint` (40-hex runtime fingerprint), `expo-root.pem` (public CA cert for Expo Updates code signing), `sentry.options.json`, `sentry-debug-meta.properties`, `com/tom_roush/{fontbox,pdfbox}/resources` (afm, cmap, glyphlist, ttf, unicode), `kotlin-tooling-metadata.json`, `client_analytics.proto`, `messaging_event*.proto` (Firebase). No bundled fonts at assets root in this tree (stripped per task note).

## 5. Security posture observations

| Item | Finding | Label |
|---|---|---|
| debuggable | not set (absent attribute, defaults false); `testOnly` absent | OBS |
| Cleartext / network security | no `usesCleartextTraffic` attribute, no `networkSecurityConfig`, no `res/xml/network_security_config.xml`. With targetSdk 36 the platform default is cleartext **blocked**; no custom CA pinning or user-CA config | OBS; interpretation INF |
| iOS ATS | `NSAllowsLocalNetworking=true` only (iOS side, config) | OBS |
| Backup | `allowBackup="true"`; `fullBackupContent` and API31 `dataExtractionRules` (cloud-backup and device-transfer) include all shared prefs but **exclude** `sharedpref/SecureStore` (expo-secure-store). MMKV/Room/files not explicitly excluded (default includes files, DBs) | OBS; risk INF: local DB/MMKV/LogRocket-Sentry caches can be extracted by `adb backup`/cloud restore |
| Legacy storage | `requestLegacyExternalStorage=true`, READ/WRITE_EXTERNAL_STORAGE declared (ignored on 11+ scoped storage for targetSdk 30+) | OBS |
| Exported surface | one app activity (MainActivity) with deep links; Firebase Auth redirect activities exported (standard); OneSignal HMS activity exported without data filter (standard SDK) | OBS |
| Deep-link verification | `autoVerify=true` for gizmo.ai, app.gizmo.ai, gizmo.go.link, share.gizmo.ai/s/*; custom scheme `gizmo://` and `exp+native://` are unverified and hijackable by other apps | OBS/INF |
| Overlay permission | `SYSTEM_ALERT_WINDOW` declared (likely RN dev overlay residue or LogBox; `expo/modules/logbox` classes present) | OBS; INF |
| Screen-capture | `DETECT_SCREEN_CAPTURE` + `expo.modules.screencapture` present: can detect/prevent screenshots (likely for exam/quiz integrity) | OBS/INF |
| Updates (OTA) | Expo Updates enabled, channel `production-ota`, runtimeVersion = fingerprint policy; code-signing root `expo-root.pem` is in assets (that is Expo's generic cert; whether app-specific code signing is enforced not determined) | OBS; enforcement unknown |
| Telemetry | Sentry (`sendDefaultPii=false`, replay sample 0), LogRocket session recording, Adjust attribution + AD_ID, Firebase analytics collection default enabled, OneSignal location module, Facebook SDK | OBS |
| Privacy-sensitive features | contacts read/write, coarse location, mic/camera, speech recognition, age-signals/age-range gating (minors likely a user group) | OBS; INF |
| Test/dev residue | `org/junit`, `androidx/test` classes, `DebugProbesKt.bin` (coroutines debug probes), `exp+native` scheme, dev-client packages (`expo/modules/devclient`, `devlauncher`, `devmenu` ~15 classes, stubs) in a release build | OBS; harmless but increases surface |
| Source/secrets | Public identifiers (Facebook app id, Snap client id, OneSignal app id, Sentry DSN, Firebase config) are present as expected for client apps; no private keys observed in manifest/config | OBS |
| Hermes bytecode | JS shipped as HBC (not plain text), sourcemaps stripped from www.bundle; reversible with hermes decompilers | OBS |
| Signature scheme | `META-INF` contains only library `.version` files, `services/`, `NOTICE`, no `CERT.RSA/CERT.SF/MANIFEST.MF` and no APK Signing Block available in the extraction (apktool-rebuilt `gizmo_rebuilt.apk`, `apkout/original/stamp-cert-sha256` exists = Play source-stamp hash file). Signing scheme (v2/v3) **cannot be determined** here. The two cert SHA-256s in `assetlinks.json` (prod + a second, likely Play app-signing/upload or preview key) are the only signer evidence | OBS; INF |

## 6. Bottom line (INF)
Thin native shell: a React Native 0.86 / Expo SDK 57 app with Hermes JS, ~8K Expo module classes and only ~25 `ai.saveall` classes (activity, application, social sharing, notifications). Custom Kotlin local modules (gizmopdf, shareinbox, splashanimation, lottiecache, memorypressure, otasubsystemrecovery, webviewdatastore) fill gaps. Heavy third-party attribution/monetization/observability stack (RevenueCat, Adjust, LogRocket, Sentry, OneSignal, Facebook). On-device ML is limited to stock ML Kit face and barcode models; no first-party AI model is bundled, so the "AI" is server-side. Main hardening gaps: `allowBackup=true`, unverified custom schemes, pre-release AndroidX libs, residual dev/test code.
