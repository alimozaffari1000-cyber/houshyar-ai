import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runReleasePreflight } from "../scripts/agent-release-preflight.mjs";

function fixture() {
  const cwd = mkdtempSync(join(tmpdir(), "houshyar-release-"));
  mkdirSync(join(cwd, "config"), { recursive: true });
  mkdirSync(join(cwd, ".houshyar-agent-reports"), { recursive: true });
  writeFileSync(join(cwd, "config/development-agents.json"), JSON.stringify({
    platform: "cloudflare-pages",
    principles: {
      productionWrites: false,
      directMainWrites: false,
      humanApprovalRequiredFor: ["merge_to_main", "production_deploy", "production_database_migration"]
    }
  }));
  writeFileSync(join(cwd, ".houshyar-agent-reports/patch-sandbox-2026-11-18.json"), JSON.stringify({
    status: "validated_in_isolated_worktree",
    checks: ["qa", "security:scan", "build", "quality:check"].map(name => ({ name, success: true }))
  }));
  writeFileSync(join(cwd, ".houshyar-agent-reports/offline-agent-2026-11-18.md"), "- Result: 5/5 checks passed; 0 failed\n");
  const git = (args) => {
    if (args[0] === "branch") return { status: 0, stdout: "feat/release-test\n" };
    if (args[0] === "status") return { status: 0, stdout: "" };
    if (args[0] === "rev-parse") return { status: 0, stdout: "a".repeat(40) + "\n" };
    return { status: 1, stdout: "", stderr: "unexpected command" };
  };
  return { cwd, git };
}

test("passes automated preflight but never authorizes production release", async () => {
  const { cwd, git } = fixture();
  try {
    const result = await runReleasePreflight({ cwd, git, now: new Date("2026-11-18T00:00:00.000Z") });
    assert.equal(result.status, "preflight_passed_pending_human_review");
    assert.equal(result.automatedPassed, true);
    assert.equal(result.productionReleaseAuthorized, false);
    assert.equal(result.checks.length, 6);
    assert.match(readFileSync(result.reportPath, "utf8"), /never merges, deploys/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("blocks preflight when sandbox proof is missing", async () => {
  const { cwd, git } = fixture();
  try {
    const { rmSync: remove } = await import("node:fs");
    remove(join(cwd, ".houshyar-agent-reports/patch-sandbox-2026-11-18.json"));
    const result = await runReleasePreflight({ cwd, git });
    assert.equal(result.status, "blocked");
    assert.equal(result.checks.find(item => item.id === "sandbox_patch_checks").passed, false);
    assert.equal(result.productionReleaseAuthorized, false);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("blocks main branch and dirty working tree", async () => {
  const { cwd } = fixture();
  try {
    const git = (args) => {
      if (args[0] === "branch") return { status: 0, stdout: "main\n" };
      if (args[0] === "status") return { status: 0, stdout: " M src/main.js\n" };
      if (args[0] === "rev-parse") return { status: 0, stdout: "b".repeat(40) };
      return { status: 1 };
    };
    const result = await runReleasePreflight({ cwd, git });
    assert.equal(result.checks.find(item => item.id === "not_main_branch").passed, false);
    assert.equal(result.checks.find(item => item.id === "clean_worktree").passed, false);
    assert.equal(result.status, "blocked");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
