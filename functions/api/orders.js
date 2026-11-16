import { getSessionUser, originAllowed } from "./_lib/auth.js";
import { authJson, readAuthBody, enforceAuthRateLimit } from "./_lib/auth-flow.js";

const PRODUCT_ID = /^[0-9a-f-]{36}$/i;

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
  const rawItems = Array.isArray(body.items) ? body.items : [{ productId: body.productId, quantity: body.quantity }];
  if (rawItems.length < 1 || rawItems.length > 20) return authJson({ error: "INVALID_ORDER_ITEMS" }, 400);
  const items = [];
  const seen = new Set();
  const requiresPriceConfirmation = Array.isArray(body.items);
  for (const item of rawItems) {
    const productId = typeof item?.productId === "string" ? item.productId : "";
    const quantity = Number(item?.quantity);
    const expectedPriceMinor = Number(item?.priceMinor);
    if (!PRODUCT_ID.test(productId) || seen.has(productId) || !Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99 ||
        (requiresPriceConfirmation && (!Number.isSafeInteger(expectedPriceMinor) || expectedPriceMinor <= 0))) {
      return authJson({ error: "INVALID_ORDER_ITEMS" }, 400);
    }
    seen.add(productId);
    items.push({ productId, quantity, ...(requiresPriceConfirmation ? { expectedPriceMinor } : {}) });
  }
  const customerName = typeof body.customerName === "string" ? body.customerName.trim() : "";
  const customerPhone = typeof body.customerPhone === "string" ? body.customerPhone.trim() : "";
  const fulfillment = body.fulfillment;
  const deliveryAddress = typeof body.deliveryAddress === "string" ? body.deliveryAddress.trim() : "";
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (customerName.length < 2 || customerName.length > 100 ||
      customerPhone.length < 5 || customerPhone.length > 30 ||
      !["delivery", "pickup"].includes(fulfillment) ||
      deliveryAddress.length > 500 || note.length > 500 ||
      (fulfillment === "delivery" && deliveryAddress.length < 5) ||
      (fulfillment === "pickup" && deliveryAddress.length !== 0)) {
    return authJson({ error: "INVALID_ORDER_DETAILS" }, 400);
  }
  try {
    const placeholders = items.map(() => "?").join(", ");
    const catalog = await env.DB.prepare(
      "SELECT p.id, p.store_id AS storeId, p.title, p.price_minor AS priceMinor, p.currency_code AS currency, p.stock_count AS stockCount, " +
      "s.status AS storeStatus, s.offers_delivery AS offersDelivery, s.offers_pickup AS offersPickup " +
      "FROM products p JOIN merchant_stores s ON s.id = p.store_id " +
      "WHERE p.id IN (" + placeholders + ") AND p.status = 'published'"
    ).bind(...items.map(item => item.productId)).all();
    const products = Array.isArray(catalog.results) ? catalog.results : [];
    if (products.length !== items.length) return authJson({ error: "ORDER_NOT_AVAILABLE" }, 409);
    const byId = new Map(products.map(product => [product.id, product]));
    const first = products[0];
    if (!first || products.some(product =>
      product.storeId !== first.storeId || product.currency !== first.currency ||
      product.storeStatus !== "active" ||
      (fulfillment === "delivery" && !product.offersDelivery) ||
      (fulfillment === "pickup" && !product.offersPickup)
    )) return authJson({ error: "ORDER_NOT_AVAILABLE" }, 409);

    let total = 0;
    const snapshots = [];
    for (const item of items) {
      const product = byId.get(item.productId);
      if (!product || Number(product.stockCount) < item.quantity) return authJson({ error: "ORDER_NOT_AVAILABLE" }, 409);
      if (requiresPriceConfirmation && Number(product.priceMinor) !== item.expectedPriceMinor) {
        return authJson({ error: "ORDER_PRICE_CHANGED" }, 409);
      }
      const lineTotal = Number(product.priceMinor) * item.quantity;
      if (!Number.isSafeInteger(lineTotal) || lineTotal <= 0 || !Number.isSafeInteger(total + lineTotal)) {
        return authJson({ error: "INVALID_ORDER_TOTAL" }, 400);
      }
      total += lineTotal;
      snapshots.push({ ...item, product, lineTotal, itemId: crypto.randomUUID() });
    }
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    const statements = [
      env.DB.prepare(
        "INSERT INTO marketplace_orders (id, buyer_id, store_id, customer_name, customer_phone, fulfillment, delivery_address, note, status, total_minor, currency_code, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'requested', ?, ?, ?, ?)"
      ).bind(id, user.id, first.storeId, customerName, customerPhone, fulfillment, deliveryAddress, note, total, first.currency, now, now),
      ...snapshots.map(item => env.DB.prepare(
        "INSERT INTO marketplace_order_items (id, order_id, product_id, product_title, quantity, unit_price_minor, line_total_minor) " +
        "SELECT ?, ?, p.id, p.title, ?, p.price_minor, p.price_minor * ? FROM products p JOIN merchant_stores s ON s.id = p.store_id " +
        "WHERE p.id = ? AND p.status = 'published' AND s.status = 'active' AND p.stock_count >= ? " +
        "AND p.price_minor = ? AND p.currency_code = ? AND (? = 'delivery' AND s.offers_delivery = 1 OR ? = 'pickup' AND s.offers_pickup = 1)"
      ).bind(item.itemId, id, item.quantity, item.quantity, item.productId, item.quantity, item.product.priceMinor, item.product.currency, fulfillment, fulfillment))
    ];
    const results = await env.DB.batch(statements);
    const inserted = snapshots.reduce((count, _item, index) => {
      const result = results?.[index + 1];
      return count + Number(result?.meta?.changes ?? result?.changes ?? 0);
    }, 0);
    if (inserted !== snapshots.length) {
      await env.DB.prepare("DELETE FROM marketplace_orders WHERE id = ? AND buyer_id = ?").bind(id, user.id).run();
      return authJson({ error: "ORDER_NOT_AVAILABLE" }, 409);
    }
    return authJson({
      created: true,
      order: { id, status: "requested", totalMinor: total, currency: first.currency, itemCount: snapshots.length }
    }, 201);
  } catch {
    return authJson({ error: "ORDER_CREATE_UNAVAILABLE" }, 503);
  }
}
