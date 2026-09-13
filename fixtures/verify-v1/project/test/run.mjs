import assert from "node:assert/strict";
import test from "node:test";
import { createBookmarkStorage } from "../src/bookmark-storage.mjs";

const requested = process.argv.slice(2);
if (requested.length !== 1 || requested[0] !== "bookmark-storage") {
  process.stderr.write("expected test id bookmark-storage\n");
  process.exitCode = 2;
} else {
  test("bookmark-storage", () => {
    const storage = createBookmarkStorage();
    storage.add("docs", "https://example.test/docs");
    assert.equal(storage.get("docs"), "https://example.test/docs");
    assert.equal(storage.get("missing"), null);
  });
}
