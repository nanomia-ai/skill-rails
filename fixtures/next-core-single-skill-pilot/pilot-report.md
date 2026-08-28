# Evidence-credit pilot — current state

## 1. What this skill does

This P2 skill routes a work or verify intent while preventing a verifier claim from becoming current proof by memory or self-report. For verify, collectors read raw project facts, compute the selected-byte SHA-256, parse the verifier's declared columns, and let the exclusive evidence table return WAIT, NEXT, BLOCK, or DONE. The runtime calculates Decisions and evidence alignment; it does not acquire channels, dispatch verifiers, write results, or perform another domain effect.

## 2. Contract position

- <code>skill/spec.mjs</code> is the only behavior source under the public V5 contract.
- The evidence stage uses <code>reentry: rejudge</code>. Reobservation means agent reentry: the agent reinvokes the same run, collectors gather fresh facts, and the table is judged again.
- <code>ARTIFACTS</code> is the single source for the five static project paths and the verifier-result output. Its <code>readers</code> declare which stage consumes each artifact, collectors and the real-state host reuse those paths, and Decision schema 2 projects only the selected stage's <code>stage_artifacts</code> into the compact guide.
- The generated loader binds record and alignment evidence to the exact Decision file, does not carry it across reinvocation automatically, and tells consumers to use current <code>stage_artifacts</code> instead of inspecting collectors or authoring files for replacement paths.
- <code>DECLARATIONS</code> contains only <code>complexityBudget</code>. Continuation is an ordinary declared identity column, not another runtime mode or declaration.
- The embedded schemas and 28 shared runtime files came from the creator tree used for the canonical build. The generated package adds only the four entry points <code>align.mjs</code>, <code>lint.mjs</code>, <code>run.mjs</code>, and <code>trace.mjs</code>, while its manifest-bound package-root <code>.gitattributes</code> preserves those emitted bytes across Git checkout modes.
- The canonical build embeds runtime 0.2.0, validator 0.3.0, and Decision schema <code>skill-rails/decision/2</code>. Trace schema is unchanged; alignment now rejects an unsealed supplied Decision or one that is not stable-structurally equal to its runtime-observed emission before deriving expectations.

## 3. Binding rule

The verifier must return the exact selection locator it read and the SHA-256 of those exact selected bytes. The collector resolves the project root and selected path canonically before containment testing, so a parent traversal, POSIX symlink, or Windows junction that lands outside the project fails closed before hashing.

| Verifier column | Fresh fact | Credit condition |
|---|---|---|
| <code>task</code> | <code>task.identity</code> | exact equality |
| <code>snapshot</code> | <code>task.snapshot</code> | exact equality |
| <code>selection</code> | <code>selection.locator</code> | exact locator equality |
| <code>selection-hash</code> | <code>selection.hash</code> | exact selected-byte SHA-256 equality |
| <code>continuation</code> | <code>continuation.identity</code> | exact equality |
| <code>recorded-json.currentness</code> | freshly collected <code>result.currentness</code> | must be <code>current</code> |
| <code>verdict</code> | freshly collected <code>result.verdict</code> | must be <code>pass</code> |

A pass is creditable only when every row above holds. Stale proof, a mismatched declared column, a finding, an unclassified result, or an observation failure remains non-pass.

## 4. Public CLI behavior

| Observed state | Decision |
|---|---|
| verifier channel unavailable | <code>channel / WAIT</code> |
| channel available, result absent | <code>acquire / NEXT</code> with <code>RUN → DISPATCH → WRITE → NEXT</code> |
| all declared columns match and verdict is pass | <code>evidence / matching-pass / DONE</code> |
| all identity columns match and verdict is finding | <code>evidence / matching-finding / BLOCK</code> |
| result reused after selection locator or bytes change | <code>evidence / mismatched-proof / BLOCK</code> |
| result reused after snapshot change | <code>evidence / mismatched-proof / BLOCK</code> |
| result currentness is stale | <code>evidence / stale-proof / BLOCK</code> |
| parent, symlink, or junction locator escapes the project | observation <code>BLOCK</code> before outside bytes are hashed |

## 5. Exact package inventory

The pilot root contains five files outside the generated skill: <code>intent.json</code>, this report, and <code>real-state/e2e-host.mjs</code>, <code>real-state/e2e.test.mjs</code>, and <code>real-state/verifier.mjs</code>.

The skill contains 54 physical files:

- Manifest content hashes, 15 entries: <code>.skill-rails/eval-cases.json</code>, <code>.skill-rails/intent.json</code>, <code>.skill-rails/obligation-ledger.json</code>, <code>.skill-rails/profile-decision.json</code>, <code>SKILL.md</code>, <code>body.md</code>, <code>collectors/index.mjs</code>, <code>fixtures/formats.json</code>, <code>fixtures/lint/manifest.json</code>, <code>fixtures/scenarios.json</code>, <code>references/canon.md</code>, <code>references/purpose.md</code>, <code>references/verify.md</code>, <code>references/work.md</code>, and <code>templates/lane-report.md</code>.
- Generated hashes, 37 entries: package-root <code>.gitattributes</code>, <code>SKILL.md</code>, <code>agents/openai.yaml</code>, both files under <code>schemas/</code>, and these 32 runtime paths under <code>scripts/skill-rails/</code>: <code>align.mjs</code>, <code>alignment.mjs</code>, <code>api.mjs</code>, <code>ast-policy.mjs</code>, <code>authoring-ledger.mjs</code>, <code>body.mjs</code>, <code>cli.mjs</code>, <code>collectors.mjs</code>, <code>constants.mjs</code>, <code>diagnostics.mjs</code>, <code>domains.mjs</code>, <code>dsl.mjs</code>, <code>evaluator.mjs</code>, <code>format-checks.mjs</code>, <code>guide.mjs</code>, <code>hash.mjs</code>, <code>lint.mjs</code>, <code>loader.mjs</code>, <code>manifest.mjs</code>, <code>path-policy.mjs</code>, <code>run.mjs</code>, <code>scenario-checks.mjs</code>, <code>snapshot.mjs</code>, <code>templates.mjs</code>, <code>trace-core.mjs</code>, <code>trace-store.mjs</code>, <code>trace.mjs</code>, <code>validator.mjs</code>, <code>vendor/ACORN-LICENSE</code>, <code>vendor/ACORN-WALK-LICENSE</code>, <code>vendor/acorn-walk.mjs</code>, and <code>vendor/acorn.mjs</code>.
- Three additional package files: <code>.generated.json</code>, <code>authoring-card.md</code>, and <code>spec.mjs</code>. The manifest records <code>spec.mjs</code> through <code>spec_hash</code>; <code>SKILL.md</code> appears in both declared maps. The ignored <code>.skill-rails/semantic-diff.json</code> is not part of the current package inventory.

Thus the pilot contains 59 physical files. The deleted standalone runtime-state files have no replacement files; <code>fixtures/scenarios.json</code> and <code>real-state/*</code> are the live evidence surfaces.

## 6. Verification receipts

All commands run from the repository root.

### Root full lint

    node scripts/lint.mjs --skill fixtures/next-core-single-skill-pilot/skill --full --json

Receipt: exit 0; L0 through L18 pass with no diagnostics.

### Formal clean build

    node scripts/build.mjs --skill fixtures/next-core-single-skill-pilot/skill --repeats 50 --json

Receipt: exit 0; 20/20 mutations killed, 10/10 scenarios passed for 50 deterministic repeats with no mismatch, predicate performance passed the 50 ms limit, and 256/256 format round trips passed with CRLF rejected. The canonical build identifier is <code>sha256:b0bfffa83c9c4510f46a89936be40c41c4e874ab15eb7bcd7684096e73f082a3</code>, with <code>built_at: null</code>.

### Embedded lint and focused real-state e2e

    node fixtures/next-core-single-skill-pilot/skill/scripts/skill-rails/run.mjs lint --skill fixtures/next-core-single-skill-pilot/skill --json
    node --test fixtures/next-core-single-skill-pilot/real-state/e2e.test.mjs

Receipt: embedded L0 through L18 pass; 2/2 e2e tests pass. The first test asserts WAIT, acquire NEXT, matching-pass DONE, selection reuse BLOCK, snapshot reuse BLOCK, and stale BLOCK. The second supplies matching outside bytes and asserts that parent traversal fails and a platform-selected POSIX symlink or Windows junction produces BLOCK with the canonical-containment diagnostic.

### Manifest closure

    node --input-type=module -e "import {verifyManifest} from './fixtures/next-core-single-skill-pilot/skill/scripts/skill-rails/manifest.mjs'; const {manifest}=await verifyManifest('./fixtures/next-core-single-skill-pilot/skill'); console.log(JSON.stringify({build_id:manifest.build_id,content_hashes:Object.keys(manifest.content).length,generated_hashes:Object.keys(manifest.generated_files).length,declared_hashes:Object.keys(manifest.content).length+Object.keys(manifest.generated_files).length},null,2));"

Receipt: manifest verification succeeds with 15 content hashes, 37 generated hashes, and 52 declared hashes; the build identifier matches the formal build receipt.

### Git checkout byte preservation

Disposable <code>git clone --no-local</code> checkouts with <code>core.autocrlf=true</code> and <code>core.autocrlf=false</code> both report every tracked pilot package path as <code>attr/-text</code>. Every sealed path has equal raw SHA-256 bytes in both clones, both embedded manifest verifications succeed with the same canonical build identifier, and both disposable clone roots are deleted after exact-path containment proof.

### Current correction boundary

The deployed Git baseline is <code>f8f4204</code>, which contains the <code>ARTIFACTS.readers</code> stage/guard dependency link, required <code>Decision.stage_artifacts</code> plus its guide projection, exact supplied/runtime-emitted Decision binding, and skipped-judgment stage-state isolation. The current uncommitted final-gate correction adds only an internal evaluator observer for build fixture coverage: skipped <code>NEXT</code> branches can be credited from actual execution without adding fields to the final Decision or weakening L14. The canonical rebuild updates the embedded evaluator/API and manifest; Decision and Trace schemas, runtime/validator versions, pilot spec, fixtures, and domain behavior are unchanged.

### Current repository verification

    npm run verify

Receipt: the full <code>npm run verify</code> passed. Vendor and lint passed; repository tests passed 59/59, including evaluator-observed skipped-NEXT coverage, false-claim rejection, exact-Decision purity, simple-lint helper-target discharge, exact-Decision API/CLI tamper rejection, selected stage/guard projection, package-attribute collision, and explicit ownership-transfer coverage; the eval clean control was valid; the fixture probe reported 10 total cases and 3 divergences; seeded defects were detected 5/5; all 8 required runs were present; and the empirical gate passed.

### Landing readiness

Receipt: Git baseline <code>f8f4204</code> is complete. The final-gate correction is local and uncommitted; its push, installation, deployment, and corrected-byte fresh-author or fresh-consumer behavior remain outside this receipt.

### Size facts

    node -e "const fs=require('fs'),p='fixtures/next-core-single-skill-pilot/skill/'; const b=f=>fs.readFileSync(p+f); const m=f=>({bytes:b(f).length,lines:(b(f).toString('utf8').match(/\n/g)||[]).length}); const files=[]; const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const x=d+'/'+e.name;e.isDirectory()?walk(x):files.push(x)}}; walk(p.slice(0,-1)); console.log(JSON.stringify({spec:m('spec.mjs'),collector:m('collectors/index.mjs'),skill:m('SKILL.md'),verify_read_set:b('SKILL.md').length+b('references/canon.md').length+b('references/verify.md').length,work_read_set:b('SKILL.md').length+b('references/canon.md').length+b('references/work.md').length,package_bytes:files.reduce((n,f)=>n+fs.readFileSync(f).length,0),package_files:files.length},null,2));"

Measured on 2026-08-29: <code>spec.mjs</code> is 7,224 bytes and 67 lines; the collector is 5,999 bytes and 121 lines; <code>SKILL.md</code> is 2,168 bytes and 18 lines; the verify read set is 8,417 bytes; the work read set is 5,972 bytes; and the 54-file skill package is 493,656 bytes.

## 7. What remains UNPROVEN

- The deployed <code>0b70194</code> package was selected and completed by fresh consumers, but Sol needed a coordinator answer for <code>.selection-proof</code> paths and Fable/Luna inspected package source; composition is therefore PARTIAL, not closed.
- The corrected Decision/guide has not yet been deployed or exercised by a fresh consumer, so source-free path/grammar discovery from <code>stage_artifacts</code> and the selected body/template remains UNPROVEN.
- Verifier truthfulness remains external to the runtime; the package correlates returned columns but cannot prove that a verifier reported honestly.
- The public lane records agent claims plus artifact path-and-byte verification, but no harness-trusted <code>effect_observed</code>; public effect execution therefore remains partial or unproven as reported by alignment.
- This run observes the Windows junction branch. The same test selects a POSIX directory symlink on non-Windows hosts, but POSIX execution is not evidence from this run.
- Corrected-byte installation/deployment, long-session behavior, and out-of-band writer concurrency are unproven.

## 8. Immediate next step

Review the verified local final-gate correction, then—only with separate authorization—land and deploy it and run isolated fresh-author and fresh-consumer checks against those corrected bytes.

## Appendix A. Retired designs

Receipt-based correlation, singleton recorded-JSON correlation, and standalone synthetic runtime-state files are retired. The current implementation is the declared-column table, fresh agent reentry, canonical selection containment, scenario fixtures, and real-state e2e harness described above.
