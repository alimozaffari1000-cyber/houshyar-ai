import { getSessionUser } from "../_lib/auth.js";
import { safeTaskRecord } from "../_lib/agent-tasks.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  }
});

export async function onRequestGet({ request, env = {}, params = {} }) {
  if (env.AUTH_ENABLED !== "true" || !env.DB) {
    return json({ error: "TASK_QUEUE_NOT_CONFIGURED" }, 503);
  }

  let user;
  try {
    user = await getSessionUser(env.DB, request);
  } catch {
    return json({ error: "TASK_QUEUE_UNAVAILABLE" }, 503);
  }
  if (!user) return json({ error: "AUTH_REQUIRED" }, 401);

  const id = typeof params.id === "string" ? params.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "INVALID_TASK_ID" }, 400);

  try {
    const row = await env.DB.prepare(
      "SELECT id, title, goal, agent_id, workflow_json, status, approval_required, created_at, updated_at, expires_at FROM agent_tasks WHERE id = ? AND user_id = ? LIMIT 1"
    ).bind(id, user.id).first();
    if (!row) return json({ error: "TASK_NOT_FOUND" }, 404);
    return json({ task: safeTaskRecord(row) });
  } catch {
    return json({ error: "TASK_QUEUE_UNAVAILABLE" }, 503);
  }
}
