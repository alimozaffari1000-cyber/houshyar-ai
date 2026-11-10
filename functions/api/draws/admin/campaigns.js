import { requireDrawUser, checkDrawRate, adJson, readAdsJson } from "../../_lib/draws.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireDrawUser({ request, env });
  if (auth.response) return auth.response;
  if (auth.user.role !== "admin") return adJson({ error: "ADMIN_REQUIRED" }, 403);
  try {
    const rows = await env.DB.prepare(
      "SELECT c.id, c.title, c.description, c.prize_description, c.status, c.jurisdiction_code, c.starts_at, c.ends_at, c.draw_at, c.max_entries, " +
      "COUNT(CASE WHEN e.entry_status = 'eligible' THEN 1 END) AS eligible_entries, " +
      "COUNT(DISTINCT CASE WHEN e.entry_status = 'eligible' THEN e.user_id END) AS participants, " +
      "(SELECT v.verification_status FROM draw_results r LEFT JOIN draw_result_verifications v ON v.result_id = r.id WHERE r.campaign_id = c.id ORDER BY v.checked_at DESC LIMIT 1) AS verification_status " +
      "FROM draw_campaigns c LEFT JOIN draw_entries e ON e.campaign_id = c.id GROUP BY c.id ORDER BY c.created_at DESC LIMIT 100"
    ).all();
    return adJson({ campaigns: rows.results || [], paidEntryEnabled: false });
  } catch { return adJson({ error: "DRAW_ADMIN_LIST_UNAVAILABLE" }, 503); }
}



export async function onRequestPost({ request, env }) {
  const auth = await requireDrawUser({ request, env, write: true });
  if (auth.response) return auth.response;
  if (auth.user.role !== "admin") return adJson({ error: "ADMIN_REQUIRED" }, 403);
  const rate = await checkDrawRate({ db: env.DB, request, action: "campaign-create", limit: 5 });
  if (rate.response) return rate.response;
  const parsed = await readAdsJson(request, 8192);
  if (parsed.error) return adJson({ error: parsed.error }, 400);
  const b = parsed.body;
  const title = typeof b.title === "string" ? b.title.trim() : "";
  const description = typeof b.description === "string" ? b.description.trim() : "";
  const prize = typeof b.prizeDescription === "string" ? b.prizeDescription.trim() : "";
  const jurisdiction = typeof b.jurisdictionCode === "string" ? b.jurisdictionCode.trim().toUpperCase() : "UNSPECIFIED";
  const currency = typeof b.currencyCode === "string" ? b.currencyCode.trim().toUpperCase() : "USD";
  const maxEntries = b.maxEntries === undefined ? 10000 : b.maxEntries;
  const entriesPerUser = b.entriesPerUser === undefined ? 1 : b.entriesPerUser;
  const startsAt = b.startsAt ?? null;
  const endsAt = b.endsAt ?? null;
  const drawAt = b.drawAt ?? null;
  const validDate = value => value === null || (typeof value === "string" && !Number.isNaN(Date.parse(value)) && value === new Date(value).toISOString());
  if (title.length < 3 || title.length > 120 || description.length > 3000 || prize.length < 2 || prize.length > 500 ||
      !/^[A-Z0-9_-]{2,16}$/.test(jurisdiction) || !/^[A-Z]{3}$/.test(currency) ||
      !Number.isInteger(maxEntries) || maxEntries < 1 || maxEntries > 1000000 ||
      !Number.isInteger(entriesPerUser) || entriesPerUser !== 1 ||
      !validDate(startsAt) || !validDate(endsAt) || !validDate(drawAt) || !endsAt || !drawAt ||
      (startsAt && endsAt && endsAt <= startsAt) || (endsAt && drawAt && drawAt < endsAt)) {
    return adJson({ error: "INVALID_DRAW_CAMPAIGN" }, 400);
  }
  const id = crypto.randomUUID();
  const now = new Date().toISOString();
  try {
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO draw_campaigns (id, title, description, draw_mode, status, jurisdiction_code, currency_code, prize_description, starts_at, ends_at, draw_at, max_entries, entries_per_user, entry_fee_minor, paid_entry_enabled, rules_version, created_by, created_at, updated_at) " +
        "VALUES (?, ?, ?, 'free_promotional', 'draft', ?, ?, ?, ?, ?, ?, ?, 1, 0, 0, '1.0', ?, ?, ?)"
      ).bind(id, title, description, jurisdiction, currency, prize, startsAt, endsAt, drawAt, maxEntries, auth.user.id, now, now),
      env.DB.prepare("INSERT INTO draw_audit_events (id, campaign_id, actor_user_id, event_type, event_payload_json, created_at) VALUES (?, ?, ?, 'campaign_created', ?, ?)")
        .bind(crypto.randomUUID(), id, auth.user.id, JSON.stringify({ title, jurisdiction, maxEntries, entriesPerUser: 1, paidEntryEnabled: false }), now)
    ]);
    return adJson({ created: true, campaign: { id, title, status: "draft", drawMode: "free_promotional" }, paidEntryEnabled: false }, 201);
  } catch { return adJson({ error: "DRAW_CAMPAIGN_CREATE_FAILED" }, 503); }
}
