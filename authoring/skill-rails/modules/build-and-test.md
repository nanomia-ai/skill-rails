# Build, check, test, and gate

Build one target first, review its receipt and generated diff, and verify deterministic delivery and currentness before claiming delivery. Double-build and compare tree hashes, and check artifact integrity separately from source currentness. Test from a standalone copy. When maintaining an existing package, rebuild only affected targets and preserve failed receipts.

At the adoption or release gate, run the smallest realistic fresh-use observation that can change the decision and reread the actual effect. Scope that observation by the decision's distinct failure risks, not by target count: one observation may cover several targets, and any risk it does not actually exercise stays `unproven`. Record `proven`, `failed`, and `unproven` separately; do not grow a matrix after the decision is already bounded.

Current evidence covers deterministic source/build/currentness, one bounded record-only use path, five small pilot stage observations, one machine-level non-Devflow generalization, and one bounded installed author-to-two-target-to-maintain-to-unfamiliar-use observation. The embedded CLI closes mechanical out-of-repository delivery without a sibling repository, global runtime, or network call. The evolution method's navigation benefit, broad host behavior, authoring-process efficiency, and prose-relative total cost remain `unproven`.
