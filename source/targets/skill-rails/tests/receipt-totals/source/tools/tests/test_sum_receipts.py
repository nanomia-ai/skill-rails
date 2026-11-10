"""Development test for tools/sum-receipts; not shipped. Run: python -B tools/tests/test_sum_receipts.py"""
import json, os, subprocess, sys, tempfile, unittest

TOOL = os.path.join(os.path.dirname(__file__), "..", "sum-receipts", "sum_receipts.py")
RECEIPTS = "date,merchant,amount\n2026-11-01,Blue Bottle,6500\n2026-11-02,\"Kakao, T\",12000\n2026-11-03,스타벅스,4500\n2026-11-05,Blue Bottle,6500\n2026-11-07,Unknown,1000\n"


def run(stdin):
    with tempfile.TemporaryDirectory() as d:
        path = os.path.join(d, "r.csv")
        with open(path, "w", encoding="utf-8", newline="") as f:
            f.write(RECEIPTS)
        return subprocess.run([sys.executable, "-B", TOOL, path], input=stdin.encode("utf-8"), capture_output=True)


class SumReceipts(unittest.TestCase):
    def test_totals_and_counts(self):
        p = run('merchant,category\nBlue Bottle,food\n"Kakao, T",transport\n스타벅스,food\n')
        self.assertEqual(p.returncode, 0, p.stderr)
        self.assertEqual(json.loads(p.stdout), {
            "totals": {"food": 17500, "transport": 12000, "uncategorized": 1000},
            "counts": {"food": 3, "transport": 1, "uncategorized": 1},
            "grandTotal": 30500})

    def test_rejects_bad_stdin(self):
        for stdin in ("", "name,cat\nA,b\n", "merchant,category\n"):
            p = run(stdin)
            self.assertEqual(p.returncode, 2)
            self.assertTrue(p.stderr.startswith(b"sum_receipts: "), p.stderr)
            self.assertEqual(p.stdout, b"")


if __name__ == "__main__":
    unittest.main()
