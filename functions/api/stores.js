import { authJson } from "./_lib/auth-flow.js";

const clamp = (value, min, max) => Math.max(min, Math.min(max, value));
const escapeLike = (value) => value.replace(/[\\%_]/g, "\\$&");
const distanceKm = (aLat, aLon, bLat, bLon) => {
  const radians = (value) => value * Math.PI / 180;
  const dLat = radians(bLat - aLat);
  const dLon = radians(bLon - aLon);
  const x = Math.sin(dLat / 2) ** 2 +
    Math.cos(radians(aLat)) * Math.cos(radians(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
};

export async function onRequestGet({ request, env }) {
  if (!env.DB) return authJson({ error: "CATALOG_UNAVAILABLE" }, 503);
  const url = new URL(request.url);
  const query = (url.searchParams.get("q") || "").trim().slice(0, 80);
  const city = (url.searchParams.get("city") || "").trim().slice(0, 80);
  const region = (url.searchParams.get("region") || "").trim().slice(0, 80);
  const mode = (url.searchParams.get("mode") || "").trim().toLowerCase();
  const limit = clamp(Number.parseInt(url.searchParams.get("limit") || "30", 10) || 30, 1, 50);
  const offset = clamp(Number.parseInt(url.searchParams.get("offset") || "0", 10) || 0, 0, 10000);
  const latRaw = url.searchParams.get("lat");
  const lonRaw = url.searchParams.get("lon");
  const lat = latRaw === null ? null : Number(latRaw);
  const lon = lonRaw === null ? null : Number(lonRaw);
  if (mode && !["delivery", "pickup"].includes(mode)) return authJson({ error: "INVALID_FULFILLMENT_MODE" }, 400);
  if ((latRaw === null) !== (lonRaw === null) ||
      (latRaw !== null && (!Number.isFinite(lat) || lat < -90 || lat > 90 ||
       !Number.isFinite(lon) || lon < -180 || lon > 180))) {
    return authJson({ error: "INVALID_COORDINATES" }, 400);
  }

  const conditions = ["s.status = 'active'", "p.status = 'published'", "p.stock_count > 0"];
  const bindings = [];
  if (query) {
    conditions.push("(p.title LIKE ? ESCAPE '\\' OR p.description LIKE ? ESCAPE '\\' OR s.name LIKE ? ESCAPE '\\')");
    const term = "%" + escapeLike(query) + "%";
    bindings.push(term, term, term);
  }
  if (city) { conditions.push("lower(s.city) = lower(?)"); bindings.push(city); }
  if (region) { conditions.push("lower(s.region) = lower(?)"); bindings.push(region); }
  if (mode === "delivery") conditions.push("s.offers_delivery = 1");
  if (mode === "pickup") conditions.push("s.offers_pickup = 1");
  let orderBy = "p.updated_at DESC";
  if (lat !== null) {
    // Coarse geographic ordering in SQL ensures nearby candidates enter the capped result set.
    // Exact Haversine distances are calculated and sorted below.
    orderBy = "CASE WHEN s.latitude IS NULL OR s.longitude IS NULL THEN 1 ELSE 0 END, " +
      "((s.latitude - ?) * (s.latitude - ?) + ((s.longitude - ?) * (s.longitude - ?)) * ?) ASC, p.updated_at DESC";
    const longitudeScale = Math.cos(lat * Math.PI / 180) ** 2;
    bindings.push(lat, lat, lon, lon, longitudeScale);
  }
  bindings.push(limit, offset);

  try {
    const result = await env.DB.prepare(
      "SELECT p.id AS productId, p.title, p.description, p.category, p.price_minor AS priceMinor, " +
      "p.currency_code AS currency, p.stock_count AS stockCount, p.updated_at AS productUpdatedAt, " +
      "s.id AS storeId, s.name AS storeName, s.slug AS storeSlug, s.city, s.region, " +
      "s.public_address AS publicAddress, s.latitude, s.longitude, " +
      "s.offers_delivery AS offersDelivery, s.offers_pickup AS offersPickup, " +
      "s.contact_phone AS contactPhone, s.order_url AS orderUrl " +
      "FROM products p JOIN merchant_stores s ON s.id = p.store_id WHERE " +
      conditions.join(" AND ") + " ORDER BY " + orderBy + " LIMIT ? OFFSET ?"
    ).bind(...bindings).all();
    const rows = Array.isArray(result.results) ? result.results : [];
    const products = rows.map((row) => {
      const distanceKmValue = lat === null || row.latitude === null || row.longitude === null
        ? null : Math.round(distanceKm(lat, lon, row.latitude, row.longitude) * 10) / 10;
      return { ...row, distanceKm: distanceKmValue };
    });
    if (lat !== null) products.sort((a, b) => {
      if (a.distanceKm === null) return 1;
      if (b.distanceKm === null) return -1;
      return a.distanceKm - b.distanceKm;
    });
    return authJson({ products, count: products.length, limit, offset, hasMore: products.length === limit, locationUsedForThisSearch: lat !== null });
  } catch {
    return authJson({ error: "CATALOG_UNAVAILABLE" }, 503);
  }
}
