import { requireUser, readConversationBody, normalizeMessages, normalizeTitle, ownedConversation, validConversationId, json, originAllowed } from "./_lib.js";

export async function onRequestGet({ request, env, params }) {
  const id = params?.id;
  if (!validConversationId(id)) return json({ error: "NOT_FOUND" }, 404);
  const auth = await requireUser(request, env);
  if (auth.error) return auth.error;
  try {
    const row = await ownedConversation(env.DB, auth.user.id, id);
    if (!row) return json({ error: "NOT_FOUND" }, 404);
    let messages;
    try { messages = JSON.parse(row.messages_json); } catch { return json({ error: "HISTORY_CORRUPTED" }, 500); }
    return json({ conversation: { id: row.id, title: row.title, messages, message_count: row.message_count, created_at: row.created_at, updated_at: row.updated_at } });
  } catch {
    return json({ error: "HISTORY_NOT_CONFIGURED" }, 503);
  }
}

export async function onRequestPut({ request, env, params }) {
  if (!originAllowed(request)) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const id = params?.id;
  if (!validConversationId(id)) return json({ error: "NOT_FOUND" }, 404);
  const auth = await requireUser(request, env);
  if (auth.error) return auth.error;
  const parsed = await readConversationBody(request);
  if (parsed.error) return parsed.error;
  try {
    const existing = await ownedConversation(env.DB, auth.user.id, id);
    if (!existing) return json({ error: "NOT_FOUND" }, 404);
    const messages = parsed.body.messages === undefined ? null : normalizeMessages(parsed.body.messages);
    if (parsed.body.messages !== undefined && !messages) return json({ error: "INVALID_MESSAGES" }, 400);
    const title = parsed.body.title === undefined ? existing.title : normalizeTitle(parsed.body.title, messages || JSON.parse(existing.messages_json));
    const now = Math.floor(Date.now() / 1000);
    if (messages) {
      await env.DB.prepare(
        "UPDATE conversations SET title = ?, messages_json = ?, message_count = ?, updated_at = ? WHERE id = ? AND user_id = ?"
      ).bind(title, JSON.stringify(messages), messages.length, now, id, auth.user.id).run();
    } else {
      await env.DB.prepare(
        "UPDATE conversations SET title = ?, updated_at = ? WHERE id = ? AND user_id = ?"
      ).bind(title, now, id, auth.user.id).run();
    }
    return json({ saved: true, conversation: { id, title, message_count: messages?.length ?? existing.message_count, updated_at: now } });
  } catch {
    return json({ error: "HISTORY_SAVE_FAILED", message: "به‌روزرسانی گفتگو انجام نشد." }, 503);
  }
}

export async function onRequestDelete({ request, env, params }) {
  if (!originAllowed(request)) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const auth = await requireUser(request, env);
  if (auth.error) return auth.error;
  const id = params?.id;
  if (!validConversationId(id)) return json({ error: "NOT_FOUND" }, 404);
  try {
    const result = await env.DB.prepare("DELETE FROM conversations WHERE id = ? AND user_id = ?").bind(id, auth.user.id).run();
    if (!result.meta?.changes) return json({ error: "NOT_FOUND" }, 404);
    return json({ deleted: true, id });
  } catch {
    return json({ error: "HISTORY_DELETE_FAILED" }, 503);
  }
}
