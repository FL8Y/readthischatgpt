import json, os, sqlite3, tempfile, zipfile, unittest
from build_apkg import build

class ApkgTest(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.mkdtemp()
        self.out = os.path.join(self.tmp, "t.apkg")
        self.spec = json.load(open(os.path.join(os.path.dirname(__file__), "sample_cards.json"), encoding="utf-8"))

    def read(self):
        with zipfile.ZipFile(self.out) as z:
            self.assertIn("collection.anki2", z.namelist()); self.assertIn("media", z.namelist())
            db = os.path.join(self.tmp, "c.sqlite"); open(db, "wb").write(z.read("collection.anki2"))
        return sqlite3.connect(db)

    def test_counts_and_schema(self):
        n = build(self.spec, self.out); con = self.read()
        self.assertEqual(n, 5)
        self.assertEqual(con.execute("select count(*) from notes").fetchone()[0], 5)
        self.assertEqual(con.execute("select count(*) from cards").fetchone()[0], 5)  # 1 card per note here
        self.assertEqual(con.execute("select count(*) from revlog").fetchone()[0], 0)
        tables = {r[0] for r in con.execute("select name from sqlite_master where type='table'")}
        self.assertTrue({"col", "notes", "cards", "revlog", "graves"} <= tables)

    def test_cloze_and_fields(self):
        build(self.spec, self.out); con = self.read()
        flds = [r[0] for r in con.execute("select flds from notes")]
        self.assertTrue(any("{{c1::20}}" in f for f in flds))
        self.assertTrue(any(f.startswith("Normal adult resting heart rate\x1f60") for f in flds))  # 0x1f separates fields

    def test_guid_stable_across_builds(self):
        build(self.spec, self.out); a = sorted(r[0] for r in self.read().execute("select guid from notes"))
        build(self.spec, self.out); b = sorted(r[0] for r in self.read().execute("select guid from notes"))
        self.assertEqual(a, b)

    def test_validation(self):
        with self.assertRaises(ValueError): build({"deck": "d", "cards": [{"type": "cloze", "text": "no deletion"}]}, self.out)
        with self.assertRaises(ValueError): build({"deck": "d", "cards": [{"type": "basic", "front": "x"}]}, self.out)

if __name__ == "__main__":
    unittest.main()
