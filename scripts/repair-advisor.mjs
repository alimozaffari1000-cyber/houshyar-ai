import { readFileSync, writeFileSync } from "node:fs";

const RULES = Object.freeze({
  BUILD_FAILED: { severity: "high", mode: "human_approval", action: "Review build logs and propose a minimal patch; do not deploy automatically." },
  TEST_FAILED: { severity: "high", mode: "human_approval", action: "Identify the failing test and isolate the regression before changing code." },
  SECURITY_ADVISORY: { severity: "critical", mode: "human_approval", action: "Verify the upstream advisory and patched version; do not guess dependency versions." },
  HEALTH_ENDPOINT_FAILED: { severity: "high", mode: "human_approval", action: "Check Pages deployment, routing, and runtime logs; do not restart or roll back automatically." },
  PROVIDER_UNAVAILABLE: { severity: "medium", mode: "human_approval", action: "Verify provider configuration and service status without exposing or printing credentials." },
  DATABASE_SCHEMA_PENDING: { severity: "high", mode: "human_approval", action: "Review the migration and backup state; never apply production migrations automatically." },
  LATENCY_REGRESSION: { severity: "medium", mode: "human_approval", action: "Compare provider latency samples and inspect recent changes before tuning timeouts." }
});

function safeFinding(item) {
  if (!item || typeof item !== "object" || Array.isArray(item)) return null;
  const code = typeof item.code === "string" ? item.code.trim().toUpperCase() : "";
  if (!Object.hasOwn(RULES, code)) return null;
  const source = typeof item.source === "string" && /^[a-z0-9_.:-]{1,64}$/i.test(item.source) ? item.source : "unspecified";
  const observedAt = typeof item.observedAt === "string" && !Number.isNaN(Date.parse(item.observedAt)) ? new Date(item.observedAt).toISOString() : null;
  return { code, source, observedAt, ...RULES[code] };
}

export function createRepairPlan(input) {
  const findings = Array.isArray(input?.findings) ? input.findings : [];
  const planned = findings.map(safeFinding).filter(Boolean);
  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    mode: "advisory_only",
    automaticChangesAllowed: false,
    productionActionsAllowed: false,
    ignoredFindingCount: findings.length - planned.length,
    findings: planned,
    approvalRequired: planned.length > 0
  };
}

if (process.argv[1] && import.meta.url === new URL("file://" + process.argv[1]).href) {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3] || "repair-plan.json";
  if (!inputPath) {
    console.error("Usage: node scripts/repair-advisor.mjs <findings.json> [output.json]");
    process.exit(2);
  }
  try {
    const input = JSON.parse(readFileSync(inputPath, "utf8"));
    const plan = createRepairPlan(input);
    writeFileSync(outputPath, JSON.stringify(plan, null, 2) + "\n", { mode: 0o600 });
    console.log("Repair advisory generated: " + outputPath);
    console.log("Findings: " + plan.findings.length + "; ignored: " + plan.ignoredFindingCount + "; automatic changes: disabled.");
  } catch {
    console.error("Could not read valid findings JSON; no repair actions were performed.");
    process.exit(1);
  }
}
