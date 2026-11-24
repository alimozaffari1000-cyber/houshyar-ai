import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const REPORT_DIR = ".houshyar-agent-reports";

function runGit(args, cwd) {
  return spawnSync("git", args, { cwd, encoding: "utf8", shell: false, timeout: 15000, windowsHide: true });
}
function passed(result) { return !result.error && result.status === 0; }
function latest(files, pattern) { return files.filter(name => pattern.test(name)).sort().at(-1) || null; }

export async function runReleasePreflight({ cwd = process.cwd(), git = runGit, now = new Date() } = {}) {
  const reportDir = resolve(cwd, REPORT_DIR);
  mkdirSync(reportDir, { recursive: true });
  const files = readdirSync(reportDir);
  const checks = [];
  const add = (id, ok, detail) => checks.push({ id, passed: Boolean(ok), detail });

  const branch = git(["branch", "--show-current"], cwd);
  const branchName = passed(branch) ? String(branch.stdout).trim() : "";
  add("not_main_branch", Boolean(branchName) && branchName !== "main", branchName || "Could not determine current branch.");

  const status = git(["status", "--porcelain"], cwd);
  const clean = passed(status) && !String(status.stdout).trim();
  add("clean_worktree", clean, clean ? "Git working tree is clean." : "Uncommitted or untracked changes exist, or Git status failed.");

  const head = git(["rev-parse", "HEAD"], cwd);
  const commit = passed(head) ? String(head.stdout).trim() : null;
  add("commit_identified", Boolean(commit && /^[0-9a-f]{40}$/i.test(commit)), commit || "Current commit could not be identified.");

  let policy = null;
  try { policy = JSON.parse(readFileSync(resolve(cwd, "config/development-agents.json"), "utf8")); } catch {}
  const approvals = policy?.principles?.humanApprovalRequiredFor || [];
  const policyOk = policy?.platform === "cloudflare-pages"
    && policy?.principles?.productionWrites === false
    && policy?.principles?.directMainWrites === false
    && ["merge_to_main", "production_deploy", "production_database_migration"].every(item => approvals.includes(item));
  add("production_guardrails", policyOk, policyOk ? "Pages target and human approval boundaries are present." : "Required production guardrails are missing or invalid.");

  const sandboxName = latest(files, /^patch-sandbox-.*\.json$/);
  let sandbox = null;
  try { if (sandboxName) sandbox = JSON.parse(readFileSync(join(reportDir, sandboxName), "utf8")); } catch {}
  const sandboxOk = sandbox?.status === "validated_in_isolated_worktree"
    && Array.isArray(sandbox.checks)
    && sandbox.checks.length === 4
    && sandbox.checks.every(item => item.success === true);
  add("sandbox_patch_checks", sandboxOk, sandboxName ? (sandboxOk ? "Latest patch passed all four sandbox checks." : "Latest sandbox report is not a complete successful run.") : "No successful sandbox report exists.");

  const offlineName = latest(files, /^offline-agent-.*\.md$/);
  let offlineText = "";
  try { if (offlineName) offlineText = readFileSync(join(reportDir, offlineName), "utf8"); } catch {}
  const offlineOk = /Result:\s*5\/5 checks passed;\s*0 failed/.test(offlineText);
  add("offline_full_suite", offlineOk, offlineName ? (offlineOk ? "Latest offline report records all five checks passed." : "Latest offline report is missing or contains failures.") : "No offline-agent report exists.");

  const automatedPassed = checks.every(item => item.passed);
  const manualItems = [
    "CI must pass on this exact commit.",
    "A human reviewer must approve the pull request and inspect the diff.",
    "Cloudflare Pages preview must be tested before any production release.",
    "Production secrets, domain, billing, and database migrations require separate owner verification and approval."
  ];
  const report = {
    generatedAt: now.toISOString(),
    commit,
    branch: branchName,
    status: automatedPassed ? "preflight_passed_pending_human_review" : "blocked",
    automatedPassed,
    productionReleaseAuthorized: false,
    checks,
    requiredHumanReview: manualItems,
    safety: "This report never merges, deploys, changes secrets, or runs production migrations."
  };
  const stamp = now.toISOString().replace(/[:.]/g, "-");
  const reportPath = join(reportDir, "release-preflight-" + stamp + ".json");
  writeFileSync(reportPath, JSON.stringify(report, null, 2) + "\n", "utf8");
  return { ...report, reportPath };
}

async function main() {
  const result = await runReleasePreflight();
  console.log("[RELEASE PREFLIGHT] " + result.status);
  for (const check of result.checks) console.log("[RELEASE PREFLIGHT] " + (check.passed ? "PASS " : "BLOCK ") + check.id + ": " + check.detail);
  console.log("[RELEASE PREFLIGHT] Production release authorized: no");
  console.log("[RELEASE PREFLIGHT] Report: " + result.reportPath);
  // A blocked release preflight is an expected report state, not a CI failure.
  // Only a runner exception should fail this reporting step.
}
if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error("[RELEASE PREFLIGHT] Fatal:", error.message); process.exitCode = 1; });
}
