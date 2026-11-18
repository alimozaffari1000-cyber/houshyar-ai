import { getSessionUser, originAllowed } from "./_lib/auth.js";
import { validateRuntimeTask } from "./_lib/agent-runtime-policy.js";
const json = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
export async function onRequestPost({ request, env }) {
  if (!originAllowed(request)) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  if ((request.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase() !== "application/json") return json({ error: "UNSUPPORTED_MEDIA_TYPE" }, 415);
  if (!env?.DB) return json({ error: "DATABASE_UNAVAILABLE" }, 503);
  let user;
  try { user = await getSessionUser(env.DB, request); } catch { return json({ error: "AUTH_UNAVAILABLE" }, 503); }
  if (!user) return json({ error: "AUTH_REQUIRED" }, 401);
  let body;
  try { const raw = await request.text(); if (raw.length > 4000) return json({ error: "BODY_TOO_LARGE" }, 413); body = JSON.parse(raw); }
  catch { return json({ error: "INVALID_JSON" }, 400); }
  const checked = validateRuntimeTask({ taskType: body?.taskType, payload: body?.payload ?? {} });
  if (!checked.allowed) return json({ error: checked.reason }, 400);
  const key = request.headers.get("idempotency-key");
  if (key && !/^[A-Za-z0-9._:-]{8,128}$/.test(key)) return json({ error: "INVALID_IDEMPOTENCY_KEY" }, 400);
  const now = Math.floor(Date.now() / 1000), id = crypto.randomUUID(), eventId = crypto.randomUUID();
  try {
    if (key) {
      const previous = await env.DB.prepare("SELECT id,title,status,created_at FROM agent_tasks WHERE user_id = ? AND idempotency_key = ? LIMIT 1").bind(user.id, key).first();
      if (previous) return json({ task: previous, idempotentReplay: true, execution: "queued_only" });
    }
    const task = checked.task;
    await env.DB.batch([
      env.DB.prepare("INSERT INTO agent_tasks (id,user_id,title,input_text,agent_id,status,priority,created_at,updated_at,idempotency_key,task_type,payload_json) VALUES (?,?,?,?,?,'queued',3,?,?,?,?,?)").bind(id, user.id, task.title, "System-generated deterministic task", task.agentId, now, now, key || null, task.taskType, "{}"),
      env.DB.prepare("INSERT INTO agent_task_events (id,task_id,actor_type,actor_id,event_type,from_status,to_status,detail_json,created_at) VALUES (?,?, 'user', ?, 'created', NULL, 'queued', ?, ?)").bind(eventId, id, user.id, JSON.stringify({ taskType: task.taskType }), now)
    ]);
    return json({ task: { id, title: task.title, taskType: task.taskType, status: "queued", createdAt: now }, execution: "queued_only", autonomousExecution: false }, 201);
  } catch { return json({ error: "TASK_CREATE_FAILED" }, 503); }
}
