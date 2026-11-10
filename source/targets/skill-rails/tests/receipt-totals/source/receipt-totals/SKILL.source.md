---
name: receipt-totals
description: Total a month of card receipts by spending category from a CSV export. Use when the user asks for category totals of card spending.
disable-model-invocation: true
---

# Receipt totals

1. Read the CSV the user names. Each row has `date,merchant,amount`.
2. Decide a category for each merchant using `references/categories.md`.
3. Pass those decisions to the tool on its standard input as a CSV with the header `merchant,category`, one row per merchant, quoting a name that contains a comma. Do not write them to a file. `<skill-root>` is the folder containing this `SKILL.md`; for example:

   ```bash
   python -B "<skill-root>/scripts/sum-receipts/sum_receipts.py" <receipts.csv> <<'EOF'
   merchant,category
   Blue Bottle,food
   EOF
   ```

   It prints JSON with `totals` (amount per category), `counts` (receipts per category), and `grandTotal`. A merchant you left out is counted under `uncategorized`. On an error it prints what was wrong with the input; fix that and run it again.
4. Report each category's total with its receipt count beside it, and the grand total. Mention any merchant you could not categorize.
