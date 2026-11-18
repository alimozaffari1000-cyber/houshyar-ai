import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { runPatchProposal, validatePatchProposal } from "../scripts/agent-patch-proposal.mjs";

const validPatch = `diff --git a/src/visual-image-validation.js b/src/visual-image-validation.js
index 1111111..2222222 100644
--- a/src/visual-image-validation.js
+++ b/src/visual-image-validation.js
@@ -1,1 +1,1 @@
-export const MAX_VISUAL_IMAGE_BYTES = 8 * 1024 * 1024;
+export const MAX_VISUAL_IMAGE_BYTES = 7 * 1024 * 1024;
`;

test("accepts a small patch limited to exact allowlisted existing files", () => {
  assert.deepEqual(validatePatchProposal(validPatch), {
    valid: true,
    paths: ["src/visual-image-validation.js"]
  });
});

test("rejects traversal, unapproved paths, renames and binary patches", () => {
  for (const patch of [
    validPatch.replaceAll("src/visual-image-validation.js", "../secrets.txt"),
    validPatch.replaceAll("src/visual-image-validation.js", "package.json"),
    validPatch.replace("diff --git a/src/visual-image-validation.js b/src/visual-image-validation.js", "diff --git a/src/visual-image-validation.js b/tests/visual-image-validation.test.js"),
    validPatch + "GIT binary patch\n"
  ]) assert.equal(validatePatchProposal(patch).valid, false);
});

test("rejects empty and oversized proposals", () => {
  assert.equal(validatePatchProposal("").reason, "empty_patch");
  assert.equal(validatePatchProposal("x".repeat(24001)).reason, "patch_too_large");
});

test("does not generate patches when model provider is disabled", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "houshyar-patch-"));
  try {
    const result = await runPatchProposal({ cwd, provider: { available: false } });
    assert.equal(result.status, "skipped_model_disabled");
    assert.equal(result.patchPath, null);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("saves only a git-validated proposal and never applies it", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "houshyar-patch-"));
  try {
    mkdirSync(join(cwd, "src"), { recursive: true });
    mkdirSync(join(cwd, "tests"), { recursive: true });
    writeFileSync(join(cwd, "src/visual-image-validation.js"), "export const sample = true;\n");
    writeFileSync(join(cwd, "tests/visual-image-validation.test.js"), "import test from 'node:test';\n");
    const result = await runPatchProposal({
      cwd,
      provider: { available: true, complete: async ({ task }) => {
        assert.equal(task, "patch_proposal");
        return validPatch;
      } },
      gitCheck: (patch) => ({ status: 0, stderr: "", received: patch })
    });
    assert.equal(result.status, "validated_proposal_only");
    assert.equal(result.applied, false);
    assert.match(readFileSync(result.patchPath, "utf8"), /diff --git/);
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});

test("rejects a proposal that fails git apply check", async () => {
  const cwd = mkdtempSync(join(tmpdir(), "houshyar-patch-"));
  try {
    mkdirSync(join(cwd, "src"), { recursive: true });
    mkdirSync(join(cwd, "tests"), { recursive: true });
    writeFileSync(join(cwd, "src/visual-image-validation.js"), "export const sample = true;\n");
    writeFileSync(join(cwd, "tests/visual-image-validation.test.js"), "import test from 'node:test';\n");
    const result = await runPatchProposal({
      cwd,
      provider: { available: true, complete: async () => validPatch },
      gitCheck: () => ({ status: 1, stderr: "patch does not apply" })
    });
    assert.equal(result.status, "rejected");
    assert.equal(result.reason, "git_apply_check_failed");
  } finally { rmSync(cwd, { recursive: true, force: true }); }
});
