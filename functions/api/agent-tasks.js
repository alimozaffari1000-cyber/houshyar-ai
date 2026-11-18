import { getSessionUser, originAllowed } from "../_lib/auth.js";
import { buildAgentPlan, routeAgentRequest } from "../_lib/agent-router.js";
import { requiresHumanApproval, safeTaskRecord, taskTitle } from "../_lib/agent-tasks.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
});

async function readJsonLimited(request) {
  if (!request.body) return { error: "INVALID_JSON" };
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 8192) {
        await reader.cancel();
        return { error: "BODY_TOO_LARGE" };
      }
      chunks.push(value);
    }
  } catch {
    return { error: "INVALID_JSON" };
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
  try { return { body: JSON.parse(new TextDecoder().decode(bytes)) }; }
  catch { return { error: "INVALID_JSON" }; }
}

async function authenticatedUser(request, env) {
  if (env.AUTH_ENABLED !== "true" || !env.DB) return { error: json({ error: "TASK_QUEUE_NOT_CONFIGURED" }, 503) };
  try {
    const user = await getSessionUser(env.DB, request);
    if (!user) return { error: json({ error: "AUTH_REQUIRED" }, 401) };
    return { user };
  } catch {
    return { error: json({ error: "TASK_QUEUE_UNAVAILABLE" }, 503) };
  }
}

export async function onRequestGet({ request, env = {} }) {
  const auth = await authenticatedUser(request, env);
  if (auth.error) return auth.error;
  try {
    const result = await env.DB.prepare(
      "SELECT id, title, goal, agent_id, workflow_json, status, approval_required, created_at, updated_at, expires_at FROM agent_tasks WHERE user_id = ? AND expires_at > ? ORDER BY created_at DESC LIMIT 30"
    ).bind(auth.user.id, Math.floor(Date.now() / 1000)).all();
    return json({ tasks: (result.results || []).map(safeTaskRecord).filter(Boolean) });
  } catch {
    return json({ error: "TASK_QUEUE_UNAVAILABLE" }, 503);
  }
}

export async function onRequestPost({ request, env = {} }) {
  if (!originAllowed(request)) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  if ((request.headers.get("content-type") || "").split(";", 1)[0].trim().toLowerCase() !== "application/json") {
    return json({ error: "UNSUPPORTED_MEDIA_TYPE" }, 415);
  }
  const length = Number(request.headers.get("content-length"));
  if (Number.isFinite(length) && length > 8192) return json({ error: "BODY_TOO_LARGE" }, 413);
  const auth = await authenticatedUser(request, env);
  if (auth.error) return auth.error;
  const parsed = await readJsonLimited(request);
  if (parsed.error === "BODY_TOO_LARGE") return json({ error: "BODY_TOO_LARGE" }, 413);
  if (parsed.error) return json({ error: "INVALID_JSON" }, 400);
  const body = parsed.body;
  if (!body || typeof body !== "object" || Array.isArray(body) || typeof body.goal !== "string") {
    return json({ error: "INVALID_BODY" }, 400);
  }
  const goal = body.goal.trim();
  if (!goal) return json({ error: "GOAL_REQUIRED" }, 400);
  if (goal.length > 4000) return json({ error: "GOAL_TOO_LONG" }, 413);

  try {
    const now = Math.floor(Date.now() / 1000);
    const open = await env.DB.prepare(
      "SELECT COUNT(*) AS total FROM agent_tasks WHERE user_id = ? AND status IN ('queued', 'needs_approval', 'running') AND expires_at > ?"
    ).bind(auth.user.id, now).first();
    if ((Number(open?.total) || 0) >= 10) return json({ error: "TASK_LIMIT_REACHED" }, 429);

    const specialist = routeAgentRequest(goal);
    const workflow = buildAgentPlan(goal);
    const approvalRequired = requiresHumanApproval(goal);
    const id = crypto.randomUUID();
    const status = approvalRequired ? "needs_approval" : "queued";
    const expiresAt = now + 7 * 86400;
    const title = taskTitle(goal);
    await env.DB.prepare(
      "INSERT INTO agent_tasks (id, user_id, title, goal, agent_id, workflow_json, status, approval_required, created_at, updated_at, expires_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, auth.user.id, title, goal, specialist.id, JSON.stringify(workflow), status, approvalRequired ? 1 : 0, now, now, expiresAt).run();
    return json({
      task: { id, title, agentId: specialist.id, workflow, status, approvalRequired, createdAt: now, updatedAt: now, expiresAt },
      execution: "not_started",
      message: approvalRequired
        ? "وظیفه ثبت شد و تا تأیید انسانی اجرا نخواهد شد."
        : "وظیفه در صف ثبت شد؛ اجرای خودکار هنوز فعال نیست."
    }, 201);
  } catch {
    return json({ error: "TASK_QUEUE_UNAVAILABLE" }, 503);
  }
}
