import { requireProjectUser, readProjectBody, normalizeProjectTitle, normalizeProjectDescription, json, originAllowed } from "./_lib.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireProjectUser(request, env);
  if (auth.error) return auth.error;
  try {
    const result = await env.DB.prepare(
      "SELECT p.id, p.title, p.description, p.created_at, p.updated_at, COUNT(c.id) AS conversation_count FROM projects p LEFT JOIN conversations c ON c.project_id = p.id AND c.user_id = p.user_id WHERE p.user_id = ? GROUP BY p.id ORDER BY p.updated_at DESC LIMIT 50"
    ).bind(auth.user.id).all();
    return json({ projects: result.results || [] });
  } catch {
    return json({ error: "PROJECTS_NOT_CONFIGURED", message: "جدول پروژه‌ها هنوز روی پایگاه داده ایجاد نشده است." }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  if (!originAllowed(request)) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const auth = await requireProjectUser(request, env);
  if (auth.error) return auth.error;
  const parsed = await readProjectBody(request);
  if (parsed.error) return parsed.error;
  const title = normalizeProjectTitle(parsed.body.title);
  const description = normalizeProjectDescription(parsed.body.description);
  if (!title) return json({ error: "INVALID_PROJECT_TITLE", message: "عنوان پروژه الزامی است." }, 400);
  if (typeof parsed.body.description !== "undefined" && typeof parsed.body.description !== "string") return json({ error: "INVALID_PROJECT_DESCRIPTION" }, 400);
  const id = crypto.randomUUID(), now = Math.floor(Date.now() / 1000);
  try {
    const count = await env.DB.prepare("SELECT COUNT(*) AS count FROM projects WHERE user_id = ?").bind(auth.user.id).first();
    if ((count?.count || 0) >= 50) return json({ error: "PROJECT_LIMIT_REACHED", message: "حداکثر ۵۰ پروژه برای هر حساب مجاز است." }, 409);
    await env.DB.prepare("INSERT INTO projects (id, user_id, title, description, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, auth.user.id, title, description, now, now).run();
    return json({ created: true, project: { id, title, description, conversation_count: 0, created_at: now, updated_at: now } }, 201);
  } catch {
    return json({ error: "PROJECT_CREATE_FAILED", message: "ساخت پروژه انجام نشد." }, 503);
  }
}
