import { requireProjectUser, readProjectBody, normalizeProjectTitle, normalizeProjectDescription, validProjectId, ownedProject, json, originAllowed } from "./_lib.js";

export async function onRequestGet({ request, env, params }) {
  const id = params?.id;
  if (!validProjectId(id)) return json({ error: "NOT_FOUND" }, 404);
  const auth = await requireProjectUser(request, env);
  if (auth.error) return auth.error;
  try {
    const project = await ownedProject(env.DB, auth.user.id, id);
    if (!project) return json({ error: "NOT_FOUND" }, 404);
    const result = await env.DB.prepare("SELECT id, title, message_count, created_at, updated_at FROM conversations WHERE user_id = ? AND project_id = ? ORDER BY updated_at DESC LIMIT 50").bind(auth.user.id, id).all();
    return json({ project, conversations: result.results || [] });
  } catch { return json({ error: "PROJECTS_NOT_CONFIGURED" }, 503); }
}

export async function onRequestPut({ request, env, params }) {
  if (!originAllowed(request)) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const id = params?.id;
  if (!validProjectId(id)) return json({ error: "NOT_FOUND" }, 404);
  const auth = await requireProjectUser(request, env);
  if (auth.error) return auth.error;
  const parsed = await readProjectBody(request);
  if (parsed.error) return parsed.error;
  const title = normalizeProjectTitle(parsed.body.title);
  if (!title) return json({ error: "INVALID_PROJECT_TITLE", message: "عنوان پروژه الزامی است." }, 400);
  if (typeof parsed.body.description !== "undefined" && typeof parsed.body.description !== "string") return json({ error: "INVALID_PROJECT_DESCRIPTION" }, 400);
  const description = normalizeProjectDescription(parsed.body.description ?? "");
  const now = Math.floor(Date.now() / 1000);
  try {
    const result = await env.DB.prepare("UPDATE projects SET title = ?, description = ?, updated_at = ? WHERE id = ? AND user_id = ?").bind(title, description, now, id, auth.user.id).run();
    if (!result.meta?.changes) return json({ error: "NOT_FOUND" }, 404);
    return json({ updated: true, project: { id, title, description, updated_at: now } });
  } catch { return json({ error: "PROJECT_UPDATE_FAILED" }, 503); }
}

export async function onRequestDelete({ request, env, params }) {
  if (!originAllowed(request)) return json({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const id = params?.id;
  if (!validProjectId(id)) return json({ error: "NOT_FOUND" }, 404);
  const auth = await requireProjectUser(request, env);
  if (auth.error) return auth.error;
  try {
    const result = await env.DB.prepare("DELETE FROM projects WHERE id = ? AND user_id = ?").bind(id, auth.user.id).run();
    if (!result.meta?.changes) return json({ error: "NOT_FOUND" }, 404);
    return json({ deleted: true, id, conversations_unassigned: true });
  } catch { return json({ error: "PROJECT_DELETE_FAILED" }, 503); }
}
