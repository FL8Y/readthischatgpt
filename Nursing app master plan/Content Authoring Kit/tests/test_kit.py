import copy, json, os, sys, tempfile, unittest
HERE = os.path.dirname(os.path.abspath(__file__)); ROOT = os.path.join(HERE, "..")
sys.path.insert(0, os.path.join(ROOT, "tools"))
import build_topic_tree as btt
import validate_content as vc

HIER = os.path.join(ROOT, "..", "nursing preset topics", "Anki Deck Topic Hierarchy")
load = lambda *p: json.load(open(os.path.join(ROOT, *p), encoding="utf-8"))

def mcq(**kw):
    base = {"id": "t1", "type": "mcq", "stem": "Which action is best for this client?", "answer": "B",
            "options": [{"label": l, "text": t} for l, t in zip("ABCD", ["Check the order again later", "Verify the client identity first", "Ask a colleague to decide", "Proceed once the family agrees"])],
            "rationale": "Verifying identity is the first safety step before any intervention because every other action depends on it.",
            "meta": {"nursing_practice": "NP3", "tos_content_area": "Fundamentals", "topic": "Safety", "cognitive_domain": "applying", "difficulty": "easy", "evidence_status": "established_knowledge"}}
    base.update(kw); return base

class TopicTree(unittest.TestCase):
    def test_matches_filesystem(self):
        tree = btt.build(HIER)
        dirs = sum(len(d) for _, d, _ in os.walk(HIER))
        self.assertEqual(btt.count(tree["subjects"]), dirs)
        self.assertEqual(len(tree["subjects"]), 7)
        self.assertEqual(dirs - 7, 636)
        self.assertEqual(btt.max_depth(tree["subjects"]), 7)

    def test_ids_unique_and_schema_valid(self):
        from jsonschema import Draft202012Validator
        tree = btt.build(HIER)
        Draft202012Validator(load("schemas", "topic-tree.schema.json")).validate(tree)
        ids = vc.topic_ids(tree)
        self.assertEqual(len(ids), btt.count(tree["subjects"]))

    def test_committed_tree_is_current(self):
        self.assertEqual(load("samples", "topic-tree.generated.json"), btt.build(HIER))

class Content(unittest.TestCase):
    def test_samples_valid_with_review_warnings(self):
        errs, warns = vc.validate(load("samples", "questions.sample.json"), load("samples", "topic-tree.generated.json"))
        self.assertEqual(errs, [])
        self.assertTrue(any("needs_review" in w for w in warns))

    def test_publish_gate_blocks_unreviewed(self):
        errs, _ = vc.validate(load("samples", "questions.sample.json"), None, publish=True)
        self.assertTrue(any("needs_review" in e for e in errs))

    def test_good_item_passes_with_why_not_warnings_only(self):
        errs, warns = vc.validate(mcq())
        self.assertEqual(errs, []); self.assertTrue(any("why_not" in w for w in warns))

    def test_schema_rejects_three_options_and_short_rationale(self):
        bad = mcq(); bad["options"] = bad["options"][:3]
        self.assertTrue(vc.validate(bad)[0])
        self.assertTrue(vc.validate(mcq(rationale="Too short."))[0])

    def test_banned_option_forms_and_duplicates(self):
        bad = mcq(); bad["options"][3]["text"] = "All of the above"
        self.assertTrue(any("banned" in e for e in vc.validate(bad)[0]))
        dup = mcq(); dup["options"][2]["text"] = dup["options"][0]["text"]
        self.assertTrue(any("duplicate options" in e for e in vc.validate(dup)[0]))

    def test_unknown_topic_and_duplicate_stems(self):
        tree = load("samples", "topic-tree.generated.json")
        bad = mcq(); bad["meta"]["topic_id"] = "nope/none"
        self.assertTrue(any("unknown topic_id" in e for e in vc.validate(bad, tree)[0]))
        a, b = mcq(id="a"), mcq(id="b")
        self.assertTrue(any("duplicate stem" in e for e in vc.validate([a, b])[0]))

    def test_sata_matrix_cloze_highlight_rules(self):
        meta = mcq()["meta"]; common = {"rationale": "x" * 50, "meta": meta}
        sata = {"id": "s", "type": "sata", "stem": "Select all that apply for this client.", "options": list("abcde"), "answers": [0, 9], **common}
        self.assertTrue(any("out of range" in e for e in vc.validate(sata)[0]))
        matrix = {"id": "m", "type": "matrix", "stem": "Match each finding to a condition.", "columns": ["x", "y"], "rows": [{"text": "r1", "correct_column": 0}, {"text": "r2", "correct_column": 5}], **common}
        self.assertTrue(any("correct_column" in e for e in vc.validate(matrix)[0]))
        cloze = {"id": "c", "type": "cloze", "stem": "Complete the sentence below.", "text": "A {{1}} and {{2}}", "blanks": [{"id": "1", "choices": ["a", "b"], "correct_index": 0}], **common}
        self.assertTrue(any("no definition" in e for e in vc.validate(cloze)[0]))
        hl = {"id": "h", "type": "highlight", "stem": "Highlight the abnormal findings.", "segments": [{"text": "a", "selectable": True, "correct": False}, {"text": "b", "selectable": False, "correct": False}], **common}
        self.assertTrue(any("no correct segment" in e for e in vc.validate(hl)[0]))

    def test_answer_key_skew_and_longest_option_bias(self):
        items = []
        for i in range(12):
            it = mcq(id=f"k{i}", stem=f"Distinct stem number {i} for the client scenario?", answer="B")
            it["options"][1]["text"] = "A much longer and more detailed correct answer than the others here"
            items.append(it)
        _, warns = vc.validate(items)
        self.assertTrue(any("skew" in w for w in warns)); self.assertTrue(any("longest" in w for w in warns))

if __name__ == "__main__":
    unittest.main()
