import { join, resolve } from "node:path";
import { validateFast, importVerifiedSource } from "./validator.mjs";
import { verifyManifest } from "./manifest.mjs";
import { fail } from "./diagnostics.mjs";

export async function loadBuiltSkill(skillRoot, options = {}) {
  const root = resolve(skillRoot);
  const fast = await validateFast(root);
  if (!fast.ok) fail("SR_LFAST_FAILED", "L-fast rejected the spec before import.", { pointer: join(root, "spec.mjs"), details: fast.diagnostics });
  const runtimeDir = options.runtimeDir ?? join(root, "scripts", "skill-rails");
  const { manifest, current } = await verifyManifest(root, { runtimeDir });
  const spec = await importVerifiedSource(fast);
  return {
    root,
    runtimeDir,
    spec,
    fast,
    manifest,
    runtime: {
      version: manifest.runtime_version,
      spec_hash: current.spec_hash,
      dsl_hash: current.dsl_hash,
      runtime_hash: current.runtime_hash,
      validator_version: current.validator_version,
      validator_hash: current.validator_hash,
      minimum_node_major: current.minimum_node_major,
      content_hash: current.content_hash
    }
  };
}

export async function reverifyBuiltSkill(loaded) {
  await verifyManifest(loaded.root, { runtimeDir: loaded.runtimeDir });
}
