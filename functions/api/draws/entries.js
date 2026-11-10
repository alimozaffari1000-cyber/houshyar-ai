import { requireDrawUser, checkDrawRate, adJson, readAdsJson } from "../_lib/draws.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireDrawUser({ request, env });
  if (auth.response) return auth.response;
  const campaignId = new URL(request.url).searchParams.get("campaignId");
  if (!campaignId || !/^[0-9a-f-]{36}$/i.test(campaignId)) return adJson({ error: "INVALID_CAMPAIGN_ID" }, 400);
  try {
    const rows = await env.DB.prepare(
      "SELECT id, campaign_id, ticket_code, entry_status, created_at FROM draw_entries " +
      "WHERE campaign_id = ? AND user_id = ? ORDER BY created_at DESC"
    ).bind(campaignId, auth.user.id).all();
    return adJson({ entries: rows.results || [] });
  } catch { return adJson({ error: "DRAW_ENTRIES_UNAVAILABLE" }, 503); }
}

export async function onRequestPost({ request, env }) {
  const auth = await requireDrawUser({ request, env, write: true });
  if (auth.response) return auth.response;
  const rate = await checkDrawRate({ db: env.DB, request, action: "entry", limit: 5 });
  if (rate.response) return rate.response;
  const parsed = await readAdsJson(request, 2048);
  if (parsed.error) return adJson({ error: parsed.error }, parsed.error === "BODY_TOO_LARGE" ? 413 : 400);
  const campaignId = typeof parsed.body.campaignId === "string" ? parsed.body.campaignId.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(campaignId)) return adJson({ error: "INVALID_CAMPAIGN_ID" }, 400);

  const now = new Date().toISOString();
  const entryId = crypto.randomUUID();
  const ticketCode = crypto.randomUUID().replace(/-/g, "").toUpperCase();
  try {
    const inserted = await env.DB.prepare(
      "INSERT INTO draw_entries (id, campaign_id, user_id, ticket_code, entry_status, created_at) " +
      "SELECT ?, c.id, ?, ?, 'eligible', ? FROM draw_campaigns c " +
      "WHERE c.id = ? AND c.draw_mode = 'free_promotional' AND c.entry_fee_minor = 0 " +
      "AND c.paid_entry_enabled = 0 AND c.status = 'open' " +
      "AND (c.starts_at IS NULL OR c.starts_at <= ?) AND (c.ends_at IS NULL OR c.ends_at > ?) " +
      "AND (SELECT COUNT(*) FROM draw_entries e WHERE e.campaign_id = c.id AND e.entry_status = 'eligible') < c.max_entries " +
      "AND (SELECT COUNT(*) FROM draw_entries e WHERE e.campaign_id = c.id AND e.user_id = ? AND e.entry_status = 'eligible') < c.entries_per_user"
    ).bind(entryId, auth.user.id, ticketCode, now, campaignId, now, now, auth.user.id).run();

    if (inserted.meta?.changes === 1) {
      return adJson({ accepted: true, entry: { id: entryId, campaignId, ticketCode, status: "eligible" }, paidEntry: false }, 201);
    }
    const existing = await env.DB.prepare(
      "SELECT id, ticket_code, entry_status FROM draw_entries WHERE campaign_id = ? AND user_id = ? AND entry_status = 'eligible' LIMIT 1"
    ).bind(campaignId, auth.user.id).first();
    if (existing) return adJson({ accepted: true, duplicate: true, entry: { id: existing.id, ticketCode: existing.ticket_code, status: existing.entry_status } });
    const campaign = await env.DB.prepare("SELECT status, max_entries, ends_at FROM draw_campaigns WHERE id = ?").bind(campaignId).first();
    if (!campaign) return adJson({ error: "DRAW_NOT_FOUND" }, 404);
    if (campaign.status !== "open") return adJson({ error: "DRAW_NOT_OPEN" }, 409);
    return adJson({ error: "DRAW_ENTRY_UNAVAILABLE", message: "ظرفیت دوره تکمیل شده یا زمان ثبت‌نام به پایان رسیده است." }, 409);
  } catch { return adJson({ error: "DRAW_ENTRY_FAILED" }, 503); }
}
