import { requireUser, readConversationBody, normalizeMessages, normalizeTitle, validOwnedProject, json, originAllowed } from "./_lib.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireUser(request, env);
  if (auth.error) return auth.error;
  try {
    const result = await env.DB.prepare(
      "SELECT id, title, message_count, created_at, updated_at, project_id FROM conversations WHERE user_id = ? ORDER BY updated_at DESC LIMIT 50"
    ).bind(auth.user.id).all();
    return json({ conversations: result.results || [] });
  } catch {
    return json({ error: "HISTORY_NOT_CONFIGURED", message: "جدول تاریخچه هنوز روی پایگاه داده ایجاد نشده است." }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  if (!originAllowed(request)) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const auth = await requireUser(request, env);
  if (auth.error) return auth.error;
  const parsed = await readConversationBody(request);
  if (parsed.error) return parsed.error;
  const messages = normalizeMessages(parsed.body.messages);
  if (!messages) return json({ error: "INVALID_MESSAGES", message: "ساختار یا اندازه پیام‌های گفتگو معتبر نیست." }, 400);
  const projectId = parsed.body.project_id || null;
  try {
    if (!await validOwnedProject(env.DB, auth.user.id, projectId)) return json({ error: "PROJECT_NOT_FOUND", message: "پروژه انتخاب‌شده وجود ندارد یا متعلق به این حساب نیست." }, 404);
  } catch { return json({ error: "PROJECTS_NOT_CONFIGURED" }, 503); }
  const title = normalizeTitle(parsed.body.title, messages);
  const now = Math.floor(Date.now() / 1000);
  const id = crypto.randomUUID();
  try {
    await env.DB.prepare(
      "INSERT INTO conversations (id, user_id, title, messages_json, message_count, created_at, updated_at, project_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
    ).bind(id, auth.user.id, title, JSON.stringify(messages), messages.length, now, now, projectId).run();
    return json({ saved: true, conversation: { id, title, message_count: messages.length, created_at: now, updated_at: now, project_id: projectId } }, 201);
  } catch {
    return json({ error: "HISTORY_SAVE_FAILED", message: "ذخیره گفتگو انجام نشد؛ دوباره تلاش کنید." }, 503);
  }
}
