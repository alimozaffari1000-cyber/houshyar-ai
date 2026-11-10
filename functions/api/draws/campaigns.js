import { adJson } from "../_lib/draws.js";

export async function onRequestGet({ request, env }) {
  if (env.DRAW_MODULE_ENABLED !== "true" || !env.DB) {
    return adJson({ error: "DRAWS_NOT_CONFIGURED", message: "سامانه قرعه‌کشی هنوز فعال نشده است." }, 503);
  }
  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (id && !/^[0-9a-f-]{36}$/i.test(id)) return adJson({ error: "INVALID_CAMPAIGN_ID" }, 400);
  try {
    const where = id ? "WHERE c.id = ?" : "WHERE c.status IN ('open','closed','drawn')";
    const stmt = env.DB.prepare(
      "SELECT c.id, c.title, c.description, c.jurisdiction_code, c.currency_code, c.prize_description, " +
      "c.starts_at, c.ends_at, c.draw_at, c.max_entries, c.entries_per_user, " +
      "CASE WHEN c.status = 'open' AND c.ends_at IS NOT NULL AND c.ends_at <= ? THEN 'closed' ELSE c.status END AS status, c.rules_version, " +
      "COUNT(CASE WHEN e.entry_status = 'eligible' THEN 1 END) AS eligible_entries, " +
      "COUNT(DISTINCT CASE WHEN e.entry_status = 'eligible' THEN e.user_id END) AS participants " +
      "FROM draw_campaigns c LEFT JOIN draw_entries e ON e.campaign_id = c.id " +
      where + " GROUP BY c.id ORDER BY c.draw_at ASC LIMIT 100"
    );
    const now = new Date().toISOString();
    const rows = id ? await stmt.bind(now, id).all() : await stmt.bind(now).all();
    return adJson({ campaigns: rows.results || [], paidEntryEnabled: false });
  } catch { return adJson({ error: "DRAW_CAMPAIGNS_UNAVAILABLE" }, 503); }
}
