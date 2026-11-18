import { getSessionUser, originAllowed } from "../../_lib/auth.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
});

export async function onRequestPost({ request, env = {}, params = {} }) {
  if (!originAllowed(request)) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  if (env.AUTH_ENABLED !== "true" || !env.DB) return json({ error: "TASK_QUEUE_NOT_CONFIGURED" }, 503);
  let user;
  try { user = await getSessionUser(env.DB, request); } catch { return json({ error: "TASK_QUEUE_UNAVAILABLE" }, 503); }
  if (!user) return json({ error: "AUTH_REQUIRED" }, 401);
  const id = typeof params.id === "string" ? params.id : "";
  if (!/^[0-9a-f-]{36}$/i.test(id)) return json({ error: "INVALID_TASK_ID" }, 400);
  try {
    const now = Math.floor(Date.now() / 1000);
    const result = await env.DB.prepare(
      "UPDATE agent_tasks SET status = 'cancelled', updated_at = ? WHERE id = ? AND user_id = ? AND status IN ('queued', 'needs_approval') AND expires_at > ?"
    ).bind(now, id, user.id, now).run();
    if (!result.meta?.changes) return json({ error: "TASK_NOT_CANCELLABLE" }, 409);
    return json({ id, status: "cancelled" });
  } catch {
    return json({ error: "TASK_QUEUE_UNAVAILABLE" }, 503);
  }
}
