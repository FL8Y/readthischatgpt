package com.example.nursing.anki

import android.content.ContentValues
import android.content.Context
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri

/**
 * Sends cards from your app into AnkiDroid (package com.ichi2.anki) via its CardContentProvider.
 *
 * Facts this code relies on, all seen in the AnkiDroid 2.25.1 APK:
 *  - provider authority  "com.ichi2.anki.flashcards" (exported, spec version 2)
 *  - runtime permission  "com.ichi2.anki.permission.READ_WRITE_DATABASE" (protectionLevel=dangerous)
 *  - column names: notes -> mid, flds, tags; decks -> deck_id, deck_name; models -> name, field_names, num_cards
 * Not observed in the APK (kept conservative on purpose): model/template creation columns. This bridge uses
 * AnkiDroid's built-in "Basic" and "Cloze" note types instead of creating its own.
 * Compile-checked against Android 14 stubs; NOT yet run on a device with AnkiDroid installed.
 */
class AnkiDroidBridge(private val context: Context) {

    companion object {
        const val PACKAGE = "com.ichi2.anki"
        const val AUTHORITY = "com.ichi2.anki.flashcards"
        const val PERMISSION = "com.ichi2.anki.permission.READ_WRITE_DATABASE"
        private const val FIELD_SEP = '\u001f'           // Anki separates note fields with 0x1f
        private val BASE: Uri = Uri.parse("content://$AUTHORITY")
        val NOTES: Uri = Uri.withAppendedPath(BASE, "notes")
        val DECKS: Uri = Uri.withAppendedPath(BASE, "decks")
        val MODELS: Uri = Uri.withAppendedPath(BASE, "models")
    }

    sealed interface Card {
        val tags: List<String>
        data class Basic(val front: String, val back: String, override val tags: List<String> = emptyList()) : Card
        data class Cloze(val text: String, override val tags: List<String> = emptyList()) : Card  // "{{c1::answer}}"
    }

    data class Result(val added: Int, val skippedDuplicates: Int, val failed: Int)

    private val resolver get() = context.contentResolver

    /** Needs <queries><provider android:authorities="com.ichi2.anki.flashcards"/></queries> in your manifest (Android 11+). */
    fun isInstalled(): Boolean = context.packageManager.resolveContentProvider(AUTHORITY, 0) != null

    fun hasPermission(): Boolean =
        context.checkSelfPermission(PERMISSION) == PackageManager.PERMISSION_GRANTED

    /** Id of the deck with this exact name, creating it if missing. "Parent::Child" makes a sub-deck. */
    fun ensureDeck(name: String): Long {
        resolver.query(DECKS, arrayOf("deck_id", "deck_name"), null, null, null)?.use { c ->
            while (c.moveToNext()) if (c.getString(1) == name) return c.getLong(0)
        }
        val uri = resolver.insert(DECKS, ContentValues().apply { put("deck_name", name) })
            ?: error("AnkiDroid refused to create deck '$name'")
        return uri.lastPathSegment!!.toLong()
    }

    /** Id of a built-in note type by name ("Basic", "Cloze"), or null if the user renamed/removed it. */
    fun findModelId(name: String): Long? {
        resolver.query(MODELS, arrayOf("_id", "name"), null, null, null)?.use { c ->
            while (c.moveToNext()) if (c.getString(1) == name) return c.getLong(0)
        }
        return null
    }

    /** First fields of notes already stored for a model, used to skip duplicates. */
    private fun existingFirstFields(modelId: Long): Set<String> {
        val out = HashSet<String>()
        runCatching {
            resolver.query(NOTES, arrayOf("flds"), "mid=?", arrayOf(modelId.toString()), null)?.use { c ->
                while (c.moveToNext()) out += c.getString(0).substringBefore(FIELD_SEP)
            }
        }
        return out
    }

    fun addCards(deckName: String, cards: List<Card>): Result {
        check(isInstalled()) { "AnkiDroid is not installed" }
        check(hasPermission()) { "Ask the user for $PERMISSION first" }
        val deckId = ensureDeck(deckName)
        val basic = findModelId("Basic")
        val cloze = findModelId("Cloze")
        val seen = HashMap<Long, MutableSet<String>>()
        var added = 0; var dup = 0; var failed = 0

        for (card in cards) {
            val (mid, fields) = when (card) {
                is Card.Basic -> (basic ?: run { failed++; null }) to listOf(card.front, card.back)
                is Card.Cloze -> (cloze ?: run { failed++; null }) to listOf(card.text, "")
            }
            if (mid == null) continue
            val known = seen.getOrPut(mid) { existingFirstFields(mid).toMutableSet() }
            if (!known.add(fields[0])) { dup++; continue }

            val values = ContentValues().apply {
                put("mid", mid)
                put("flds", fields.joinToString(FIELD_SEP.toString()))
                put("tags", card.tags.joinToString(" ") { it.replace(' ', '_') })
            }
            val uri = runCatching { resolver.insert(NOTES, values) }.getOrNull()
            if (uri == null) { failed++; continue }
            added++
            // New notes land in the note type's default deck; keep them together by moving the cards if needed.
            moveNoteToDeck(uri, deckId)
        }
        return Result(added, dup, failed)
    }

    /** Best effort: set the deck on the note's cards (cards URI is notes/<id>/cards, from the public FlashCardsContract). */
    private fun moveNoteToDeck(noteUri: Uri, deckId: Long) {
        runCatching {
            val cardsUri = Uri.withAppendedPath(noteUri, "cards")
            resolver.query(cardsUri, arrayOf("card_ord"), null, null, null)?.use { c ->
                while (c.moveToNext()) {
                    val one = Uri.withAppendedPath(cardsUri, c.getInt(0).toString())
                    resolver.update(one, ContentValues().apply { put("deck_id", deckId) }, null, null)
                }
            }
        }
    }

    // ---- No-permission fallbacks (intents AnkiDroid exposes, all seen in its manifest) ----

    /** Opens AnkiDroid's add-card screen pre-filled with a front/back pair (org.openintents CREATE_FLASHCARD). */
    fun createCardIntent(front: String, back: String): Intent =
        Intent("org.openintents.action.CREATE_FLASHCARD")
            .setPackage(PACKAGE)
            .putExtra("SOURCE_TEXT", front)
            .putExtra("TARGET_TEXT", back)

    /** Hands a .apkg you generated to AnkiDroid's importer; [apkgUri] must be a FileProvider content:// URI. */
    fun importApkgIntent(apkgUri: Uri): Intent =
        Intent(Intent.ACTION_VIEW)
            .setDataAndType(apkgUri, "application/apkg")
            .setPackage(PACKAGE)
            .addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION)

    /** Triggers a sync with AnkiWeb (action seen in the manifest); needs the user to be signed in inside AnkiDroid. */
    fun syncIntent(): Intent = Intent("com.ichi2.anki.DO_SYNC").setPackage(PACKAGE)
}
