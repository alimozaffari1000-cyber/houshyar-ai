import { spawnSync } from "node:child_process";
import { appendFileSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const args = new Set(process.argv.slice(2));
const unknown = [...args].filter((arg) => arg !== "--safe-repair");
if (unknown.length) {
  console.error("Unknown option. Supported option: --safe-repair");
  process.exit(2);
}

const root = process.cwd();
const reportDir = resolve(root, ".houshyar-agent-reports");
mkdirSync(reportDir, { recursive: true });
const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const reportPath = resolve(reportDir, `offline-agent-${stamp}.md`);
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const steps = [];
const run = (name, commandArgs) => {
  console.log(`\n[OFFLINE AGENT] ${name}`);
  const result = spawnSync(commandArgs[0], commandArgs.slice(1), {
    cwd: root,
    encoding: "utf8",
    shell: false,
    timeout: 10 * 60 * 1000,
    env: { ...process.env, CI: "1", HOUShYAR_AGENT_MODE: "offline" }
  });
  const output = [result.stdout, result.stderr].filter(Boolean).join("\n").trim();
  if (output) console.log(output);
  steps.push({
    name,
    passed: result.status === 0,
    status: result.status,
    output: output.slice(-12000),
    error: result.error?.message || null
  });
  return result.status === 0;
};

if (args.has("--safe-repair")) {
  run("Allowlisted local repairs", [npm, "run", "agent:repair"]);
}

run("Repository and Pages configuration audit", [npm, "run", "agent:check"]);
run("Automated tests", [npm, "run", "qa"]);
run("Static security scan", [npm, "run", "security:scan"]);
run("Cloudflare Pages production build", [npm, "run", "build"]);
run("Static quality and bundle budget", [npm, "run", "quality:check"]);

const passed = steps.filter((step) => step.passed).length;
const failed = steps.length - passed;
const lines = [
  "# Houshyar offline development-agent report",
  "",
  `- Generated: ${new Date().toISOString()}`,
  "- Mode: offline; no external AI service or network research is called by this runner",
  "- Deployment target: Cloudflare Pages",
  `- Result: ${passed}/${steps.length} checks passed; ${failed} failed`,
  `- Safe repair mode: ${args.has("--safe-repair") ? "enabled" : "disabled"}`,
  "",
  "## Check results",
  ...steps.map((step) => `- [${step.passed ? "PASS" : "FAIL"}] ${step.name} (exit: ${step.status ?? "spawn-error"})`),
  "",
  "## Details",
  ...steps.map((step) => `### ${step.name}\n\n${step.error ? `Runner error: ${step.error}\n\n` : ""}`${step.output || "No output."}`),
  "",
  "## Safety boundary",
  "This runner performs deterministic checks only. It does not author application code, execute task-provided shell commands, access credentials, contact external services, push commits, merge pull requests, run database migrations, or deploy.",
  ""
];
writeFileSync(reportPath, lines.join("\n"), "utf8");
console.log(`\n[OFFLINE AGENT] Report saved: ${reportPath}`);
console.log(`[OFFLINE AGENT] ${passed}/${steps.length} checks passed.`);
if (failed) process.exitCode = 1;
