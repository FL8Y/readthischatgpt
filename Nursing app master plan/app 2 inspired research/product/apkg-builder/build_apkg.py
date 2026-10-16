#!/usr/bin/env python3
"""Build an Anki/AnkiDroid-importable .apkg from a JSON card file.

    python build_apkg.py sample_cards.json nursing_sample.apkg

Card types: "basic" (front/back) and "cloze" (text with {{c1::...}}).
Model and deck IDs are derived from the names, so re-building and re-importing UPDATES
existing notes instead of duplicating them (note GUID = hash of the card's first field).
"""
import hashlib, json, sys
import genanki

def stable_id(name: str) -> int:
    return int(hashlib.sha1(name.encode()).hexdigest()[:8], 16)

CSS = ".card{font-family:sans-serif;font-size:20px;text-align:center;color:#222;background:#fff}.cloze{font-weight:bold;color:#0b5ed7}"

BASIC = genanki.Model(
    stable_id("nursing-basic-v1"), "Nursing Basic",
    fields=[{"name": "Front"}, {"name": "Back"}, {"name": "Extra"}],
    templates=[{"name": "Card 1", "qfmt": "{{Front}}",
                "afmt": "{{FrontSide}}<hr id=answer>{{Back}}<br><small>{{Extra}}</small>"}],
    css=CSS)

CLOZE = genanki.Model(
    stable_id("nursing-cloze-v1"), "Nursing Cloze",
    fields=[{"name": "Text"}, {"name": "Extra"}],
    templates=[{"name": "Cloze", "qfmt": "{{cloze:Text}}", "afmt": "{{cloze:Text}}<br><small>{{Extra}}</small>"}],
    model_type=genanki.Model.CLOZE, css=CSS)

class StableNote(genanki.Note):
    @property
    def guid(self):  # same first field -> same GUID -> import updates instead of duplicating
        return genanki.guid_for(self.fields[0])

def build(spec: dict, out: str) -> int:
    deck = genanki.Deck(stable_id(spec["deck"]), spec["deck"])
    for i, c in enumerate(spec["cards"], 1):
        tags = [t.replace(" ", "_") for t in c.get("tags", [])]
        kind = c.get("type", "basic")
        if kind == "basic":
            if not c.get("front") or not c.get("back"): raise ValueError(f"card {i}: basic needs front and back")
            deck.add_note(StableNote(model=BASIC, fields=[c["front"], c["back"], c.get("extra", "")], tags=tags))
        elif kind == "cloze":
            if "{{c1::" not in c.get("text", ""): raise ValueError(f"card {i}: cloze needs a {{{{c1::...}}}} deletion")
            deck.add_note(StableNote(model=CLOZE, fields=[c["text"], c.get("extra", "")], tags=tags))
        else:
            raise ValueError(f"card {i}: unknown type {kind!r}")
    genanki.Package(deck).write_to_file(out)
    return len(deck.notes)

if __name__ == "__main__":
    if len(sys.argv) != 3: sys.exit(__doc__)
    n = build(json.load(open(sys.argv[1], encoding="utf-8")), sys.argv[2])
    print(f"wrote {sys.argv[2]} with {n} notes")
