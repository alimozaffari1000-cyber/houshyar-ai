import { getSessionUser } from "../../_lib/auth.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  }
});

const TASK_ID = /^[0-9a-f-]{36}$/i;
const CURSOR = /^(\d{1,12})\.([0-9a-f-]{36})$/i;
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

function encodeCursor(event) {
  return String(event.created_at) + "." + event.id;
}

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

  const taskId = typeof params.id === "string" ? params.id : "";
  if (!TASK_ID.test(taskId)) return json({ error: "INVALID_TASK_ID" }, 400);

  const url = new URL(request.url);
  const rawLimit = url.searchParams.get("limit");
  let limit = DEFAULT_LIMIT;
  if (rawLimit !== null) {
    if (!/^\d{1,2}$/.test(rawLimit)) return json({ error: "INVALID_LIMIT" }, 400);
    limit = Number(rawLimit);
    if (limit < 1 || limit > MAX_LIMIT) return json({ error: "INVALID_LIMIT" }, 400);
  }

  const rawCursor = url.searchParams.get("cursor");
  let cursor = null;
  if (rawCursor !== null) {
    const match = CURSOR.exec(rawCursor);
    if (!match) return json({ error: "INVALID_CURSOR" }, 400);
    cursor = { createdAt: Number(match[1]), id: match[2] };
  }

  try {
    const task = await env.DB.prepare(
      "SELECT id FROM agent_tasks WHERE id = ? AND user_id = ? LIMIT 1"
    ).bind(taskId, user.id).first();
    if (!task) return json({ error: "TASK_NOT_FOUND" }, 404);

    const statement = cursor
      ? env.DB.prepare(
          "SELECT id, event_type, actor_type, created_at FROM agent_task_events WHERE task_id = ? AND user_id = ? AND (created_at < ? OR (created_at = ? AND id < ?)) ORDER BY created_at DESC, id DESC LIMIT ?"
        ).bind(taskId, user.id, cursor.createdAt, cursor.createdAt, cursor.id, limit + 1)
      : env.DB.prepare(
          "SELECT id, event_type, actor_type, created_at FROM agent_task_events WHERE task_id = ? AND user_id = ? ORDER BY created_at DESC, id DESC LIMIT ?"
        ).bind(taskId, user.id, limit + 1);

    const result = await statement.all();
    const rows = Array.isArray(result.results) ? result.results : [];
    const hasMore = rows.length > limit;
    const events = rows.slice(0, limit).map(event => ({
      id: event.id,
      type: event.event_type,
      actor: event.actor_type,
      createdAt: event.created_at
    }));

    return json({
      events,
      page: {
        limit,
        hasMore,
        nextCursor: hasMore && events.length
          ? encodeCursor(rows[limit - 1])
          : null
      }
    });
  } catch {
    return json({ error: "TASK_QUEUE_UNAVAILABLE" }, 503);
  }
}
