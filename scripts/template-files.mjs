import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Some tests check files that ship with the Grok App Builder template under `.grok/`.
 * That folder is gitignored, so it is absent in a plain clone and in CI.
 *
 * Returns `false` when every path exists (run the test) or a reason string when one is
 * missing (node:test then reports the test as skipped, with the reason, instead of failing).
 */
export function skipUnlessTemplate(...relativePaths) {
  const root = join(dirname(fileURLToPath(import.meta.url)), "..");
  const missing = relativePaths.filter((rel) => !existsSync(join(root, rel)));
  if (missing.length === 0) return false;
  return `needs Grok template file(s) absent from this checkout: ${missing.join(", ")}`;
}
