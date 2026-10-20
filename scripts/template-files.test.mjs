import assert from "node:assert/strict";
import { test } from "node:test";
import { skipUnlessTemplate } from "./template-files.mjs";

test("an existing file does not skip the test", () => {
  assert.equal(skipUnlessTemplate("package.json"), false);
  assert.equal(skipUnlessTemplate("package.json", "scripts"), false);
});

test("a missing file skips with a reason that names it", () => {
  const reason = skipUnlessTemplate("package.json", ".grok/definitely-not-here.json");
  assert.equal(typeof reason, "string");
  assert.match(reason, /\.grok\/definitely-not-here\.json/);
  assert.doesNotMatch(reason, /package\.json/);
});
