import { getSessionUser, originAllowed } from "../_lib/auth.js";
import { authJson, readAuthBody, enforceAuthRateLimit } from "../_lib/auth-flow.js";

const uuidPattern = /^[0-9a-f-]{36}$/i;
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

export async function onRequestGet({ request, env }) {
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  const user = await getSessionUser(env.DB, request);
  if (!user) return authJson({ error: "AUTH_REQUIRED" }, 401);
  try {
    const [buyer, seller] = await Promise.all([
      env.DB.prepare(
        "SELECT o.id, o.status, o.fulfillment_mode AS fulfillmentMode, o.buyer_note AS buyerNote, o.seller_note AS sellerNote, o.created_at AS createdAt, o.updated_at AS updatedAt, o.accepted_at AS acceptedAt, o.completed_at AS completedAt, s.name AS storeName, i.product_title AS productTitle, i.unit_price_minor AS unitPriceMinor, i.currency_code AS currency, i.quantity FROM marketplace_orders o JOIN merchant_stores s ON s.id = o.store_id JOIN marketplace_order_items i ON i.order_id = o.id WHERE o.buyer_user_id = ? ORDER BY o.created_at DESC LIMIT 50"
      ).bind(user.id).all(),
      env.DB.prepare(
        "SELECT o.id, o.status, o.fulfillment_mode AS fulfillmentMode, o.buyer_note AS buyerNote, o.seller_note AS sellerNote, o.created_at AS createdAt, o.updated_at AS updatedAt, o.accepted_at AS acceptedAt, o.completed_at AS completedAt, s.name AS storeName, i.product_title AS productTitle, i.unit_price_minor AS unitPriceMinor, i.currency_code AS currency, i.quantity FROM marketplace_orders o JOIN merchant_stores s ON s.id = o.store_id JOIN marketplace_order_items i ON i.order_id = o.id WHERE s.user_id = ? ORDER BY o.created_at DESC LIMIT 50"
      ).bind(user.id).all()
    ]);
    const own = Array.isArray(buyer.results) ? buyer.results.map(order => ({ ...order, viewerRole: "buyer" })) : [];
    const incoming = Array.isArray(seller.results) ? seller.results.map(order => ({ ...order, viewerRole: "seller" })) : [];
    const unique = new Map();
    for (const order of [...own, ...incoming]) unique.set(order.id, order);
    return authJson({ orders: [...unique.values()].sort((a, b) => b.createdAt - a.createdAt).slice(0, 50) });
  } catch {
    return authJson({ error: "ORDERS_UNAVAILABLE" }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  if (!originAllowed(request)) return authJson({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const user = await getSessionUser(env.DB, request);
  if (!user) return authJson({ error: "AUTH_REQUIRED" }, 401);
  const limited = await enforceAuthRateLimit({ env, request, action: "marketplace-order-create", email: user.email, limit: 10 });
  if (limited) return limited;
  const parsed = await readAuthBody(request);
  if (parsed.error) return authJson({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  const productId = typeof body.productId === "string" ? body.productId.trim() : "";
  const quantity = body.quantity === undefined ? 1 : Number(body.quantity);
  const fulfillmentMode = typeof body.fulfillmentMode === "string" ? body.fulfillmentMode.trim() : "";
  const buyerNote = typeof body.buyerNote === "string" ? body.buyerNote.trim() : "";
  if (!uuidPattern.test(productId)) return authJson({ error: "INVALID_PRODUCT_ID" }, 400);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 100) return authJson({ error: "INVALID_QUANTITY" }, 400);
  if (!["delivery", "pickup"].includes(fulfillmentMode)) return authJson({ error: "INVALID_FULFILLMENT_MODE" }, 400);
  if (buyerNote.length > 500) return authJson({ error: "BUYER_NOTE_TOO_LONG" }, 400);
  try {
    const product = await env.DB.prepare(
      "SELECT p.id, p.title, p.price_minor AS priceMinor, p.currency_code AS currency, p.stock_count AS stockCount, s.id AS storeId, s.user_id AS sellerUserId, s.status AS storeStatus, s.offers_delivery AS offersDelivery, s.offers_pickup AS offersPickup FROM products p JOIN merchant_stores s ON s.id = p.store_id WHERE p.id = ? AND p.status = 'published' LIMIT 1"
    ).bind(productId).first();
    if (!product || product.storeStatus !== "active") return authJson({ error: "PRODUCT_NOT_AVAILABLE" }, 404);
    if (product.sellerUserId === user.id) return authJson({ error: "CANNOT_ORDER_OWN_PRODUCT" }, 403);
    if (product.stockCount < quantity) return authJson({ error: "INSUFFICIENT_STOCK" }, 409);
    if (fulfillmentMode === "delivery" && product.offersDelivery !== 1) return authJson({ error: "DELIVERY_NOT_AVAILABLE" }, 400);
    if (fulfillmentMode === "pickup" && product.offersPickup !== 1) return authJson({ error: "PICKUP_NOT_AVAILABLE" }, 400);

    const id = crypto.randomUUID();
    const itemId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const results = await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO marketplace_orders (id, buyer_user_id, store_id, status, fulfillment_mode, buyer_note, created_at, updated_at) SELECT ?, ?, s.id, 'pending', ?, ?, ?, ? FROM products p JOIN merchant_stores s ON s.id = p.store_id WHERE p.id = ? AND p.status = 'published' AND s.status = 'active' AND s.user_id != ? AND p.stock_count >= ? AND ((? = 'delivery' AND s.offers_delivery = 1) OR (? = 'pickup' AND s.offers_pickup = 1))"
      ).bind(id, user.id, fulfillmentMode, buyerNote, now, now, productId, user.id, quantity, fulfillmentMode, fulfillmentMode),
      env.DB.prepare(
        "INSERT INTO marketplace_order_items (id, order_id, product_id, product_title, unit_price_minor, currency_code, quantity) SELECT ?, o.id, p.id, p.title, p.price_minor, p.currency_code, ? FROM marketplace_orders o JOIN products p ON p.id = ? WHERE o.id = ? AND o.buyer_user_id = ? AND o.status = 'pending'"
      ).bind(itemId, quantity, productId, id, user.id)
    ]);
    if (!results?.[0]?.meta?.changes || !results?.[1]?.meta?.changes) return authJson({ error: "PRODUCT_NO_LONGER_AVAILABLE" }, 409);
    return authJson({ created: true, order: { id, status: "pending", fulfillmentMode, productTitle: product.title, quantity, unitPriceMinor: product.priceMinor, currency: product.currency, createdAt: now } }, 201);
  } catch {
    return authJson({ error: "ORDER_CREATE_UNAVAILABLE" }, 503);
  }
}
