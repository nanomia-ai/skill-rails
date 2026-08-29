import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { exists } from "./io.mjs";
import { inventoryFlatMarkdown, resolveRegularInside } from "./regular-paths.mjs";

export async function measureSimpleContextSurface(skillRoot) {
  const root = resolve(skillRoot);
  const entryBytes = await byteLength(join(root, "SKILL.md"));
  const indexPath = join(root, "references", "guidance-index.md");
  const indexBytes = await exists(indexPath) ? await byteLength(await resolveRegularInside(root, "references/guidance-index.md")) : 0;
  const topicBytes = [];
  const inventory = await inventoryFlatMarkdown(root, "references/guidance");
  if (inventory.issues.length > 0) throw new Error(inventory.issues.map((item) => item.message).join("\n"));
  for (const entry of inventory.files) topicBytes.push({ path: entry.local, bytes: await byteLength(entry.path) });
  topicBytes.sort((left, right) => left.path < right.path ? -1 : left.path > right.path ? 1 : 0);
  const onDemandTotal = topicBytes.reduce((sum, item) => sum + item.bytes, 0);
  return {
    schema: "skill-rails/context-surface/1",
    progressive: indexBytes > 0,
    entry_bytes: entryBytes,
    routing_index_bytes: indexBytes,
    fixed_context_bytes: entryBytes + indexBytes,
    on_demand_topic_count: topicBytes.length,
    on_demand_total_bytes: onDemandTotal,
    largest_on_demand_bytes: topicBytes.reduce((maximum, item) => Math.max(maximum, item.bytes), 0),
    total_guidance_bytes: entryBytes + indexBytes + onDemandTotal,
    note: "Byte counts describe stored and fixed routing surfaces. They do not prove which conditions a model will match or which files it will read."
  };
}

async function byteLength(path) {
  return (await readFile(path)).byteLength;
}
