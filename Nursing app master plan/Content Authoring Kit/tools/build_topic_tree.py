#!/usr/bin/env python3
"""Turn the repo's PNLE topic folder hierarchy into topic-tree.json (see schemas/topic-tree.schema.json).

    python tools/build_topic_tree.py "<path to 'Anki Deck Topic Hierarchy'>" samples/topic-tree.generated.json

Every real directory becomes a node; .gitkeep markers and files are ignored. Node ids are stable slugs of the
path ("medical-surgical-nursing/cardiovascular/..."), so items can reference topics by id.
The subject -> Nursing Practice (NP1-NP5) mapping below is PROVISIONAL and must be verified against the official TOS.
"""
import json, os, re, sys

PROVISIONAL_NP = {
    "community-health-nursing": ["NP1"],
    "ob-nursing": ["NP2"],
    "pediatric-nursing": ["NP2"],
    "medical-surgical-nursing": ["NP3", "NP4"],
    "psychiatric-nursing": ["NP5"],
    "fundamentals": ["CROSS_CUTTING"],
    "palmer": ["CROSS_CUTTING"],
}

def slug(name: str) -> str:
    s = re.sub(r"^\d+\s+", "", name)                       # "01 Community Health" -> "Community Health"
    s = re.sub(r"[^a-z0-9]+", "-", s.lower()).strip("-")
    return s or "untitled"

def build_node(path: str, parent_id: str, depth: int) -> dict:
    name = re.sub(r"^\d+\s+", "", os.path.basename(path)) if depth == 1 else os.path.basename(path)
    node_id = f"{parent_id}/{slug(os.path.basename(path))}" if parent_id else slug(os.path.basename(path))
    kids, seen = [], {}
    for entry in sorted(os.listdir(path), key=str.lower):
        child = os.path.join(path, entry)
        if not os.path.isdir(child):
            continue
        k = build_node(child, node_id, depth + 1)
        if k["id"] in seen:                                  # duplicate sibling slug -> disambiguate
            seen[k["id"]] += 1
            k["id"] = f"{k['id']}-{seen[k['id']]}"
        else:
            seen[k["id"]] = 1
        kids.append(k)
    node = {"id": node_id, "name": name, "depth": depth, "children": kids}
    if depth == 1 and node_id in PROVISIONAL_NP:
        node["np"] = PROVISIONAL_NP[node_id]
    return node

def build(root: str) -> dict:
    subjects = [build_node(os.path.join(root, d), "", 1) for d in sorted(os.listdir(root)) if os.path.isdir(os.path.join(root, d))]
    return {"version": 1, "source": os.path.basename(os.path.normpath(root)), "subjects": subjects}

def count(nodes) -> int:
    return sum(1 + count(n["children"]) for n in nodes)

def max_depth(nodes) -> int:
    return max((max(n["depth"], max_depth(n["children"])) for n in nodes), default=0)

if __name__ == "__main__":
    if len(sys.argv) != 3: sys.exit(__doc__)
    tree = build(sys.argv[1])
    with open(sys.argv[2], "w", encoding="utf-8") as f:
        json.dump(tree, f, ensure_ascii=False, indent=1)
    total = count(tree["subjects"])
    print(f"{len(tree['subjects'])} subjects, {total - len(tree['subjects'])} nested topics, max depth {max_depth(tree['subjects'])}")
