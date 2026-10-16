import re
from docx import Document
from docx.shared import Pt, RGBColor, Inches
from docx.enum.text import WD_ALIGN_PARAGRAPH
from docx.oxml.ns import qn
from docx.oxml import OxmlElement

A2 = '/tmp/claude-0/-home-user/386c8b50-43be-54c5-b6a0-357edf2ecf6f/scratchpad/app2/'
R = '/home/user/readthischatgpt/Nursing app master plan/app 2 inspired research/'

d = Document()
st = d.styles['Normal']; st.font.name = 'Calibri'; st.font.size = Pt(10.5)
for s in d.sections:
    s.left_margin = s.right_margin = Inches(0.9); s.top_margin = s.bottom_margin = Inches(0.9)

def shade(cell, color):
    tcPr = cell._tc.get_or_add_tcPr(); sh = OxmlElement('w:shd')
    sh.set(qn('w:val'), 'clear'); sh.set(qn('w:color'), 'auto'); sh.set(qn('w:fill'), color); tcPr.append(sh)

def H(t, l=1): d.add_heading(t, level=l)
def P(t, bold=False, italic=False):
    p = d.add_paragraph(); r = p.add_run(t); r.bold = bold; r.italic = italic; return p
def B(items):
    for t in items:
        p = d.add_paragraph(style='List Bullet')
        if isinstance(t, tuple):
            r = p.add_run(t[0]); r.bold = True; p.add_run(t[1])
        else: p.add_run(t)
def T(head, rows, widths=None):
    t = d.add_table(rows=1, cols=len(head)); t.style = 'Table Grid'
    for i, h in enumerate(head):
        c = t.rows[0].cells[i]; c.text = ''; r = c.paragraphs[0].add_run(h); r.bold = True; r.font.size = Pt(9.5); shade(c, 'D9E2F3')
    for row in rows:
        cells = t.add_row().cells
        for i, v in enumerate(row):
            cells[i].text = ''; r = cells[i].paragraphs[0].add_run(str(v)); r.font.size = Pt(9.5)
    if widths:
        for row in t.rows:
            for i, w in enumerate(widths): row.cells[i].width = Inches(w)
    d.add_paragraph()
def CODE(t):
    p = d.add_paragraph(); p.paragraph_format.left_indent = Inches(0.15)
    r = p.add_run(t); r.font.name = 'Consolas'; r.font.size = Pt(8.5)
    r._element.rPr.rFonts.set(qn('w:eastAsia'), 'Consolas')
    pPr = p._p.get_or_add_pPr(); sh = OxmlElement('w:shd')
    sh.set(qn('w:val'), 'clear'); sh.set(qn('w:color'), 'auto'); sh.set(qn('w:fill'), 'F2F2F2'); pPr.append(sh)
def NOTE(t):
    p = d.add_paragraph(); r = p.add_run('Note: '); r.bold = True; p.add_run(t)


def inline(p, text):
    # **bold** and `code` runs
    for part in re.split(r'(\*\*[^*]+\*\*|`[^`]+`)', text):
        if not part: continue
        if part.startswith('**') and part.endswith('**'):
            r = p.add_run(part[2:-2]); r.bold = True
        elif part.startswith('`') and part.endswith('`'):
            r = p.add_run(part[1:-1]); r.font.name = 'Consolas'; r.font.size = Pt(9)
        else: p.add_run(part)

def MD(path, level_shift=1):
    lines = open(path, errors='replace').read().split('\n')
    i = 0
    while i < len(lines):
        ln = lines[i].rstrip()
        if not ln or ln.startswith('Labels:') or ln.startswith('Source is untrusted'): i += 1; continue
        m = re.match(r'^(#{1,4})\s+(.*)', ln)
        if m:
            lvl = min(len(m.group(1)) + level_shift, 4)
            if len(m.group(1)) == 1: i += 1; continue   # file title replaced by our own section heading
            d.add_heading(m.group(2), level=lvl); i += 1; continue
        if ln.startswith('|'):
            rows = []
            while i < len(lines) and lines[i].startswith('|'):
                cells = [c.strip() for c in lines[i].strip().strip('|').split('|')]
                if not all(re.fullmatch(r':?-{2,}:?', c) for c in cells): rows.append(cells)
                i += 1
            if rows:
                n = max(len(r) for r in rows)
                t = d.add_table(rows=0, cols=n); t.style = 'Table Grid'
                for ri, r in enumerate(rows):
                    cells = t.add_row().cells
                    for ci in range(n):
                        cells[ci].text = ''
                        p = cells[ci].paragraphs[0]
                        inline(p, r[ci] if ci < len(r) else '')
                        for run in p.runs: run.font.size = Pt(9); run.bold = run.bold or ri == 0
                        if ri == 0: shade(cells[ci], 'D9E2F3')
                d.add_paragraph()
            continue
        mb = re.match(r'^(\s*)[-*]\s+(.*)', ln)
        if mb:
            p = d.add_paragraph(style='List Bullet'); inline(p, mb.group(2)); i += 1; continue
        p = d.add_paragraph(); inline(p, ln.strip()); i += 1


def FILE(path, maxlines=None):
    t = open(path, encoding='utf-8').read().rstrip('\n')
    CODE(t)

# ---------- Title ----------
d.add_heading('AnkiDroid — How It Works and How to Integrate It', 0)
P('Static reverse-engineering report of AnkiDroid 2.25.1 (Android package com.ichi2.anki), with integration guidance and working, tested reference code for a nursing study app.', italic=True)
P('Source: uploaded file App2.zip. Despite the name it is a 7-Zip archive holding one file, base.apk (41 MB). Fonts were excluded. Static analysis only: the app was never run and no network requests were made.')

H('1. Summary')
B([
 ('What it is. ', 'AnkiDroid is the Android client of Anki, the best-known spaced-repetition flashcard system. It shows a card, you grade your recall (Again / Hard / Good / Easy), and a scheduler decides when you see it next.'),
 ('Where the logic lives. ', 'Only three small dex files hold the Kotlin UI (about 339 first-party classes, minified). The engine is the upstream Anki Rust backend in lib/arm64-v8a/librsdroid.so (23.6 MB): the SQLite collection, the v3 scheduler, FSRS (crate fsrs 5.2.0), search, templates, import/export and AnkiWeb sync.'),
 ('Why it matters for your nursing app. ', 'You do not need to rebuild the hard parts. AnkiDroid already has a stable, user-grantable data API (a content provider), file import for .apkg decks, and a proven scheduler. Section 7 gives three integration routes with code.'),
 ('Code delivered. ', '(1) a dependency-free FSRS scheduler in TypeScript, 10/10 tests pass; (2) a deck builder that creates .apkg files AnkiDroid imports, 4/4 tests pass; (3) a Kotlin bridge that adds cards straight into AnkiDroid, compile-checked against Android 14. None of it has been run on a device.'),
 ('Important finding. ', 'This build is not a clean release. It bundles LeakCanary (with an exported LeakActivity), a jacoco coverage agent file, allows cleartext traffic and backups. Treat it as a developer-flavoured build when judging security.'),
])

H('2. What was uploaded')
T(['Item', 'Value'], [
 ['File', 'App2.zip (17 MB) = 7-Zip archive, not a zip'],
 ['Content', 'base.apk, 41 MB, 2,243 entries (1,803 resources, 153 assets, 3 dex, 1 native library of interest)'],
 ['Package / version', 'com.ichi2.anki, versionName 2.25.1, versionCode 322501300'],
 ['SDK levels', 'minSdk 24 (Android 7.0), targetSdk 36'],
 ['Native libraries', 'lib/arm64-v8a/librsdroid.so (Anki Rust backend), libandroidx.graphics.path.so. No armeabi/x86 libraries, so this is an arm64 split.'],
 ['Fonts', 'Excluded as requested'],
])

H('3. How the analysis was done and its limits')
B([
 'Unpacked the 7-Zip archive, then the APK; decoded the manifest and resources with apktool.',
 'Read class descriptors out of the three dex files and counted them by package. The code is minified (R8), so most method names are single letters.',
 'Read the strings of librsdroid.so (Rust, symbols stripped) to recover crate versions, protobuf message names, the SQLite schema and sync endpoints.',
 'Three parallel research passes (Sonnet agents) wrote the addenda in sections 10–12; I verified key facts myself (provider authority, permission, column names).',
])
NOTE('"Observed" means a literal string or manifest entry. "Inferred" means my reading of how pieces fit, often from knowledge of the open-source Anki project. Native machine code was not decompiled, so scheduling maths and enforcement checks are inferred from upstream behaviour.')
NOTE('AnkiDroid is open source (GPL-3.0; the Anki core is AGPL-3.0). Using its content provider or importing its file formats does not copy its code. Copying AnkiDroid or Anki source into your own app does carry licence obligations; get legal advice before doing that. This report is not legal advice.')

H('4. App identity and stack')
T(['Item', 'Value', 'Type'], [
 ['Package', 'com.ichi2.anki', 'observed'],
 ['Version', '2.25.1 (code 322501300); release string "android26.05" near the update check', 'observed'],
 ['UI language / toolkit', 'Kotlin, Android Views and fragments (not Compose), WebView for cards', 'observed/inferred'],
 ['Engine', 'Anki rslib (Rust) via net.ankiweb.rsdroid; protobuf over a single JNI entry', 'observed / inferred'],
 ['Rust crates seen', 'fsrs 5.2.0, burn 0.17.1 (FSRS training), rusqlite 0.36, reqwest + rustls, zstd, ammonia, html5ever', 'observed'],
 ['Database', 'SQLite, schema version 18 (collection.anki2 / anki21b)', 'observed'],
 ['Background work', 'AndroidX WorkManager; boot, day-rollover and reminder receivers', 'observed'],
 ['Crash reporting', 'ACRA to https://ankidroid.org/acra/report', 'observed'],
 ['Dev tooling in this build', 'LeakCanary (exported LeakActivity), jacoco-agent.properties', 'observed'],
 ['Embedded server', 'NanoHTTPD serving /jsapi/, /_anki/, /_app/ (for the card WebView)', 'observed'],
])

H('5. How AnkiDroid works, end to end')
H('5.1 The layers', 2)
CODE("""+--------------------------------------------------------------+
|  Android UI (Kotlin): DeckPicker, Reviewer, CardBrowser,     |
|  NoteEditor, Statistics, Preferences, widgets, notifications |
+------------------------------+-------------------------------+
                               |  protobuf requests (one JNI entry:
                               |  service index + method index + bytes)
+------------------------------v-------------------------------+
|  librsdroid.so  (Anki Rust backend, "rslib")                 |
|  collection - notes/cards/decks/notetypes - search           |
|  scheduler v3 + FSRS - templates/cloze - import/export       |
|  AnkiWeb sync - stats - undo - media                         |
+------------------------------+-------------------------------+
                               |
+------------------------------v-------------------------------+
|  SQLite collection (collection.anki2) + media folder         |
+--------------------------------------------------------------+
   Card face: WebView renders card_template.html + flashcard.css
   + ankidroid.css + MathJax; an in-app HTTP server feeds assets.""")
H('5.2 One review, step by step', 2)
B([
 '1. The DeckPicker asks the backend for the deck tree with due counts (new / learning / review).',
 '2. Reviewer asks the scheduler for the next queued card (GetQueuedCards). The scheduler returns the card plus four pre-computed "states", one for each answer button.',
 '3. The backend renders the card: the note type\'s question template, with fields substituted and {{cloze:...}} deletions expanded, produces HTML. The WebView shows it.',
 '4. You tap Show Answer, then a grade button. The app sends the chosen state back; the backend writes the new card scheduling data and a revlog row, and updates counts.',
 '5. Changes are marked for sync. Sync with AnkiWeb (sync.ankiweb.net) uploads and downloads changes; media syncs separately.',
])
H('5.3 The data model', 2)
T(['Table', 'Holds'], [
 ['notes', 'The content: fields joined by 0x1f, tags, note type id (mid), GUID, checksum'],
 ['cards', 'One row per question generated from a note: deck, ordinal, queue/type, due, interval, ease/memory state, reps, lapses'],
 ['revlog', 'One row per review: card, grade, time taken, interval before/after'],
 ['decks / notetypes / deck_config', 'Hierarchical decks ("A::B"), note types with templates, per-deck options (limits, steps, FSRS retention)'],
 ['graves', 'Deleted items, used by sync'],
])
P('A note can produce several cards (for example "front to back" and "back to front", or one card per cloze number). That split between content (notes) and scheduling (cards) is the key idea to copy.')
H('5.4 Scheduling', 2)
B([
 ('v3 scheduler. ', 'Cards are New, Learning, Review or Relearning, with learning steps (short intervals) before graduating to days-long intervals.'),
 ('FSRS. ', 'The backend contains FSRS (fsrs 5.2.0 plus burn for training): it models each card\'s stability and difficulty and schedules the next review for a chosen desired retention. Request names such as ComputeFsrsParams, EvaluateParams and SimulateFsrsReview show that it can fit weights to your review history on-device.'),
 ('Limits and housekeeping. ', 'Daily new/review limits, burying siblings, suspending, leech handling, custom study, day rollover (an alarm resets the "day").'),
])

H('6. Notable features visible in the manifest')
T(['Feature', 'Evidence'], [
 ['Widgets', '4 widgets: small, add-note, deck picker, card analysis'],
 ['Reminders', 'Notification service, snooze service, boot receiver, day-rollover alarm'],
 ['Import', '.apkg, .colpkg, .csv, .tsv, .txt via VIEW/SEND intents'],
 ['Shared decks', 'SharedDecksActivity downloads decks from the web and imports them'],
 ['Text-selection menu', '"Anki card" action appears in other apps (PROCESS_TEXT)'],
 ['Add card from other apps', 'org.openintents.action.CREATE_FLASHCARD and SEND text/plain'],
 ['Sync', 'com.ichi2.anki.DO_SYNC intent action; AnkiWeb account activity'],
 ['Public data API', 'CardContentProvider (authority com.ichi2.anki.flashcards)'],
 ['Multimedia', 'Image crop, audio recording (RECORD_AUDIO), text-to-speech'],
])

H('7. How to integrate it with your app')
P('There are three independent routes. They can be combined.')
T(['Route', 'You get', 'Needs', 'Best for'], [
 ['A. Content-provider bridge', 'Cards appear inside the user\'s AnkiDroid instantly; AnkiDroid does the scheduling and sync', 'AnkiDroid installed; user grants one dangerous permission', 'Letting students study your cards in the app they already use'],
 ['B. .apkg deck files', 'Distribute decks as files that import into Anki, AnkiDroid and Anki Desktop; re-imports update rather than duplicate', 'Nothing on the phone besides AnkiDroid; works with permission-free sharing', 'Publishing curriculum decks, backups, sharing with classmates'],
 ['C. Your own scheduler', 'Spaced repetition inside your own app with your own UI and data', 'Your own storage; optionally fit FSRS weights to your data', 'A self-contained nursing study app'],
])
H('7.1 Route A — the content-provider bridge (Kotlin)', 2)
P('Facts relied on, all seen in this APK: the provider authority com.ichi2.anki.flashcards is exported; it is guarded by the runtime permission com.ichi2.anki.permission.READ_WRITE_DATABASE (protection level dangerous); column names mid, flds, tags (notes), deck_id, deck_name (decks), name, field_names, num_cards (models).')
P('Steps:', bold=True)
B([
 '1. Add the manifest snippet (permission plus a <queries> block so Android 11+ lets you see AnkiDroid).',
 '2. Check AnkiDroidBridge.isInstalled(); if false, send the user to install AnkiDroid.',
 '3. Request the permission com.ichi2.anki.permission.READ_WRITE_DATABASE at runtime.',
 '4. Call addCards(deckName, cards). It creates the deck if needed, uses AnkiDroid\'s built-in Basic and Cloze note types, skips cards whose first field already exists, and reports added / duplicates / failed.',
 '5. Without the permission, fall back to the intents: createCardIntent() opens AnkiDroid\'s add-card screen pre-filled; importApkgIntent() hands over a .apkg.',
])
P('AnkiDroidBridge.kt', bold=True)
FILE(R+'product/ankidroid-bridge/src/AnkiDroidBridge.kt')
P('Manifest additions', bold=True)
FILE(R+'product/ankidroid-bridge/AndroidManifest.snippet.xml')
NOTE('Not verified on a device: the cards URI (notes/<id>/cards) used to move a new note into the target deck, and the duplicate check query, come from the public AnkiDroid API and are wrapped so a failure does not crash. Model creation columns were not recovered from this APK, so the bridge deliberately avoids creating its own note types.')
H('7.2 Route B — build .apkg decks (Python)', 2)
P('A .apkg is a zip with a SQLite collection and a media map. The script below builds one from a JSON file of nursing cards using the genanki library, with model and deck IDs and note GUIDs derived from content so that importing a newer version updates existing notes instead of duplicating them.')
P('build_apkg.py', bold=True)
FILE(R+'product/apkg-builder/build_apkg.py')
P('sample_cards.json (format of your content file)', bold=True)
FILE(R+'product/apkg-builder/sample_cards.json')
P('Verified: unit tests build the deck, open the resulting collection.anki2 with SQLite and check note and card counts, the 0x1f field separator, cloze text, GUID stability across rebuilds and input validation (4/4 pass). Importing into a real AnkiDroid was not tested.')
H('7.3 Route C — your own FSRS scheduler (TypeScript)', 2)
P('A dependency-free scheduler: review(card, rating, now) returns the updated card; preview() gives the due date each of the four buttons would produce; dueQueue() builds today\'s queue (learning first, then reviews with lowest recall first, then new cards up to the daily limit); isLeech() flags cards that keep failing.')
NOTE('Parity: this is FSRS-5 from the public specification. AnkiDroid 2.25.1 bundles fsrs 5.2.0, probably a newer FSRS generation (inferred), so intervals will differ slightly from AnkiDroid\'s. For exact parity use ts-fsrs or fsrs-rs, and fit weights to your own data.')
P('fsrs.ts', bold=True)
FILE(R+'product/srs-scheduler/src/fsrs.ts')
P('Tests that pass (node --test): retrievability is 90% when elapsed time equals stability; interval equals stability at 90% retention; Easy > Good > Hard > Again after a first review; stability grows after recall and falls after a lapse; difficulty stays in 1..10; later reviews gain more stability; button previews are ordered; input is not mutated; queue order and limits; leech detection.')
H('7.4 Putting the routes together for a nursing app', 2)
B([
 'Author content once as JSON (front/back/cloze plus tags such as topic and exam blueprint area).',
 'Generate the .apkg with Route B for distribution and offline backup.',
 'Offer "Send to AnkiDroid" with Route A for users who already use AnkiDroid.',
 'If you want in-app studying, schedule with Route C and store the card state (stability, difficulty, due, lapses) plus a review log in your own database.',
 'Use the AI quiz generator from the App 3 research to draft new cards from your notes; have a clinician or instructor review them before they are published, since generated clinical facts can be wrong.',
])

H('8. Verification summary')
T(['Deliverable', 'Check run', 'Result'], [
 ['TypeScript FSRS scheduler', 'node --experimental-strip-types --test (10 tests)', '10 pass, 0 fail'],
 ['Python .apkg builder', 'unittest: builds the deck, opens the SQLite inside, checks counts, GUIDs, validation (4 tests)', '4 pass'],
 ['Kotlin bridge', 'Kotlin 2.1.21 compiler against Android 14 framework stubs', '0 errors'],
 ['On-device behaviour', 'Not run: no device or AnkiDroid install here', 'untested'],
])

H('9. What could not be determined')
B([
 'Exact scheduler maths and which FSRS generation the bundled crate implements (native code was not decompiled).',
 'Whether the content provider enforces the permission in code (the manifest leaves the provider itself unprotected; enforcement is inferred from the public API).',
 'Creation columns for note types and templates through the provider.',
 'Why the build has LeakCanary and jacoco: probably a test or developer flavour.',
 'Protobuf service names (stripped); only message names were recovered.',
])

H('10. Addendum A — Android layer (Sonnet research pass)')
MD(A2+'addendum_android.md')
H('11. Addendum B — Core engine (librsdroid.so)')
MD(A2+'addendum_engine.md')
H('12. Addendum C — Integration surface')
MD(A2+'addendum_integration.md')
d.save(R+'AnkiDroid_App2_Research.docx')
print('saved')
