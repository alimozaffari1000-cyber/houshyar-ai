import { getSessionUser, originAllowed } from "../_lib/auth.js";
import { authJson, readAuthBody, enforceAuthRateLimit } from "../_lib/auth-flow.js";
import { getCurrencyDefinition } from "../../../src/payments/money.js";

const slugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export async function onRequestGet({ request, env }) {
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  const user = await getSessionUser(env.DB, request);
  if (!user) return authJson({ error: "AUTH_REQUIRED" }, 401);
  const url = new URL(request.url);
  const view = url.searchParams.get("view") || "mine";
  try {
    if (view === "matches") {
      const store = await env.DB.prepare(
        "SELECT id, country_code AS countryCode, user_id AS userId, status FROM merchant_stores WHERE user_id = ? LIMIT 1"
      ).bind(user.id).first();
      if (!store || store.status !== "active") return authJson({ error: "ACTIVE_STORE_REQUIRED" }, 403);
      const rows = await env.DB.prepare(
        "SELECT r.id, r.country_code AS countryCode, r.city, r.title, r.description, r.category, r.quantity, r.unit, r.target_price_minor AS targetPriceMinor, r.currency_code AS currency, r.expires_at AS expiresAt, r.created_at AS createdAt " +
        "FROM trade_purchase_requests r WHERE r.status = 'open' AND r.supplier_visible = 1 AND r.expires_at > ? AND r.buyer_user_id != ? " +
        "AND r.country_code IS ? AND (r.country_code IS NULL OR EXISTS (SELECT 1 FROM country_market_configs cm WHERE cm.country_code = r.country_code AND cm.status = 'live')) " +
        "AND EXISTS (SELECT 1 FROM products p WHERE p.store_id = ? AND p.status IN ('draft','published') AND p.category = r.category) " +
        "ORDER BY r.created_at DESC LIMIT 50"
      ).bind(Math.floor(Date.now() / 1000), user.id, store.countryCode ?? null, store.id).all();
      return authJson({ requests: Array.isArray(rows.results) ? rows.results : [], view: "matches" });
    }
    if (view !== "mine") return authJson({ error: "INVALID_REQUEST_VIEW" }, 400);
    const rows = await env.DB.prepare(
      "SELECT id, country_code AS countryCode, city, title, description, category, quantity, unit, target_price_minor AS targetPriceMinor, currency_code AS currency, status, expires_at AS expiresAt, created_at AS createdAt, updated_at AS updatedAt " +
      "FROM trade_purchase_requests WHERE buyer_user_id = ? ORDER BY created_at DESC LIMIT 50"
    ).bind(user.id).all();
    return authJson({ requests: Array.isArray(rows.results) ? rows.results : [], view: "mine" });
  } catch {
    return authJson({ error: "TRADE_REQUESTS_UNAVAILABLE" }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  if (!originAllowed(request)) return authJson({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const user = await getSessionUser(env.DB, request);
  if (!user) return authJson({ error: "AUTH_REQUIRED" }, 401);
  const limited = await enforceAuthRateLimit({ env, request, action: "trade-rfq-create", email: user.email, limit: 10 });
  if (limited) return limited;
  const parsed = await readAuthBody(request);
  if (parsed.error) return authJson({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  const title = typeof body.title === "string" ? body.title.trim() : "";
  const description = typeof body.description === "string" ? body.description.trim() : "";
  const category = typeof body.category === "string" ? body.category.trim().toLowerCase() : "";
  const quantity = Number(body.quantity);
  const unit = typeof body.unit === "string" ? body.unit.trim() : "";
  const countryCode = body.countryCode === undefined || body.countryCode === null || body.countryCode === ""
    ? null : (typeof body.countryCode === "string" ? body.countryCode.trim().toUpperCase() : "");
  const city = typeof body.city === "string" ? body.city.trim() : "";
  const targetPriceMinor = body.targetPriceMinor === undefined || body.targetPriceMinor === null || body.targetPriceMinor === ""
    ? null : Number(body.targetPriceMinor);
  const currency = body.currency === undefined || body.currency === null || body.currency === ""
    ? null : (typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "");
  const expiresInDays = body.expiresInDays === undefined ? 14 : Number(body.expiresInDays);
  const shareWithSuppliers = body.shareWithSuppliers === true;

  if (title.length < 2 || title.length > 160) return authJson({ error: "INVALID_REQUEST_TITLE" }, 400);
  if (description.length > 3000) return authJson({ error: "DESCRIPTION_TOO_LONG" }, 400);
  if (!slugPattern.test(category) || category.length > 60) return authJson({ error: "INVALID_CATEGORY" }, 400);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 1000000) return authJson({ error: "INVALID_QUANTITY" }, 400);
  if (unit.length < 1 || unit.length > 30) return authJson({ error: "INVALID_UNIT" }, 400);
  if (city.length > 80) return authJson({ error: "INVALID_CITY" }, 400);
  if (countryCode !== null && !/^[A-Z]{2}$/.test(countryCode)) return authJson({ error: "INVALID_COUNTRY_CODE" }, 400);
  if (!Number.isSafeInteger(expiresInDays) || expiresInDays < 1 || expiresInDays > 30) return authJson({ error: "INVALID_EXPIRY" }, 400);
  if ((targetPriceMinor === null) !== (currency === null)) return authJson({ error: "PRICE_AND_CURRENCY_REQUIRED_TOGETHER" }, 400);
  if (targetPriceMinor !== null && (!Number.isSafeInteger(targetPriceMinor) || targetPriceMinor < 1)) return authJson({ error: "INVALID_TARGET_PRICE" }, 400);
  if (currency !== null && !getCurrencyDefinition(currency)) return authJson({ error: "UNSUPPORTED_CURRENCY" }, 400);

  try {
    if (countryCode) {
      const market = await env.DB.prepare(
        "SELECT country_code FROM country_market_configs WHERE country_code = ? AND status = 'live' LIMIT 1"
      ).bind(countryCode).first();
      if (!market) return authJson({ error: "COUNTRY_MARKET_NOT_LIVE" }, 403);
    }
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const expiresAt = now + expiresInDays * 86400;
    await env.DB.prepare(
      "INSERT INTO trade_purchase_requests (id, buyer_user_id, country_code, city, title, description, category, quantity, unit, target_price_minor, currency_code, supplier_visible, status, expires_at, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'open', ?, ?, ?)"
    ).bind(id, user.id, countryCode, city, title, description, category, quantity, unit, targetPriceMinor, currency, shareWithSuppliers ? 1 : 0, expiresAt, now, now).run();
    return authJson({ created: true, request: { id, countryCode, city, title, description, category, quantity, unit, targetPriceMinor, currency, shareWithSuppliers, status: "open", expiresAt, createdAt: now } }, 201);
  } catch {
    return authJson({ error: "TRADE_REQUEST_CREATE_UNAVAILABLE" }, 503);
  }
}
