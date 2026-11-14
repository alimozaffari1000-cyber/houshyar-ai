import { originAllowed } from "../_lib/auth.js";
import { marketJson, validCountry, cleanText, readMarketBody, requireMarketUser, enforceMarketWriteLimit, validSlug } from "../_lib/marketplace.js";
export async function onRequestGet({ request, env }) {
  if (!env.DB) return marketJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  const url = new URL(request.url), country = (url.searchParams.get("country") || "").toUpperCase();
  if (!validCountry(country)) return marketJson({ error: "INVALID_COUNTRY" }, 400);
  const city = url.searchParams.get("city")?.trim().slice(0, 100) || "", limit = Math.min(30, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  try {
    const query = city
      ? env.DB.prepare("SELECT id, country_code, name, slug, description, city, created_at FROM marketplace_stores WHERE country_code = ? AND city = ? AND status = 'active' ORDER BY created_at DESC LIMIT ?").bind(country, city, limit)
      : env.DB.prepare("SELECT id, country_code, name, slug, description, city, created_at FROM marketplace_stores WHERE country_code = ? AND status = 'active' ORDER BY created_at DESC LIMIT ?").bind(country, limit);
    const result = await query.all(); return marketJson({ country, stores: result.results || [] });
  } catch { return marketJson({ error: "MARKET_READ_FAILED" }, 503); }
}
export async function onRequestPost({ request, env }) {
  if (!originAllowed(request)) return marketJson({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const auth = await requireMarketUser(request, env); if (auth.response) return auth.response;
  const parsed = await readMarketBody(request); if (parsed.error) return marketJson({ error: parsed.error }, parsed.status);
  const body = parsed.body, country = typeof body.country === "string" ? body.country.toUpperCase() : "";
  const name = cleanText(body.name, 2, 100), slug = typeof body.slug === "string" ? body.slug.trim().toLowerCase() : "";
  const city = cleanText(body.city, 2, 100), description = typeof body.description === "string" ? body.description.trim() : "";
  if (!validCountry(country) || !name || !city || description.length > 1200 || !validSlug(slug)) return marketJson({ error: "INVALID_STORE_DATA" }, 400);
  try {
    if (await enforceMarketWriteLimit(env.DB, auth.user.id, "store")) return marketJson({ error: "RATE_LIMITED" }, 429);
    const id = crypto.randomUUID(), now = Math.floor(Date.now() / 1000);
    await env.DB.prepare("INSERT INTO marketplace_stores (id, owner_user_id, country_code, name, slug, description, city, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)").bind(id, auth.user.id, country, name, slug, description, city, now, now).run();
    return marketJson({ accepted: true, store: { id, country, name, slug, city, status: "pending" } }, 201);
  } catch (error) {
    if (String(error).includes("UNIQUE")) return marketJson({ error: "STORE_NAME_OR_SLUG_TAKEN" }, 409);
    return marketJson({ error: "STORE_CREATE_FAILED" }, 503);
  }
}
