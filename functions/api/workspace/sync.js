import { getSessionUser, originAllowed } from "../_lib/auth.js";
import { authJson, enforceAuthRateLimit, isJsonContentType } from "../_lib/auth-flow.js";

const MAX_BODY_BYTES = 256 * 1024;
const MAX_RECORDS = 30;
const validDate = value => typeof value === "string" && Number.isFinite(Date.parse(value));
const normalizeHistory = value => value.filter(item =>
  item && typeof item === "object" && typeof item.id === "string" && item.id.length > 0 && item.id.length <= 128 &&
  typeof item.title === "string" && validDate(item.createdAt) && Array.isArray(item.messages)
).map(item => ({
  id: item.id,
  title: item.title.trim().slice(0, 120),
  createdAt: item.createdAt,
  messages: item.messages.filter(message =>
    message && typeof message === "object" && ["user", "assistant"].includes(message.role) &&
    typeof message.text === "string"
  ).slice(-50).map(message => ({ role: message.role, text: message.text.slice(0, 12000) }))
})).filter(item => item.title && item.messages.length).slice(0, MAX_RECORDS);
const normalizeProjects = value => value.filter(item =>
  item && typeof item === "object" && typeof item.id === "string" && item.id.length > 0 && item.id.length <= 128 &&
  typeof item.title === "string" && validDate(item.createdAt)
).map(item => ({
  id: item.id,
  title: item.title.trim().slice(0, 80),
  prompt: typeof item.prompt === "string" ? item.prompt.slice(0, 5000) : "",
  createdAt: item.createdAt
})).filter(item => item.title).slice(0, MAX_RECORDS);

async function authenticatedUser(request, env) {
  if (env.AUTH_ENABLED !== "true" || !env.DB) return { response: authJson({ error: "AUTH_NOT_CONFIGURED" }, 503) };
  const user = await getSessionUser(env.DB, request);
  if (!user) return { response: authJson({ error: "AUTH_REQUIRED" }, 401) };
  const limited = await enforceAuthRateLimit({ env, request, action: "workspace-sync", email: user.email, limit: 30 });
  if (limited) return { response: limited };
  return { user };
}

export async function onRequestGet({ request, env }) {
  const auth = await authenticatedUser(request, env);
  if (auth.response) return auth.response;
  try {
    const row = await env.DB.prepare(
      "SELECT revision, payload_json AS payloadJson, updated_at AS updatedAt FROM workspace_snapshots WHERE user_id = ? LIMIT 1"
    ).bind(auth.user.id).first();
    if (!row) return authJson({ revision: 0, workspace: { history: [], projects: [] } });
    let workspace;
    try { workspace = JSON.parse(row.payloadJson); } catch { return authJson({ error: "WORKSPACE_DATA_UNAVAILABLE" }, 503); }
    if (!workspace || !Array.isArray(workspace.history) || !Array.isArray(workspace.projects)) {
      return authJson({ error: "WORKSPACE_DATA_UNAVAILABLE" }, 503);
    }
    return authJson({ revision: Number(row.revision), updatedAt: Number(row.updatedAt), workspace });
  } catch {
    return authJson({ error: "WORKSPACE_SYNC_UNAVAILABLE" }, 503);
  }
}

export async function onRequestPut({ request, env }) {
  if (!originAllowed(request)) return authJson({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const auth = await authenticatedUser(request, env);
  if (auth.response) return auth.response;
  if (!isJsonContentType(request.headers.get("content-type"))) return authJson({ error: "UNSUPPORTED_MEDIA_TYPE" }, 415);
  const declaredLength = Number(request.headers.get("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BODY_BYTES) return authJson({ error: "BODY_TOO_LARGE" }, 413);
  let raw;
  try { raw = await request.text(); } catch { return authJson({ error: "INVALID_JSON" }, 400); }
  if (new TextEncoder().encode(raw).byteLength > MAX_BODY_BYTES) return authJson({ error: "BODY_TOO_LARGE" }, 413);
  let body;
  try { body = JSON.parse(raw); } catch { return authJson({ error: "INVALID_JSON" }, 400); }
  if (!body || typeof body !== "object" || Array.isArray(body) || !Number.isSafeInteger(body.revision) || body.revision < 0 ||
      !body.workspace || typeof body.workspace !== "object" || Array.isArray(body.workspace) ||
      !Array.isArray(body.workspace.history) || !Array.isArray(body.workspace.projects)) {
    return authJson({ error: "INVALID_WORKSPACE" }, 400);
  }
  const workspace = {
    history: normalizeHistory(body.workspace.history),
    projects: normalizeProjects(body.workspace.projects)
  };
  const payloadJson = JSON.stringify(workspace);
  if (new TextEncoder().encode(payloadJson).byteLength > MAX_BODY_BYTES) return authJson({ error: "WORKSPACE_TOO_LARGE" }, 413);
  const now = Math.floor(Date.now() / 1000);
  try {
    const result = body.revision === 0
      ? await env.DB.prepare(
          "INSERT INTO workspace_snapshots (user_id, revision, payload_json, updated_at) VALUES (?, 1, ?, ?) ON CONFLICT(user_id) DO NOTHING RETURNING revision"
        ).bind(auth.user.id, payloadJson, now).first()
      : await env.DB.prepare(
          "UPDATE workspace_snapshots SET revision = revision + 1, payload_json = ?, updated_at = ? WHERE user_id = ? AND revision = ? RETURNING revision"
        ).bind(payloadJson, now, auth.user.id, body.revision).first();
    if (!result) {
      const current = await env.DB.prepare("SELECT revision FROM workspace_snapshots WHERE user_id = ? LIMIT 1").bind(auth.user.id).first();
      return authJson({ error: "WORKSPACE_REVISION_CONFLICT", currentRevision: Number(current?.revision || 0) }, 409);
    }
    return authJson({ saved: true, revision: Number(result.revision), updatedAt: now });
  } catch {
    return authJson({ error: "WORKSPACE_SYNC_UNAVAILABLE" }, 503);
  }
}
