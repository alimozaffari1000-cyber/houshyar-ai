import { requireAdsUser, adJson } from "../_lib/ads.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireAdsUser({ request, env });
  if (auth.response) return auth.response;
  const url = new URL(request.url);
  const campaignId = url.searchParams.get("campaignId");
  if (campaignId && !/^[0-9a-f-]{36}$/i.test(campaignId)) return adJson({ error: "INVALID_CAMPAIGN_ID" }, 400);
  try {
    const where = auth.user.role === "admin"
      ? "1 = 1"
      : "c.advertiser_user_id = ?";
    const binds = auth.user.role === "admin" ? [] : [auth.user.id];
    const filter = campaignId ? " AND c.id = ?" : "";
    const allBinds = campaignId ? [...binds, campaignId] : binds;
    const campaigns = await env.DB.prepare(
      "SELECT c.id, c.title, c.status, c.budget_minor, c.currency_code, c.pricing_model, " +
      "COALESCE(SUM(CASE WHEN e.event_type = 'impression' AND e.validation_status = 'valid' THEN 1 ELSE 0 END), 0) AS valid_impressions, " +
      "COALESCE(SUM(CASE WHEN e.event_type = 'click' AND e.validation_status = 'valid' THEN 1 ELSE 0 END), 0) AS valid_clicks, " +
      "COALESCE(SUM(CASE WHEN e.validation_status IN ('pending','review') THEN 1 ELSE 0 END), 0) AS pending_events, " +
      "COALESCE(SUM(CASE WHEN e.validation_status = 'rejected' THEN 1 ELSE 0 END), 0) AS rejected_events, " +
      "COALESCE((SELECT SUM(s.net_amount_minor) FROM ad_settlements s WHERE s.campaign_id = c.id), 0) AS net_settled_minor " +
      "FROM ad_campaigns c LEFT JOIN ad_events e ON e.campaign_id = c.id " +
      "WHERE " + where + filter + " GROUP BY c.id ORDER BY c.created_at DESC LIMIT 100"
    ).bind(...allBinds).all();
    const rows = (campaigns.results || []).map(row => ({
      ...row,
      valid_impressions: Number(row.valid_impressions || 0),
      valid_clicks: Number(row.valid_clicks || 0),
      pending_events: Number(row.pending_events || 0),
      rejected_events: Number(row.rejected_events || 0),
      net_settled_minor: Number(row.net_settled_minor || 0),
      ctr_percent: Number(row.valid_impressions) > 0
        ? Math.round(Number(row.valid_clicks) * 10000 / Number(row.valid_impressions)) / 100
        : 0,
      reward_pool_minor: Math.floor(Number(row.net_settled_minor || 0) * 500 / 10000)
    }));
    return adJson({ campaigns: rows, settlementSource: "verified_provider_records_only", rewardsIssued: false });
  } catch { return adJson({ error: "AD_ANALYTICS_UNAVAILABLE" }, 503); }
}
