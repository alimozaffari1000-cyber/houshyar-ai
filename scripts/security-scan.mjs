import { execFileSync } from "node:child_process";
import { readFileSync, statSync } from "node:fs";

const files = execFileSync("git", ["ls-files", "-z"], { encoding: "utf8" })
  .split("\0").filter(Boolean);
const findings = [];
const rules = [
  ["Private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/],
  ["GitHub personal access token", /\b(?:ghp|gho|ghu|ghs|github_pat)_[A-Za-z0-9_]{20,}\b/],
  ["Slack token", /\bxox[baprs]-[A-Za-z0-9-]{20,}\b/],
  ["AWS access key", /\bAKIA[0-9A-Z]{16}\b/],
  ["Groq API key", /\bgsk_[A-Za-z0-9]{30,}\b/],
  ["Possible hard-coded API secret", /(?:api[_-]?key|secret|access[_-]?token)\s*[:=]\s*["'][A-Za-z0-9_\-]{28,}["']/i],
];

for (const file of files) {
  if (file === "scripts/security-scan.mjs" || file.endsWith(".lock") || file.startsWith("dist/")) continue;
  try {
    if (statSync(file).size > 1_000_000) continue;
    const content = readFileSync(file, "utf8");
    for (const [name, pattern] of rules) {
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
