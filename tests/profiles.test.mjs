import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { readJson } from "../scripts/lib/io.mjs";
import { selectProfile, validateIntent } from "../scripts/lib/profiles.mjs";
import { createObligationLedger, mergeObligationLedger } from "../scripts/lib/obligations.mjs";
import { ROOT } from "./helpers.mjs";

for (const profile of ["p0", "p1", "p2"]) {
  test(`auto selects ${profile}`, async () => {
    const intent = await readJson(join(ROOT, "fixtures", "intents", `${profile}.json`));
    assert.deepEqual(validateIntent(intent), []);
    assert.equal(selectProfile(intent).profile, profile);
  });
}

test("explicit profile remains auditable", async () => {
  const intent = await readJson(join(ROOT, "fixtures", "intents", "p0.json"));
  const selected = selectProfile(intent, "p2");
  assert.equal(selected.profile, "p2");
  assert.equal(selected.explicit, true);
});

test("completion evidence alone does not inflate a judgment-only skill to P2", async () => {
  const intent = await readJson(join(ROOT, "fixtures", "intents", "p0.json"));
  intent.completion_evidence = ["review notes identify every proposed tone change"];
  assert.equal(selectProfile(intent).profile, "p0");
});

test("conditional judgment topics do not inflate profile selection", async () => {
  const intent = await readJson(join(ROOT, "fixtures", "intents", "p0.json"));
  intent.judgment_points = [{
    id: "meaning-risk",
    when: "The requested tone change could alter a factual claim.",
    points: ["Preserve the original claim and identify the risky wording before suggesting a change."]
  }];
  assert.deepEqual(validateIntent(intent), []);
  assert.equal(selectProfile(intent).profile, "p0");
});

test("conditional judgment topics require stable unique routing metadata", async () => {
  const intent = await readJson(join(ROOT, "fixtures", "intents", "p0.json"));
  intent.judgment_points = [
    { id: "reader-fit", when: "The audience is specialized.", points: ["Keep necessary domain terms."] },
    { id: "reader-fit", when: "The audience is new.\nUse simpler words.", points: [] }
  ];
  const issues = validateIntent(intent);
  assert.ok(issues.some((issue) => /duplicated/.test(issue)));
  assert.ok(issues.some((issue) => /single-line/.test(issue)));
  assert.ok(issues.some((issue) => /one or more/.test(issue)));
});

test("ledger v2 upgrades discard obsolete simple projections without erasing P2 authoring", async () => {
  const p0 = await readJson(join(ROOT, "fixtures", "intents", "p0.json"));
  const legacyP0 = createObligationLedger(p0, "p0");
  legacyP0.schema = "skill-rails/obligation-ledger/1";
  for (const atom of legacyP0.atoms) {
    atom.targets = ["file:SKILL.md", "file:references/intent.md"];
    atom.evidence = ["file:references/intent.md"];
  }
  const upgradedP0 = mergeObligationLedger(legacyP0, p0, "p0");
  assert.equal(upgradedP0.schema, "skill-rails/obligation-ledger/2");
  assert.equal(upgradedP0.atoms.some((atom) => [...atom.targets, ...atom.evidence].includes("file:references/intent.md")), false);

  const p1 = await readJson(join(ROOT, "fixtures", "intents", "p1.json"));
  const legacyP1 = createObligationLedger(p1, "p1");
  legacyP1.schema = "skill-rails/obligation-ledger/1";
  for (const atom of legacyP1.atoms) {
    if (atom.source !== "intent.deterministic_helpers[0]") {
      atom.targets = ["file:SKILL.md", "file:references/intent.md"];
      atom.evidence = ["file:references/intent.md"];
    }
  }
  const authoredP1 = legacyP1.atoms.find((atom) => atom.source === "intent.deterministic_helpers[0]");
  authoredP1.disposition = "projected";
  authoredP1.targets = ["file:scripts/run.mjs"];
  authoredP1.evidence = ["file:tests/helper.test.mjs"];
  const upgradedP1 = mergeObligationLedger(legacyP1, p1, "p1");
  const preservedP1 = upgradedP1.atoms.find((atom) => atom.source === authoredP1.source);
  assert.deepEqual({ disposition: preservedP1.disposition, targets: preservedP1.targets, evidence: preservedP1.evidence }, {
    disposition: "projected", targets: ["file:scripts/run.mjs"], evidence: ["file:tests/helper.test.mjs"]
  });
  assert.equal(upgradedP1.atoms.some((atom) => [...atom.targets, ...atom.evidence].includes("file:references/intent.md")), false);
  const changedP1 = mergeObligationLedger(legacyP1, { ...p1, deterministic_helpers: ["a changed helper"] }, "p1", ["deterministic_helpers"]);
  assert.equal(changedP1.atoms.find((atom) => atom.source === authoredP1.source).disposition, "review-required");

  const p2 = await readJson(join(ROOT, "fixtures", "intents", "p2.json"));
  const legacyP2 = createObligationLedger(p2, "p2");
  legacyP2.schema = "skill-rails/obligation-ledger/1";
  const authored = legacyP2.atoms.find((atom) => atom.source === "intent.outputs[0]");
  authored.disposition = "projected";
  authored.targets = ["spec:STAGES/operate"];
  authored.evidence = ["fixture:ready"];
  const upgradedP2 = mergeObligationLedger(legacyP2, p2, "p2");
  const preserved = upgradedP2.atoms.find((atom) => atom.source === authored.source);
  assert.equal(upgradedP2.schema, "skill-rails/obligation-ledger/2");
  assert.deepEqual({ disposition: preserved.disposition, targets: preserved.targets, evidence: preserved.evidence }, {
    disposition: "projected", targets: ["spec:STAGES/operate"], evidence: ["fixture:ready"]
  });
});
