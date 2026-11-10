import { requireDrawUser, checkDrawRate, adJson, readAdsJson } from "../../_lib/draws.js";

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
      !validDate(startsAt) || !validDate(endsAt) || !validDate(drawAt) ||
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
