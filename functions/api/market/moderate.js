import { originAllowed } from "../_lib/auth.js";
import { marketJson, requireMarketUser, readMarketBody, validCountry } from "../_lib/marketplace.js";
export async function onRequestPost({ request, env }) {
  if (!originAllowed(request)) return marketJson({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const auth = await requireMarketUser(request, env);
  if (auth.response) return auth.response;
  if (auth.user.role !== "admin") return marketJson({ error: "ADMIN_REQUIRED" }, 403);
  const parsed = await readMarketBody(request);
  if (parsed.error) return marketJson({ error: parsed.error }, parsed.status);
  const { type, id, decision, country } = parsed.body;
  if (!["store", "listing"].includes(type) || typeof id !== "string" || id.length > 64 || !["approve", "reject"].includes(decision) || !validCountry(country)) return marketJson({ error: "INVALID_MODERATION_REQUEST" }, 400);
  const status = decision === "approve" ? (type === "store" ? "active" : "published") : "rejected";
  const now = Math.floor(Date.now() / 1000);
  try {
    if (type === "store") {
      const result = await env.DB.prepare("UPDATE marketplace_stores SET status = ?, updated_at = ? WHERE id = ? AND country_code = ? AND status = 'pending'").bind(status, now, id, country.toUpperCase()).run();
      if (!result.meta?.changes) return marketJson({ error: "PENDING_STORE_NOT_FOUND" }, 404);
    } else {
      const row = await env.DB.prepare("SELECT l.id, s.status AS store_status FROM marketplace_listings l JOIN marketplace_stores s ON s.id = l.store_id WHERE l.id = ? AND l.country_code = ? AND l.status = 'pending' LIMIT 1").bind(id, country.toUpperCase()).first();
      if (!row) return marketJson({ error: "PENDING_LISTING_NOT_FOUND" }, 404);
      if (decision === "approve" && row.store_status !== "active") return marketJson({ error: "STORE_NOT_ACTIVE" }, 409);
      await env.DB.prepare("UPDATE marketplace_listings SET status = ?, updated_at = ? WHERE id = ? AND country_code = ? AND status = 'pending'").bind(status, now, id, country.toUpperCase()).run();
    }
    await env.DB.prepare("INSERT INTO audit_events (id, actor_user_id, event_type, target_type, target_id, metadata_json, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)").bind(crypto.randomUUID(), auth.user.id, "marketplace.moderated", type, id, JSON.stringify({ country: country.toUpperCase(), decision }), now).run();
    return marketJson({ success: true, type, id, status });
  } catch { return marketJson({ error: "MODERATION_FAILED" }, 503); }
}
