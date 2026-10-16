# Addendum: AnkiDroid 2.25.1 core engine (librsdroid.so)
Method: `strings`/byte-regex over `ex/lib/arm64-v8a/librsdroid.so` (23.6 MB, arm64, Rust, symbols stripped) and files in `ex/assets`. No code executed.
Labels: **OBSERVED** = literal string/file seen. **INFERRED** = deduced from upstream Anki knowledge or string adjacency.

## 0. What it is
- OBSERVED: Rust crate paths `anki/rslib/src/...` (upstream Anki `rslib`) with an `ankidroid/db.rs` shim; build path `/Users/runner/.cargo/...` (GitHub macOS CI). Release string `android26.05` next to the update-check code.
- OBSERVED crates (versions from registry paths): rusqlite 0.36 (SQLite bundled/FTS3-5/rtree/json1 strings present), **fsrs 5.2.0**, **burn 0.17.1** (burn-ndarray/autodiff/core/tensor; CPU tensors for FSRS training), ndarray 0.16.1, prost-style protobuf decoding ("invalid wire type"), reqwest 0.12.24 + hyper 1.6 + rustls 0.23 (+ native-certs, webpki), tokio 1.45, zstd-safe 7.2.4, zip 4.1, flate2 1.1 (zopfli present), csv 1.3, html5ever 0.35 + **ammonia 4.1.2**, nom 8, regex 1.12, blake3, chrono, rayon.
- INFERRED: the Kotlin app talks to the engine through one JNI entry point carrying (service index, method index, protobuf bytes) -> protobuf bytes. Supporting OBSERVED errors: `InvalidService`, `InvalidMethodIndex`, `ProtoError`, `CollectionNotOpen`, `CollectionAlreadyOpen`. Service names themselves (`SchedulerService` etc.) are NOT present as strings (stripped; dispatch is by index). `ex/assets/backend/ts_funcs.txt` is the only literal method-name list.

## 1. Backend RPC surface
OBSERVED: 122 distinct protobuf `*Request` message names (many are noise from rustls `HelloRetryRequest` etc.; ~105 genuine). Service grouping below is INFERRED from upstream proto layout; message names are OBSERVED. Approx counts of genuine request types per group:
| Group (INFERRED service) | n | OBSERVED request messages (examples) |
|---|---|---|
| Collection / Backup | ~6 | OpenCollection, CloseCollection, CreateBackup, CheckDatabase(output msg), Undo-related ops |
| Notes | ~6 | AddNotes, UpdateNotes, RemoveNotes, FieldNamesForNotes, NoteIdsAndTags, DefaultsForAdding |
| Cards | ~7 | UpdateCards, RemoveCards, SetDeck, SetFlag, BuryOrSuspendCards, SortCards, GetQueuedCards(sched) |
| Decks | ~8 | AddOrUpdateDeckLegacy, RenameDeck, ReparentDecks, SetDeckCollapsed, GetDeckNames, DeckTree, UnburyDeck, CustomStudy(+Defaults) |
| DeckConfig | ~3 | UpdateDeckConfigs, GetIgnoredBeforeCount, GetRetentionWorkload |
| Notetypes | ~7 | AddOrUpdateNotetype, UpdateNotetypeLegacy, ChangeNotetype, GetChangeNotetypeInfo, RestoreNotetypeToStock, StockNotetype |
| Scheduler | ~12 | ScheduleCardsAsNew(+Defaults), SetDueDate, GetQueuedCards, CustomStudy, StudiedToday msg, SchedulingState/Context, SortDeck, ExtendLimits, UnburyDeck, GradeNow |
| FSRS | ~9 | ComputeFsrsParams, ComputeFsrsParamsFromItems, EvaluateParams(+Legacy), SimulateFsrsReview, GetOptimalRetentionParameters, FsrsBenchmark, ExportDataset, RetentionFuzzDelta |
| Search | ~6 | SearchRequest, JoinSearchNodes, ReplaceSearchNode, FindAndReplace, FindAndReplaceTag, GetNextResultPage (browser table) |
| Tags | ~6 | CompleteTag, RenameTags, ReparentTags, SetTagCollapsed, FindAndReplaceTag, Register |
| Config | ~6 | GetConfigBool/SetConfigBool, Get/SetConfigString, SetConfigJson, Get/SetAuxConfigKey, Get/SetAuxTemplateConfigKey |
| Stats | ~3 | GraphsRequest, CardStats, ReviewsGraphs/Today |
| ImportExport | ~9 | ImportAnkiPackage, ImportCollectionPackage, ImportCsv, CsvMetadata, ExportAnkiPackage, ExportCollectionPackage, ExportNoteCsv, ExportCardCsv, PackageMetadata |
| Media | ~4 | AddMediaFile, TrashMediaFiles, CheckMedia, media entries |
| Sync | ~6 | SyncLogin, SyncCollection, FullUploadOrDownload, SyncMedia, Logout, Status |
| CardRendering | ~12 | RenderExistingCard, RenderUncommittedCard(+Legacy), ExtractAvTags, ExtractLatex, ExtractClozeForTyping, CompareAnswer, StripHtml, HtmlToTextLine, RenderMarkdown, EncodeIri, AllTtsVoices, WriteTtsStream |
| ImageOcclusion | 4 | GetImageForOcclusion, GetImageOcclusionFields, Add/Get/UpdateImageOcclusionNote |
| I18n | 2 | TranslateString, FormatTimespan |
| Updates / GitHub | ~4 | CheckForUpdate, LatestRelease, GetAddonInfo, GithubRelease |
| AnkiHub (new) | ~2 | login/http client (`ankihub/login.rs`, `backend/ankihub.rs`) |
| AnkiDroid-specific | 1+ | `SqlValueDbRequest` / DbRequest {Begin, Commit, ...}: raw SQL/DB access for legacy Kotlin code (`ankidroid/db.rs`) |
- OBSERVED `ts_funcs.txt` (42 entries): Svelte web UI RPCs exposed to the embedded webview: graphs, cardStats, congratsInfo, getDeckConfigsForUpdate, updateDeckConfigs, computeFsrsParams, evaluateParamsLegacy, computeOptimalRetention, simulateFsrsReview/Workload, getRetentionWorkload, getSchedulingStatesWithContext, setSchedulingStates, importCsv/importAnkiPackage/importJsonFile/String, getCsvMetadata, getImportAnkiPackagePresets, importDone, getChangeNotetypeInfo, changeNotetype, image-occlusion (get/add/update/getImageForOcclusion), completeTag, getFieldNames, getNotetypeNames, getDeckNames, getGraphPreferences/set, getCustomColours/save, searchInBrowser, latestProgress, setWantsAbort, i18nResources, deckOptionsReady/RequireClose.

## 2. Collection schema (SQLite)
OBSERVED literal DDL (schema upgrade chain 11 -> 14 -> 15 -> 16 -> 17 -> 18 present as `UPDATE col SET ver = N`; current = **18**).
Core tables:
- `col` (single row): id, crt (creation time), mod, scm (schema-mod), ver, dty, usn, ls (last sync); legacy JSON cols conf/models/decks/dconf/tags are emptied in v18 (`update col set dconf=''`, `tags=''`) and moved to tables below.
- `notes`: id (ms epoch), guid, mid (notetype), mod, usn, tags (space-separated), flds (fields joined by 0x1f), sfld (sort field, `integer` affinity on purpose), csum (checksum of first field for dupe check), flags, data.
- `cards`: id, nid, did, ord (template/cloze index), mod, usn, type, queue, due, ivl, factor (ease x1000), reps, lapses, left (learning steps remaining), odue, odid (original due/deck when in filtered deck), flags, data (JSON: FSRS memory state s/d, desired retention, last-review time, custom data, original position; keys OBSERVED: `original_due, remaining_steps, due, queue, template_idx, mtime_secs, lapses, ease_factor, decay, flags, last_review_time_secs, original_position`).
- `revlog`: id (ms ts), cid, usn, ease (button 1-4), ivl, lastIvl (neg = seconds, pos = days), factor, time (ms), type (learn/review/relearn/filtered/manual/resched).
- `graves`: oid, type, usn; v18 = `PRIMARY KEY(oid,type) WITHOUT ROWID`, index `idx_graves_pending(usn)`. Deletion tombstones for sync.
- `config` (key PK, usn, mtime_secs, val blob JSON) WITHOUT ROWID: collection settings.
- `deck_config` (id, name unicase, mtime_secs, usn, config protobuf blob): presets (learn_steps, new_per_day, etc.).
- `decks` (id, name unicase, mtime_secs, usn, common blob, kind blob [normal/filtered]); `tags` (tag PK unicase, usn, collapsed).
- `notetypes` (id, name, mtime_secs, usn, config blob), `fields` (ntid, ord, name, config), `templates` (ntid, ord, name, mtime_secs, usn, config).
- Indexes (OBSERVED): ix_notes_usn, ix_cards_usn, ix_revlog_usn, ix_cards_nid, ix_cards_sched(did,queue,due), ix_revlog_cid, ix_notes_csum, idx_notes_mid, idx_cards_odid (partial odid!=0), idx_fields_name_ntid(unique), idx_templates_name_ntid(unique), idx_templates_usn, idx_notetypes_name(unique), idx_notetypes_usn, idx_decks_name(unique), idx_graves_pending.
- Custom SQL functions registered (OBSERVED): `regexpfn`, `regexp_fields`, `regexp_tags`, `field_at_index`, `fnvhash`, `process_text`, `extract_custom_data`, `extract_original_position`, `extract_fsrs_variable`, `extract_fsrs_retrievability`, `extract_fsrs_relative_retrievability`; collation `unicase`. Pragmas: `locking_mode=exclusive`, `cache_size`, `temp_store=memory`, WAL checkpoint(truncate), quick_check, `vacuum; reindex; analyze`.
- Media DB (separate `collection.media.db2`): `media(fname PK, csum, mtime, dirty)` WITHOUT ROWID, index idx_media_dirty (partial), `meta(dirMod,lastUsn)`. OBSERVED.
- Enums: card `type` 0 new, 1 learning, 2 review, 3 relearning; `queue` -3 sched-buried, -2 user-buried, -1 suspended, 0 new, 1 learning, 2 review, 3 day-learning, 4 preview. INFERRED (upstream). OBSERVED consistent hints: `WHERE type IN (2,3)`, errors `invalid card type`, `invalid card queue`, `card modified without updating queue`, `due > 1000000000` (timestamp vs day number for learning cards). `due`: new = position, review = day number since crt, learn = epoch secs.
- Check Database (`dbcheck.rs`) OBSERVED messages: card_properties_invalid, card_position_too_high, cards_missing_note, decks_missing, revlog_properties_invalid, templates_missing, card_ords_duplicated, field_count_mismatch, notetypes_recovered, invalid_utf8, invalid_ids, card_last_review_time_empty; "create recovery notetype".

## 3. Scheduling
- OBSERVED modules: `scheduler/answering/learning.rs`, `queue/{learning,mod}.rs`, `reviews.rs`, `filtered/mod.rs`, `timing.rs`, `states/{review,load_balancer,rescheduling_filter}.rs`, `fsrs/{memory_state,params,rescheduler,simulator}.rs`. States: New/Learn/Review/Relearn/Preview/ReschedulingFilter (strings `LearnState`, `ReviewState`, `RelearnState`, `PreviewState`, `ReschedulingFilterState`). This is the **v3 scheduler** (states computed by engine, JS "custom scheduling" can alter via `getSchedulingStatesWithContext`/`setSchedulingStates`). INFERRED: v1/v2 removed.
- Deck-config fields OBSERVED (snake_case proto): new_per_day, reviews_per_day, new_per_day_minimum, learn_steps, relearn_steps, initial_ease, graduating_interval_good (+ _easy), minimum_lapse_interval, interval_multiplier, hard_multiplier, easy_multiplier, maximum_review_interval, leech_action, leech_threshold, bury_new/review/interday_learning, new_mix, interday_learning_mix, review_order, new_card_insert_order, new_card_gather_priority, new_card_sort_order, easy_days_percentages, ignore_revlogs_before_date, param_search, weight_search, sm2_retention, fsrs_params_4/5/6, fsrs_weights (legacy), desired_retention, show_timer, seconds_to_show_question/answer, wait_for_audio, stop_timer_on_answer, cap_answer_time_to_secs, question/answer_action.
- Collection-level OBSERVED: `new_timezone`, `rollover`, `day_learn_first`, `load_balancer_enabled`, `fsrs_short_term_with_steps_enabled`, `show_intervals_on_buttons`, `show_remaining_due_counts`, `time_limit_secs`, `interrupt_audio_when_answering`.
- SM-2 path (INFERRED standard): ease factor per card `factor` (permille, default via initial_ease, 2500), Again/Hard/Good/Easy modify ease (-20/-15/0/+15 pts), interval = ivl * multiplier, fuzz, load balancer; leech after `leech_threshold` lapses -> tag "leech" and suspend or tag-only (`leech_action`); `minimum_lapse_interval` on relearn. Buried-by-sibling states use queues -2/-3.
- **FSRS** (OBSERVED fsrs crate 5.2.0 via burn CPU): memory state per card = Stability + Difficulty (+ Retrievability, shown in browser columns `Stability`, `Difficulty`, `Retrievability`); params array of 19-21 weights stored in fsrs_params_4/5/6 (versions 4,5,6 = FSRS-4/5/6; INFERRED); `decay` field in card data; optimizer (`ComputeFsrsParams`, `FsrsBenchmark`, `ExportDataset`), evaluate (log-loss/RMSE), optimal-retention/workload simulator, rescheduler, "ignore revlogs before date", short-term-with-steps option, easy-days percentages. Search props `prop:s`, `prop:d`, `prop:r`, `prop:cds`, `prop:cdn` (custom-data).
- Timing: day cutoff from `rollover` (default 4am) and `new_timezone`; `timing.rs`, undo via `undo/mod.rs`, `revlog/undo.rs`.

## 4. Sync
- OBSERVED default server `https://sync.ankiweb.net/` (followed by a base62 alphabet table in adjacent .rodata: used for random host/key generation, INFERRED). Custom server error: "Invalid sync server specified. Please check the preferences." Update check: GitHub `api.github.com/repos/ankitects/anki/releases/latest`. AnkiHub client: `https://app.ankihub.net/api/` (env override `ANKIHUB_APP_URL`).
- OBSERVED collection-sync method strings: `hostKey` (login), `meta`, `applyGraves`, `applyChanges`, `chunk`, `applyChunks`, `sanityCheck2`, `finish`, `abort`, `upload`, `download` (+ `start`, `status`). Media (`msync/`): `begin`, `mediaChanges`, `uploadChanges`, `downloadFiles`, `mediaSanity`. Structs `SyncMeta` {scm, usn, ..., host_num, media_usn}, `SyncBeginResponse`, `JsonResult::{Ok,Err}`. Headers/params seen: `anki-sync` (JSON header), `client_ver`, `hkey`, `anki-original-size` (zstd-compressed bodies; request/response zstd). Sync protocol = modern v11 (JSON + zstd, `sanityCheck2`), INFERRED. Full upload/download replaces the whole collection (needs `scm` bump).
- Media sync: dirty-flag DB, 43 MB-ish chunk limits (strings "43 MB >" near status.rs, INFERRED limit constants), files zipped for transfer.
- Flow INFERRED: login -> hostKey; meta (compare mod/scm/usn); if schema differs -> full sync; else start/applyGraves/applyChanges/chunks both ways/sanityCheck2/finish. TLS rustls; Mozilla/native CA (+ bundled `assets/USERTrust_RSA.crt`, `PublicSuffixDatabase.list` for Java/OkHttp side).

## 5. Import / export
- OBSERVED: `import_export/package/{apkg/import/media,colpkg/export,media,meta}.rs`, `text/{import,csv/export,csv/metadata}.rs`. Strings `.apkg` (many, from i18n), `.colpkg`, `collection.anki2`, `collection.anki21`, `collection.anki21b`, `meta` (protobuf PackageMetadata, version enum), `media` map file, zstd (6 refs), zip 4.1. Backups: `backup-%Y-%m-%d-%H.%M.%S.colpkg` (`collection/backup.rs`).
- INFERRED format: package = zip; `meta` (proto version: Legacy1 anki2, Legacy2 anki21, Latest anki21b); `collection.anki21b` = zstd-compressed SQLite (v18 schema); `media` = zstd-compressed protobuf map (numbered zip entry -> filename, size, sha1) in latest, JSON `{"0":"file.jpg"}` in legacy. Importer handles older schemas via the legacy ones (`FileTooNew`, `FileTooOld`, `InvalidArchive`, `UnsupportedArchive`, `InvalidPassword` error kinds OBSERVED). CSV/TSV import with delimiter/HTML/dupe-resolution (`dupe_resolution`, `match_scope`, `default_deck`, `global_tags`, `updated_tags`), JSON import, export notes/cards CSV with limits/html options.
- Media check: `media/check.rs` (unused/missing files, trash), `media/files.rs` (filename normalisation, safe names).

## 6. Search, templates, HTML
- Search parser (nom, `search/parser.rs`, `sqlwriter.rs`) OBSERVED tokens: `deck:`, `note:`, `card:`, `tag:`, `flag:`, `nid:`, `cid:`, `added:`, `edited:`, `introduced:`, `rated:`, `resched:`, `dupe:`, `re:` (regex via `regexp_fields`), `nc:` (no-combining/accent-insensitive), `sc:`, `w:`, `has-cd:`, `preset:`, `prop:` {ivl, due, reps, lapses, ease, rated, resched, pos, s, d, r, cds, cdn, active}, `is:` {due, new, learn, review, suspended, buried, leech}, `and`/`or`/`-`, quotes, parentheses, `*`/`_` wildcards, backslash escapes. Errors enumerated (UnopenedGroup, InvalidPropProperty, InvalidAnswerButton, ...). Ordering columns map to `c.mod`, `n.id`, `ivl`, `reps`, `lapses`, etc.
- Templates (`template.rs`, `template_filters.rs`, `cloze.rs`): mustache-like `{{Field}}`, `{{#Field}}..{{/Field}}`, `{{^Field}}`, `{{FrontSide}}`, `{{=<% %>=}}` delimiter swap, filters `text:`, `hint:` , `type:` (type-answer, `{{type:`, `<hr id=answer>`), `cloze:`, `kana:`, `tts ` (OBSERVED "kana:", "tts "), special `Tags/Type/Deck/Subdeck/Card/CardFlag` (INFERRED). Errors link to docs.ankiweb.net/templates/errors.html (front blank, no cloze filter on cloze note type, etc.).
- Cloze: `{{c1::text::hint}}`, nested clozes, rendered to `<span class="cloze" data-cloze=...>`; image occlusion notes store masks as cloze-like data (`image_occlusion/imagedata.rs`).
- Sanitising: ammonia 4.1.2 + html5ever (HTML cleaning on paste/import/strip), regex strip `(<!--.*?-->)|(<style..>)|(<script..>)|(<.*?>)`, `[sound:..]` and TTS AV-tag extraction, LaTeX extraction/render (`latex.rs`, `render_latex`), `ignore_accents_in_search`, `paste_strips_formatting`, `paste_images_as_png`. Note: rendering does not sanitise card templates (they may contain script); WebView isolation is on the app side.

## 7. ex/assets/backend (OBSERVED)
- `ts_funcs.txt` (42 RPC names, above); `licenses-cargo.json` (188 KB, Rust crate licences), `licenses-ts.json` (36 KB, JS deps).
- `css/` reviewer.css, reviewer_extras.css, root-vars.css (24 KB); `js/` reviewer.js, reviewer_extras_bundle.js (upstream reviewer TS bundles), mathjax.js, jquery.min.js, `vendor/mathjax` (5 MB total).
- `sveltekit/` (1.8 MB): index.html + `app/{env.js,version.json,immutable/{assets,chunks,entry,nodes}}` - upstream Anki Svelte web UI (deck options, stats graphs, congrats, change-notetype, import CSV/apkg, image occlusion) served to the WebView and calling the RPC list above through a local HTTP-ish bridge (INFERRED).
- Sibling assets: `scripts/{card.js,js-api.js,ankidroid-reviewer.js,ankidroid-cardviewer.js}` (782 lines; AnkiDroid JS API / gestures), `card_template.html`, `flashcard.css`, `ankidroid.css`, `mathjax/mathjax.css`, `README.md` (jQuery 3.5.1, MathJax 3.1.2), `changelog.html`.

## Limitations
Service/method names not recovered as strings (stripped, index-dispatched); group counts are estimated from request-message names. Enum values and SM-2 formulas are INFERRED from upstream Anki, not decoded from machine code. No decompilation done.
