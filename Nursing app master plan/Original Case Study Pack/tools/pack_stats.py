#!/usr/bin/env python3
"""Statistics and blueprint for the case-study pack.   python tools/pack_stats.py [cases/all_cases.json] > BLUEPRINT.md"""
import collections, json, os, sys
HERE = os.path.dirname(os.path.abspath(__file__))
path = sys.argv[1] if len(sys.argv) > 1 else os.path.join(HERE, "..", "cases", "all_cases.json")
cases = json.load(open(path, encoding="utf-8"))
items = [i for c in cases for i in c["items"]]
mcq = [i for i in items if i["type"] == "mcq"]
longest = sum(1 for i in mcq if max(i["options"], key=lambda o: len(o["text"]))["label"] == i["answer"])
print("# Blueprint and statistics\n")
print(f"{len(cases)} cases, {len(items)} items. All items `evidence_status: needs_review`.\n")
print("| Measure | Value |\n|---|---|")
print("| Item types | " + ", ".join(f"{k} {v}" for k, v in sorted(collections.Counter(i['type'] for i in items).items())) + " |")
print("| MCQ answer letters | " + ", ".join(f"{k} {v}" for k, v in sorted(collections.Counter(i['answer'] for i in mcq).items())) + " |")
print(f"| MCQ where the correct option is the longest | {longest} of {len(mcq)} |")
print("| Difficulty | " + ", ".join(f"{k} {v}" for k, v in sorted(collections.Counter(i['meta']['difficulty'] for i in items).items())) + " |")
print("| Cognitive domain | " + ", ".join(f"{k} {v}" for k, v in sorted(collections.Counter(i['meta']['cognitive_domain'] for i in items).items())) + " |")
print(f"| Items with an image suggestion | {sum(1 for i in items if 'image_suggestion' in i)} |\n")
print("| Case | NP | Title | Topic id | Item types | Difficulty |\n|---|---|---|---|---|---|")
for c in cases:
    m = c["items"][0]["meta"]
    types = " ".join(i["type"] for i in c["items"])
    diff = "/".join(i["meta"]["difficulty"][0].upper() for i in c["items"])
    print(f"| {c['id']} | {m['nursing_practice']} | {c['title']} | `{m['topic_id']}` | {types} | {diff} |")
