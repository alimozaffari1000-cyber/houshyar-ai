import { getSessionUser, originAllowed } from "../../_lib/auth.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  }
});

/**
 * Records explicit human approval for a consequential task.
 * Approval only moves the plan to the queue; no worker or external action is run.
 */
export async function onRequestPost({ request, env = {}, params = {} }) {
  if (!originAllowed(request)) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
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
    const now = Math.floor(Date.now() / 1000);
    const eventId = crypto.randomUUID();
    const results = await env.DB.batch([
      env.DB.prepare(
        "UPDATE agent_tasks SET status = 'queued', updated_at = ? WHERE id = ? AND user_id = ? AND status = 'needs_approval' AND approval_required = 1 AND expires_at > ?"
      ).bind(now, id, user.id, now),
      env.DB.prepare(
        "INSERT INTO agent_task_events (id, task_id, user_id, event_type, actor_type, created_at, metadata_json) SELECT ?, id, user_id, 'task.approval_recorded', 'user', ?, '{}' FROM agent_tasks WHERE id = ? AND user_id = ? AND status = 'queued' AND approval_required = 1 AND updated_at = ? AND changes() = 1"
      ).bind(eventId, now, id, user.id, now)
    ]);

    if (!results[0]?.meta?.changes) return json({ error: "TASK_NOT_APPROVABLE" }, 409);
    return json({
      id,
      status: "queued",
      execution: "not_started",
      message: "تأیید انسانی ثبت شد؛ این نسخه هنوز وظیفه را اجرا نمی‌کند."
    });
  } catch {
    return json({ error: "TASK_QUEUE_UNAVAILABLE" }, 503);
  }
}
