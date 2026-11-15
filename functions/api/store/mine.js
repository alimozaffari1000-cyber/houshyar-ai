import { getSessionUser } from "../_lib/auth.js";
import { authJson } from "../_lib/auth-flow.js";

export async function onRequestGet({ request, env }) {
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  const user = await getSessionUser(env.DB, request);
  if (!user) return authJson({ error: "AUTH_REQUIRED" }, 401);
  try {
    const store = await env.DB.prepare(
      "SELECT id, name, slug, description, status, city, region, public_address AS publicAddress, latitude, longitude, " +
      "offers_delivery AS offersDelivery, offers_pickup AS offersPickup, contact_phone AS contactPhone, order_url AS orderUrl, " +
      "created_at AS createdAt, updated_at AS updatedAt FROM merchant_stores WHERE user_id = ? LIMIT 1"
    ).bind(user.id).first();
    if (!store) return authJson({ authenticated: true, store: null, products: [] });
    const result = await env.DB.prepare(
      "SELECT id, title, slug, description, category, price_minor AS priceMinor, currency_code AS currency, stock_count AS stockCount, status, created_at AS createdAt, updated_at AS updatedAt FROM products WHERE store_id = ? ORDER BY updated_at DESC LIMIT 100"
    ).bind(store.id).all();
    return authJson({ authenticated: true, store, products: Array.isArray(result.results) ? result.results : [] });
  } catch {
    return authJson({ error: "STORE_DASHBOARD_UNAVAILABLE" }, 503);
  }
}
