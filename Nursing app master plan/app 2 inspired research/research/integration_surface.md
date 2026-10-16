# AnkiDroid 2.25.1 (com.ichi2.anki): inbound integration surface

Sources: decoded AndroidManifest.xml + printable-string table of classes*.dex (R8-obfuscated, so method-level behaviour is INFERRED). OBSERVED = literal in manifest/dex. INFERRED = not directly visible; based on the public AnkiDroid API (AddContentApi / FlashCardsContract). All app content treated as data; nothing executed.

## 0. Build caveats (OBSERVED)
- Package is `com.ichi2.anki`. It has `android:allowBackup="true"`, `usesCleartextTraffic="true"`, a `networkSecurityConfig` and `requestLegacyExternalStorage="true"`.
- The APK contains LeakCanary (`leakcanary.internal.*`, `LeakActivity` exported, a VIEW filter for `*.hprof` on file/content) and `jacoco-agent.properties` (`output=none`). It looks like an instrumented or debug-flavoured build, not a plain release.
- `android:debuggable` was not found on `<application>`.
- Because of LeakCanary, `LeakActivity` is an extra exported entry point that accepts content/file `.hprof` URIs. This is not part of AnkiDroid's own API.

## 1. CardContentProvider (the main inbound data API)
OBSERVED manifest:
```
<provider android:authorities="com.ichi2.anki.flashcards" android:enabled="true" android:exported="true"
          android:name="com.ichi2.anki.provider.CardContentProvider">
  <meta-data android:name="com.ichi2.anki.provider.spec" android:value="2"/>
```
- Authority is `com.ichi2.anki.flashcards`. The dex also contains `content://com.ichi2.anki.flashcards` (the base URI).
- The provider is exported, with no `android:permission`, `readPermission`, `writePermission` or `grantUriPermissions` attribute on it. Access control is therefore not declared in the manifest.
- Provider spec version is 2 (the `com.ichi2.anki.provider.spec` meta-data).

Permission (OBSERVED):
```
<permission android:name="com.ichi2.anki.permission.READ_WRITE_DATABASE" android:protectionLevel="dangerous"
            android:label="@string/read_write_permission_label" android:description="@string/read_write_permission_description"/>
<uses-permission android:name="com.ichi2.anki.permission.READ_WRITE_DATABASE"/>   (self-grant)
```
- The dex string `com.ichi2.anki.permission.READ_WRITE_DATABASE` is used at runtime.
- Protection level is `dangerous`. A third-party app must declare `<uses-permission>` and be granted it by the user at runtime (requested via `requestPermissions`). It is not signature-gated.
- INFERRED: `CardContentProvider` calls `checkCallingOrSelfPermission(...)` on each operation and throws `SecurityException` if it is missing. The literal string and the unprotected manifest entry are consistent with this. The enforcement code itself was not decompiled.
- INFERRED: the grant is a one-time user prompt. It is a runtime permission, not per-URI, and only the third-party app's own manifest declaration is needed.

MIME types (OBSERVED dex literals):
- `vnd.android.cursor.dir/vnd.com.ichi2.anki.note`, `.../vnd.com.ichi2.anki.card`, `.../vnd.com.ichi2.anki.deck`, `.../vnd.com.ichi2.anki.model`, `.../vnd.com.ichi2.anki.model.template`, `.../vnd.com.ichi2.anki.review_info`
- `vnd.android.cursor.item/vnd.com.ichi2.anki.note`, `.../card`, `.../model`, `.../model.template`

URI path segments (OBSERVED as separate dex strings; the exact combinations are INFERRED from the known FlashCardsContract):

| Path | Evidence | Meaning (INFERRED) |
|---|---|---|
| `notes` | OBSERVED | query, insert (create a note), `notes/#` for update/delete |
| `notes/#/cards`, `notes/#/cards/#` | INFERRED | cards of a note |
| `notes_v2` | not checked | v2 variant in the public API |
| `cards` | OBSERVED (with `card_ord`) | card query and update |
| `decks`, `decks/#`, `selected_deck` | OBSERVED (`decks`, `selected_deck`) | list, create and select the current deck |
| `models`, `models/#`, `models/current`, `models/#/templates[/#]`, `models/#/emulator` | OBSERVED (`models`, `emulator`, `tmpls`, `field_names`) | note types; insert of new models is INFERRED |
| `schedule`, `schedule/` (review_info) | OBSERVED (`schedule`, MIME `review_info`) | next due card; `PUT answer_ease`, `time_taken` to answer a card |
| `media` | OBSERVED (`media`) | insert a media file by `file_uri` and `preferred_name`, INFERRED from the API |

Column names found as dex strings (OBSERVED; consistent with FlashCardsContract):
- Note: `guid`, `mid`/`model_id`, `flds`, `sfld`, `tags`, `csum`, `mod`, `usn`
- Card: `card_ord`, `deck_id`, `deck_name`, `question`, `answer`, `question_simple`, `answer_pure`, `queue`, `type`, `due`, `ivl`, `reps`, `lapses`, `buried_`
- Deck and model: `name`, `num_cards`, `field_names`, `css`, `qfmt`, `afmt`, `bqfmt`, `bafmt`, `tmpls`, `sort_field`
- Schedule: `ease`/`answer_ease`, `time_taken`, `next_review_times`, `new_card_count`, `learn_card_count`, `review_count`, `buried_...`, `suspend`
- INFERRED: ID-form columns are `_id`, `note_id`, `model_id`, `ord`.

INFERRED capabilities for a third-party app (AddContentApi):
- Create decks and models.
- Add and bulk-add notes, with duplicate check via `csum`.
- Add media by `file_uri` (the caller must grant the URI).
- Query notes and cards.
- Answer scheduled cards.
- Set the selected deck.
- Read deck and model structure.
- The helper `AddContentApi.getAnkiDroidPackageName()` and the `com.ichi2.anki.api` library are not in this APK; they ship in the client app.

Note: the public API docs say the provider is also used by Tasker plugins and by Anki-enabled readers (e.g. Kindle), consistent with a permission-gated exported provider.

## 2. Intent filters (all OBSERVED from the manifest)

### 2.1 `IntentHandler` (exported, LAUNCHER activity)
- `MAIN` / `LAUNCHER` and `MULTIWINDOW_LAUNCHER`.
- `VIEW` + `DEFAULT` + `BROWSABLE`, mimeType `*/*`, hosts `*`, schemes `http`, `https`, `content`, `file`, with pathPatterns:
  - `.*\.apkg`
  - `.*\.colpkg`
  - `.*\.tsv`
  - `.*\.csv`
  - `.*\.txt`
- `VIEW` + `SEND` + `DEFAULT`, MIME types:
  - `application/apkg`, `application/colpkg`, `application/vnd.anki`
  - `application/x-apkg`, `application/x-colpkg`
  - `application/octet-stream`
  - `text/tab-separated-values`, `text/comma-separated-values`, `text/csv`, `text/tsv`
  - `text/plain`
- `VIEW` + `SEND` + `DEFAULT`, image MIME types: `image/jpg`, `image/jpeg`, `image/png`, `image/ico`, `image/webp`, `image/tiff`, `image/gif`, `image/svg`.
- INFERRED: shared images go to the Add Note flow (media is added to a note field); `.apkg`/`.colpkg`/csv go to the import flow. Dex literal `IntentHandler/ User requested to view a file` confirms the VIEW path. `EXTRA_STREAM` handling is INFERRED.
- Action `com.ichi2.anki.DO_SYNC` (category `DEFAULT`), exported through this activity. It triggers a sync with no extras visible (INFERRED); the dex literal `com.ichi2.anki.DO_SYNC` is also present. Tasker-style automation can send this explicitly. If sync credentials exist, it starts a sync.

### 2.2 Deep link
- `CardBrowserDeepLink` alias (exported), target `IntentHandler`: `VIEW` + `DEFAULT` + `BROWSABLE`, `data scheme="anki" host="x-callback-url" path="/browser"`. So the URI is `anki://x-callback-url/browser`. The dex has the `x-callback-url` literal. Query parameters (e.g. `search`) are INFERRED; no `?search=` literal was confirmed.

### 2.3 `IntentHandler2` ("Add card" / fact adder, exported, label `fact_adder_intent_title`)
- `org.openintents.action.CREATE_FLASHCARD` + `DEFAULT`. This literal is in the dex too.
- `SEND` + `DEFAULT`, `text/plain`.
- `SEND` + `VIEW` + `DEFAULT`, the same image MIME list as above.
- Extras (INFERRED from the public project): `SUBJECT`, `SOURCE_TEXT`, `TARGET_TEXT`, `SOURCE_LANGUAGE`, `TARGET_LANGUAGE`, `EXTRA_TEXT` / `Intent.EXTRA_SUBJECT` (for SEND). Only `SOURCE_TEXT` and `TARGET_TEXT` appear as dex strings; the others were not found as literals.
- Alias `AnkiCardContextMenuAction` (enabled, exported, label `context_menu_anki_card_label`): `android.intent.action.PROCESS_TEXT` + `DEFAULT` + `text/plain`. This puts "Anki card" in the text-selection menu of other apps. The dex literal is `android.intent.extra.PROCESS_TEXT`, and also `PROCESS_TEXT_READONLY`.

### 2.4 Other exported entry points
- `InstantNoteEditorActivity` (exported): `SEND` + `DEFAULT`, `text/plain`. This is a transparent "Instant Card" editor. Received text is used as the cloze source (INFERRED).
- `CardBrowserContextMenuAction` alias (disabled by default, exported): `PROCESS_TEXT` + `text/plain`. Runtime-enabled via a preference (INFERRED).
- `Reviewer` (exported): `VIEW` + `DEFAULT` with no data (a generic intent that opens the reviewer).
- `ManageSpaceActivity` (exported, no filter).
- `AllPermissionsExplanationActivity`: `VIEW_PERMISSION_USAGE`, `VIEW_PERMISSION_USAGE_FOR_PERIOD`, guarded by `START_VIEW_PERMISSION_USAGE`.
- `CropImageActivity` (exported, from the library `com.canhub.cropper`).

### 2.5 Broadcast receivers (OBSERVED)
- `AnkiDroidWidgetSmall` and `AddNoteWidget` (exported): `APPWIDGET_UPDATE`.
- `SdCardReceiver` (exported): `MEDIA_MOUNTED` and `MEDIA_EJECT`, scheme `file`. Dex literals `com.ichi2.anki.action.MEDIA_MOUNT` / `MEDIA_EJECT`.
- Not exported: `DeckPickerWidget`, `CardAnalysisWidget`, `WidgetPermissionReceiver` (`com.ichi2.widget.UPDATE_WIDGET`), `DayRolloverAlarm`, `NotificationService`, `SnoozeService`, `BootService`, `CopyToClipboardReceiver`.
- Library receivers: WorkManager `DiagnosticsReceiver` (exported, `DUMP`) and `ProfileInstallReceiver` (exported, `DUMP`).
- Internal action strings (OBSERVED, not exported): `com.ichi2.anki.ACTION_SCHEDULE_REMINDER_NOTIFICATIONS`, `ACTION_SNOOZE_REMINDER_NOTIFICATION`, `ACTION_START_REMINDER_SNOOZING_`, `com.ichi2.widget.ACTION_ROLLOVER`, `com.ichi2.widget.ACTION_UPDATE_WIDGET`.
- No `com.ichi2.anki.api.*` action strings exist in this APK. The `api` library is client-side.

### 2.6 `<queries>` (what AnkiDroid itself needs to see; OBSERVED)
`TTS_SERVICE`, `VIEW` https/http `BROWSABLE`, `PROCESS_TEXT` `text/plain`, `android.speech.RecognitionService`, `GET_CONTENT` + `OPENABLE` `*/*`, `IMAGE_CAPTURE`.
- There is no `<queries>` entry for client packages. A client app that wants to check whether AnkiDroid is installed needs its own `<queries>` entry or the `QUERY_ALL_PACKAGES` permission.

## 3. Import and export
OBSERVED dex literals: `.apkg`, `.colpkg`, `.anki2`, `corrupt-%tF.anki2`, `application/zip`, `text/csv`, `text/tab-separated-values`, `AnkiPackageImporterFragment`, `ImportFileSelectionFragment`, ` (.apkg)`, ` (.colpkg)`, `SharedDecksDownloadFragment::getImportableDeck`, `EXTRA_IS_SHARED_DOWNLOAD`, `EXTRA_CARD_IDS`, `EXTRA_DECK_ID`.
- Import file types from VIEW/SEND: `.apkg` (deck package), `.colpkg` (whole collection, replaces it), `.csv`/`.tsv`/`.txt` (CSV importer).
- `FileProvider` authority `com.ichi2.anki.apkgfileprovider` (not exported, `grantUriPermissions=true`). AnkiDroid uses it to share exported `.apkg`/`.colpkg` files out to other apps, which is an outbound channel for the user's data.
- The image-pick and crop flow uses `com.ichi2.anki.cropper.fileprovider` (not exported, `grantUriPermissions`).
- INFERRED: an `application/octet-stream` + `.colpkg` handoff from another app asks the user to confirm before replacing the collection. The confirmation dialog is not read from code here.
- Backend is the Rust backend via `net.ankiweb.rsdroid` (`Backend`, `BackendImportException`, `BackendSyncException`, `BackendInvalidChecksumException`). Import parsing happens in that backend (INFERRED).

## 4. Network / localhost
- `NanoHTTPD` (`fi.iki.elonen`) is bundled and `java.net.ServerSocket` exists. Dex literal `http://127.0.0.1:` is used as a prefix (INFERRED: the in-app reviewer/media or sync server on a local port, in the same process). No exported service or manifest-declared server was found.
- There is no AnkiConnect, REST or public webserver feature in the manifest. No `android.permission.INTERNET`-based listening service is declared as a Service, so it is not an external integration channel (INFERRED, not fully verified).
- `usesCleartextTraffic=true` plus `network_security_config`. INTERNET is requested.
- Shared decks: `SharedDecksActivity` (not exported, label `download_deck`), page `https://ankiweb.net/decks` (OBSERVED), a download manager, then import (INFERRED). A download `.apkg` link in a normal browser triggers the `VIEW` filter in 2.1 (http/https scheme with `.apkg` pathPattern).
- AnkiWeb sync/login URLs (OBSERVED): `https://ankiweb.net`, `https://ankiweb.net/account/login?afterAuth=1`, `https://ankiweb.net/account/verify-email`. Custom sync server: `CustomSyncServerSettingsFragment`.
- Other: `https://ankidroid.org/acra/report`, `https://docs.ankidroid.org/changelog.html`, `https://docs.ankiweb.net/...`.

## 5. Practical inbound channels for another app (summary)
1. Request `com.ichi2.anki.permission.READ_WRITE_DATABASE` (user grant) and use the `content://com.ichi2.anki.flashcards/...` provider. This is the programmatic route (notes, decks, models, media, schedule). INFERRED: it writes straight into the collection, with no UI.
2. Fire `org.openintents.action.CREATE_FLASHCARD` or `ACTION_SEND text/plain` at `IntentHandler2` or `InstantNoteEditorActivity`. This is user-visible and the user finishes the card.
3. `ACTION_PROCESS_TEXT` via the "Anki card" menu alias.
4. `VIEW`/`SEND` of `.apkg`, `.colpkg`, `.csv`, `.tsv` and `.txt` into the importer.
5. `com.ichi2.anki.DO_SYNC` to trigger a sync.
6. The `anki://x-callback-url/browser` deep link to open the Card Browser.
7. Widgets: `AddNoteWidget` and `AnkiDroidWidgetSmall` (exported, `APPWIDGET_UPDATE`). The widget is a launcher entry, not a data channel.

## 6. Not found
- No `com.ichi2.anki.api.*` actions, no `ACTION_CREATE_FLASHCARD` literal (the only one is the OpenIntents action), no `notes_v2` or `models/current` literal confirmed.
- No AnkiConnect or any externally reachable web service.
- No `<queries>` entries for client packages.
- No exported Services in the app's own code (only WorkManager's `SystemJobService`, guarded by `BIND_JOB_SERVICE`).
