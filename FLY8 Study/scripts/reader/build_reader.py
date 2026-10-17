"""Builds a single-file study reader from the preset notes. Run: python3 -I build_reader.py <out.html>"""
import json, sys, os
here = os.path.dirname(os.path.abspath(__file__))
data_dir = os.path.join(here, "..", "..", "data", "presets")
GROUPS = [
    (["np1-a", "np1-b", "np1-chn2"], "NP1", "Community health nursing", "Primary health care, prevention, COPAR, DOH programs, epidemiology, family nursing"),
    (["np1-comm"], "NP1", "Communicable diseases", "Infectious disease nursing, isolation, treatment and prevention"),
    (["np2-ob"], "NP2", "Obstetrics", "Pregnancy, labor, delivery, postpartum, newborn, complications"),
    (["np2-pedia"], "NP2", "Pediatrics and development", "Growth and development, child illnesses, congenital problems"),
    (["np3-cardioresp"], "NP3", "Heart and lungs", "Cardiovascular and respiratory disorders and care"),
    (["np3-hop"], "NP3", "Blood, cancer and surgery care", "Hematology, oncology, peri-operative nursing"),
    (["np3-erdn-renal"], "NP3", "Fluids, burns and kidneys", "Fluid and electrolytes, acid-base, burns, renal and urinary disorders"),
    (["np4-ortho"], "NP4", "Bones, joints and muscles", "Orthopedic and musculoskeletal nursing"),
    (["np4-neurosenses"], "NP4", "Brain, nerves and senses", "Neurologic, eye and ear disorders"),
    (["np4-gitendo"], "NP4", "Digestive and hormones", "GI, liver, pancreas, endocrine and diabetes"),
    (["np5-a", "np5-b", "np5-psych-c", "np5-psych-d"], "NP5", "Psychiatric and emergency nursing", "Therapeutic communication, disorders, drugs, crisis, triage, disasters, shock"),
    (["gen-fund-a", "gen-fund-b", "gen-fund-c"], "GEN", "Fundamentals of nursing", "Assessment, procedures, medication administration, infection control, diagnostics"),
    (["gen-pharm"], "GEN", "Pharmacology", "Drug classes, actions, adverse effects, nursing considerations"),
    (["gen-plmar"], "GEN", "Laws, leadership, management, research", "Professional laws, ethics, management, research basics"),
]
notes, groups = [], []
for files, area, label, desc in GROUPS:
    key = files[0]
    groups.append({"key": key, "area": area, "label": label, "desc": desc})
    for f in files:
        for n in json.load(open(os.path.join(data_dir, f + ".json"))):
            notes.append({"id": n["id"], "area": n["area"], "title": n["title"], "body": n["body"], "priority": n.get("priority", "medium"), "group": key})
payload = {"notes": notes, "groups": groups,
           "disclaimer": "AI-written study notes from general nursing knowledge; coverage guided by a review-deck outline (headings only). Not reviewed by a nurse. Check against your textbook and local policy, especially Philippine program details, numbers and drugs."}
js = json.dumps(payload, ensure_ascii=False).replace("<", "\\u003c")
tpl = open(os.path.join(here, "template.html"), encoding="utf-8").read()
out = sys.argv[1] if len(sys.argv) > 1 else "study-reader.html"
open(out, "w", encoding="utf-8").write(tpl.replace("__DATA__", js))
print(out, len(notes), "notes", os.path.getsize(out) // 1024, "KB")
