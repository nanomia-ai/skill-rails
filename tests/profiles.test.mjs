import test from "node:test";
import assert from "node:assert/strict";
import { join } from "node:path";
import { readJson } from "../scripts/lib/io.mjs";
import { selectProfile, validateIntent } from "../scripts/lib/profiles.mjs";
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
