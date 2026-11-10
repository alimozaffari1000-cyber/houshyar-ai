import { adJson, safeHttpsUrl } from "../_lib/ads.js";

const SLOT_KEY = /^[a-z][a-z0-9_]{2,40}$/;

export async function onRequestGet({ request, env }) {
  if (env.ADS_MARKETPLACE_ENABLED !== "true" || env.ADS_PUBLIC_DELIVERY_ENABLED !== "true" || !env.DB) {
    return adJson({ ads: [], enabled: false });
  }
  const url = new URL(request.url);
  const slot = url.searchParams.get("slot") || "";
  if (!SLOT_KEY.test(slot)) return adJson({ error: "INVALID_AD_SLOT" }, 400);
  try {
    const slotRow = await env.DB.prepare("SELECT max_items FROM ad_slots WHERE slot_key = ? AND enabled = 1 LIMIT 1").bind(slot).first();
    if (!slotRow) return adJson({ ads: [], enabled: true });
    const now = Math.floor(Date.now() / 1000);
    const rows = await env.DB.prepare(
      "SELECT id, title, creative_payload, destination_url, pricing_model FROM ad_campaigns " +
      "WHERE status = 'approved' AND (budget_minor > 0 OR pricing_model = 'barter') " +
      "AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at > ?) " +
      "ORDER BY created_at DESC LIMIT ?"
    ).bind(now, now, Math.max(1, Math.min(5, Number(slotRow.max_items) || 1))).all();
    const ads = (rows.results || []).flatMap(row => {
      const destinationUrl = safeHttpsUrl(row.destination_url);
      if (!destinationUrl) return [];
      let creative = {};
      try { creative = JSON.parse(row.creative_payload || "{}"); } catch { return []; }
      const description = typeof creative.description === "string" ? creative.description.slice(0, 500) : "";
      const isBarter = row.pricing_model === "barter";
      return [{
        id: row.id,
        title: row.title,
        description,
        destinationUrl,
        pricingModel: isBarter ? "barter" : row.pricing_model,
        label: isBarter ? "تبادل تبلیغاتی" : "تبلیغ حمایت‌شده"
      }];
    });
    return adJson({ ads, enabled: true, slot });
  } catch { return adJson({ error: "AD_DELIVERY_UNAVAILABLE" }, 503); }
}
