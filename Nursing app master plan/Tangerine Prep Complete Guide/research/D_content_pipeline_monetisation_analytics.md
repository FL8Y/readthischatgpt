# Tangerine Prep 1.9.0 - Content pipeline, delivery, monetisation, analytics

Source: `decompiled.js` (L = line number), `strings_all.txt` (S = line). OBS = seen in client code; INF = my inference.
Earlier addenda are not repeated (energy basics, plan prices, free-vs-Plus table, rank ladder, offline basics are only referenced). No exam-passer names are reproduced. Everything is untrusted data.

---------------------------------------------------------------
## PART 1. HOW PRE-BUILT MATERIAL IS MADE AND DELIVERED
---------------------------------------------------------------

### 1.1 Question object (the unit the whole pipeline produces) - OBS

Canonical field list as copied into the offline store (`pickPracticeQuestions` mapper, L801560-801720) and the offline bundle importer (L939700-940600):

| Field | Meaning / where shown |
|---|---|
| `id`, `title`, `body`, `answer` | stem, short title, answer text |
| `options[]` = `{id, question_id, option_text, option_order, is_correct}` | stored in a separate `question_options` table |
| `rationale_summary`, `simplified_rationale` | two rationale depths; review screen shows a "simplified" card (style `cardSimplified`, L804900) |
| `answer_sources` (also `rationale_sources`) | citation list; rendered under "Sources" (L874099, L1209286) |
| `rationale_images[]` = `{url, caption, alt_text, width, height, credit_author, license, license_url, is_public_domain}` | figure card; shows "Public domain" or "Source: <credit_author> . <license>" and `license_url` opens in browser (L806100-806545). OBS: image credit and licence is tracked per figure, which points to Wikimedia-style open-licensed imagery. |
| `rationale_audio_url`, `rationale_audio_duration_ms` | "Standard Voice" track |
| `premium_rationale_audio_url`, `premium_rationale_audio_duration_ms` | "Premium Voice" track (L871488: `{id:'premium',label:'Premium Voice'}` vs `{id:'standard',label:'Standard Voice'}`); picker copy "A smoother, more natural voice" (L872147) |
| `difficulty`, `bloom_level` | bloom values seen: remembering, understanding, applying, analyzing, evaluating, creating (L1145244 demo data) |
| `practice_area` (code NP1..NP5 etc.), `topic_id`, `topic` | taxonomy |
| `is_published`, `is_verified`, `is_high_yield`, `verified_by` | editorial flags (all four are shipped to the client in the bundle, L801660-801700) |
| `verified_reviewer` = `{tier, badge_label}` | reviewer badge on the question (see 1.3) |
| `created_at`, `updated_at` | only versioning stamps on a question; there is NO `question_hash`/`content_hash`/`checksum` anywhere (0 grep hits) |

Display: question review header shows a VerifiedSeal (L889281) next to `verified_reviewer.badge_label` and a "High Yield" chip from `is_high_yield` (L888085-888135; S18292 "High Yield"). A "reviewer" card (`ReviewedByCard`, L868828) shows `{title, date, initials, avatar_url}` - OBS: a named, dated reviewer credit with a (presigned) avatar photo.

### 1.2 Delivery: online vs offline bundle - OBS

Online: `/sessions/...` serve questions per session; `pickPracticeQuestions[BySelection]` reads local SQLite when offline (L801735-803121).

Offline "library" bundle (Tangerine+ only; entitlement is checked inside the importer, `entitlement` step in the flow L939700-940600):

| Step | Evidence |
|---|---|
| 1. `GET /offline/bundle/manifest/` (timeout message "The offline library manifest timed out.") | L942550 |
| Manifest fields: `version`, `chunk_count`, `practice_areas[]`, `topics[]`, `question_count`, `option_count` | L939900-940030; "Offline library manifest was incomplete." |
| 2. staging tables created, then per-chunk `GET /offline/bundle/chunks/<n>/?version=<v>` ("Offline question batch N timed out.") | L942592; migration v9 `offline_bundle_resumable_staging` (L795471): `staged_practice_areas`, `staged_topics`, staged questions/options, plus `offline_bundle_chunks(version, chunk_index)` as the resume ledger |
| Each chunk returns `questions[]` and `options[]` | L942642 (`/offline/bundle/` handler uses `.questions`, `.options`, `.practice_areas`) |
| 3. `activation` step swaps staging into live tables; counters `dropped_questions`, `downloaded_questions`; message "N questions are ready offline." | L940330-940600 |
| Resume: events `chunk_resumed` / `chunk_staged` / `chunk_fetched`, `resumed_chunks`, `progress_percent`, `fetch_ms`, `stage_ms` | analytics metadata in same range |
| Prefetch cadence | `PREFETCH_INTERVAL_MS = 86400000` (24 h), `last_prefetch_at` in `meta` (L940816-940825); returns `skipped_recent` if refreshed inside the window (L939724) |
| Offline use window | `OFFLINE_WINDOW_MS` (24 h per copy: "keep studying for up to 24 hours with no connection", S2513); entitlement cached as `entitlements_snapshot` in `meta` |
| Self-heal | `invalidateEmptyQuestionLibrary` -> `offline_library_invalidated` action `invalidate_empty_snapshot` (L1021079) |

Format and chunking: JSON rows stored as `payload TEXT` JSON blobs in SQLite (`questions`, `question_options`, `practice_areas`, `topics` all `payload TEXT`, L795955-795990). Chunk size is server-decided (client only reads `chunk_count`). OBS: no per-chunk hash, no signature, no delta format. Versioning is one opaque bundle `version` string; a new version means refetch of all chunks (INF: no delta updates - the client has no diff logic). Migration v10 (L795473) deletes cached options/questions ("question_cache_reset") when the schema changed, i.e. the cache is treated as disposable.

Other offline artifacts (all `payload` JSON): `offline_cheat_sheets(id, version, payload)` (v6), `offline_flashcard_folders(folder_id, release, payload)` (v7), `offline_user_flashcard_packs(pack_key)` (v8), `rationale_audio_cache(question_id, field, data_uri, bytes)` (v10), `wiki_definitions` cache (v4), `cached_reports` (v5), `flashcard_local_progress` (v11), `outbox(kind, payload, client_id, attempts)` for sync (L796046). Audio is stored as base64 `data_uri` in SQLite, so size is tracked in `bytes`; stats query counts questions that have either audio URL (L800722). `stableIdempotencyKey` (L840790, 4x32-bit FNV-style hash of fields) is used for outbox de-dup, not for content hashing.

Cheat sheets: `GET /study-sheets/` (list) and `/study-sheets/<id>/` (detail with `sections`, `version`, `figures[{url}]`); figures use `/api/assets/<id>?delivery=proxy` and a fallback URL helper (L1109917-1109943). OBS: the reader blocks screenshots via `preventScreenCapture` and logs `cheat_sheet_capture_protection_enabled` (L1103407) - content is treated as protected IP. Free users get a timed preview (`cheat_sheet_preview_gated`, `preview_ms`; timer constants 15/25 unresolved, L1104225); list items carry `is_locked` (L1119288). Reader supports pen/highlight layers (L1113750).

Case studies ("situations"): `/situations/v2/<id>/items/<n>/answer/`, `/situations/<id>/items/<n>/report/`. Sample data `SAMPLE_SITUATIONS` ships in the bundle and the player accepts a `sample-` id mode (L1361568+24..295, L1366495). Item `type` values: `mcq`, `sata`, `matrix`, `cloze` (with `blank` segments + `correctIndex`), `highlight` (tokens). Each item has `seq`, `bloom_level`, `difficulty`, `title`, `body` (markdown `**first**`), `rationale`. Situation header fields: `practice_area` ('NP4'), `pnle_np` ('NP5'), `tos_section` ("Concepts on Acute Biologic Crisis"), `stem`. This is next-gen (NGN-style) item design aligned to the PNLE TOS.

Library (AI generation from the learner's own files): source object `{status ('processing'|failed...), processed_pages, page_count}` drives the "Reading source..." progress bar (L1008770-1009540); copy "Sources are read once and reused. Scans, photos and documents over 100 pages may use more of your weekly credits." (S389). `/library/usage` returns `weekly_used/limit/remaining(_percent)/reset_at`.

### 1.3 Verified-reviewer tiers - OBS

- Only two tiers exist in the UI: `rn` -> label "RN Verified", `topnotcher` -> "RN Topnotcher Verified" (S17971, S24242; `VerifiedSeal` L889281-889330; colours `pnleBadgeColor` L1037793: RN orange, Topnotcher gold; `VERIFIED_GOLD`).
- The same `rn` / `topnotcher` badge object is the user-profile `pnle_badge` (L1038984, L1050537) tied to the August 2026 results roster (`pnle_badge_roster_august_2026_v1`, S82777).
- Also separate badges: "Verified staff account" (`is_staff`), "Verified school".
- INFERRED: question reviewers are licensed nurses (RN) or board topnotchers recruited from the same PNLE results list; `verified_by` links a question to such a person, and `ReviewedByCard.title` is their credential line.

### 1.4 Content reporting loop - OBS

| Surface | Call | Fields | Options |
|---|---|---|---|
| Question (`questions/[id]`, review) | `POST /questions/<id>/report/` L1319841 | `report_type`, `content_type:'question'`, `notes` (analytics `report_question_submit` with `hasNotes`) | `unclear` ("Wording or phrasing is confusing."), `too_long` ("Stem is longer than it needs to be."), `incorrect` ("Answer or rationale looks wrong."), `other` (L1320591-1320597) |
| Case-study item | `POST /situations/<id>/items/<n>/report/` L1103118 | `report_type`, `notes` | same four (item wording) L1365984-1365990; error "Failed to submit situation item report" |
| Ask Cleo message | "Report this message for review?" (S82765) | n/a | moderation of AI output |
| App feedback / crash | `/app-platform/feedback/` L776988, `/app-platform/errors/` L777317 | `client_event_id`, rating, comment, screen, metadata | |
| Premium voice | `POST /app-platform/premium-voice/feedback/` L777018 | `client_event_id, rating, comment, screen, metadata`; asked after N plays (`premium_voice_play_count_v1`, `PREMIUM_VOICE_FEEDBACK_AT`, L873367) | |
| Surveys | `pmf_survey_*` (L979829-980208), `ask_cleo_survey_shown` (L812207) | PMF ("how disappointed") style | |

INF: reports land in a moderation queue; "too_long" exists because items are LLM-authored and over-long stems are a known failure mode.

### 1.5 Internal / staff tools - OBS

| Route | Gate | What it shows | L |
|---|---|---|---|
| `/design-lab` | `is_staff` (L932164; home row "Design lab - Staff-only 3D primitives preview") | UI primitives + links to the labs below | L932187, L1362694 |
| `/model-lab` (API `GET/POST /model-lab/compare/`) | staff | Side-by-side LLM compare. Models: `candidate_pro` "5.6 Luna Pro", `deepseek_v4` "DeepSeek V4 Pro", `deepseek_v4_flash` "DeepSeek V4 Flash". Presets/tasks: `exam_report_analysis`, `tag_generation`, `blooms_check` ("Bloom's taxonomy check"), `question_rewrite`. Body `{preset, input, models}`. Sample inputs are 4 nursing MCQs (immunization referral, prioritization, suicidal-ideation communication...) L1145200-1145330, and four mock score messages | L1130450-1130464, L1145244 |
| `/rationale-video-lab` | staff | HLS player: `GET /design-lab/rationale-video/playback/<id>` returns `playback_url`, `expires_at`/`expires_in`, `issued_at_ms`; client schedules a refresh (`getPlaybackRefreshDelay`), quality selector, PiP, fullscreen; message "The video is still being prepared." Events `design_lab_rationale_video_{started,ready,paused,link_renewed,quality_selected,pip_*,fullscreen_*,refresh}` | L1131485, L1332786 |
| `/townhall-lab`, `/apex-rank-lab`, `/battle-topic-wheel-lab`, `/fabricated-battle-royale`, `/server-health` | staff / ping chip (`ping_chip_tap` -> `/server-health`) | UI previews and connectivity | L1131433-1132074, L982506 |

Rationale video is NOT in the learner flow in 1.9.0 (only in the lab); the question object has no video field. INF: a rationale-video product is in development behind signed HLS links (short-lived CDN tokens).

### 1.6 Embedded demo label `np5-gpt41-raw-output` - OBS/INF

OBS L1366495: a sample situation `{id:'np5-gpt41-raw-output', title:'Mang Tomas After a Warehouse Collapse: Multi-System Trauma', practice_area:'NP4', pnle_np:'NP5', tos_section:'Concepts on Acute Biologic Crisis', stem..., items: 4 mcq/matrix/cloze/highlight/sata}`. The id literally reads "NP5 / GPT-4.1 / raw output". INF: the NP5 case-study generator ran on GPT-4.1 and this unedited output was pasted in as test data. Note the inconsistency (`practice_area` NP4 vs `pnle_np` NP5), a sign it is not hand-edited.

### 1.7 INFERRED authoring and QA pipeline

1. Blueprint: PNLE TOS (NP1-NP5 areas, `tos_section`) -> topic tree (`practice_areas`, `topics` with `sort_order`).
2. Generation: LLM drafts (GPT-4.1 for case studies per 1.6; DeepSeek V4 and an in-house "Luna" model being A/B'd in model-lab) producing stem, options, `rationale_summary`, `simplified_rationale`, sources.
3. Enrichment LLM tasks (model-lab list): `tag_generation` (topic/tags), `blooms_check` (bloom_level assignment/validation), `question_rewrite` (clean-up, shorten), `exam_report_analysis` (learner-facing).
4. Human QA: nurses/topnotchers set `is_verified` + `verified_by`; admin flips `is_published`; `is_high_yield` set editorially. Learners feed back via report types 1.4.
5. Media: images with per-figure licence/credit (public-domain or open-licensed); audio rendered per question in two voices (standard + "premium", likely neural TTS; S2558 "Rationale narration position"); both stored as URLs and offline-cached.
6. Release: no client hashes or signatures -> bundle `version` set server-side; chunks served by `/offline/bundle`; cheat sheets and flashcard folders versioned by integer `version` / `release` label.
No admin/editor UI exists in the client (no create/edit-question screen); authoring lives in the Django-style backend (`/auth/`, `/exam-report/` style routes, Railway host) - OBS host strings at L777448, L783336.

---------------------------------------------------------------
## PART 2. MONETISATION
---------------------------------------------------------------

### 2.1 Tiers and entitlement - OBS

- Tier codes: `free` (default), `student` (label "Student" L1018100 region) and Plus ("Tangerine+"). `isPremiumEntitlement(entitlements)` reads `entitlements.tier.code` and `payment_plan` (L859560-859600; `getEntitlementSnapshot`). `GET /auth/entitlements/` L859426; `energy` block rides on it (`energy.current/max/unlimited/next_regen_at/regen_seconds`).
- INF: Student price tier is unconfirmed; only code and label exist.
- Hook `useEntitlements().isPremium` drives all gates; 403 bodies carry `requires_premium` (case studies L1362198, L1362586) and `premium_required` (L825490, L1104429); offline sync skips non-premium (`skipped_non_premium`, L939626).
- A third-party subscription "kit" API exists: `/v1/subscriptions/status/`, `/entitlements/`, `/bind-user/` with `userId`, `apiKey`, `baseUrl` (L898204-898520, `kitApi`). INF: server-side receipt/entitlement broker; native SDK events seen: InGracePeriod, InBillingRetry, Paused, Revoked, PriceChange, Recovered (S2692, S6755, S8292, S20287, S21687).

### 2.2 Plans and prices - OBS (detail beyond earlier notes)

| Plan | Native product id (L892411-892500) | Subtitle / badge | Web "pass" |
|---|---|---|---|
| monthly | `tangerine_premium_monthly` | "30-day access" / "Flexible short-term access", PHP 399 | 30 days of Tangerine+ |
| quarterly | `tangerine_premium_quarterly` | "90-day access" / "Best for a full review sprint", PHP 799 | 90 days |
| yearly | `tangerine_premium_annual` | "1-year access" / "Lowest cost per month", badge "Best value", PHP 1,999 (strike price `originalPriceText` '₱1,999' L1018691) | 1 year |

Promo OBS: "Early Bird Promo - 25% off . Limited time" (L1017813); `YEARLY_OFFER_START='2026-09-13T13:00:00Z'`, `YEARLY_OFFER_DURATION=1209600000` (14 days -> ends 2026-09-27T13:00Z), `useYearlyOfferCountdown` renders "Nd Nh Nm" (L1022950-1023140). Hard-coded strings 'PHP 399/799/1,999' L1017588-1017597 are fallbacks when store prices are unavailable; store price loaded via `productsById[...].price/displayPrice`.
Voucher: `POST /auth/checkout/create/` takes `{plan, voucher_code}` (L906642). No voucher-entry UI string found -> OBS API-level only; INF used for campus/ambassador promo codes.
Gifting / "paying for": `fetchPayingForToken` + `&paying-for=` param on the web pricing link (L906715-906830) lets someone pay on behalf of another account (INF: sponsor/gift flow); no gift UI in app.
Trial: no free trial (`FREETRIAL` S10521 and `FREE_TRIAL` S13178 are store-SDK enum constants). Instead: one free AI report unlock (`/exam-report/free-unlock/` "You have one free unlock!" L879313) and an Android beta grant (modal "YOU'RE IN - N days of premium, unlocked", events `beta_offer_shown`, `beta_granted_ok`; L1144363-1144500).

### 2.3 Checkout paths - OBS

Decision logic (`usePlanPurchase`, L890255-890384): event `upsell_plan_purchase`; if `ANDROID_WEB_CHECKOUT` (expo config `extra.androidWebCheckout`, L907039) -> `openWebPricing`; else native IAP via react-native-iap (Nitro): `requestPurchase({type:'subs', sku, offerToken, appAccountToken (apple) / obfuscatedAccountId (google)})`, then `POST /auth/billing/native-iap/sync/` with `{plan, product_id, transaction_id, original_transaction_id, purchase_token, signed_transaction, purchase_state, transaction_date, store, platform, environment, price, currency}` (L892411) and `finishTransaction`. Modes 'buy' vs 'storeDead' (store unavailable falls back to web). Restore = `getAvailablePurchases` -> sync each (event `subscription_native_iap_restore`; errors "No active purchase was found yet." / "Could not restore purchases."). Recovery retry loop `NATIVE_IAP_RECOVERY_RETRY_MS`, `isRetryableNativeIapSyncError` -> `subscription_native_iap_recovered`.
Channels: `IS_ANDROID_DIRECT` = update channel 'android-direct' (sideloaded APK), `ANDROID_PLAY_STORE_URL` = Play listing id `com.tangerineprep.app` (L907040-907054); a `SideloadMigrationModal` nudges direct-APK users to the Play version (`sideload_migration_shown`, L1077229).
Web checkout (route `/checkout`, L1121700-1123600, PayMongo-style intent flow - INF from status names):
1. `POST /auth/checkout/create/` -> `{intent_id, amount, status, qr_code, checkout_url}`; event `checkout_web_created`.
2. Screen copy: "QR Ph . pay with any participating bank or e-wallet", steps "Screenshot the QR code above / Open GCash, Maya, or your banking app / Choose Pay QR / Scan QR, then upload the screenshot / Come back here - we confirm your payment automatically." "One-time payment. No auto-renewal."
3. Poll `GET /auth/checkout/<intent_id>/status/`; pending set `awaiting_payment_method, awaiting_next_action, processing`; `succeeded` -> `checkout_web_success`, refresh entitlements, haptic. Fallback button "Open secure checkout instead" (`checkout_open_hosted`, opens `checkout_url`). Errors: "Could not load the payment QR.", "This payment did not go through. You can start over to try again."
4. Browser path: `POST /auth/checkout/token/` mints a short token appended to `https://tangerineprep.app/pricing?source=android_app&plan=..` (L906800-906900; failure event `checkout_token_mint_failed`). Hosts: web `https://tangerineprep.app`, API `https://tangerineprep.app/api` and Railway `tangerine-backend-production.up.railway.app` (L783336-783482).
Subscription screen (`/subscription`, L1017000-1022500): plan cards, comparison table (see earlier notes), "How checkout works" 3-step block (Open pricing page / Pay with GCash, Maya, or your bank / Tangerine+ unlocks right here), "Restore or manage purchase", legal line ("auto-renew... cancel at least 24 hours... Cancel anytime in your [store settings]"), links `/eula`, `/privacy`; offline guard "Subscribing needs a connection". Active-state copy: "You're on Tangerine+." and "<plan> plan is active. Manage or renew it from the website pricing page." (L1019351) - cancel/manage is done at the store (IAP) or the website (web passes). Web passes do not auto-renew, so "cancel" does not apply to them.
Claim: "Tangerine+ learners have a 35% higher passing probability" (L1017185; INF marketing claim, no evidence in client).

### 2.4 Limits and mechanics

| Mechanic | Free | Plus | Evidence |
|---|---|---|---|
| Energy | cap 20 (copy), cost 1/answer, regen `regen_seconds` default 3000 (50 min/pt, INF), "Next energy in ...", school bonus +5 ("Set your university for plus 5 energy", L861868), mid-session `energy_bonus.amount` in answer response (L1342078) | `energy.unlimited` | L860711-860800; 4xx body `no_energy` stops the session (L1317632, L1342478) |
| Lives | not a feature: only error key `no_lives` exists (L1317641, S50206); no UI (INF: legacy/unused or battles) | - | |
| Ask Cleo | quota in daily AND weekly windows: `daily_limit/used/remaining(_percent)/reset_at`, `weekly_*`; copy "Free credits refresh automatically", "Your remaining Ask Cleo allowance. Text and voice messages share this allowance." (S25700); response may need more credits than remain ("not enough for this response") ; endpoint `/sessions/ask-cleo/v2/usage/` L852286 | multiples shown as "N x" via `cleoPricingLimits` (free is "1x") | L817850-818010, L824177 |
| Session start (exam) | `session_start_limit_reached` with `quota_kind` (e.g. 'exam'), mode standard/ai; body `limit_reached` | higher/unlimited | L860300-860440 |
| Library AI | weekly credits (`/library/usage`), file pages count (>100 pages costs more) | more credits | S389, L1208308 |
| Flashcards | `FREE_MY_FLASHCARD_LIMIT` = 100 personal cards ("100-card limit reached") | unlimited | L843965, L1187806 |
| Cheat sheets | timed preview then gate | full | 1.2 |
| Case studies | 2 cases (copy) enforced by server `requires_premium` | full | L1362198 |
| Offline | none | downloads + 24 h offline | |
| Exam report | one free AI analysis unlock (`/exam-report/free-unlock/` -> `granted/used/available`), then "Unlock full analysis"; premium analysis endpoint `/exam-report/analysis/premium/` | full | L879313, L890157 |
| Review | answers visible as right/wrong only; question text/options/rationale locked ("Upgrade to review") | full | S13726, S18366 |
| Performance | 30-day trend and weak areas locked; "Unlock your forecast" | full | L1238318-1238396 |
| AI Curator exams | locked ("Unlock AI Curator exams") | unlimited | L1153974 |
| Premium Voice | listed as a voice option; gating inside audio player not isolated (INF: Plus-only, with `premium_voice_intro_shown` explainer) | | L869188, L871488 |
| Daily recommendations | unlock after 30 practice questions (not paywall) | | L1155450 |

### 2.5 Paywall triggers (feature -> surface -> event) - OBS

| Gate | Copy (short) | Event / target | L |
|---|---|---|---|
| Generic `PremiumFeatureUpsell` modal | feature-specific text; button "See plans" -> `/subscription` | `premium_feature_upsell_shown/_dismiss/_see_plans` (metadata `feature`) | L857908 |
| Out of energy modal | "You've used all your energy, so this session can't continue. Get Tangerine+ for unlimited energy." Buttons Get Tangerine+ / Quit | `out_of_energy_modal`, `energy_modal_upgrade`, `out_of_energy_upgrade` | L1143940 |
| Review (post-exam) | "Upgrade to read each question, see the correct answer, and unlock full rationales." | `review_upgrade_banner`, `review_question_upsell`, `review_unlock_upgrade`, `review_upsell_see_plans`, `paywall_sheet` | L1147450-1147591, L888525, L1150791 |
| Exam report | "Unlock full analysis" | `exam_report_premium_tap` | L878824, L883325 |
| Cheat sheets | "Cheat Sheets are a Tangerine+ feature" / "Upgrade to open the full compact reader." | `cheat_sheet_preview_gated`, `cheat_sheet_reader_upgrade` | L1103863-1104985 |
| Flashcards | "Flashcards are a Tangerine+ feature"; 100-card cap | - | L1182669, L1174224 |
| AI Curator | "AI Curator exams are a Tangerine+ feature" / "Upgrade to start personalized exams built from your chosen topic or learning patterns." | `ai_curator_start_upsell_shown`, `ai_curator_upsell_see_plans`, `ai_curator_upsell_dismiss` | L1153769 |
| Ask Cleo quota | "Upgrade to keep chatting with Cleo after your free credits run out." | `ask_cleo_limit_upgrade`, `usage_upgrade` | L825604, L1226955 |
| Case study | "Case studies are multi-step clinical scenarios... Upgrade to open this one" | `situation_locked_view` | L1362216, L1363685 |
| Performance | "Upgrade to see your weak areas and 30-day trend." / "Unlock your forecast" | `performance_upgrade` | L1238436 |
| Offline | "Unlock offline downloads", "Offline pack downloads require Tangerine+." | `offline_mode_upgrade` | L1178298, L1192034, L1230437 |
| Study plan | banner "STUDY PLAN UPGRADE BANNER" | `study_plan_upgrade_banner_shown` | L1131711, L1424845 |

---------------------------------------------------------------
## PART 3. ANALYTICS, FLAGS AND EXPERIMENTS
---------------------------------------------------------------

### 3.1 Transport - OBS
- Queue with two kinds, `event` -> `POST /app-platform/events/` and `error` -> `POST /app-platform/errors/` (L940808); payload `{client_event_id, event_name, event_type, screen, target, action, attribution, metadata}` (L776693). Flush constants 500 / 8000 (count/ms, INF) and `/sessions/sync/` for study data. `tangerine_app_attribution_id` (S27971) is an install/attribution id sent in `attribution`. Heartbeat `app_foreground_heartbeat`.
- Two emitters: `trackPlatformEvent({eventName, eventType:'custom', screen, action, metadata})` = 114 distinct names; `trackButtonClick({name, screen, target})` = 311 distinct names.

### 3.2 `eventName` groups (114) - OBS
| Group | n | Notable |
|---|---|---|
| design_lab (rationale video) | 7 | see 1.5 |
| cheat_sheet | 6 | catalog_loaded, folder_loaded, reader_loaded, reader_chrome_toggled, preview_gated, capture_protection_enabled |
| battle (voice/player/wheel/invite) | ~9 | battle_voice_{connected,timeout,retry_exhausted,test}, battle_topic_wheel_revealed |
| subscription/checkout/beta | 8 | subscription_native_iap_{success,error,recovered}, checkout_web_{created,success}, beta_offer_shown, beta_granted_ok |
| offline | ~12 | offline_library_{enabled,invalidated,refreshed}, offline_bundle_{prefetched,prefetch_progress}, offline_rationale_audio_downloaded, practice_session_completed_offline |
| session/questions | 8 | session_start_{limit_reached,no_questions,succeeded}, questions_{first_page_ready,load_complete,routed_topic_preview} |
| onboarding/auth | ~12 | onboarding_{tour_*,completed,auth_reached,loading_test}, signup_{completed,failed}, login_success, forgot_password_*, diagnostic_{started,submitted,completed}, first_session_review_{requested,unavailable} |
| ask_cleo / ai_curator | 6 | ask_cleo_{open,exam_generated,context_attention_shown,survey_shown}, ai_curator_generation_failed |
| rank/social/announcements | ~12 | rank_{spotlight,announcement,season_path_opened}, hall_of_fame_announcement_shown, versus_announcement_shown, townhall_posts_seen, group_study_exam_{entered,finalized} |
| study plan/exam date | 6 | exam_date_{gate_shown,blocker_shown,restored_from_pending}, study_plan_auto_generated |
| lifecycle | ~8 | ota_check_no_update, ota_update_downloaded, update_available_shown, force_update_shown, sideload_migration_shown, notification_{received,opened,permission_prompt} |
| research | 3 | pmf_survey_{shown,submitted}, coaching_waitlist_joined |

### 3.3 Flags / experiments - OBS
- Remote config: `GET /app-platform/onboarding-config/` -> `tour_version`, `flashcard_tour_version` (L936074). `GET /app-platform/version-status/` drives `force_update_shown` / `update_available_shown` (L1079435).
- Build-time: `LIBRARY_ENABLED` / `useLibraryBeta` derived from the update channel (compared with `'testflight'`, L840860-840890; direction not resolved - INF: Library may be limited to TestFlight/beta channel); `extra.androidWebCheckout`; `IS_ANDROID_DIRECT`; `is_staff` gate on labs.
- Experiments: only "waitlist experiment" ("Test accounts are excluded from the waitlist experiment.", S7701) -> coaching waitlist (`/practice/coaching`, event `coaching_waitlist_joined`). No A/B variant keys or experiment library found; paywall copy variants are hard-coded.
- Local one-time flags (AsyncStorage): `premium_voice_intro_seen_v1`, `premium_voice_feedback_done_v1`, `premium_voice_play_count_v1`, `energy_onboarding_seen_v2`, `streak_celebration_last_manila_day`.

### 3.4 Caveats
- Plan price strings are in the client; real charged amounts come from the store/intent (`amount`).
- Student tier details, premium voice gating logic, cheat-sheet preview length, and LIBRARY_ENABLED direction are unresolved.
- The bundle embeds a roster of exam-passer names (not reproduced here).
