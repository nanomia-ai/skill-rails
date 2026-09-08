# Evidence-credit pilot — current state

## 1. What this skill does

This P2 skill routes a work or verify intent while preventing a verifier claim from becoming current proof by memory or self-report. For verify, collectors read raw project facts, compute the selected-byte SHA-256, parse the verifier's declared columns, and let the exclusive evidence table return WAIT, NEXT, BLOCK, or DONE. The runtime calculates Decisions and evidence alignment; it does not acquire channels, dispatch verifiers, write results, or perform another domain effect.

## 2. Contract position

- <code>skill/spec.mjs</code> is the only behavior source under the public V5 contract.
- The evidence stage uses <code>reentry: rejudge</code>. Reobservation means agent reentry: the agent reinvokes the same run, collectors gather fresh facts, and the table is judged again.
- <code>ARTIFACTS</code> is the single source for the five static project paths and the verifier-result output. Its <code>readers</code> declare which stage consumes each artifact, collectors and the real-state host reuse those paths, and Decision schema 2 projects only the selected stage's <code>stage_artifacts</code> into the compact guide.
- The generated loader binds record and alignment evidence to the exact Decision file, does not carry it across reinvocation automatically, and tells consumers to use current <code>stage_artifacts</code> instead of inspecting collectors or authoring files for replacement paths.
- <code>DECLARATIONS</code> contains only <code>complexityBudget</code>. Continuation is an ordinary declared identity column, not another runtime mode or declaration.
- The embedded schemas and 29 shared runtime files came from the creator tree used for the canonical build. The generated package adds only the four entry points <code>align.mjs</code>, <code>lint.mjs</code>, <code>run.mjs</code>, and <code>trace.mjs</code>, while its manifest-bound package-root <code>.gitattributes</code> preserves those emitted bytes across Git checkout modes.
- The canonical build embeds runtime 0.3.3, validator 0.6.2, and Decision schema <code>skill-rails/decision/2</code>. Trace schema is unchanged; alignment rejects an unsealed supplied Decision or one that is not stable-structurally equal to its runtime-observed emission before deriving expectations. Validator 0.6.2 also exposes the existing L16 locator resolver as structured read-only data for creator-side maintenance inspection without widening the accepted locator universe.

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

The skill contains 55 physical files:

- Manifest content hashes, 15 entries: <code>.skill-rails/eval-cases.json</code>, <code>.skill-rails/intent.json</code>, <code>.skill-rails/obligation-ledger.json</code>, <code>.skill-rails/profile-decision.json</code>, <code>SKILL.md</code>, <code>body.md</code>, <code>collectors/index.mjs</code>, <code>fixtures/formats.json</code>, <code>fixtures/lint/manifest.json</code>, <code>fixtures/scenarios.json</code>, <code>references/canon.md</code>, <code>references/purpose.md</code>, <code>references/verify.md</code>, <code>references/work.md</code>, and <code>templates/lane-report.md</code>.
- Generated hashes, 38 entries: package-root <code>.gitattributes</code>, <code>SKILL.md</code>, <code>agents/openai.yaml</code>, both files under <code>schemas/</code>, and these 33 runtime paths under <code>scripts/skill-rails/</code>: <code>align.mjs</code>, <code>alignment.mjs</code>, <code>api.mjs</code>, <code>ast-policy.mjs</code>, <code>authoring-ledger.mjs</code>, <code>body.mjs</code>, <code>cli.mjs</code>, <code>collectors.mjs</code>, <code>constants.mjs</code>, <code>diagnostics.mjs</code>, <code>domains.mjs</code>, <code>dsl.mjs</code>, <code>evaluator.mjs</code>, <code>format-checks.mjs</code>, <code>guide.mjs</code>, <code>hash.mjs</code>, <code>lint.mjs</code>, <code>loader.mjs</code>, <code>manifest.mjs</code>, <code>observations.mjs</code>, <code>path-policy.mjs</code>, <code>run.mjs</code>, <code>scenario-checks.mjs</code>, <code>snapshot.mjs</code>, <code>templates.mjs</code>, <code>trace-core.mjs</code>, <code>trace-store.mjs</code>, <code>trace.mjs</code>, <code>validator.mjs</code>, <code>vendor/ACORN-LICENSE</code>, <code>vendor/ACORN-WALK-LICENSE</code>, <code>vendor/acorn-walk.mjs</code>, and <code>vendor/acorn.mjs</code>.
- Three additional package files: <code>.generated.json</code>, <code>authoring-card.md</code>, and <code>spec.mjs</code>. The manifest records <code>spec.mjs</code> through <code>spec_hash</code>; <code>SKILL.md</code> appears in both declared maps. The ignored <code>.skill-rails/semantic-diff.json</code> is not part of the current package inventory.

Thus the pilot contains 60 physical files. The deleted standalone runtime-state files have no replacement files; <code>fixtures/scenarios.json</code> and <code>real-state/*</code> are the live evidence surfaces.

## 6. Verification receipts

All commands run from the repository root.

### Root full lint

    node skills/skill-rails/scripts/lint.mjs --skill fixtures/next-core-single-skill-pilot/skill --full --json

Receipt: exit 0; L0 through L18 pass with no diagnostics.

### Formal clean build

    node skills/skill-rails/scripts/build.mjs --skill fixtures/next-core-single-skill-pilot/skill --repeats 50 --json

Receipt: exit 0; 20/20 mutations killed, 10/10 scenarios passed for 50 deterministic repeats with no mismatch, predicate performance passed the 50 ms limit, and 256/256 format round trips passed with CRLF rejected. The canonical build identifier is <code>sha256:4f81126091d6e47aa319cd5b048a3d1b3ddc113d5930e525d818ca6543f196bd</code>, with <code>built_at: null</code>.

### Embedded lint and focused real-state e2e

    node fixtures/next-core-single-skill-pilot/skill/scripts/skill-rails/run.mjs lint --skill fixtures/next-core-single-skill-pilot/skill --json
    node --test fixtures/next-core-single-skill-pilot/real-state/e2e.test.mjs

Receipt: embedded L0 through L18 pass; 2/2 e2e tests pass. The first test asserts WAIT, acquire NEXT, matching-pass DONE, selection reuse BLOCK, snapshot reuse BLOCK, and stale BLOCK. The second supplies matching outside bytes and asserts that parent traversal fails and a platform-selected POSIX symlink or Windows junction produces BLOCK with the canonical-containment diagnostic.

### Manifest closure

    node --input-type=module -e "import {verifyManifest} from './fixtures/next-core-single-skill-pilot/skill/scripts/skill-rails/manifest.mjs'; const {manifest}=await verifyManifest('./fixtures/next-core-single-skill-pilot/skill'); console.log(JSON.stringify({build_id:manifest.build_id,content_hashes:Object.keys(manifest.content).length,generated_hashes:Object.keys(manifest.generated_files).length,declared_hashes:Object.keys(manifest.content).length+Object.keys(manifest.generated_files).length},null,2));"

Receipt: manifest verification succeeds with 15 content hashes, 38 generated hashes, and 53 declared hashes; the build identifier matches the formal build receipt.

### Git checkout byte preservation

Disposable <code>git clone --no-local</code> checkouts with <code>core.autocrlf=true</code> and <code>core.autocrlf=false</code> both report every tracked pilot package path as <code>attr/-text</code>. Every sealed path has equal raw SHA-256 bytes in both clones, both embedded manifest verifications succeed with the same canonical build identifier, and both disposable clone roots are deleted after exact-path containment proof.

### Current correction boundary

The deployed product baseline is <code>126be23</code>. It keeps the stage/guard artifact projection, exact-Decision evidence admission, skipped-judgment isolation, and final-gate fixture coverage, then projects the first L15 golden <code>expect</code> into both <code>Decision.format.example</code> and the owning effect's <code>format_example</code>. The evaluator clones the effect for the Decision and never mutates the spec; missing or unreadable fixtures fall back to the prior synthesized example. Decision and Trace schemas, runtime/validator versions, pilot spec, fixtures, and domain behavior are unchanged.

The released <code>v0.1.7</code> union unites the optional public stage <code>targetPath</code>/<code>--target</code> collector input and trace-to-resume continuity with the released single-owner observation preparation contract. A target-bearing <code>decision_emitted</code> event carries the value outside the Decision and CLI resume quotes it into the next stage command; target-less event data and commands remain unchanged. Every lane still normalizes raw <code>"UNKNOWN"</code> to the reserved version-5 sentinel, and fixture preparation plus L5 remain owned by <code>observations.mjs</code> with declared-read gating. The canonical rebuild updates the generated loader and embedded runtime projection while leaving the pilot spec, fixtures, schemas, and domain behavior unchanged. That union recorded <code>RUNTIME_VERSION</code> 0.3.1 and <code>VALIDATOR_VERSION</code> 0.4.1; fresh-agent use of the target surface remains <code>UNPROVEN</code> outside the upstream API/CLI regression.

### Prior deployed repository verification

    npm run verify

Receipt: at deployed baseline <code>126be23</code>, the full <code>npm run verify</code> passed. Vendor and lint passed; repository tests passed 60/60, including golden-format effect projection without spec mutation, evaluator-observed skipped-NEXT coverage, false-claim rejection, exact-Decision purity, simple-lint helper-target discharge, exact-Decision API/CLI tamper rejection, selected stage/guard projection, package-attribute collision, and explicit ownership-transfer coverage; the eval clean control was valid; the fixture probe reported 10 total cases and 3 divergences; seeded defects were detected 5/5; all 8 required runs were present; and the empirical gate passed.

### Current bounded target verification

    node --test --test-name-pattern "public stage target" tests/integration.test.mjs
    node --test tests/runtime.test.mjs tests/integration.test.mjs
    npm run lint

Receipt: focused reconciled regressions 4/4 and runtime plus integration 42/42 pass (26 integration + 16 runtime top-level tests); the regression covers normalized target delivery, all Decision-emission outcome paths, same-target resume, byte-shaped target absence, Windows junction rejection, unified fixture lanes, L5 read gating, and guard-pending trace order; creator lint passes. The canonical build records mutation 20/20, scenario 10/10, deterministic repeat 50 with 0 mismatches, format round-trip 256/256, manifest 15 content + 38 generated = 53, and build ID <code>sha256:d2855deb87b5b1b4cbcba467975cbfcc87c7661e7072ffc6478e13b85f49ca1c</code>; embedded lint is L0 through L18 and real-state e2e is 2/2. This receipt is the released <code>v0.1.7</code> boundary (commit <code>c739bff</code>/<code>e1c09e6</code>); the single release-boundary <code>npm run verify</code> is recorded in the implementation-verification document rather than this bounded mechanics receipt.

### Released v0.1.8 receipt: interior-space path domain and quoted artifact path

The v0.1.8 change widened the public `path` domain to accept an interior U+0020 space while continuing to reject a leading or trailing space, CR, LF, `;`, `.`/`./` alone, and a `..` traversal segment, and quoted the generated `record --type artifact_verified ... --artifact "<path>"` example in the thin loader so a selected path containing a space stays one shell token. Both changes were covered by the same targeted regression: `node --test --test-name-pattern "named, list, object, NONE, and UNKNOWN domains fail closed" tests/runtime.test.mjs` passed 1/1, and the existing `tests/integration.test.mjs` public-stage-target regression exercised a `cards/task two.md` selection end to end. The release-boundary rebuild embedded `RUNTIME_VERSION` 0.3.2 and `VALIDATOR_VERSION` 0.4.2 with `KERNEL_VERSION` 6 and build ID `sha256:c1492ff7217f9fe54f9b15b9012bfcea4f69948f2a2663408dcb2ef232420a01`; repository verification passed 70/70 plus the frozen G0.5 eval. An independent Sol/Opus/Fable cross-review found no MUST-fix.

This is a historical receipt. The change was subsequently committed, tagged, pushed, released, and installed as `v0.1.8`; the receipt does not claim fresh-agent consumption of a space-containing selected path.

### Current uncommitted candidate: creator-side maintenance context

The current candidate adds a read-only creator-side maintenance view for an existing target skill. `maintain.mjs --skill <package> --describe` reconstructs a current-source model from the package inventory, intent and obligation records, P2 source, body, fixtures, manifest, and available evidence metadata. `--query` returns a source-linked causal capsule, `--json` returns the same model for AI use, and `--map` renders a human preview to stdout. The model leads with gaps and limits, distinguishes finite absence from unsupported or unresolved extraction, and claims only `complete-for-declared-scope`. It never imports or executes the target package's spec, collectors, or helpers, and it does not create a persistent second source of truth.

The maintenance feature itself does not add a generated-package loader or alter the using-agent path. The pilot was rebuilt only because the canonical shared runtime projection now exports the already-existing L16 locator resolver and carries validator 0.6.2. `SPEC.version = "5"`, runtime 0.3.3, kernel 6, Decision and Trace schemas, effect authority, and the L16 locator universe are unchanged. Existing packages can be described without migration or rebuild.

Evidence on this candidate: the focused maintenance-context suite passes 12/12, including the final review's locator, partial-extraction, source-position, bounded reverse-consumer, P0/P1 ownership, AST-import, query-cut, and fail-closed declared-relation counterexamples; the repository-wide `npm run verify` passes vendor check, self lint, 90/90 tests, and the frozen G0.5 eval; the canonical `--repeats 50` pilot rebuild records L0–L18, mutation 20/20, scenario 10/10 across 50 repeats with 0 mismatches, format 256/256 with CRLF rejected, manifest 15 content + 38 generated = 53 declared hashes, and build ID `sha256:4f81126091d6e47aa319cd5b048a3d1b3ddc113d5930e525d818ca6543f196bd`. A blind fresh maintainer discovered the public route and recovered purpose, owning stage, fixtures, source basis, gaps, and a resumable next query; a separate normal-use control stayed on the generated skill's runtime path and did not activate maintenance. These are bounded behavioral observations, not proof across models, hosts, or long sessions.

This checkpoint has not been tagged, pushed, released, or installed.

### Prior landing readiness

Receipt: Git baseline <code>126be23</code> is on <code>origin/main</code>. The official project-local installer produced the same 249 paths, the installed creator self-lint and embedded pilot L0–L18 passed, and all 54 sealed pilot files were byte-identical to Git blobs. A fresh Luna Max consumer used those exact generated bytes without source inspection, found <code>format_example</code> on the WRITE effect, and reached <code>evidence / matching-pass / DONE</code> plus the final report.

### Size facts

    node -e "const fs=require('fs'),p='fixtures/next-core-single-skill-pilot/skill/'; const b=f=>fs.readFileSync(p+f); const m=f=>({bytes:b(f).length,lines:(b(f).toString('utf8').match(/\n/g)||[]).length}); const files=[]; const walk=d=>{for(const e of fs.readdirSync(d,{withFileTypes:true})){const x=d+'/'+e.name;e.isDirectory()?walk(x):files.push(x)}}; walk(p.slice(0,-1)); console.log(JSON.stringify({spec:m('spec.mjs'),collector:m('collectors/index.mjs'),skill:m('SKILL.md'),verify_read_set:b('SKILL.md').length+b('references/canon.md').length+b('references/verify.md').length,work_read_set:b('SKILL.md').length+b('references/canon.md').length+b('references/work.md').length,package_bytes:files.reduce((n,f)=>n+fs.readFileSync(f).length,0),package_files:files.length},null,2));"

Measured on 2026-09-09: <code>spec.mjs</code> is 7,224 bytes and 67 lines; the collector is 5,999 bytes and 121 lines; <code>SKILL.md</code> is 3,712 bytes and 20 lines; the verify read set is 9,961 bytes; the work read set is 7,516 bytes; and the 55-file skill package is 502,976 bytes.

## 7. What remains UNPROVEN

- The deployed <code>0b70194</code> package was selected and completed by fresh consumers, but Sol needed a coordinator answer for <code>.selection-proof</code> paths and Fable/Luna inspected package source; composition is therefore PARTIAL, not closed.
- Source-free path and exact-format discovery is observed once in a fresh Luna Max consumer; repeated-model and long-session reliability remain UNPROVEN.
- Verifier truthfulness remains external to the runtime; the package correlates returned columns but cannot prove that a verifier reported honestly.
- The public lane records agent claims plus artifact path-and-byte verification, but no harness-trusted <code>effect_observed</code>; public effect execution therefore remains partial or unproven as reported by alignment.
- This run observes the Windows junction branch. The same test selects a POSIX directory symlink on non-Windows hosts, but POSIX execution is not evidence from this run.
- Fresh AI invocation beginning from the official installed path, long-session behavior, and out-of-band writer concurrency are unproven. The installed pilot is byte-identical to the fresh-consumed package, but path-level behavior is not inferred from byte equality alone.
- Fresh-agent use of a space-containing selected path through an installed v0.1.8 loader remains unproven even though the mechanics were released and structurally verified.
- Maintenance-context reliability across other models and hosts, long sessions or compaction, large Devflow-scale packages, unmanaged variants beyond the fixtures, and out-of-band writes during capture remains unproven. The two fresh observations do not quantify error reduction or prove that every relevant causal relation was extracted.

## 8. Immediate next step

Finish the whole-result cross-review against the original human-and-AI maintenance purpose. If no blocker remains, compare direct exploration with the source-linked context on one bounded Devflow capability before considering a default surface, persisted map, release, or installation.

## Appendix A. Retired designs

Receipt-based correlation, singleton recorded-JSON correlation, and standalone synthetic runtime-state files are retired. The current implementation is the declared-column table, fresh agent reentry, canonical selection containment, scenario fixtures, and real-state e2e harness described above.
