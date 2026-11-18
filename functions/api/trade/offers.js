import { getSessionUser, originAllowed } from "../_lib/auth.js";
import { authJson, readAuthBody, enforceAuthRateLimit } from "../_lib/auth-flow.js";
import { getCurrencyDefinition } from "../../../src/payments/money.js";

const text = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function onRequestGet({ request, env }) {
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  const user = await getSessionUser(env.DB, request);
  if (!user) return authJson({ error: "AUTH_REQUIRED" }, 401);
  const url = new URL(request.url);
  const requestId = text(url.searchParams.get("requestId"), 80);
  try {
    if (requestId) {
      const ownRequest = await env.DB.prepare(
        "SELECT id FROM trade_purchase_requests WHERE id = ? AND buyer_user_id = ? LIMIT 1"
      ).bind(requestId, user.id).first();
      if (!ownRequest) return authJson({ error: "REQUEST_NOT_FOUND" }, 404);
      const result = await env.DB.prepare(
        "SELECT o.id, o.revision, o.unit_price_minor AS unitPriceMinor, o.currency_code AS currency, " +
        "o.minimum_quantity AS minimumQuantity, o.lead_time_days AS leadTimeDays, " +
        "o.delivery_terms AS deliveryTerms, o.note, o.status, o.created_at AS createdAt, " +
        "s.name AS supplierName, s.city AS supplierCity, s.country_code AS supplierCountryCode " +
        "FROM trade_supplier_offers o JOIN merchant_stores s ON s.id = o.supplier_store_id " +
        "WHERE o.request_id = ? ORDER BY o.created_at DESC, o.revision DESC LIMIT 100"
      ).bind(requestId).all();
      return authJson({ offers: Array.isArray(result.results) ? result.results : [], view: "buyer" });
    }
    const store = await env.DB.prepare(
      "SELECT id, status FROM merchant_stores WHERE user_id = ? LIMIT 1"
    ).bind(user.id).first();
    if (!store || store.status !== "active") return authJson({ error: "ACTIVE_STORE_REQUIRED" }, 403);
    const result = await env.DB.prepare(
      "SELECT o.id, o.request_id AS requestId, o.revision, o.unit_price_minor AS unitPriceMinor, " +
      "o.currency_code AS currency, o.minimum_quantity AS minimumQuantity, o.lead_time_days AS leadTimeDays, " +
      "o.delivery_terms AS deliveryTerms, o.note, o.status, o.created_at AS createdAt " +
      "FROM trade_supplier_offers o WHERE o.supplier_store_id = ? ORDER BY o.created_at DESC LIMIT 100"
    ).bind(store.id).all();
    return authJson({ offers: Array.isArray(result.results) ? result.results : [], view: "supplier" });
  } catch {
    return authJson({ error: "TRADE_OFFERS_UNAVAILABLE" }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  if (!originAllowed(request)) return authJson({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const user = await getSessionUser(env.DB, request);
  if (!user) return authJson({ error: "AUTH_REQUIRED" }, 401);
  const limited = await enforceAuthRateLimit({ env, request, action: "trade-offer-create", email: user.email, limit: 20 });
  if (limited) return limited;
  const parsed = await readAuthBody(request);
  if (parsed.error) return authJson({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  const requestId = text(body.requestId, 80);
  const unitPriceMinor = Number(body.unitPriceMinor);
  const currency = typeof body.currency === "string" ? body.currency.trim().toUpperCase() : "";
  const minimumQuantity = body.minimumQuantity === undefined ? 1 : Number(body.minimumQuantity);
  const leadTimeDays = body.leadTimeDays === undefined ? 0 : Number(body.leadTimeDays);
  const deliveryTerms = text(body.deliveryTerms, 500);
  const note = text(body.note, 1000);
  if (!requestId) return authJson({ error: "REQUEST_ID_REQUIRED" }, 400);
  if (!Number.isSafeInteger(unitPriceMinor) || unitPriceMinor < 1) return authJson({ error: "INVALID_UNIT_PRICE" }, 400);
  if (!getCurrencyDefinition(currency)) return authJson({ error: "UNSUPPORTED_CURRENCY" }, 400);
  if (!Number.isSafeInteger(minimumQuantity) || minimumQuantity < 1 || minimumQuantity > 1000000) return authJson({ error: "INVALID_MINIMUM_QUANTITY" }, 400);
  if (!Number.isSafeInteger(leadTimeDays) || leadTimeDays < 0 || leadTimeDays > 365) return authJson({ error: "INVALID_LEAD_TIME" }, 400);
  try {
    const store = await env.DB.prepare(
      "SELECT id, status, country_code AS countryCode FROM merchant_stores WHERE user_id = ? LIMIT 1"
    ).bind(user.id).first();
    if (!store || store.status !== "active") return authJson({ error: "ACTIVE_STORE_REQUIRED" }, 403);
    const rfq = await env.DB.prepare(
      "SELECT id, buyer_user_id AS buyerUserId, country_code AS countryCode, category, quantity, " +
      "currency_code AS currency, status, expires_at AS expiresAt, supplier_visible AS supplierVisible " +
      "FROM trade_purchase_requests WHERE id = ? LIMIT 1"
    ).bind(requestId).first();
    if (!rfq || rfq.status !== "open" || rfq.expiresAt <= Math.floor(Date.now() / 1000)) {
      return authJson({ error: "REQUEST_NOT_OPEN" }, 404);
    }
    if (rfq.buyerUserId === user.id) return authJson({ error: "BUYER_CANNOT_OFFER_ON_OWN_REQUEST" }, 403);
    if (!rfq.supplierVisible) return authJson({ error: "REQUEST_NOT_SHARED_WITH_SUPPLIERS" }, 403);
    if (rfq.countryCode !== (store.countryCode ?? null)) return authJson({ error: "COUNTRY_SCOPE_MISMATCH" }, 403);
    if (rfq.countryCode) {
      const market = await env.DB.prepare(
        "SELECT country_code FROM country_market_configs WHERE country_code = ? AND status = 'live' LIMIT 1"
      ).bind(rfq.countryCode).first();
      if (!market) return authJson({ error: "COUNTRY_MARKET_NOT_LIVE" }, 403);
    }
    if (minimumQuantity > rfq.quantity) return authJson({ error: "MINIMUM_EXCEEDS_REQUEST_QUANTITY" }, 400);
    if (rfq.currency && rfq.currency !== currency) return authJson({ error: "OFFER_CURRENCY_MISMATCH" }, 400);
    const matchingProduct = await env.DB.prepare(
      "SELECT p.id FROM products p WHERE p.store_id = ? AND p.status = 'published' AND p.category = ? LIMIT 1"
    ).bind(store.id, rfq.category).first();
    if (!matchingProduct) return authJson({ error: "PUBLISHED_MATCHING_PRODUCT_REQUIRED" }, 403);

    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    await env.DB.batch([
      env.DB.prepare(
        "UPDATE trade_supplier_offers SET status = 'superseded' WHERE request_id = ? AND supplier_store_id = ? AND status = 'submitted'"
      ).bind(requestId, store.id),
      env.DB.prepare(
        "INSERT INTO trade_supplier_offers (id, request_id, supplier_store_id, revision, unit_price_minor, currency_code, minimum_quantity, lead_time_days, delivery_terms, note, status, created_at) " +
        "SELECT ?, ?, ?, COALESCE(MAX(revision), 0) + 1, ?, ?, ?, ?, ?, ?, 'submitted', ? " +
        "FROM trade_supplier_offers WHERE request_id = ? AND supplier_store_id = ?"
      ).bind(id, requestId, store.id, unitPriceMinor, currency, minimumQuantity, leadTimeDays, deliveryTerms, note, now, requestId, store.id)
    ]);
    const created = await env.DB.prepare(
      "SELECT revision FROM trade_supplier_offers WHERE id = ? LIMIT 1"
    ).bind(id).first();
    if (!created) return authJson({ error: "OFFER_CREATE_UNAVAILABLE" }, 503);
    return authJson({ created: true, offer: { id, requestId, revision: created.revision, unitPriceMinor, currency, minimumQuantity, leadTimeDays, deliveryTerms, note, status: "submitted", createdAt: now } }, 201);
  } catch {
    return authJson({ error: "TRADE_OFFER_CREATE_UNAVAILABLE" }, 503);
  }
}
