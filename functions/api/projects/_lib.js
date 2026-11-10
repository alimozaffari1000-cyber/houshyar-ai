import { getSessionUser, originAllowed } from "../_lib/auth.js";

export const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }
});

export async function requireProjectUser(request, env) {
  if (env.AUTH_ENABLED !== "true" || !env.DB) return { error: json({ error: "PROJECTS_NOT_CONFIGURED", message: "فضای پروژه‌ها هنوز روی سرور راه‌اندازی نشده است." }, 503) };
  try {
    const user = await getSessionUser(env.DB, request);
    if (!user) return { error: json({ error: "AUTH_REQUIRED", message: "برای مدیریت پروژه‌ها وارد حساب شوید." }, 401) };
    return { user };
  } catch {
    return { error: json({ error: "PROJECTS_AUTH_UNAVAILABLE" }, 503) };
  }
}

export async function readProjectBody(request) {
  if (!(request.headers.get("content-type") || "").toLowerCase().includes("application/json")) return { error: json({ error: "UNSUPPORTED_MEDIA_TYPE" }, 415) };
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > 16 * 1024) return { error: json({ error: "BODY_TOO_LARGE" }, 413) };
  if (!request.body) return { error: json({ error: "INVALID_JSON" }, 400) };
  const reader = request.body.getReader();
  const chunks = []; let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 16 * 1024) { await reader.cancel(); return { error: json({ error: "BODY_TOO_LARGE" }, 413) }; }
      chunks.push(value);
    }
  } catch { return { error: json({ error: "INVALID_JSON" }, 400) }; }
  const bytes = new Uint8Array(total); let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body)) return { error: json({ error: "INVALID_BODY" }, 400) };
    return { body };
  } catch { return { error: json({ error: "INVALID_JSON" }, 400) }; }
}

export function normalizeProjectTitle(value) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 80) : "";
}
export function normalizeProjectDescription(value) {
  return typeof value === "string" ? value.trim().slice(0, 500) : "";
}
export function validProjectId(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
export async function ownedProject(db, userId, projectId) {
  return db.prepare("SELECT id, user_id, title, description, created_at, updated_at FROM projects WHERE id = ? AND user_id = ? LIMIT 1").bind(projectId, userId).first();
}
export { originAllowed };
