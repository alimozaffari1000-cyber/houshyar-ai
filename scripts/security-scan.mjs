import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";
import { SECRET_PATTERNS } from "./secret-patterns.js";

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0").filter(Boolean);
const findings = [];

for (const file of files) {
  if (file === "scripts/security-scan.mjs" || file.endsWith(".lock") || file.startsWith("dist/")) continue;
  try {
    if (statSync(file).size > 1_000_000) continue;
    const content = readFileSync(file, "utf8");
    for (const [name, pattern] of SECRET_PATTERNS) {
      if (pattern.test(content)) findings.push({ file, name });
    }
  } catch {
    // Skip non-text or unavailable tracked files; do not expose their contents.
  }
}

if (findings.length) {
  console.error("HOUSHYAR SECURITY SCAN: possible secrets detected.");
  for (const item of findings) console.error("- " + item.file + ": " + item.name);
  console.error("Rotate any exposed credential immediately; removing it from the latest commit is not sufficient.");
  process.exit(1);
}
console.log("HOUSHYAR SECURITY SCAN: no known secret patterns found in tracked files.");
console.log("Note: this static scan cannot prove the repository or deployed service is secure.");
