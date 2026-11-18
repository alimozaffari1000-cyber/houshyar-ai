import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { runPatchSandbox } from "../scripts/agent-patch-sandbox.mjs";

const patch = `diff --git a/src/visual-image-validation.js b/src/visual-image-validation.js
index 1111111..2222222 100644
--- a/src/visual-image-validation.js
+++ b/src/visual-image-validation.js
@@ -1 +1 @@
-export const MAX_VISUAL_IMAGE_BYTES = 8 * 1024 * 1024;
+export const MAX_VISUAL_IMAGE_BYTES = 7 * 1024 * 1024;
`;

function git(args, cwd, input) {
  return spawnSync("git", args, { cwd, input, encoding: "utf8", shell: false });
}
function makeRepo() {
  const cwd = mkdtempSync(join(tmpdir(), "houshyar-sandbox-test-"));
  mkdirSync(join(cwd, "src"));
  mkdirSync(join(cwd, ".houshyar-agent-reports"));
  writeFileSync(join(cwd, "src/visual-image-validation.js"), "export const MAX_VISUAL_IMAGE_BYTES = 8 * 1024 * 1024;\n");
  writeFileSync(join(cwd, "tests-placeholder.txt"), "baseline\n");
  assert.equal(git(["init"], cwd).status, 0);
  git(["config", "user.email", "test@example.invalid"], cwd);
  git(["config", "user.name", "Houshyar Test"], cwd);
  git(["add", "."], cwd);
  assert.equal(git(["commit", "-m", "baseline"], cwd).status, 0);
  writeFileSync(join(cwd, ".houshyar-agent-reports", "patch-proposal-2026-11-18.patch"), patch);
  return cwd;
}

test("skips cleanly when there is no patch artifact", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "houshyar-sandbox-empty-"));
  try {
    const result = await runPatchSandbox({ cwd });
    assert.equal(result.status, "skipped_no_patch");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("applies patch only in detached worktree and runs fixed checks", async () => {
  const cwd = makeRepo();
  const observed = [];
  try {
    const result = await runPatchSandbox({
      cwd,
      check: async (name, worktree) => {
        observed.push(name);
        const content = readFileSync(join(worktree, "src/visual-image-validation.js"), "utf8");
        assert.match(content, /7 \* 1024/);
        return { status: 0, stderr: "" };
      }
    });
    assert.equal(result.status, "validated_in_isolated_worktree");
    assert.deepEqual(observed, ["qa", "security:scan", "build", "quality:check"]);
    assert.match(readFileSync(join(cwd, "src/visual-image-validation.js"), "utf8"), /8 \* 1024/);
    const report = readFileSync(join(cwd, ".houshyar-agent-reports", "patch-sandbox-2026-11-18T00-00-00-000Z.json"), "utf8");
    assert.match(report, /temporary Git worktree/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("stops when a fixed validation command fails", async () => {
  const cwd = makeRepo();
  try {
    const result = await runPatchSandbox({
      cwd,
      check: async (name) => ({ status: name === "qa" ? 1 : 0, stderr: "test failure" })
    });
    assert.equal(result.status, "failed");
    assert.equal(result.reason, "check_failed: qa");
    assert.equal(result.checks.length, 1);
    assert.match(readFileSync(join(cwd, "src/visual-image-validation.js"), "utf8"), /8 \* 1024/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("rejects invalid patch before creating a worktree", async () => {
  const cwd = makeRepo();
  try {
    writeFileSync(join(cwd, ".houshyar-agent-reports", "patch-proposal-2026-11-19.patch"), patch.replaceAll("src/visual-image-validation.js", "../outside"));
    const result = await runPatchSandbox({ cwd });
    assert.equal(result.status, "rejected_invalid_patch");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
