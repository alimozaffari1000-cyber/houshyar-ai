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
      "SELECT p.id, p.title, p.slug, p.description, p.category, p.price_minor AS priceMinor, p.currency_code AS currency, p.stock_count AS stockCount, p.status, p.created_at AS createdAt, p.updated_at AS updatedAt, " +
      "(SELECT pm.id FROM product_media pm WHERE pm.product_id = p.id ORDER BY pm.sort_order ASC, pm.created_at ASC LIMIT 1) AS primaryMediaId " +
      "FROM products p WHERE p.store_id = ? ORDER BY p.updated_at DESC LIMIT 100"
    ).bind(store.id).all();
    return authJson({ authenticated: true, store, products: Array.isArray(result.results) ? result.results : [] });
  } catch {
    return authJson({ error: "STORE_DASHBOARD_UNAVAILABLE" }, 503);
  }
}
