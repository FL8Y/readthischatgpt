# App 2 — AnkiDroid inspired research

Static reverse-engineering of AnkiDroid 2.25.1 (`com.ichi2.anki`): how it works, how to integrate it with a nursing study app, and tested reference code.

| Path | What it is |
|---|---|
| `AnkiDroid_App2_Research.docx` | Full report (35 pages): architecture, review flow, data model, scheduling, integration routes A/B/C with code, verification, unknowns, three addenda |
| `research/` | Markdown notes: Android layer, core engine (`librsdroid.so`: crates, SQLite schema, FSRS, sync, formats), inbound integration surface |
| `product/ankidroid-bridge/` | Kotlin: add cards to AnkiDroid via its content provider (+ intent fallbacks, manifest snippet). Compile-checked, not run on a device |
| `product/apkg-builder/` | Python: build `.apkg` decks from JSON (genanki). 4/4 tests pass |
| `product/srs-scheduler/` | TypeScript: dependency-free FSRS-5 scheduler + queue builder. 10/10 tests pass (not parity with AnkiDroid's newer fsrs crate; see header comment) |
| `data/` | Decoded manifest |
| `framework/` | Method notes and report builder |

Evidence is labelled observed (literal string/manifest entry) or inferred. The original app files are not stored here. AnkiDroid is GPL-3.0 (Anki core AGPL-3.0): using its content provider or file formats does not copy its code; copying its source does carry obligations.
