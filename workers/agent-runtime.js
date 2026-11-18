import { TRANSLATION_LANGUAGES } from "../src/translation-languages.js";
const ALLOWED = new Set(["project_health_report", "translation_catalog_audit", "agent_team_audit"]);
const nowSeconds = () => Math.floor(Date.now() / 1000);
export function buildDeterministicReport(taskType, stats = {}) {
  if (taskType === "translation_catalog_audit") {
    const codes = TRANSLATION_LANGUAGES.map(item => item.code);
    return { taskType, languageCount: codes.length, uniqueCodeCount: new Set(codes).size, hasPersian: codes.includes("fa"), hasEnglish: codes.includes("en"), result: codes.length === 100 && new Set(codes).size === 100 ? "pass" : "review_required" };
  }
  if (taskType === "agent_team_audit") return { taskType, configuredRoleCount: 10, autonomousCodeChanges: false, unrestrictedShell: false, productionApprovalRequired: true, result: "static_policy_snapshot" };
  if (taskType === "project_health_report") return { taskType, ...stats, generatedAt: nowSeconds(), result: "read_only_snapshot" };
  throw new Error("TASK_TYPE_NOT_ALLOWED");
}
async function claimOne(db, leaseOwner, now) {
  return await db.prepare("UPDATE agent_tasks SET status='in_progress', attempt_count=attempt_count+1, lease_owner=?, lease_expires_at=?, started_at=COALESCE(started_at,?), updated_at=? WHERE id=(SELECT id FROM agent_tasks WHERE status='queued' AND task_type IN ('project_health_report','translation_catalog_audit','agent_team_audit') AND attempt_count < max_attempts ORDER BY priority ASC, created_at ASC LIMIT 1) AND status='queued' RETURNING id,user_id,title,task_type,payload_json,attempt_count,max_attempts").bind(leaseOwner, now + 120, now, now).first();
}
async function executeReadOnly(db, task) {
  if (!ALLOWED.has(task.task_type)) throw new Error("TASK_TYPE_NOT_ALLOWED");
  if (task.task_type === "project_health_report") {
    const counts = await db.prepare("SELECT status, COUNT(*) AS count FROM agent_tasks GROUP BY status").all();
    return buildDeterministicReport(task.task_type, { taskCounts: counts.results || [] });
  }
  return buildDeterministicReport(task.task_type);
}
export async function processOne(db, leaseOwner = "agent-runtime", now = nowSeconds()) {
  const task = await claimOne(db, leaseOwner, now);
  if (!task) return { processed: false, reason: "QUEUE_EMPTY" };
  const claimedEvent = db.prepare("INSERT INTO agent_task_events (id,task_id,actor_type,actor_id,event_type,from_status,to_status,detail_json,created_at) VALUES (?,?,'worker',?,'claimed','queued','in_progress',?,?)").bind(crypto.randomUUID(), task.id, leaseOwner, JSON.stringify({ attempt: task.attempt_count }), now);
  try {
    const report = await executeReadOnly(db, task), finishedAt = nowSeconds();
    const update = db.prepare("UPDATE agent_tasks SET status='completed', result_text=?, error_code=NULL, completed_at=?, updated_at=?, lease_owner=NULL, lease_expires_at=NULL WHERE id=? AND status='in_progress' AND lease_owner=?").bind(JSON.stringify(report).slice(0, 12000), finishedAt, finishedAt, task.id, leaseOwner);
    const event = db.prepare("INSERT INTO agent_task_events (id,task_id,actor_type,actor_id,event_type,from_status,to_status,detail_json,created_at) VALUES (?,?,'worker',?,'completed','in_progress','completed',?,?)").bind(crypto.randomUUID(), task.id, leaseOwner, JSON.stringify({ result: report.result }), finishedAt);
    await db.batch([claimedEvent, update, event]);
    return { processed: true, taskId: task.id, status: "completed" };
  } catch (error) {
    const failedAt = nowSeconds(), code = error?.message === "TASK_TYPE_NOT_ALLOWED" ? "TASK_TYPE_NOT_ALLOWED" : "RUNTIME_TASK_FAILED";
    const update = db.prepare("UPDATE agent_tasks SET status='failed', error_code=?, updated_at=?, lease_owner=NULL, lease_expires_at=NULL WHERE id=? AND status='in_progress' AND lease_owner=?").bind(code, failedAt, task.id, leaseOwner);
    const event = db.prepare("INSERT INTO agent_task_events (id,task_id,actor_type,actor_id,event_type,from_status,to_status,detail_json,created_at) VALUES (?,?,'worker',?,'failed','in_progress','failed',?,?)").bind(crypto.randomUUID(), task.id, leaseOwner, JSON.stringify({ code }), failedAt);
    await db.batch([claimedEvent, update, event]);
    return { processed: true, taskId: task.id, status: "failed", errorCode: code };
  }
}
export default {
  async scheduled(_event, env, ctx) {
    if (env.AGENT_RUNTIME_ENABLED !== "true" || !env.DB) return;
    ctx.waitUntil((async () => {
      const owner = crypto.randomUUID();
      for (let index = 0; index < 5; index += 1) {
        const result = await processOne(env.DB, owner);
        if (!result.processed) break;
      }
    })());
  }
};
