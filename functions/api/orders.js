import { getSessionUser, originAllowed } from "./_lib/auth.js";
import { authJson, readAuthBody, enforceAuthRateLimit } from "./_lib/auth-flow.js";

export async function onRequestGet({ request, env }) {
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  const user = await getSessionUser(env.DB, request);
  if (!user) return authJson({ error: "AUTH_REQUIRED" }, 401);
  try {
    const result = await env.DB.prepare(
      "SELECT o.id, o.status, o.fulfillment, o.total_minor AS totalMinor, o.currency_code AS currency, " +
      "o.created_at AS createdAt, o.updated_at AS updatedAt, i.product_title AS productTitle, " +
      "i.quantity, i.unit_price_minor AS unitPriceMinor, i.line_total_minor AS lineTotalMinor " +
      "FROM marketplace_orders o JOIN marketplace_order_items i ON i.order_id = o.id " +
      "WHERE o.buyer_id = ? ORDER BY o.created_at DESC LIMIT 100"
    ).bind(user.id).all();
    return authJson({ orders: Array.isArray(result.results) ? result.results : [] });
  } catch {
    return authJson({ error: "BUYER_ORDERS_UNAVAILABLE" }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  if (!originAllowed(request)) return authJson({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const user = await getSessionUser(env.DB, request);
  if (!user) return authJson({ error: "AUTH_REQUIRED" }, 401);
  const limited = await enforceAuthRateLimit({ env, request, action: "marketplace-order", email: user.email, limit: 10 });
  if (limited) return limited;
  const parsed = await readAuthBody(request);
  if (parsed.error) return authJson({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  const productId = typeof body.productId === "string" ? body.productId : "";
  const quantity = Number(body.quantity);
  const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
  const customerPhone = typeof body.customerPhone === "string" ? body.customerPhone.trim() : "";
  const fulfillment = body.fulfillment;
  const deliveryAddress = typeof body.deliveryAddress === "string" ? body.deliveryAddress.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (!/^[0-9a-f-]{36}$/i.test(productId) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99 ||
      customerName.length < 2 || customerName.length > 100 ||
      customerPhone.length < 5 || customerPhone.length > 30 ||
      !["delivery", "pickup"].includes(fulfillment) ||
      deliveryAddress.length > 500 || note.length > 500 ||
      (fulfillment === "delivery" && deliveryAddress.length < 5) ||
      (fulfillment === "pickup" && deliveryAddress.length !== 0)) {
    return authJson({ error: "INVALID_ORDER_DETAILS" }, 400);
  }
  try {
    const product = await env.DB.prepare(
      "SELECT p.id, p.store_id AS storeId, p.title, p.price_minor AS priceMinor, p.currency_code AS currency, p.stock_count AS stockCount, " +
      "s.status AS storeStatus, s.offers_delivery AS offersDelivery, s.offers_pickup AS offersPickup " +
      "FROM products p JOIN merchant_stores s ON s.id = p.store_id WHERE p.id = ? AND p.status = 'published' LIMIT 1"
    ).bind(productId).first();
    if (!product || product.storeStatus !== "active" || Number(product.stockCount) < quantity ||
        (fulfillment === "delivery" && !product.offersDelivery) ||
        (fulfillment === "pickup" && !product.offersPickup)) {
      return authJson({ error: "ORDER_NOT_AVAILABLE" }, 409);
    }
    const total = Number(product.priceMinor) * quantity;
    if (!Number.isSafeInteger(total) || total <= 0) return authJson({ error: "INVALID_ORDER_TOTAL" }, 400);
    const id = crypto.randomUUID();
    const itemId = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const statements = [
      env.DB.prepare(
        "INSERT INTO marketplace_orders (id, buyer_id, store_id, customer_name, customer_phone, fulfillment, delivery_address, note, status, total_minor, currency_code, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?, ?, ?)"
      ).bind(id, user.id, product.storeId, customerName, customerPhone, fulfillment, deliveryAddress, note, total, product.currency, now, now),
      env.DB.prepare(
        "INSERT INTO marketplace_order_items (id, order_id, product_id, product_title, quantity, unit_price_minor, line_total_minor) " +
        "SELECT ?, ?, p.id, p.title, ?, p.price_minor, p.price_minor * ? FROM products p JOIN merchant_stores s ON s.id = p.store_id " +
        "WHERE p.id = ? AND p.status = 'published' AND s.status = 'active' AND p.stock_count >= ? " +
        "AND p.currency_code = ? AND (? = 'delivery' AND s.offers_delivery = 1 OR ? = 'pickup' AND s.offers_pickup = 1)"
      ).bind(itemId, id, quantity, quantity, productId, quantity, product.currency, fulfillment, fulfillment)
    ];
    const results = await env.DB.batch(statements);
    const inserted = Number(results?.[1]?.meta?.changes ?? results?.[1]?.changes ?? 0);
    if (inserted !== 1) {
      await env.DB.prepare("DELETE FROM marketplace_orders WHERE id = ? AND buyer_id = ?").bind(id, user.id).run();
      return authJson({ error: "ORDER_NOT_AVAILABLE" }, 409);
    }
    return authJson({ created: true, order: { id, status: "requested", totalMinor: total, currency: product.currency } }, 201);
  } catch {
    return authJson({ error: "ORDER_CREATE_UNAVAILABLE" }, 503);
  }
}
