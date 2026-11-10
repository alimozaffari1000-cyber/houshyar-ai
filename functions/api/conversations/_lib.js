import { getSessionUser, originAllowed } from "../_lib/auth.js";

export const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  }
});

export async function requireUser(request, env) {
  if (env.AUTH_ENABLED !== "true" || !env.DB) return { error: json({ error: "HISTORY_NOT_CONFIGURED", message: "ذخیره تاریخچه هنوز در این محیط راه‌اندازی نشده است." }, 503) };
  try {
    const user = await getSessionUser(env.DB, request);
    if (!user) return { error: json({ error: "AUTH_REQUIRED", message: "برای ذخیره و مشاهده تاریخچه گفتگوها وارد حساب شوید." }, 401) };
    return { user };
  } catch {
    return { error: json({ error: "HISTORY_AUTH_UNAVAILABLE", message: "بررسی نشست کاربری موقتاً ممکن نیست." }, 503) };
  }
}

export async function readConversationBody(request) {
  const type = request.headers.get("content-type") || "";
  if (!type.toLowerCase().includes("application/json")) return { error: json({ error: "UNSUPPORTED_MEDIA_TYPE" }, 415) };
  const declared = Number(request.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > 512 * 1024) return { error: json({ error: "BODY_TOO_LARGE" }, 413) };
  if (!request.body) return { error: json({ error: "INVALID_JSON" }, 400) };
  const reader = request.body.getReader();
  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > 512 * 1024) {
        await reader.cancel();
        return { error: json({ error: "BODY_TOO_LARGE" }, 413) };
      }
      chunks.push(value);
    }
  } catch { return { error: json({ error: "INVALID_JSON" }, 400) }; }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try {
    const body = JSON.parse(new TextDecoder().decode(bytes));
    if (!body || typeof body !== "object" || Array.isArray(body)) return { error: json({ error: "INVALID_BODY" }, 400) };
    return { body };
  } catch { return { error: json({ error: "INVALID_JSON" }, 400) }; }
}

export function normalizeMessages(value) {
  if (!Array.isArray(value) || value.length < 2 || value.length > 80) return null;
  const messages = [];
  let total = 0;
  for (const item of value) {
    if (!item || !["user", "assistant"].includes(item.role)) return null;
    const content = typeof item.content === "string" ? item.content.trim() : typeof item.text === "string" ? item.text.trim() : "";
    if (!content || content.length > 6000) return null;
    total += content.length;
    if (total > 100000) return null;
    messages.push({ role: item.role, content });
  }
  if (messages[0].role !== "user" || messages[messages.length - 1].role !== "assistant") return null;
  return messages;
}

export function normalizeTitle(value, messages) {
  const title = typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, 120) : "";
  return title || (messages.find(item => item.role === "user")?.content || "گفتگوی جدید").slice(0, 80);
}

export async function ownedConversation(db, userId, id) {
  return db.prepare("SELECT id, title, messages_json, message_count, created_at, updated_at, project_id FROM conversations WHERE id = ? AND user_id = ? LIMIT 1").bind(id, userId).first();
}

export function validConversationId(value) {
  return typeof value === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

export async function validOwnedProject(db, userId, projectId) {
  if (projectId === null || projectId === undefined || projectId === "") return true;
  if (!validConversationId(projectId)) return false;
  const row = await db.prepare("SELECT id FROM projects WHERE id = ? AND user_id = ? LIMIT 1").bind(projectId, userId).first();
  return Boolean(row);
}

export { getSessionUser, originAllowed };
