import collections, json, os, sys, unittest
HERE = os.path.dirname(os.path.abspath(__file__)); PACK = os.path.join(HERE, "..")
KIT = os.path.join(PACK, "..", "Content Authoring Kit")
sys.path.insert(0, os.path.join(KIT, "tools"))
import validate_content as vc

load = lambda p: json.load(open(p, encoding="utf-8"))
CASES = load(os.path.join(PACK, "cases", "all_cases.json"))
TREE = load(os.path.join(KIT, "samples", "topic-tree.generated.json"))
ITEMS = [i for c in CASES for i in c["items"]]
MCQ = [i for i in ITEMS if i["type"] == "mcq"]

class Pack(unittest.TestCase):
    def test_counts_and_structure(self):
        self.assertEqual(len(CASES), 42); self.assertEqual(len(ITEMS), 210)
        self.assertTrue(all(len(c["items"]) == 5 for c in CASES))
        self.assertEqual(len({c["id"] for c in CASES}), 42)
        by_np = collections.Counter(c["items"][0]["meta"]["nursing_practice"] for c in CASES)
        self.assertEqual(dict(by_np), {"NP1": 8, "NP2": 9, "NP3": 9, "NP4": 9, "NP5": 7})

    def test_validates_with_no_errors(self):
        errs, _ = vc.validate(CASES, TREE)
        self.assertEqual(errs, [])

    def test_every_item_has_unreviewed_status_and_rationale(self):
        for i in ITEMS:
            self.assertEqual(i["meta"]["evidence_status"], "needs_review")
            self.assertGreaterEqual(len(i["rationale"]), 40)
            self.assertTrue(i.get("rationale_simplified"))
        self.assertTrue(all("sources" not in i["meta"] for i in ITEMS))   # no invented citations

    def test_each_case_mixes_types_with_mcq_and_sata(self):
        for c in CASES:
            kinds = {i["type"] for i in c["items"]}
            self.assertIn("mcq", kinds); self.assertIn("sata", kinds); self.assertGreaterEqual(len(kinds), 3)

    def test_mcq_quality_rules(self):
        self.assertEqual(collections.Counter(i["answer"] for i in MCQ).keys(), {"A", "B", "C", "D"})
        self.assertLessEqual(max(collections.Counter(i["answer"] for i in MCQ).values()) / len(MCQ), 0.4)
        longest = sum(1 for i in MCQ if max(i["options"], key=lambda o: len(o["text"]))["label"] == i["answer"])
        self.assertLessEqual(longest / len(MCQ), 1 / 3)
        for i in MCQ:
            for o in i["options"]:
                if o["label"] != i["answer"]: self.assertTrue(o["why_not"], i["id"])

    def test_images_are_suggestions_only(self):
        for i in ITEMS: self.assertNotIn("images", i)                       # nothing attached without a verified licence
        for c in CASES: self.assertNotIn("images", c)

if __name__ == "__main__":
    unittest.main()
