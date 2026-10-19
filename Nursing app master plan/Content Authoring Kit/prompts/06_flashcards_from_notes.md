# 06 — Flashcards from notes (Anki-compatible)

```
Turn the supplied study notes into flashcards for nursing exam review. Use ONLY facts in the notes.
Return JSON for tools/apkg-builder (App 2 `product/apkg-builder/sample_cards.json` format):
{ "deck": "Nursing::<Subject>::<Topic>", "cards": [
  { "type": "basic", "front": "<one question>", "back": "<short answer>", "extra": "<optional why>", "tags": ["topic-slug"] },
  { "type": "cloze", "text": "... {{c1::answer}} ...", "extra": "...", "tags": [...] } ] }
Rules: one idea per card; front is a question, not a heading; cloze hides one term (use c2, c3 for other terms);
no card depends on another card; at most 25 words on the back; include a tag equal to the topic id when supplied.
Do not add facts that are not in the notes; flag unclear notes in a separate "questions_for_author" list.
```

Build the deck with `python build_apkg.py cards.json out.apkg` (App 2 `product/apkg-builder`).
