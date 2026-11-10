import { requireDrawUser, checkDrawRate, adJson, readAdsJson } from "../../_lib/draws.js";

export async function onRequestPost({ request, env }) {
  const auth = await requireDrawUser({ request, env, write: true });
  if (auth.response) return auth.response;
  if (auth.user.role !== "admin") return adJson({ error: "ADMIN_REQUIRED" }, 403);
  const rate = await checkDrawRate({ db: env.DB, request, action: "campaign-review", limit: 10 });
  if (rate.response) return rate.response;
  const parsed = await readAdsJson(request, 2048);
  if (parsed.error) return adJson({ error: parsed.error }, 400);
  const id = typeof parsed.body.campaignId === "string" ? parsed.body.campaignId : "";
  const action = parsed.body.action;
  if (!/^[0-9a-f-]{36}$/i.test(id) || !["open", "cancel"].includes(action)) {
    return adJson({ error: "INVALID_DRAW_REVIEW" }, 400);
  }
  const now = new Date().toISOString();
  try {
    const campaign = await env.DB.prepare("SELECT id, status, starts_at, ends_at, draw_at FROM draw_campaigns WHERE id = ?").bind(id).first();
    if (!campaign) return adJson({ error: "DRAW_NOT_FOUND" }, 404);
    if (action === "open" && campaign.status !== "draft") return adJson({ error: "DRAW_NOT_DRAFT" }, 409);
    if (action === "cancel" && !["draft", "scheduled", "open"].includes(campaign.status)) return adJson({ error: "DRAW_CANNOT_CANCEL" }, 409);
    if (action === "open" && campaign.ends_at && campaign.ends_at <= now) return adJson({ error: "DRAW_PERIOD_EXPIRED" }, 409);
    const nextStatus = action === "open" ? "open" : "cancelled";
    const update = env.DB.prepare("UPDATE draw_campaigns SET status = ?, updated_at = ? WHERE id = ? AND status = ?")
      .bind(nextStatus, now, id, campaign.status);
    const audit = env.DB.prepare(
      "INSERT INTO draw_audit_events (id, campaign_id, actor_user_id, event_type, event_payload_json, created_at) " +
      "SELECT ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM draw_campaigns WHERE id = ? AND status = ?)"
    ).bind(crypto.randomUUID(), id, auth.user.id, "campaign_" + action, JSON.stringify({ previousStatus: campaign.status, status: nextStatus }), now, id, nextStatus);
    const results = await env.DB.batch([update, audit]);
    if (results[0]?.meta?.changes !== 1) return adJson({ error: "DRAW_STATUS_CONFLICT" }, 409);
    return adJson({ updated: true, campaign: { id, status: nextStatus } });
  } catch { return adJson({ error: "DRAW_REVIEW_FAILED" }, 503); }
}
