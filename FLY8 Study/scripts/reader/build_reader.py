"""Builds a single-file study reader from the preset notes. Run: python3 -I build_reader.py <out.html>"""
import json, sys, os
here = os.path.dirname(os.path.abspath(__file__))
data_dir = os.path.join(here, "..", "..", "data", "presets")
GROUPS = [
    ("np1-a", "NP1", "Community health basics", "COPAR, DOH, family nursing process, health promotion, primary health care, prevention"),
    ("np1-b", "NP1", "Elements of primary health care", "Immunization, maternal and child health, nutrition, drugs, sanitation, endemic diseases, mental health program"),
    ("np5-a", "NP5", "Psychiatric nursing", "Communication, crisis, disorders, medications, safety"),
    ("np5-b", "NP5", "Emergency, disaster and life-threatening care", "Triage, survey, shock, burns, disasters, high-acuity conditions"),
]
notes, groups = [], []
for key, area, label, desc in GROUPS:
    groups.append({"key": key, "area": area, "label": label, "desc": desc})
    for n in json.load(open(os.path.join(data_dir, key + ".json"))):
        notes.append({"id": n["id"], "area": n["area"], "title": n["title"], "body": n["body"], "priority": n.get("priority", "medium"), "group": key})
payload = {"notes": notes, "groups": groups,
           "disclaimer": "AI-written study notes from general nursing knowledge; coverage guided by a review-deck outline (headings only). Not reviewed by a nurse. Check against your textbook and local policy, especially Philippine program details, numbers and drugs."}
js = json.dumps(payload, ensure_ascii=False).replace("<", "\\u003c")
tpl = open(os.path.join(here, "template.html"), encoding="utf-8").read()
out = sys.argv[1] if len(sys.argv) > 1 else "study-reader.html"
open(out, "w", encoding="utf-8").write(tpl.replace("__DATA__", js))
print(out, len(notes), "notes", os.path.getsize(out) // 1024, "KB")
