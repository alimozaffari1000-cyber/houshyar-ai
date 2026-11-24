import { mkdtempSync, mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { resolve, join } from "node:path";
import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";
import { validatePatchProposal } from "./agent-patch-proposal.mjs";

const REPORT_DIR = ".houshyar-agent-reports";
const CHECKS = ["qa", "security:scan", "build", "quality:check"];
const TIMEOUT_MS = 6 * 60 * 1000;

function runGit(args, options = {}) {
  return spawnSync("git", args, {
    cwd: options.cwd,
    input: options.input,
    encoding: "utf8",
    shell: false,
    timeout: 30000,
    windowsHide: true
  });
}

function runNpm(script, cwd) {
  return spawnSync("npm", ["run", script], {
    cwd,
    encoding: "utf8",
    shell: false,
    timeout: TIMEOUT_MS,
    windowsHide: true,
    env: { ...process.env, CI: "true", HUSKY: "0" }
  });
}

function runInstall(cwd) {
  return spawnSync("npm", ["install", "--ignore-scripts", "--no-audit", "--no-fund", "--package-lock=false"], {
    cwd,
    encoding: "utf8",
    shell: false,
    timeout: TIMEOUT_MS,
    windowsHide: true,
    env: { ...process.env, CI: "true", HUSKY: "0" }
  });
}

function resultOk(result) {
  return !result.error && result.status === 0;
}

export async function runPatchSandbox({
  cwd = process.cwd(),
  git = runGit,
  install = runInstall,
  check = runNpm,
  now = new Date()
} = {}) {
  const reportDir = resolve(cwd, REPORT_DIR);
  mkdirSync(reportDir, { recursive: true });
  const names = readdirSync(reportDir).filter((name) => /^patch-proposal-.*\.patch$/.test(name)).sort();
  if (!names.length) return { status: "skipped_no_patch", checks: [] };

  const patchPath = join(reportDir, names.at(-1));
  const patch = readFileSync(patchPath, "utf8");
  const validation = validatePatchProposal(patch);
  if (!validation.valid) return { status: "rejected_invalid_patch", validation, checks: [] };

  const tempRoot = mkdtempSync(join(tmpdir(), "houshyar-patch-sandbox-"));
  const worktree = join(tempRoot, "worktree");
  const checks = [];
  let status = "failed";
  let reason = null;
  let worktreeCreated = false;
  let returnValue = null;
  try {
    const add = git(["worktree", "add", "--detach", worktree, "HEAD"], { cwd });
    if (!resultOk(add)) {
      reason = `worktree_creation_failed: ${String(add.stderr || add.error?.message || "").slice(0, 1500)}`;
      returnValue = { status, reason, checks };
      return returnValue;
    }
    worktreeCreated = true;

    const dependencies = await install(worktree);
    if (!resultOk(dependencies)) {
      reason = "sandbox_dependency_install_failed: " + String(dependencies.stderr || dependencies.error?.message || "").slice(0, 1500);
      returnValue = { status, reason, checks };
      return returnValue;
    }

    const dryRun = git(["apply", "--check", "--whitespace=error", "-"], { cwd: worktree, input: patch });
    if (!resultOk(dryRun)) {
      reason = `patch_check_failed: ${String(dryRun.stderr || dryRun.error?.message || "").slice(0, 1500)}`;
      returnValue = { status, reason, checks };
      return returnValue;
    }
    const applied = git(["apply", "--whitespace=error", "-"], { cwd: worktree, input: patch });
    if (!resultOk(applied)) {
      reason = `patch_apply_failed: ${String(applied.stderr || applied.error?.message || "").slice(0, 1500)}`;
      returnValue = { status, reason, checks };
      return returnValue;
    }

    for (const name of CHECKS) {
      const result = await check(name, worktree);
      const entry = {
        name,
        success: resultOk(result),
        exitCode: result.status ?? null,
        detail: String(result.stderr || result.error?.message || "").slice(0, 1500)
      };
      checks.push(entry);
      if (!entry.success) {
        reason = `check_failed: ${name}`;
        returnValue = { status, reason, checks };
        return returnValue;
      }
    }
    status = "validated_in_isolated_worktree";
    returnValue = { status, patchFile: names.at(-1), paths: validation.paths, appliedInSandboxOnly: true, checks };
    return returnValue;
  } finally {
    if (worktreeCreated) {
      const remove = git(["worktree", "remove", "--force", worktree], { cwd });
      if (!resultOk(remove)) {
        reason ||= `worktree_cleanup_warning: ${String(remove.stderr || remove.error?.message || "").slice(0, 1000)}`;
        status = "cleanup_failed";
        if (returnValue) {
          returnValue.status = status;
          returnValue.reason = reason;
        }
      }
    }
    rmSync(tempRoot, { recursive: true, force: true });
    const stamp = now.toISOString().replace(/[:.]/g, "-");
    writeFileSync(join(reportDir, `patch-sandbox-${stamp}.json`), JSON.stringify({
      generatedAt: now.toISOString(),
      status,
      patchFile: names.at(-1),
      checks,
      reason,
      safety: [
        "Patch was applied only inside a detached temporary Git worktree.",
        "Only fixed npm scripts were executed; no model-generated shell commands were accepted.",
        "No commit, push, pull request, merge, deployment, or production mutation was performed."
      ]
    }, null, 2) + "\n", "utf8");
  }
}

async function main() {
  if (process.env.CI !== "true" && !process.argv.includes("--allow-local-execution")) {
    console.log("[PATCH SANDBOX] blocked: patch code may execute with this device's permissions.");
    console.log("[PATCH SANDBOX] On a trusted local checkout, explicitly pass --allow-local-execution; CI uses an ephemeral runner.");
    process.exitCode = 2;
    return;
  }
  const result = await runPatchSandbox();
  console.log(`[PATCH SANDBOX] ${result.status}`);
  for (const item of result.checks || []) console.log(`[PATCH SANDBOX] ${item.name}: ${item.success ? "PASS" : "FAIL"}`);
  if (result.reason) console.error(`[PATCH SANDBOX] ${result.reason}`);
  if (["failed", "cleanup_failed", "rejected_invalid_patch"].includes(result.status)) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch((error) => {
    console.error("[PATCH SANDBOX] Fatal error:", error.message);
    process.exitCode = 1;
  });
}
