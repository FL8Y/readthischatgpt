#!/usr/bin/env python3
"""Validate question content against schemas/question.schema.json plus the rules of the project's PNLE Question Maker prompt.

    python tools/validate_content.py samples/questions.sample.json [--topic-tree samples/topic-tree.generated.json] [--publish]

Exit code 1 if there are errors. With --publish, items still marked evidence_status "needs_review" are errors
(a clinician/instructor must review before anything reaches learners).
"""
import json, os, re, sys
from collections import Counter
from jsonschema import Draft202012Validator

HERE = os.path.dirname(os.path.abspath(__file__))
SCHEMA = json.load(open(os.path.join(HERE, "..", "schemas", "question.schema.json"), encoding="utf-8"))
BANNED_OPTION = re.compile(r"\b(all of the above|none of the above|both [a-d] and [a-d]|a and b)\b", re.I)
ABSOLUTES = re.compile(r"\b(always|never|only|all|none)\b", re.I)
norm = lambda s: re.sub(r"\s+", " ", s.lower()).strip()

def topic_ids(tree):
    out = set()
    def walk(ns):
        for n in ns: out.add(n["id"]); walk(n["children"])
    walk(tree["subjects"]); return out

def check_item(it, where, errors, warnings):
    t = it["type"]
    if t == "mcq":
        labels = [o["label"] for o in it["options"]]
        if labels != ["A", "B", "C", "D"]: errors.append(f"{where}: option labels must be A,B,C,D in order")
        texts = [norm(o["text"]) for o in it["options"]]
        if len(set(texts)) != len(texts): errors.append(f"{where}: duplicate options")
        for o in it["options"]:
            if BANNED_OPTION.search(o["text"]): errors.append(f"{where}: option {o['label']} uses a banned form (all/none of the above, combined options)")
            if ABSOLUTES.search(o["text"]) and len(o["text"].split()) <= 12: warnings.append(f"{where}: option {o['label']} contains an absolute word; check it is not a clue")
        lens = [len(o["text"]) for o in it["options"]]
        if min(lens) and max(lens) / min(lens) > 3: warnings.append(f"{where}: option lengths differ by more than 3x")
        missing = [o["label"] for o in it["options"] if o["label"] != it["answer"] and not o.get("why_not")]
        if missing: warnings.append(f"{where}: no internal why_not note for distractor(s) {','.join(missing)}")
    elif t == "sata":
        n = len(it["options"]); a = it["answers"]
        if any(i >= n for i in a): errors.append(f"{where}: answer index out of range")
        if len(set(a)) != len(a): errors.append(f"{where}: duplicate answer indexes")
        if len(a) == n: warnings.append(f"{where}: every option is correct")
    elif t == "matrix":
        for i, r in enumerate(it["rows"]):
            if r["correct_column"] >= len(it["columns"]): errors.append(f"{where}: row {i + 1} correct_column out of range")
    elif t == "cloze":
        ids = [b["id"] for b in it["blanks"]]
        for b in it["blanks"]:
            if "{{" + b["id"] + "}}" not in it["text"]: errors.append(f"{where}: blank {b['id']} not found in text")
            if b["correct_index"] >= len(b["choices"]): errors.append(f"{where}: blank {b['id']} correct_index out of range")
            if len(set(map(norm, b["choices"]))) != len(b["choices"]): errors.append(f"{where}: blank {b['id']} has duplicate choices")
        for m in re.findall(r"\{\{([^}]+)\}\}", it["text"]):
            if m not in ids: errors.append(f"{where}: text has blank {{{{{m}}}}} with no definition")
    elif t == "highlight":
        segs = it["segments"]
        if not any(s["correct"] for s in segs): errors.append(f"{where}: no correct segment")
        if any(s["correct"] and not s["selectable"] for s in segs): errors.append(f"{where}: a correct segment is not selectable")

def flatten(doc):
    """Yield (location, item) for every item, expanding situations."""
    docs = doc if isinstance(doc, list) else [doc]
    for i, d in enumerate(docs):
        if d.get("type") == "situation":
            for j, it in enumerate(d["items"]): yield f"{d['id']}#{j + 1}", it
        else:
            yield d.get("id", f"#{i + 1}"), d

def validate(doc, tree=None, publish=False):
    errors, warnings = [], []
    v = Draft202012Validator(SCHEMA)
    docs = doc if isinstance(doc, list) else [doc]
    for i, d in enumerate(docs):
        for e in sorted(v.iter_errors(d), key=lambda e: list(e.absolute_path)):
            path = "/".join(map(str, e.absolute_path))
            errors.append(f"{d.get('id', '#' + str(i + 1))}: schema: {e.message[:140]} (at {path or 'root'})")
    if errors: return errors, warnings
    items = list(flatten(doc))
    ids = [loc for loc, _ in items]
    for k, c in Counter(ids).items():
        if c > 1: errors.append(f"{k}: duplicate id")
    stems = Counter(norm(it["stem"]) for _, it in items)
    for s, c in stems.items():
        if c > 1: errors.append(f"duplicate stem used {c} times: {s[:60]}...")
    known = topic_ids(tree) if tree else None
    for loc, it in items:
        check_item(it, loc, errors, warnings)
        tid = it["meta"].get("topic_id")
        if known is not None and tid and tid not in known: errors.append(f"{loc}: unknown topic_id {tid}")
        if it["meta"]["evidence_status"] == "needs_review":
            (errors if publish else warnings).append(f"{loc}: evidence_status needs_review (clinician review required before publishing)")
    mcq = [it for _, it in items if it["type"] == "mcq"]
    if len(mcq) >= 12:
        dist = Counter(it["answer"] for it in mcq)
        top, n = dist.most_common(1)[0]
        if n / len(mcq) > 0.4: warnings.append(f"answer key skew: {top} is correct in {n}/{len(mcq)} items")
    if len(mcq) >= 8:
        longest = sum(1 for it in mcq if max(it["options"], key=lambda o: len(o["text"]))["label"] == it["answer"])
        if longest / len(mcq) > 0.5: warnings.append(f"correct option is the longest in {longest}/{len(mcq)} items (a test-taking clue)")
    return errors, warnings

if __name__ == "__main__":
    args = sys.argv[1:]
    if not args: sys.exit(__doc__)
    tree = json.load(open(args[args.index("--topic-tree") + 1], encoding="utf-8")) if "--topic-tree" in args else None
    errs, warns = validate(json.load(open(args[0], encoding="utf-8")), tree, "--publish" in args)
    for w in warns: print("WARN ", w)
    for e in errs: print("ERROR", e)
    print(f"{len(errs)} error(s), {len(warns)} warning(s)")
    sys.exit(1 if errs else 0)
