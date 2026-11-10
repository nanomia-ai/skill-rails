"""Total receipts by category.

Usage: python -B sum_receipts.py <receipts.csv>  < categories on stdin

receipts.csv has the columns date,merchant,amount (UTF-8).
stdin is a CSV with the columns merchant,category (UTF-8): the category the AI
decided for each merchant. A merchant missing from it counts as "uncategorized".
Prints JSON: {"totals": {category: amount}, "counts": {category: receipts},
"grandTotal": amount}.
"""
import csv
import io
import json
import sys
from csv_utils import read_rows


def fail(message):
    print(f"sum_receipts: {message}\nRun with --help for the input forms.", file=sys.stderr)
    sys.exit(2)


if len(sys.argv) != 2 or sys.argv[1] in ("-h", "--help"):
    print(__doc__.strip())
    sys.exit(0 if len(sys.argv) == 2 else 2)

if sys.stdin is None or sys.stdin.isatty():
    fail("pass the merchant,category CSV on standard input.")
stdin = io.TextIOWrapper(sys.stdin.buffer, encoding="utf-8-sig", newline="")
mapping = csv.DictReader(stdin)
if not mapping.fieldnames or not {"merchant", "category"} <= set(mapping.fieldnames):
    fail("stdin must be a CSV whose header has merchant,category.")
category_of = {row["merchant"]: row["category"] for row in mapping}
if not category_of:
    fail("stdin has a header but no merchant rows.")

totals, counts = {}, {}
for row in read_rows(sys.argv[1]):
    category = category_of.get(row["merchant"], "uncategorized")
    totals[category] = totals.get(category, 0) + int(row["amount"])
    counts[category] = counts.get(category, 0) + 1
print(json.dumps({"totals": totals, "counts": counts, "grandTotal": sum(totals.values())}, ensure_ascii=False))
