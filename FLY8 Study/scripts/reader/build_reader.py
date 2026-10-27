"""Builds a single-file study reader from the preset notes. Run: python3 -I build_reader.py <out.html>"""
import json, sys, os
here = os.path.dirname(os.path.abspath(__file__))
data_dir = os.path.join(here, "..", "..", "data", "presets")
bundles = json.load(open(os.path.join(data_dir, "bundles.json")))["bundles"]
by_id = {}
for fn in sorted(os.listdir(data_dir)):
    if fn.endswith(".json") and fn not in ("bundles.json", "visuals.json"):
        for n in json.load(open(os.path.join(data_dir, fn))):
            by_id[n["id"]] = n
visuals = {v["noteId"]: v for v in json.load(open(os.path.join(data_dir, "visuals.json")))}
notes, groups = [], []
for b in bundles:
    groups.append({"key": b["id"], "area": b["area"], "label": b["name"], "desc": b["blurb"]})
    for i in b["notes"]:
        n = by_id[i]
        note = {"id": n["id"], "area": n["area"], "title": n["title"], "body": n["body"], "priority": n.get("priority", "medium"), "group": b["id"]}
        if i in visuals:
            note["svg"] = visuals[i]["svg"]
            note["cap"] = visuals[i]["caption"]
        notes.append(note)
payload = {"notes": notes, "groups": groups,
           "disclaimer": "AI-written study notes from general nursing knowledge; coverage guided by a review-deck outline (headings only). Not reviewed by a nurse. Check against your textbook and local policy, especially Philippine program details, numbers and drugs."}
js = json.dumps(payload, ensure_ascii=False).replace("<", "\\u003c")
tpl = open(os.path.join(here, "template.html"), encoding="utf-8").read()
out = sys.argv[1] if len(sys.argv) > 1 else "study-reader.html"
open(out, "w", encoding="utf-8").write(tpl.replace("__DATA__", js))
print(out, len(notes), "notes", os.path.getsize(out) // 1024, "KB")
