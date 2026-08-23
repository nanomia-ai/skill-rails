import { mkdir, rm } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";

export const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const TEST_ROOT = join(ROOT, ".skill-rails", "test-runs");

export async function makeTestDir(label) {
  const path = join(TEST_ROOT, `${label}-${randomUUID()}`);
  await mkdir(path, { recursive: true });
  return path;
}

export async function removeTestDir(path) {
  const target = resolve(path);
  if (!target.startsWith(resolve(TEST_ROOT) + "\\") && !target.startsWith(resolve(TEST_ROOT) + "/")) throw new Error(`Refusing to remove test path outside ${TEST_ROOT}: ${target}`);
  await rm(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
}
