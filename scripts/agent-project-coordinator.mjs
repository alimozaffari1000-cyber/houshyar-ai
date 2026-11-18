import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const REPORT_DIR = ".houshyar-agent-reports";
const STATUSES = ["proposed", "approved", "in_progress", "review", "done", "blocked"];
const TRANSITIONS = {
  proposed: ["approved", "blocked"],
  approved: ["in_progress", "blocked"],
  in_progress: ["review", "blocked"],
  review: ["done", "in_progress", "blocked"],
  done: [],
  blocked: ["proposed"]
};
const ROLE_BY_AREA = {
  Reliability: "qa",
  Security: "security",
  Product: "developer",
  Performance: "performance",
  "Research reliability": "research"
};
const HUMAN_GATED_AREAS = new Set(["Security", "Product"]);

function stableId(area, task) {
  return "task-" + createHash("sha256").update(area + "\\n" + task).digest("hex").slice(0, 12);
}

export function buildTaskRegistry(plan, previous = { version: 1, tasks: [] }, now = new Date()) {
  if (!plan || !Array.isArray(plan.priorities)) throw new TypeError("A development plan with priorities is required");
  const existing = new Map((Array.isArray(previous.tasks) ? previous.tasks : []).map((task) => [task.id, task]));
  const tasks = [];
  for (const item of plan.priorities) {
    const area = String(item.area || "").slice(0, 80);
    const title = String(item.task || "").slice(0, 500);
    if (!area || !title) continue;
    const id = stableId(area, title);
    const prior = existing.get(id);
    const role = ROLE_BY_AREA[area] || "architect";
    tasks.push({
      id,
      area,
      title,
      priority: ["P0", "P1", "P2", "P3"].includes(item.priority) ? item.priority : "P2",
      ownerRole: role,
      acceptanceCriteria: String(item.acceptance || "Human review and automated checks are required.").slice(0, 1000),
      status: prior && STATUSES.includes(prior.status) ? prior.status : "proposed",
      requiresHumanApproval: HUMAN_GATED_AREAS.has(area),
      approvalRecorded: prior?.approvalRecorded === true,
      createdAt: prior?.createdAt || now.toISOString(),
      updatedAt: prior?.updatedAt || now.toISOString(),
      history: Array.isArray(prior?.history) ? prior.history : [{ status: "proposed", at: now.toISOString(), actor: "coordinator" }]
    });
  }
  return {
    version: 1,
    generatedAt: now.toISOString(),
    sourcePlanGeneratedAt: plan.generatedAt || null,
    tasks,
    policy: {
      allowedStatuses: STATUSES,
      productionChangesRequireSeparateHumanApproval: true,
      coordinatorCanApproveOrExecute: false
    }
  };
}

export function transitionTask(registry, taskId, nextStatus, { humanApproved = false, actor = "human", now = new Date() } = {}) {
  if (!STATUSES.includes(nextStatus)) throw new Error("Unknown task status");
  const tasks = registry.tasks.map((task) => ({ ...task, history: [...(task.history || [])] }));
  const task = tasks.find((entry) => entry.id === taskId);
  if (!task) throw new Error("Task not found");
  if (!TRANSITIONS[task.status]?.includes(nextStatus)) throw new Error(`Invalid transition: ${task.status} -> ${nextStatus}`);
  if (nextStatus === "approved" && !humanApproved) throw new Error("Explicit human approval is required");
  if (nextStatus === "approved") task.approvalRecorded = true;
  task.status = nextStatus;
  task.updatedAt = now.toISOString();
  task.history.push({ status: nextStatus, at: now.toISOString(), actor: String(actor).slice(0, 80) });
  return { ...registry, generatedAt: now.toISOString(), tasks };
}

function latestFile(dir, pattern) {
  let names = [];
  try { names = readdirSync(dir).filter((name) => pattern.test(name)).sort(); } catch {}
  return names.length ? join(dir, names.at(-1)) : null;
}

export function runProjectCoordinator({ cwd = process.cwd(), now = new Date() } = {}) {
  const dir = resolve(cwd, REPORT_DIR);
  const planPath = latestFile(dir, /^development-plan-.*\\.json$/);
  if (!planPath) throw new Error("No development plan found; run npm run agent:plan first");
  const plan = JSON.parse(readFileSync(planPath, "utf8"));
  const registryPath = join(dir, "agent-task-registry.json");
  let previous = { version: 1, tasks: [] };
  try { previous = JSON.parse(readFileSync(registryPath, "utf8")); } catch {}
  const registry = buildTaskRegistry(plan, previous, now);
  mkdirSync(dir, { recursive: true });
  writeFileSync(registryPath, JSON.stringify(registry, null, 2) + "\\n", "utf8");
  const lines = [
    "# Houshyar Agent Task Registry",
    "",
    `Generated: ${registry.generatedAt}`,
    `Tasks: ${registry.tasks.length}`,
    "",
    ...registry.tasks.flatMap((task) => [
      `## ${task.priority} · ${task.area}`,
      `- ID: ${task.id}`,
      `- Owner: ${task.ownerRole}`,
      `- Status: ${task.status}`,
      `- Human approval required: ${task.requiresHumanApproval ? "yes" : "no"}`,
      `- Task: ${task.title}`,
      `- Acceptance: ${task.acceptanceCriteria}`,
      ""
    ]),
    "## Safety",
    "- This registry proposes and tracks work; it does not execute tasks.",
    "- Approval must be recorded by a human through an explicit workflow.",
    "- Merge, deployment, production migrations, secrets, payments, and private data require separate approvals."
  ];
  const markdownPath = join(dir, "agent-task-registry.md");
  writeFileSync(markdownPath, lines.join("\\n") + "\\n", "utf8");
  return { registry, registryPath, markdownPath };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  try {
    const result = runProjectCoordinator();
    console.log(`[PROJECT COORDINATOR] ${result.registry.tasks.length} tasks registered`);
    console.log(`[PROJECT COORDINATOR] Report: ${result.markdownPath}`);
  } catch (error) {
    console.error("[PROJECT COORDINATOR] Fatal error:", error.message);
    process.exitCode = 1;
  }
}
