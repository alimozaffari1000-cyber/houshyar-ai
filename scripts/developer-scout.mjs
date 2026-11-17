import { readdirSync, readFileSync, statSync, mkdirSync, writeFileSync } from "node:fs";
import { join, relative, extname } from "node:path";

const roots = ["src", "functions", "scripts"];
const excluded = new Set(["node_modules", "dist", ".wrangler", ".git"]);
const sourceExtensions = new Set([".js", ".mjs", ".ts", ".tsx", ".css", ".html"]);
const files = [];

function walk(dir) {
  for (const name of readdirSync(dir)) {
    if (excluded.has(name)) continue;
    const path = join(dir, name);
    const info = statSync(path);
    if (info.isDirectory()) walk(path);
    else if (sourceExtensions.has(extname(name))) files.push(path);
  }
}

for (const root of roots) {
  try { walk(root); } catch { /* Optional source area may not exist yet. */ }
}

const findings = [];
let totalLines = 0;
for (const file of files) {
  const content = readFileSync(file, "utf8");
  const lines = content.split(/\r?\n/);
  totalLines += lines.length;
  lines.forEach((line, index) => {
    const match = line.match(/\b(TODO|FIXME|HACK)\b\s*:?\s*(.*)/i);
    if (match) findings.push({
      file: relative(".", file).replaceAll("\\", "/"),
      line: index + 1,
      kind: match[1].toUpperCase(),
      note: match[2].trim().slice(0, 180)
    });
  });
}

const packageJson = JSON.parse(readFileSync("package.json", "utf8"));
const requiredChecks = ["qa", "agent:check", "security:scan", "build", "quality:check"];
const missingChecks = requiredChecks.filter(name => !packageJson.scripts?.[name]);
const report = [
  "# Houshyar Developer Scout",
  "",
  `Generated: ${new Date().toISOString()}`,
  "",
  "> Deterministic repository inspection only. This tool does not use an LLM, modify source files, install dependencies, open PRs, or deploy.",
  "",
  "## Repository inventory",
  "",
  `- Source files inspected: ${files.length}`,
  `- Approximate source lines: ${totalLines}`,
  `- TODO/FIXME/HACK markers: ${findings.length}`,
  `- Missing standard checks: ${missingChecks.length ? missingChecks.join(", ") : "None"}`,
  "",
  "## Engineering backlog signals",
  ""
];

if (!findings.length) report.push("No TODO/FIXME/HACK markers were found in inspected source folders.");
else for (const item of findings) {
  report.push(`- **${item.kind}** \`${item.file}:${item.line}\` — ${item.note || "No description supplied."}`);
}

report.push(
  "",
  "## Required next-step review",
  "",
  "1. A maintainer reviews each signal and confirms whether it is actionable.",
  "2. Reproduce the issue and define acceptance criteria before changing code.",
  "3. Implement changes on an isolated branch and add regression tests.",
  "4. Run QA, security, build, and quality checks.",
  "5. Request human review; do not merge or deploy automatically.",
  "",
  "## Limitations",
  "",
  "This scout is not an autonomous AI software engineer. It does not understand runtime behavior, prove correctness, assess business priorities, or replace code review and security testing."
);

mkdirSync("developer-report", { recursive: true });
writeFileSync("developer-report/README.md", report.join("\n") + "\n");
console.log(report.join("\n"));
if (missingChecks.length) process.exitCode = 1;
