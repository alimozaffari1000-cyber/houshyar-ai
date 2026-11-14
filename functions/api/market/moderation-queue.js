import { marketJson, requireMarketUser, validCountry } from "../_lib/marketplace.js";

export async function onRequestGet({ request, env }) {
  const auth = await requireMarketUser(request, env);
  if (auth.response) return auth.response;
  if (auth.user.role !== "admin") return marketJson({ error: "ADMIN_REQUIRED" }, 403);

  const url = new URL(request.url);
  const country = (url.searchParams.get("country") || "").toUpperCase();
  if (!validCountry(country)) return marketJson({ error: "INVALID_COUNTRY" }, 400);

  try {
    const [stores, listings] = await Promise.all([
      env.DB.prepare("SELECT id, country_code, name, slug, description, city, created_at FROM marketplace_stores WHERE country_code = ? AND status = 'pending' ORDER BY created_at ASC LIMIT 50").bind(country).all(),
      env.DB.prepare("SELECT l.id, l.country_code, l.category, l.title, l.description, l.city, l.price_amount, l.currency_code, l.listing_type, l.created_at, s.name AS store_name FROM marketplace_listings l JOIN marketplace_stores s ON s.id = l.store_id WHERE l.country_code = ? AND l.status = 'pending' ORDER BY l.created_at ASC LIMIT 50").bind(country).all()
    ]);
    return marketJson({ country, stores: stores.results || [], listings: listings.results || [] });
  } catch {
    return marketJson({ error: "MODERATION_QUEUE_UNAVAILABLE" }, 503);
  }
}
