import { originAllowed } from "../_lib/auth.js";
import { MARKET_CATEGORIES, MARKET_CURRENCIES, marketJson, validCountry, cleanText, readMarketBody, requireMarketUser, enforceMarketWriteLimit } from "../_lib/marketplace.js";
export async function onRequestGet({ request, env }) {
  if (!env.DB) return marketJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  const url = new URL(request.url), country = (url.searchParams.get("country") || "").toUpperCase();
  if (!validCountry(country)) return marketJson({ error: "INVALID_COUNTRY" }, 400);
  const category = url.searchParams.get("category") || "";
  if (category && !MARKET_CATEGORIES.has(category)) return marketJson({ error: "INVALID_CATEGORY" }, 400);
  const city = url.searchParams.get("city")?.trim().slice(0, 100) || "", search = url.searchParams.get("q")?.trim().slice(0, 80) || "";
  const limit = Math.min(30, Math.max(1, Number(url.searchParams.get("limit")) || 20));
  const clauses = ["l.country_code = ?", "l.status = 'published'", "s.status = 'active'"], bindings = [country];
  if (category) { clauses.push("l.category = ?"); bindings.push(category); }
  if (city) { clauses.push("l.city = ?"); bindings.push(city); }
  if (search) { clauses.push("(l.title LIKE ? ESCAPE '\\' OR l.description LIKE ? ESCAPE '\\')"); const term = "%" + search.replace(/[\\%_]/g, "\\$&") + "%"; bindings.push(term, term); }
  bindings.push(limit);
  try {
    const sql = "SELECT l.id, l.country_code, l.category, l.title, l.description, l.city, l.price_amount, l.currency_code, l.listing_type, l.created_at, s.id AS store_id, s.name AS store_name, s.slug AS store_slug, (SELECT group_concat(i.id, ',') FROM marketplace_listing_images li JOIN marketplace_images i ON i.id = li.image_id WHERE li.listing_id = l.id AND i.status = 'ready') AS image_ids FROM marketplace_listings l JOIN marketplace_stores s ON s.id = l.store_id WHERE " + clauses.join(" AND ") + " ORDER BY l.created_at DESC LIMIT ?";
    const result = await env.DB.prepare(sql).bind(...bindings).all(); const listings = (result.results || []).map(item => { const images = item.image_ids ? item.image_ids.split(',').slice(0, 6) : []; const { image_ids, ...listing } = item; return { ...listing, images }; }); return marketJson({ country, listings });
  } catch { return marketJson({ error: "MARKET_READ_FAILED" }, 503); }
}
export async function onRequestPost({ request, env }) {
  if (!originAllowed(request)) return marketJson({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const auth = await requireMarketUser(request, env); if (auth.response) return auth.response;
  const parsed = await readMarketBody(request); if (parsed.error) return marketJson({ error: parsed.error }, parsed.status);
  const body = parsed.body, country = typeof body.country === "string" ? body.country.toUpperCase() : "";
  const storeId = typeof body.storeId === "string" ? body.storeId : "", category = typeof body.category === "string" ? body.category : "";
  const title = cleanText(body.title, 4, 120), description = cleanText(body.description, 10, 3000), city = cleanText(body.city, 2, 100);
  const listingType = body.listingType === "wanted" ? "wanted" : "offer", price = body.price === "" || body.price === null || body.price === undefined ? null : Number(body.price);
  const imageIds = Array.isArray(body.imageIds) ? body.imageIds : [];
  if (imageIds.length > 6 || imageIds.some(id => typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) || new Set(imageIds).size !== imageIds.length) return marketJson({ error: "INVALID_IMAGE_IDS" }, 400);
  if (!validCountry(country) || !storeId || storeId.length > 64 || !MARKET_CATEGORIES.has(category) || !title || !description || !city) return marketJson({ error: "INVALID_LISTING_DATA" }, 400);
  if (price !== null && (!Number.isSafeInteger(price) || price < 0)) return marketJson({ error: "INVALID_PRICE" }, 400);
  try {
    const store = await env.DB.prepare("SELECT id FROM marketplace_stores WHERE id = ? AND owner_user_id = ? AND country_code = ? AND status IN ('pending','active') LIMIT 1").bind(storeId, auth.user.id, country).first();
    if (!store) return marketJson({ error: "STORE_NOT_FOUND_OR_NOT_OWNED" }, 404);
    if (await enforceMarketWriteLimit(env.DB, auth.user.id, "listing")) return marketJson({ error: "RATE_LIMITED" }, 429);
    const id = crypto.randomUUID(), now = Math.floor(Date.now() / 1000);
    if (imageIds.length) {
      const placeholders = imageIds.map(() => "?").join(",");
      const owned = await env.DB.prepare("SELECT id FROM marketplace_images WHERE owner_user_id = ? AND store_id = ? AND country_code = ? AND status = 'ready' AND id IN (" + placeholders + ")").bind(auth.user.id, storeId, country, ...imageIds).all();
      if ((owned.results || []).length !== imageIds.length) return marketJson({ error: "IMAGE_NOT_OWNED_OR_INVALID" }, 403);
    }
    await env.DB.prepare("INSERT INTO marketplace_listings (id, store_id, owner_user_id, country_code, category, title, description, city, price_amount, currency_code, listing_type, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?)").bind(id, storeId, auth.user.id, country, category, title, description, city, price, MARKET_CURRENCIES[country], listingType, now, now).run();
    for (let index = 0; index < imageIds.length; index++) await env.DB.prepare("INSERT INTO marketplace_listing_images (listing_id, image_id, sort_order) VALUES (?, ?, ?)").bind(id, imageIds[index], index).run();
    return marketJson({ accepted: true, listing: { id, country, category, title, city, price, currency: MARKET_CURRENCIES[country], status: "pending" } }, 201);
  } catch { return marketJson({ error: "LISTING_CREATE_FAILED" }, 503); }
}
