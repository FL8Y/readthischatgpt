# Tangerine Prep 1.9.0 - Backend / Network Layer Addendum

Package `com.tangerineprep.app`, scheme `tangerineprep` (plus a `fb<appid>` Facebook scheme). Source: Hermes decompile (`decompiled.js`), `strings_all.txt`, `ex/assets/app.config`.
Labels: **[O]** observed literal in code or strings, **[I]** inferred. No secrets are reproduced. Embedded IDs exist: Facebook app id and client token, Expo EAS projectId, Google/Apple sign-in client ids, Clarity project id. They are not copied here.

## 1. Base URLs / hosts

| Host | Use | Label |
|---|---|---|
| `https://tangerine-backend-production.up.railway.app/api` | Primary REST + WS backend (Railway-hosted; Django-REST-style trailing-slash paths) | O |
| `https://tangerineprep.app/api` | Fallback/alternate API base. It is the 3rd entry of the base-URL list, after the Railway URL twice | O |
| `https://tangerineprep.app/eula`, `/privacy` | Legal pages opened in-app | O |
| `https://cloud-api.livekit.io` + `/api/v2/sandbox/connection-details` | LiveKit `TokenSource.sandboxTokenServer` (header `X-Sandbox-ID`) | O. Probably the LiveKit lib's default/dev token source, not the production voice path (see 7) [I] |
| `https://exp.host/--/api/v2/push/updateDeviceToken` | Expo push service, called by expo-notifications | O |
| `https://kit.openiap.dev` | `kitApi` of the OpenIAP / react-native-iap layer | O |
| `/api/assets/` | Asset/figure URL fallback built from the backend base (`getCheatSheetFigureFallbackUrl`) | O |

Trailing slashes are stripped from bases with `/\/+$/`. The rest of the module has no `EXPO_PUBLIC_*` env override [I].

## 2. HTTP client wrapper (module `api/client`, ~line 776k-783k)

- Plain `fetch`. The options `logErrors`, `timeoutMs` and `useExpoFetch` are visible [O]. An `ExpoFetchFormBoundary` string suggests expo/fetch for multipart uploads [I]. No axios.
- Request helper `fetchWithTimeout(url, init, timeoutMs)`. Default timeout constants are 12000 ms and 10000 ms [O].
- **Base-URL failover:** the request loops over the base list. On a network error or on status 502/503/504 (a `Set` of those codes) it tries the next base. The last base returns the final result [O].
- Headers are `Content-Type: application/json`, plus `Authorization: Bearer <access>` when a token is stored [O].
- Variants seen: `authenticatedFetch`, `_authenticatedStreamResponse` (streaming responses, for Cleo/AI streams [I]), and multipart upload helpers (avatar, showcase and celebration photos).
- On 401 the wrapper calls `performAccessTokenRefresh` and retries once [I, from the refresh function's presence and its use inside the auth wrapper].
- The app-id header `X-Request-URL` appears only in a polyfill. No custom client-version header was found [O/I].

## 3. Auth flow

| Item | Detail | Label |
|---|---|---|
| Email login | `POST /auth/login/` body `{email, password, client_platform:"mobile"}` | O |
| Email register | `POST /auth/register/verified/` body `{email, password, first_name, last_name, username, signup_source:"mobile", client_platform:"mobile"}`. "Verified" suggests an email-code step first [I] | O |
| Apple Sign-In | `POST /auth/apple/` body `{identity_token, apple_user_id, email, full_name, signup_source:"mobile"}` (expo-apple-authentication) | O |
| Google Sign-In | Browser flow: `GET /auth/google/start/?mobile=1&mobile_redirect=<deep link>`. The backend redirects back to the app scheme with tokens [I] | O (path), I (flow) |
| Password reset | `/auth/request-password-reset/`, `/auth/confirm-password-reset/` | O |
| Current user | `/auth/me/`; account deletion `/auth/me/delete/` | O |
| Profile / onboarding | `/auth/profile/` (13 call sites: onboarding steps, `goToStep`), `/auth/profile/celebration-photo/` | O |
| Tiers / entitlements | `/auth/tiers/`, `/auth/entitlements/` | O |
| Token refresh | `POST /auth/token/refresh/` body `{refresh}` returns `{access, ...}`; on a non-OK response the session is cleared [I] | O |
| Storage | expo-secure-store (a `getItemAsync`/`setItemAsync` wrapper is bundled). Key `tangerine_tokens` holds `{access, refresh}`. Key `tangerine_auth_user` holds the cached user (context `AuthProvider`). Also `tangerine_app_attribution_id` | O |
| Other stored flags | `tangerine_attr_bridge_claimed_v2`, `tangerine_attr_capi_sent`, `tangerine_attr_clipboard_tried`, clipboard marker `tng-attr:`. See attribution in 9 | O |
| Token type | The `access`/`refresh` pair is JWT-style (SimpleJWT naming) [I] | I |

## 4. API endpoints called (all relative to the base, trailing slash as shown)

HTTP methods are mostly passed through helper wrappers and are not literal near the path. Only POST/GET marked O were seen next to the path; the rest are INFERRED from the name.

**App platform / telemetry**

| Path | Notes |
|---|---|
| `GET /app-platform/version-status/` | Force-update / min-version check (O: GET) |
| `/app-platform/onboarding-config/` | Remote onboarding config |
| `/app-platform/events/` | `trackPlatformEvent`: sends `{event, attribution, metadata, ...}` (O fields `event`, `attribution`, `metadata`). It also feeds Clarity. |
| `/app-platform/errors/` | `logPlatformError`: `{error, backend_error, request, response, metadata}` (O) |
| `/app-platform/feedback/`, `/app-platform/premium-voice/feedback/` | In-app feedback; premium-voice feedback is event `premium_voice_feedback_submit` |

**Subscriptions / billing**

| Path | Notes |
|---|---|
| `POST /v1/subscriptions/bind-user/` | Body `{purchaseToken, userId}` (O) |
| `POST /v1/subscriptions/entitlements/`, `/v1/subscriptions/status/` | Entitlement check (OpenIAP-style "v1" API) |
| `POST /auth/billing/native-iap/sync/` | Body `{plan, product_id, transaction_id, original_transaction_id, purchase_token, signed_transaction, purchase_state, transaction_date, store, platform, environment, price, currency}` (O) |
| `/auth/checkout/create/`, `/auth/checkout/`, `/auth/checkout/token/` | Web checkout (Stripe-like) create, status and "paying for" token (O names) |
| `/exam-report/free-unlock/` | Consumes a free analysis unlock |

**Content**

| Path | Notes |
|---|---|
| `/questions/`, `/questions`, `/questions/diagnostic/`, `/questions/hash/`, `/questions/search/?q=` | Question bank; the hash is used for cache invalidation [I] |
| `/diagnostics/preview/`, `/diagnostics/check/`, `/diagnostics/submit-bulk/`, `/diagnostics/analysis/` | Diagnostic test |
| `/exam-report/analysis/`, `/exam-report/analysis/premium/`, `/exam-report/bloom/`, `/exam-report/sample/` | Exam reports (Bloom taxonomy) |
| `POST /flashcards/review/`, `/flashcards/review/undo/`, `/flashcards/folders/`, `/flashcards/mine/`, `/flashcards/mine/packs/`, `/flashcards/shared/`, `/flashcards/session/?`, `/flashcards/?` | Flashcards with spaced-repetition review |
| `/cleo-pack/` | Cleo-generated flashcard pack, under `/library/folders/<id>/` |
| `/study-plan/`, `/study-plan/status/`, `/study-plan/create_schedule/`, `/study-plan/rebalance/`, `/study-plan/blocks/?lazy=1`, `/study-plan/week/?week_start=`, plus v2: `/study-plan/v2/{calendar,events,status,rebalance}/` | Study plan |
| `/institutions/learner`, `/institutions/learner/reading-assignments/`, `/institutions/console/schools/?q=` | School/institution features |
| `/offline/bundle/manifest/`, `/offline/bundle/`, `/offline/bundle/chunks/` | Offline content bundle (see 6) |
| `/attempt/`, `/answer/`, `/read/` | Attempt, answer and read sub-resources of questions [I] |

**Social (large surface)**

- Profile: `/social/profile/{me/,update/,upload-avatar/,showcase/,showcase/upload/}`, `/social/user/<id>/`, `/social/users/search/?q=`.
- Friends: `/social/friends/`, `/social/friends/request/`, `/social/friends/suggestions/`.
- DMs and blocks: `/social/dm/`, `/social/dm/requests/`, `/social/blocks/create/`, `/social/messages/<id>/` (report).
- Groups: `/social/groups/{create/,join/,join-requests/,manage/}`.
- Schools: `/social/schools/`, `/social/schools/suggest/`, `/social/school/`.
- Rank: `/social/rank/`, `/social/rank/me/`, `/social/hall-of-fame/announcement/`, `/auth/rank-announcement/`, `/social/pnle/{badges,profiles}/`.
- Townhall (feed): `/social/townhall/{feed,posts,comments,threads,notes,hashtags,search,link-preview}/`.
- Notifications: `/social/notifications/`, `/social/notifications/mark-read/`, `/social/notifications/unread-count/`.
- Study sessions and matchmaking ("versus/battle"): `/social/study/{create,current,history,invites}/`, `/social/study/match/{queue,status,cancel}/`.
- Calls: `/social/calls/{start,active,incoming}/`, `/social/call/<id>/`.
- Voice tokens: `/social/study/<id>/voice-token/` (from `/voice-token/`) and `/social/voice-test/token/` (O strings; the parent path is inferred).
- Other: `/auth/pmf-survey/` (product-market-fit survey), `/emote/`.

**Realtime WebSockets:** `/ws/social/`, `/ws/dm/`, `/ws/groups/`, `/ws/study/` (Django Channels style [I]). `/v1/webhooks/stream/` is a webhook/SSE stream, `connectWebhookStream` [O].

**Request/response field names seen in code:** only the bodies listed in 3 and 4, and the `{access, refresh}` token pair. No response schemas were recovered statically.

## 5. Error handling

- Failed requests go through `logPlatformError` to `/app-platform/errors/`, carrying `request`, `response` and `backend_error` [O]. A `NetworkContext` module gates this and the event tracking [O].
- Failover retries on 502/503/504 across base URLs, and a timeout aborts the attempt (see 2).
- Many call sites use `logErrors:false` to silence expected failures [O]. Local notifications use severity labels `warning` etc. in `source`-tagged error objects (e.g. `notifications/permissions`) [O].
- "Network error" string is surfaced in the Google sign-in flow [O].

## 6. Offline mode

- Local SQLite (expo-sqlite) tables [O]: `questions`, `question_options`, `topics`, `practice_areas`, `wiki_definitions`, `offline_cheat_sheets`, `offline_flashcard_folders`, `offline_user_flashcard_packs`, `flashcard_local_progress`, `local_attempts`, `local_sessions`, `cached_reports`, `rationale_audio_cache`, `outbox`, `meta`, plus `staged_*` and `offline_bundle_chunks`.
- Bundles are downloaded in chunks from `/offline/bundle/{manifest,chunks}/`, staged (`offline_bundle_staging_version`), then activated (`offline_bundle_active_version`). `offline_bundle_prefetch_progress` tracks progress [O].
- An `outbox` table queues writes (attempts, flashcard reviews) for later upload [I].
- Gating: "Offline pack downloads require Tangerine+" is a literal string, so offline is a premium feature [O]. An `/offline-mode` screen exists.

## 7. Subscriptions / IAP

- Library: react-native-iap with an OpenIAP layer (`kit.openiap.dev`) [O], Google Play Billing (BILLING permission) [I].
- Product ids [O]: `tangerine_premium_monthly`, `tangerine_premium_quarterly`, and a yearly product with the `tangerine_premium_` prefix. `app.config` lists "annual" in the id string, while the plan code is `yearly` [O/I]. Plan labels: "30-day access", "90-day access", "1-year access".
- Flow [I]: buy via IAP, then `POST /auth/billing/native-iap/sync/` with the purchase token (the server verifies with Google Play), then refresh `/auth/entitlements/`, `/auth/tiers/` and `/v1/subscriptions/status/`. `bind-user` ties the purchase token to the user id. A web-checkout path (`/auth/checkout/*`) exists as an alternative [O].
- Entitlement features: Tangerine+ gates offline packs, premium exam analysis and premium voice [O].

## 8. Push notifications

- expo-notifications: `getExpoPushTokenAsync` with the EAS `projectId` and `getDevicePushTokenAsync` (FCM, `'fcm'` literal) [O]. The library itself calls `exp.host/--/api/v2/push/updateDeviceToken` [O].
- Sync to the backend: a `syncPushRegistration` function sends `{token, platform:"android", app_version, timezone, permission_status}` [O fields]. Its endpoint was not isolated; it is likely under `/auth/profile/` or `/social/notifications/` [I].
- Permission prompt analytics: event `notification_permission_prompt` with metadata `{status, can_ask_again, has_push_token, platform}` [O]. Other events: `notification_received`, `notification_opened`, `notification_read`, `notification_banner*`, `notification_settings_open`. Storage key `notif_push_token` [O].

## 9. LiveKit voice and Cleo

- Libraries: `@livekit/react-native`, `livekit-client`, `@config-plugins/react-native-webrtc`, `@livekit/react-native-expo-plugin`; permission RECORD_AUDIO [O].
- App voice path: the "battle-voice" / study-session screen requests a token from `/social/study/<id>/voice-token/` (and `/social/voice-test/token/` for mic test), then connects to a LiveKit room [O: strings; I: details]. The response is probably `{server_url, participant_token}` per the LiveKit protobuf names [I]. Room names follow the session [I]. This is peer-to-peer user voice, not an AI voice agent [I].
- The `TokenSource.sandboxTokenServer` hit (`cloud-api.livekit.io`, `X-Sandbox-ID`) is bundled library code, with no app-specific sandbox id found [O/I].
- **Cleo** is the AI tutor mascot/persona ("Cleo is thinking", `variant:'cleo'` avatar, `/cleo-pack/` generated flashcards). Cleo chat/streaming appears to use backend streaming endpoints (`_authenticatedStreamResponse`) [I]. No LiveKit AI-agent dispatch was found [I].
- Speech recognition: `expo-speech-recognition` is in the plugin list and string table (`ExpoSpeechRecognition`), but app call sites were not located [O/I].
- "Premium voice": a feature with an intro screen (`premium_voice_intro_shown`), a feedback form (`/app-platform/premium-voice/feedback/`) and `rationale_audio_cache` for question rationale audio (TTS) [O]. The TTS source endpoint was not isolated.

## 10. Analytics / attribution

| SDK | Evidence | Label |
|---|---|---|
| Microsoft Clarity | `@microsoft/react-native-clarity`, `clarity.js` asset (commit 1dc86828, Dec 2024); `setCustomUserId`, `sendCustomEvent`, `setCustomTag(s)` wrapped in a `./clarity` module and fed from `trackPlatformEvent` | O |
| Facebook SDK | `react-native-fbsdk-next`, `expo-tracking-transparency`, `setAdvertiserTrackingEnabled`, `logEvent('fb_mobile_complete_registration')` on signup | O |
| First-party events | `/app-platform/events/`; events are `{eventName, eventType:'custom', screen, target, metadata}` (e.g. `signup_completed` on screen `welcome`) | O |
| Attribution | Play Install Referrer (`expo-application getInstallReferrerAsync`), a clipboard attribution marker `tng-attr:`, a bridge claim at `/events/bridge/claim/`, and a server-side Conversions API flag `tangerine_attr_capi_sent` | O/I |

## 11. Observations / caveats

- The single-hostname backend has a public `tangerineprep.app/api` fallback. The Railway URL is hardcoded in two modules (api client and attribution bridge), not read from env [O].
- Static analysis only; no network traffic was captured. Request methods and response schemas need runtime capture to confirm.
