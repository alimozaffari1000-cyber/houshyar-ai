import { marketJson, requireMarketUser } from "../_lib/marketplace.js";
export async function onRequestGet({ request, env }) {
  const auth = await requireMarketUser(request, env);
  if (auth.response) return auth.response;
  try {
    const result = await env.DB.prepare("SELECT id, country_code, name, slug, description, city, status, created_at FROM marketplace_stores WHERE owner_user_id = ? ORDER BY created_at DESC LIMIT 50").bind(auth.user.id).all();
    return marketJson({ stores: result.results || [] });
  } catch { return marketJson({ error: "SELLER_STORES_UNAVAILABLE" }, 503); }
}
