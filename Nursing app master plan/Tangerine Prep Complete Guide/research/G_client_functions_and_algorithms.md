# Tangerine Prep 1.9.0 - Client-side Functions and Algorithms

Source: Hermes decompile `decompiled.js` (L<n> = line number). Labels: **O** = observed in code/constants, **I** = inferred from shape or names. Logic is re-expressed in my own words. Names are as preserved in the decompile. No secrets or passer names are included.
Constant-value lookups were done by reading the module-level assignments, so numbers marked O are literal values in the bundle.

## 1. API client (L776000-783500)

Base URL list (L783189-783340): primary Railway `.../api` (listed twice), then `https://tangerineprep.app/api`; empty entries are filtered and trailing slashes stripped (O). `getApiBases`/`getOAuthApiBases` return this list. Token storage key `tangerine_tokens` (O). Constants: `12000` and `10000` ms timeouts (O; the pair is most likely request timeout and reachability-probe timeout, I). Retryable HTTP set `{502,503,504}` (O).

| Function | Line | In -> Out | Logic (own words) | Label |
|---|---|---|---|---|
| `fetchWithTimeout` / `_fetchWithTimeout` | L782297 | (url, init, timeoutMs) -> Response | If a timeout is given, wire an abort signal that fires after that many ms and pass it to global fetch; with no timeout, plain fetch. | O/I |
| `request` / `_request` | L782530 | opts {path, method, body, headers, accessToken, logErrors} -> parsed body | Loop over the base URLs in order. Attach JSON content type and `Bearer <token>` (token from storage unless passed). On a network error or 502/503/504, move to next base (and count attempts). On 401, run `refreshAccessToken` once, then repeat the call with the new token. Non-ok responses are turned into `ApiError` with status and extracted message. If every base fails, throw "Network error calling <path>" with the attempt count. | O (shape), I (order details) |
| `getRequestDedupeKey` / `coalescedGet` | L781021/L781097 | opts -> promise | Only for GET with no body: key built from path + headers + token. A second identical GET in flight returns the same promise. | O |
| `singleFlight(fn)` | L780739 | fn -> fn | Keep one pending promise; callers during flight get it; cleared in `finally`. Used for token refresh and base probing. | O |
| `performAccessTokenRefresh` / `refreshAccessToken` | L781383/L781552 | - -> new tokens | POST `/auth/token/refresh/` with the stored refresh token; on success store both new access and refresh; on failure clear tokens. Wrapped in singleFlight so concurrent 401s share one refresh. | O |
| `shouldClearAuthSession` | L846302 | error -> bool | True if the error object has HTTP status 401. | O |
| `firstReachableBase` / `_firstReachableBase` | L780578/L780714 | bases -> base | Probe candidates in order and return the first that answers; throws "No API base URL configured" if the list is empty. | O (error text), I |
| `pingAfterFailedProbe`, `failureWindowElapsed(lastFailAt, windowMs)` | L780725/L780684 | -> bool | Time-window check: elapsed since last failure >= window. | I |
| `deviceNetworkIsOffline(state)` | L780668 | netinfo -> bool | Offline if `isConnected === false` or `isInternetReachable === false`. | O |
| `OFFLINE_HANDOFF_DELAY_MS` | L780785 | const | `30000` (30 s). | O |
| `isNetworkError`, `getBackendError`, `extractErrorMessage`, `getBodySummary` | L783228, L780863, L780897, L780805 | error/body -> message | Normalise errors: prefer backend `detail`/`message`/field errors, else status text; `isNetworkError` true for fetch TypeError-style failures. | I |
| `resolveBackendAssetUrl(u)` | L783242 | path -> absolute URL | Empty -> ''; if already absolute (regex test), keep; else join to backend origin (base minus `/api`) with a single slash. | O/I |
| `streamJsonLines`, `authenticatedStreamResponse` | L783279/L781638 | -> async line reader | NDJSON streaming for AI answers; adds auth header; refreshes on 401 like `request`. | I |
| `api.get/post/postForm/put/patch/delete` | L783487-783570 | thin verbs over `request`; `postForm` sends multipart. | O |
| `ApiError(status, message, body)` | L783410 | class | Carries status, body and message. | O |

### Idempotency keys (L840723-840871)
- `newIdempotencyKey(prefix)`: returns `prefix:` + a UUID v4. Uses `crypto.randomUUID` when present, else builds a v4 by hand from random hex groups (8-4-4-4-12, with the version nibble `4` and variant bits 8-b). (O)
- `stableIdempotencyKey(prefix, ...parts)`: joins the parts with the 0x1F separator, runs a 32-bit string hash four times with four seeds (`2166136261`, `2654435769`, `2246822507`, `3266489909`, all O), concatenates the four hex results (128-bit-ish digest) and returns `prefix:<digest>`. Same inputs always give the same key, so replays dedupe. (O)
- Neighbouring helpers: `hash32`, `randomHex` (L840648/L840676). Library Beta REST client (`startSession`, `grade`, `uploadSource`, `pollSource`...) in the same region uses these keys.

```
stableKey(prefix, parts):  s = parts.join(US); return prefix + ":" + h(s,seed1)+h(s,seed2)+h(s,seed3)+h(s,seed4)
newKey(prefix):            return prefix + ":" + (randomUUID() or handmade v4)
```

### Client telemetry ids (L776002-776560)
`createId` (base-36 timestamp+random, `_`-joined), `createClientEventId` (UUID-shaped via `seg`), `getOrCreateStoredId`, `getAuthHeader`, `buildCommonPayload` (attribution_id, session_id, occurred_at, platform `android`, app_version, device) and `postTelemetry` (POST JSON, throws "Telemetry request failed with HTTP n"). (O)

## 2. Auth and session storage
| Item | Line | Detail | Label |
|---|---|---|---|
| SecureStore tokens `tangerine_tokens` | L783382 | access + refresh pair; `getTokens/setTokens/clearTokens` | O |
| `tangerine_auth_user` (+ `getCachedUser/setCachedUser/clearCachedUser`) | L846284, L845246 | cached profile for instant start / offline | O |
| `tangerine_entitlements_<userId>` | L858531 | per-user entitlement snapshot cache; `getEntitlementSnapshot` | O |
| `isPremiumEntitlement(e)` | L859565 | Premium if tier code exists and is not `free`, or a non-blank `payment_plan` is present. | O |
| `tangerine_app_attribution_id`, `tangerine_attr_clipboard_tried`, `tangerine_attr_capi_sent`, `tangerine_attr_bridge_claimed_v2` | strings | install attribution flags | O |
| SecureStore helpers `ensureValidKey/isValidKey/isValidValue/byteCountOverLimit` | L777879-778182 | key must match a safe charset; value size capped (limit constant in lib) | O |

## 3. Offline layer

### 3.1 SQLite (db file `tangerine-offline.db`, L787970)
Open pragmas: `journal_mode=WAL`, `busy_timeout=5000`, `foreign_keys=ON` (O, L787588-787610). Migrations use `PRAGMA user_version`; 11 versioned steps (L795452-795475) plus idempotent "ensure table" definitions (L795955-796233).

| Table | Columns (own summary) | Notes |
|---|---|---|
| `questions` | id PK, payload JSON, practice_area_code, topic_id, updated_at | idx on area and topic |
| `question_options` | id PK, question_id FK(cascade), payload, is_correct | correct flag held locally so offline grading works |
| `practice_areas` | code PK, payload | |
| `topics` | id PK, payload, practice_area_code FK | |
| `local_sessions` | client_session_id PK, exam_type, started_at, completed_at, status, score REAL, question_ids_json, total_questions, practice_area_code, server_session_id, synced_at | v2 added the last five |
| `local_attempts` | id AI, client_session_id FK(cascade), question_id, selected_option_id, is_correct, time_taken_seconds REAL, answered_at, order_index | |
| `outbox` | id AI, kind, payload, client_id, created_at, attempts | v3: dedupe then UNIQUE(kind, client_id) |
| `meta` | key PK, value | holds `last_prefetch_at`, `entitlements_snapshot`, `offline_library_enabled`, `offline_bundle_staging_version`, `offline_bundle_active_version`, `pnle_badge_roster_august_2026_v1` |
| `wiki_definitions` | lookup_key PK, payload, found, fetched_at | dictionary cache (v4) |
| `cached_reports` | session_id PK, report_json, analysis_json, created_at | report cache (v5) |
| `offline_cheat_sheets` | id PK, version, payload, downloaded_at | v6 |
| `offline_flashcard_folders` | folder_id PK, release, payload, downloaded_at | v7 |
| `offline_user_flashcard_packs` | pack_key PK, payload, downloaded_at | v8 |
| `staged_practice_areas/topics/questions/question_options`, `offline_bundle_chunks(version, chunk_index)` | staging copies | v9: resumable download |
| `rationale_audio_cache` | question_id PK, field, data_uri, bytes | v10; v10 also wipes question library tables and the meta keys above (forces a clean re-download) |
| `flashcard_local_progress` | source, source_id, card_id, rating, updated_at | v11, upsert on (source, source_id, card_id) |

Repository functions (L798573-803199): `upsertPracticeAreas/Topics/Questions`, `prepareBundleStaging`, `stageBundleChunk`, `activateStagedBundle`, `replaceBundle`, `getPracticeAreas`, `getQuestionsGroupedByTopic`, `getQuestionById`, `pickPracticeQuestions[BySelection]`, `pickTopicQuestions`, `countCachedQuestions`, `computeStats`, `getMeta/setMeta/getMetaByPrefix`, `getCacheSizeBytes`, `invalidateEmptyQuestionLibrary`, `cacheRationaleAudio`, `getRationaleAudioCacheStats`, `clearAll`, `yieldPeriodically` (cooperative yield during big inserts).

### 3.2 Bundle download / prefetch (L939085-940840, L942534-942830)
Constants (O): `PREFETCH_INTERVAL_MS = 86400000` (24 h); meta keys `last_prefetch_at`, `entitlements_snapshot`, `offline_library_enabled`; backoff base `500` ms, cap `8000` ms; a `50` constant sits with them (batch size, I); manifest/chunk request timeout `30000` ms (L942811).

```
shouldPrefetch(): last = meta.last_prefetch_at ; return now - last >= 24h   (true if never)
prefetchBundle():
  if user not premium           -> status "skipped_non_premium"
  if recent (<24h) and not forced -> "skipped_recent"
  manifest = GET /offline/bundle/manifest/            (timeout 30 s: "manifest timed out")
  prepareBundleStaging(manifest.version)               // resume: skip chunk indexes already staged ("chunk_resumed")
  for each chunk index i: fetchChunkWithRetry(version, i) -> stageBundleChunk
       progress events: manifest_started/ready, chunk_fetch_started/fetched/staged, staging_ready, activation_started/complete
  validate: library must contain answerable questions and options, else keep the old library
            ("Offline bundle was incomplete / had no answerable questions; keeping the existing library")
  activateStagedBundle(); meta.last_prefetch_at = now; notifyOfflineLibraryChanged()
fetchChunkWithRetry(v,i): attempt n: GET /offline/bundle/chunks/<i>/?version=<v>
       integrity rule: response.version == requested version AND response.index == requested index,
       else throw "Offline library chunk did not match its manifest."  (this is the only "hash"-style check; no cryptographic hash seen) 
       on failure sleep backoffFor(n) = min(500 * 2^n, 8000) ms (abortable) then retry
```
Label: O for constants/endpoints/messages, I for loop details. `/offline/bundle/` single-shot variant returns keys `questions, options, practice_areas, topics, entitlement` (L942642-942739).

### 3.3 Offline window (L943192-943500)
`OFFLINE_WINDOW_MS = 86400000` (24 h, O), storage key `tangerine_offline_window_start` (O). `markOfflineStart` writes the first-offline time if unset; `computeRemainingMs(start)` = window - (now - start), floored at 0 (I); `clearOfflineWindow` on reconnect. Meaning: free/offline grace of 24 h (I). `OFFLINE_MODE_ENABLED` flag at L1083681 (value from build/env, I).

### 3.4 Outbox and sync on reconnect (L936381-939000)
Provider `OfflineProvider` (L936406) exposes status `idle | syncing | success | failed` (success/failed reset to idle after `2500` ms, O) and re-evaluates on connectivity change and every `60000` ms (O, L937359).

| Function | Line | Logic | Label |
|---|---|---|---|
| `runFlush` | L937446 | Drain in order: flashcard reviews, generic outbox kinds, then finished local sessions; sum sent counts; set status. | I |
| `_pendingCounts` | L937374 | Count rows of outbox per kind plus unsynced completed local sessions. | I |
| `drainFlashcardReviews` / `postFlashcardReview` | L937757/L937954 | POST `/flashcards/review/`. Outcome per row: ok -> `sent` (delete row); HTTP 408, 429 or >=500 (or network) -> `retry` (keep, attempts+1); other 4xx -> `discard` (delete + telemetry "rejected with HTTP n"). | O |
| `drainSessions` / `postSessions` | L938345/L938606 | POST `/sessions/sync/` in slices (slice size constant 50 likely); response per session is `created`, `duplicate` (both mean synced -> `markSessionSynced`) or `error`. 4xx other than 408/429 is non-retryable ("non-retryable payload error"). | O |
| `toSessionPayload` | L938279 | Map local session + ordered attempts to server shape (question id, selected option, correct flag, seconds, answered_at). | I |
| `drainKind`/`postBatch` | L938125/L938829 | Generic batch POST for other outbox kinds, same retry/discard rule. | O |
| `newClientSessionId` | L940840 | Hand-built UUID v4 from 32-bit random blocks (version nibble 4, variant 8-b). | O |
| `createLocalSession`, `recordAttempt`, `advanceLocalSession`, `getLocalSessionAtIndex`, `completeLocalSession`, `listPendingSessions`, `listHistorySessions`, `markSessionSynced`, `isLocalSessionId` | L940931-942388 | Local offline practice runtime. `completeLocalSession` refuses if already synced, reads attempts ordered by id, score = correct/answered x 100 (guard divide-by-zero). | O/I |

## 4. Caches and TTLs
| Name | Value | Where | Label |
|---|---|---|---|
| `PNLE_BADGE_CACHE_TTL_MS` | `3600000` (1 h) | L1305318 | O |
| `PNLE_RESULT_LIMIT` | `100` | L1304524 | O |
| PNLE badge roster cache | meta key `pnle_badge_roster_august_2026_v1`; stored JSON with `expiresAt = now + TTL`; `parseStoredRoster` rejects bad expiry ("Invalid PNLE badge cache expiry"); on expiry refetch via `fetchRosterFromApi`; `normalizeRoster` requires a version and an `RN` roster with `topnotcher` entry (error texts O) | L1304604-1305300 | O |
| Practice-area cache | AsyncStorage key `tangerine_practice_areas_v1`; `getPracticeAreas` calls `/practice-areas/`, writes the cache, falls back to cached value when offline; no TTL seen | L994279-994660 | O/I |
| Premium voice | `premium_voice_play_count_v1`, `premium_voice_feedback_done_v1`; feedback prompt at count `3` (`PREMIUM_VOICE_FEEDBACK_AT`) | L873367-873411 | O |
| Yearly offer window | start `2026-09-13T13:00:00Z`, duration `1209600000` ms (14 d), end = start + duration | L1023125-1023131 | O |
| IAP recovery retry schedule | `[15000, 60000, 300000]` ms | L906596 | O |
| Cheat sheet figure cache | `cacheCheatSheetFigures`, `getSavedSheet`, `getOfflineCheatSheet`, fallback URL `/api/assets/...` | L1015650-1017003, L1109917 | O |
| Misc size limits | `MAX_SOURCE_TEXT_LENGTH = 160000` chars (library paste), `MAX_POINTS_PER_STROKE = 4096` (ink) | L1003777, L1114551 | O |

PNLE search (L1304019-1304381, fuzzy name search over roster): lower-case + Unicode NFD, strip diacritics, collapse spaces; per-token score from exact/prefix/contains plus a bounded edit distance (`editDistanceWithin`; allowed edits grow with token length: roughly 1 for >=4 chars, 2 for >=8); scores of about 0.5/0.35/0.15 mark strong/medium/weak fuzzy hits; results sorted by score, capped at 100. (I for weights.)

## 5. Question and session helpers

| Function | Line | Rule | Label |
|---|---|---|---|
| `getSessionRemainingSeconds({totalSeconds, startedAt, pausedAt, now})` | L1355163 | If no start time or unparsable -> total. Elapsed = floor((pausedAt or now - startedAt)/1000), never negative; remaining = clamp(total - elapsed, 0, total). Pause freezes the clock because pausedAt replaces now. | O |
| Battle clock skew | L1356613, L1357864 | On each live-state payload: `skew = parse(server_now) - Date.now()`. A 250 ms interval computes `remaining = max(0, ceil((endsAt - (Date.now() + skew))/1000))`. `endsAt` = `question_ends_at` in phase `answering`, `reveal_until` in phase `reveal`. | O |
| Battle socket timing | L1358857-1358861 | heartbeat `3000` ms; heartbeat timeout `6000`; presence timeout `12000`; fallback poll `10000` when socket healthy, `2000` when down. `isSocketOpen`, `stopHeartbeat`, `reconcileLiveState`. | O |
| `calculateTime(n)` | L1156646 | Estimated minutes = ceil(n x 50 / 60), i.e. about 50 s per question. | O |
| `getDifficultyLabel(pct)` | L1350035 | <=40 "Likely very hard"; <=60 "Likely hard"; <=80 "Balanced challenge"; else "Likely easy". | O |
| `readinessFor(score)` | L874393 | >=85 "Board-ready momentum" (green); >=75 "Almost there" (green); >=60 "Needs reinforcement" (peach); else "Recovery mode" (red). Same cut-offs in `readinessLabel` (L1129936) and `readinessMessage` (L1145296, longer sentences). | O |
| `caseReadinessFor(score)` | L874420 | >=80 "Strong on this case"; >=60 "Needs another pass"; else "Worth revisiting". | O |
| `isPerfectScore(c, t)` | L874441 | t > 0 and c >= t. | O |
| `getForecastLabel(value, evidenceCount)` | L1234877 | needs >= 5 evidence items, then bands (one cut at 50, others ~65/75): "More preparation needed" < "Keep strengthening weak areas" < "Keep building readiness" < "Stronger passing estimate". Exact middle thresholds not captured. | O/I |
| `hasEvidence(x)` | L1090522 | count >= 3. | O |
| `estimateEvidenceMessage` | L1240583 | If subjects lack data: "Build recent evidence in <list>."; else "Answer N more new question(s) across the five subjects."; base text "Based on recent first answers across five subjects." (estimate uses first-attempt answers, five NP subjects, I). | O |
| `accuracyColor(p)` | L1148357 | >=75 green `#15803D`; >=60 amber `#B45309`; else red `#B91C1C`. `accuracyTint` (L1234424): <60 red `#F43F5E`, <75 amber `#E5A22E`, else green `#22C55E`. | O |
| `normalizedNpAccuracy` | L1090584 | accept number, truthy, clamp into 0-100. | I |
| `sessionAccuracy` | L889756 | correct / answered as percent, rounded. | I |
| Bloom grouping | L1367177 | Six Bloom levels fold into three buckets: remembering+understanding = `recall`; applying+analyzing = `apply`; evaluating+creating = `judgment`. Display order recall, apply, judgment. | O |
| `buildBloomLadder`, `ladderSummary`, `buildCaseReport`, `caseMessage` | L1366689+ | Case-study items ordered by position; per-rung accuracy; summary text picks among "held steady (content problem)", "slipped as thinking got harder", "held the whole ladder"; per-case message "All N items right" / "x of N items right". Percent rounded. | O (texts), I (logic) |
| `buildSampleSessionQuestions` | L1145021 | Builds synthetic report questions for sample/demo exam report: options get ids `9000 + 10*idx`, outcomes `correct/incorrect/unanswered`. | I |
| Flashcard helpers | L1186536-1187260 | Rating set `again/hard/good/easy`. `getLocalMasteryStats`: per folder, mastered = count of good+easy, learning = count of again+hard, percent = round(mastered/(mastered+learning)x100). `advanceFlashcardQueue`: good or easy removes the card; again/hard sends it back later in the queue. `shuffled`/`shuffle` (L1173156/L1183874): Fisher-Yates from the end using Math.random. `getDueLocalFlashcardIds` reads ratings by update time. | O/I |
| Mastery vocabulary | various | status strings seen: `new`, `learning`, `reviewing`, `mastered`, `due`, `weak`, `strong`, `needs_review`. | O |
| `getQuestionLibraryAction` | L1231752 | chooses CTA (download / update / open) from offline library state. | I |
| `getSessionExitPrompt`, `buildPendingCompletionAnswers` | L1359124/L1359174 | Exit confirmation text and the answer list pushed at battle/session completion for unanswered items. | I |
| `getDailyAvailability` | L1159141 | GET `/sessions/daily-availability/`. | O |
| Question `answer_reveal_mode`, eliminated options | prefs | preference key `answer_reveal_mode`; option elimination is UI state only (not persisted). | I |

Option shuffling: no client-side question-option shuffle found; option order comes from `option_order` in the server payload (O in sample builder). Shuffling is used for flashcards only.

## 6. Date and time helpers

| Function | Line | Logic | Label |
|---|---|---|---|
| Manila clock | L983751-983935 | Fixed offset `28800000` ms (UTC+8, no DST). `toManilaDay(date)` reads UTC year/month/day/weekday of the shifted instant. `manilaToday()` = now + offset. `manilaDayPlus(n)`, `manilaDaysInMonth(y,m)`, `manilaMonthLabel`, `manilaMonthStartWeekday` build calendars. `millisecondsUntilNextManilaDay()` = next Manila midnight - now (min 0). `scheduleMidnightRefresh` sets a timer for that delay + `1000` ms to re-render day-based UI. | O |
| `daysUntil(isoDate)` | L1074728 | Parse `YYYY-MM-DD` (append `T00:00:00` if date-only), diff to today / `86400000`, rounded up/down per UI; used for exam-date countdown. | O/I |
| `toIsoDate`, `isIsoDate`, `parseIsoDate`, `todayStr/todayKey`, `getMonday`, `toLocalDateStr` | L918922, L951366, L1048528, L994241, L989393 | ISO date handling and week start (Monday). | I |
| `formatPhtDeadline` | L1128051 | `Intl` with `en-PH`, timezone `Asia/Manila`, short month/day/year, suffix " PHT". | O |
| `formatDuration`, `formatTime`, `formatHoursMinutes`, `formatMinutesSeconds`, `formatTotalTime` | L866907, L873424, L889640, L889678, L1148378 | m:ss with zero-padding (seconds = floor(ms/1000), 60-based); hours variant divides by 3600; invalid -> `--`. | O |
| `formatCooldownRemaining` | L1071410 | seconds under a minute shown as "Ns", else m:ss. `battleCooldownFromPayload` reads error code `battle_queue_cooldown` and `cooldown_until`; `reason_code` `deliberate_queue_exit` treated specially. | O |
| `formatSyncedAgo`, `formatLibrarySize` | L1020774, L1020735 | size: bytes < 1,048,576 shown as KB (1024 base), otherwise MB with one decimal; tiny sizes floor to a minimum 0.1 MB. | O |
| Daily goal | L1128348-1129174 | server fields `daily_goal`, `daily_limit`, `daily_remaining`, `daily_remaining_percent`, `daily_used`, `daily_reset_at`; screen `daily_goal` with setup event `daily_goal_setup`. Reset follows Manila day (I). | O/I |
| Streak | L1350608-1351604 | `streakVariant`: 1 or fewer "started", milestone days "milestone", else "extended". `STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365]` (O). Celebration shown once per Manila day via stored key `streak_celebration_last_manila_day`. Streak count itself comes from the server (I). | O |

## 7. Gamification

Rank module (L1053987-1054100), all O:
- Tiers (index): Student II 0, Student I 1, Scholar III 2, Scholar II 3, Scholar I 4, Topnotcher III 5, Topnotcher II 6, Topnotcher I 7, Apex Topnotcher 8.
- Stars per tier: 3,3,3,3,3,4,4,4,0 (Apex has none).
- `TIER_STARTS` is a running sum: each tier starts after the previous tier's stars plus one, giving points 0,4,8,12,16,20,25,30,35 (computed, I). `MAX_RANK_POINTS` = start of Topnotcher I + its 4 stars = 39 (I); `APEX_FLOOR` = max + 1 = 40 (I); `HARVEST_FLOOR` also exported.
- `tierOf(points)`: clamp points into 0..MAX, then take the highest tier whose start is <= points. `starsOf(points)` = clamped points - tier start. `maxStarsForTier`, `isApex`, `tierName`.
- Season/visual names also defined: `SPROUT 0, BLOOM 2, GROVE 5, HARVEST 7` (tier-index anchors for tree art), `isHarvest`.
- `RANK_CONFIG` (O): `STAR_BAR_SIZE 3`, `WIN_STARS 1`, `LOSS_STARS 1`, `STREAK_THRESHOLD 3`, `STREAK_BONUS_STARS 1`, `FLAWLESS_BONUS_STARS 1`, `DEMOTE_TO_STARS 3`, `SEASON_LENGTH_DAYS 90`, `SEASON_FRAMES_ENABLED true`, `APEX_MIN_STAKE 4`, `APEX_MAX_STAKE 20`, `APEX_EQUAL_STAKE 12`, `APEX_RATING_STEP 100`. The server returns the authoritative rank object (`tier`, `tier_name`, `stars`, `max_stars`, `rank_points`, `is_apex`, `apex_points`, `is_harvest`, `harvest_pts`, `leaderboard_rank`); the client mirrors the rules for display.
- `rankTitle`: "UNRANKED" when none; apex shows "APEX TOPNOTCHER - <n> PTS". `rankLabel`.
- `comboMultiplier(streak)` (L1160421): streak <= 0 gives 1; otherwise min(cap, 1 + step x (streak - 1)) with step `0.2` (cap constant not resolved). `formatMultiplier` appends the multiplication sign. Streak banner colours: >=2 blue, >=4 orange, >=6 red; text "N IN A ROW" and "ON FIRE!" (O). Battle timings `1100`, `750`, `1250` ms animation constants (O).
- Energy: client holds `energy` object from the server (`energy_bonus` also seen); `useEnergyTick` runs a 1 s interval and triggers a refresh when the countdown reaches 0; `OutOfEnergyModal`, `EnergyBonusBurst`, `EnergyOnboardingModal` (seen flag `energy_onboarding_seen_v2`). Regen amounts are server-side. (O/I)
- Badge rosters: `loadPnleBadgeRoster` (see section 4); avatar art/ring lists `AVATAR_KEYS`, `FREE_RING`, `PREMIUM_RING`. NP chip tables `NP_ORDER, NP_SUBJECTS, NP_NUMERAL, NP_HUE` (five Nursing Practice subjects NP1-NP5, I).

## 8. State stores and persisted keys
Stores are React contexts plus AsyncStorage/SecureStore/SQLite meta (no Redux/Zustand found, I).

| Store/provider | Persisted key(s) |
|---|---|
| Auth | `tangerine_tokens`, `tangerine_auth_user` |
| Entitlements | `tangerine_entitlements_<id>` and SQLite meta `entitlements_snapshot` |
| Network/Offline | `tangerine_offline_window_start`, meta `offline_library_enabled`, `last_prefetch_at` |
| Practice areas | `tangerine_practice_areas_v1` |
| UI | `ui_preferences`, `sounds_enabled`, `answer_reveal_mode` |
| Onboarding flags | `battle_intro_seen_v1`, `post_signup_battle_intro_pending_v1`, `cheat_sheet_tools_onboarding_v2`, `question_tools_onboarding_v1`, `energy_onboarding_seen_v2`, `study_plan_upgrade_banner_seen_v1`, `premium_voice_intro_seen_v1`, `mark_rank_announcement_seen` |
| Tagger | `tagger_enabled` (`TAGGER_PREF_KEY`), `tagger_dismiss_count` |
| Streak | `streak_celebration_last_manila_day` |
| Premium | product ids `tangerine_premium_monthly/quarterly/annual` |
| PNLE | meta `pnle_badge_roster_august_2026_v1` |

Feature/remote flags: server `onboarding-config`, `version-status` (force update), `premium-voice`, `coaching_pilot_*`, `design_lab_*` events suggest dev preview screens; `OFFLINE_MODE_ENABLED`, `isTaggerEnabled`, `SEASON_FRAMES_ENABLED` are the local switches seen. No third-party flag SDK found (I).

## 9. Analytics wrapper
- `track(name, props)` (L1142165, L1202205, L1449352): lazy-loads the telemetry module and fires without awaiting; failures swallowed by `catch` (I).
- `trackPlatformEvent` (L776559) posts to `/app-platform/events/` with fields `client_event_id, event_name, event_type, screen, target, action, attribution, metadata`. Related endpoints `/app-platform/errors/`, `/feedback/`, `/onboarding-config/`, `/version-status/`, `/premium-voice/feedback/`. `trackButtonClick` uses type `button_click`, action `press`. `logPlatformError`, `trackLateOperation`, Clarity wrapper (`initClarity`, `identifyClarity`, `setClarityScreen`, `sendClarityEvent`). (O)
- Event naming: lower snake_case `<area>_<object>_<verb>` paired with a `screen` string, e.g. `login_submit`, `battle_pick`, `offline_library_refresh`, `cheat_sheet_download_offline`, `flashcard_folder_study`, `mock_board_start`, `energy_modal_start`. About 311 distinct `{name, screen}` literals found. (O)

## 10. Notifications
Mostly server-driven. Client functions: `registerPushToken` POST `/notifications/register-token/` (`expo_token`); `syncPermissionStatus` POST `/notifications/permission-status/`; `fetchNotificationManifest` GET `/notifications/manifest/`; `setNotificationPreference` POST `/notifications/preferences/` (`key`, `enabled`); `markNotificationOpened` POST `/notifications/opened/` (`delivery_id`); personal messages `/notifications/personal-messages/?limit=`; `deactivatePushToken`; `syncPushRegistration`, `maybeRequestNotificationPermissions`. In-app list built by `buildNotificationItems` (battle invites "invited you to <n> questions", friend requests, DMs; ids prefixed `battle:`, `friend:`, `dm:`; filters all/requests). No client-side local reminder scheduling logic with fixed times was found beyond library `scheduleNotificationAsync` (not called with app constants). (O/I)

## 11. Text, number, validation helpers
| Function | Line | Rule |
|---|---|---|
| `formatPesos(n)` | L906963 | divide by 100 (value in centavos, I), format `en-PH` locale, prefix "PHP ". O |
| `formatCount(n)` | L1234837 | thousands separators via regex. O |
| `stripInlineMarkdown` | L868313 | remove `*`, `_`, `~`, backtick characters. O |
| `parseMarker` | L868324 | detects a line ending with a colon as a heading-style marker. I |
| `stripCheatSheetRichText` | L1103521 | `**bold**` and `*italic*` unwrapped; `~acid[..]` / `~base[..]` markup unwrapped; `->FIG:id` and `->TBL:id` references become "see id". O |
| `flattenListItems`, `buildCleoCheatSheetContext` | L1103560, L1103728 | flatten nested bullet lists for AI context. I |
| Pluralisation | many | inline ternary: singular when count equals 1 ("question"/"questions"). O |
| `isValidKey/isValidValue` (SecureStore), `validateClarityConfig`, `validateReceipt`, `validateNitroProduct/Purchase`, `validateDateComponentsInTrigger` | libs | library validators. O |
| IAP: `normalizeErrorCode`, `isUserCancelledError`, `isDuplicatePurchaseError`, `isRetryableNativeIapSyncError`, `syncNativeIapPurchase` (retries on the 15 s / 60 s / 5 min schedule) | L903019-906596 | purchase recovery. O/I |

## 12. Not found / open items
- Combo cap constant (`comboMultiplier`), middle forecast thresholds, exact PNLE fuzzy weights: not fully resolved.
- No option shuffling for MCQs, no spaced-repetition interval math beyond rating buckets, and no cryptographic hash validation of offline chunks were found in the client; readiness/passing estimates shown are mostly server-computed with client labelling.
