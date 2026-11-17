import { getSessionUser, originAllowed } from "./_lib/auth.js";
import { authJson, readAuthBody, enforceAuthRateLimit } from "./_lib/auth-flow.js";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const text = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";

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
  if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 20) {
    return authJson({ error: "INVALID_ORDER_ITEMS" }, 400);
  }
  const quantities = new Map();
  for (const item of body.items) {
    if (!item || typeof item.productId !== "string" || !uuidPattern.test(item.productId) ||
        !Number.isSafeInteger(item.quantity) || item.quantity < 1 || item.quantity > 100) {
      return authJson({ error: "INVALID_ORDER_ITEM" }, 400);
    }
    quantities.set(item.productId, (quantities.get(item.productId) || 0) + item.quantity);
  }
  if (quantities.size !== body.items.length || [...quantities.values()].some(quantity => quantity > 100)) {
    return authJson({ error: "DUPLICATE_OR_EXCESS_ORDER_ITEM" }, 400);
  }
  const fulfillment = body.fulfillment;
  if (!["delivery", "pickup"].includes(fulfillment)) return authJson({ error: "INVALID_FULFILLMENT" }, 400);
  const recipientName = text(body.recipientName, 100);
  const contactPhone = text(body.contactPhone, 30);
  const deliveryAddress = text(body.deliveryAddress, 500);
  const buyerNote = text(body.buyerNote, 500);
  const idempotencyKey = body.idempotencyKey === undefined ? null : text(body.idempotencyKey, 80);
  if (recipientName.length < 2 || !/^[+0-9() .-]{6,30}$/.test(contactPhone) ||
      (fulfillment === "delivery" && deliveryAddress.length < 8) ||
      (body.idempotencyKey !== undefined && (idempotencyKey.length < 8 || idempotencyKey.length > 80))) {
    return authJson({ error: "INVALID_ORDER_CONTACT" }, 400);
  }

  const ids = [...quantities.keys()];
  const placeholders = ids.map(() => "?").join(", ");
  try {
    if (idempotencyKey) {
      const existing = await env.DB.prepare(
        "SELECT id, order_number, status, total_minor AS totalMinor, currency_code AS currency FROM orders WHERE buyer_user_id = ? AND idempotency_key = ? LIMIT 1"
      ).bind(user.id, idempotencyKey).first();
      if (existing) return authJson({ created: true, existing: true, order: existing }, 200);
    }
    const result = await env.DB.prepare(
      "SELECT p.id, p.title, p.price_minor AS priceMinor, p.currency_code AS currency, p.stock_count AS stockCount, p.store_id AS storeId, s.status AS storeStatus " +
      "FROM products p JOIN merchant_stores s ON s.id = p.store_id WHERE p.id IN (" + placeholders + ") AND p.status = 'published'"
    ).bind(...ids).all();
    const rows = Array.isArray(result.results) ? result.results : [];
    if (rows.length !== ids.length) return authJson({ error: "PRODUCT_UNAVAILABLE" }, 409);
    const storeId = rows[0].storeId;
    const currency = rows[0].currency;
    if (rows.some(row => row.storeId !== storeId || row.storeStatus !== "active" || row.currency !== currency)) {
      return authJson({ error: "ORDER_MUST_USE_ONE_ACTIVE_STORE_AND_CURRENCY" }, 400);
    }
    let subtotal = 0;
    const items = rows.map(row => {
      const quantity = quantities.get(row.id);
      if (row.stockCount < quantity) throw new Error("INSUFFICIENT_STOCK");
      const lineTotal = row.priceMinor * quantity;
      if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(subtotal + lineTotal)) throw new Error("ORDER_TOTAL_OVERFLOW");
      subtotal += lineTotal;
      return { ...row, quantity, lineTotal };
    });
    const now = Math.floor(Date.now() / 1000);
    const orderId = crypto.randomUUID();
    const orderNumber = "HY-" + now.toString(36).toUpperCase() + "-" + crypto.randomUUID().slice(0, 8).toUpperCase();
    const caseStock = "CASE id " + items.map(() => "WHEN ? THEN ?").join(" ") + " ELSE 0 END";
    const caseStockProduct = "CASE p.id " + items.map(() => "WHEN ? THEN ?").join(" ") + " ELSE 0 END";
    const casePrice = "CASE p.id " + items.map(() => "WHEN ? THEN ?").join(" ") + " ELSE -1 END";
    const stockBindings = items.flatMap(item => [item.id, item.quantity]);
    const priceBindings = items.flatMap(item => [item.id, item.priceMinor]);
    const updateSql =
      "UPDATE products SET stock_count = stock_count - " + caseStock + ", updated_at = ? " +
      "WHERE id IN (" + placeholders + ") AND store_id = ? AND status = 'published' AND stock_count >= " + caseStock +
      " AND price_minor = CASE id " + items.map(() => "WHEN ? THEN ?").join(" ") + " ELSE -1 END " +
      "AND (SELECT COUNT(*) FROM products p JOIN merchant_stores s ON s.id = p.store_id WHERE p.id IN (" + placeholders +
      ") AND p.store_id = ? AND p.status = 'published' AND s.status = 'active' AND p.stock_count >= " + caseStockProduct +
      " AND p.price_minor = " + casePrice + " AND p.currency_code = ?) = ?";
    const updateBindings = [
      ...stockBindings, now, ...ids, storeId, ...stockBindings, ...priceBindings,
      ...ids, storeId, ...stockBindings, ...priceBindings, currency, items.length
    ];
    const statements = [env.DB.prepare(updateSql).bind(...updateBindings)];
    statements.push(env.DB.prepare(
      "INSERT INTO orders (id, order_number, store_id, buyer_user_id, fulfillment, recipient_name, contact_phone, delivery_address, buyer_note, currency_code, subtotal_minor, delivery_fee_minor, total_minor, status, payment_status, idempotency_key, created_at, updated_at) " +
      "SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, 'pending', 'unpaid', ?, ?, ? WHERE changes() = ?"
    ).bind(orderId, orderNumber, storeId, user.id, fulfillment, recipientName, contactPhone, fulfillment === "delivery" ? deliveryAddress : "", buyerNote, currency, subtotal, subtotal, idempotencyKey, now, now, items.length));
    for (const item of items) {
      statements.push(env.DB.prepare(
        "INSERT INTO order_items (id, order_id, product_id, product_title, quantity, unit_price_minor, line_total_minor, created_at) " +
        "SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE EXISTS (SELECT 1 FROM orders WHERE id = ?)"
      ).bind(crypto.randomUUID(), orderId, item.id, item.title, item.quantity, item.priceMinor, item.lineTotal, now, orderId));
    }
    const batch = await env.DB.batch(statements);
    const changed = batch?.[0]?.meta?.changes ?? batch?.[0]?.changes ?? 0;
    if (changed !== items.length) return authJson({ error: "STOCK_OR_PRICE_CHANGED", message: "موجودی یا قیمت تغییر کرده است؛ سبد خرید را تازه‌سازی کنید." }, 409);
    return authJson({ created: true, order: {
      id: orderId, orderNumber, status: "pending", paymentStatus: "unpaid",
      fulfillment, currency, subtotalMinor: subtotal, totalMinor: subtotal
    } }, 201);
  } catch (error) {
    if (error?.message === "INSUFFICIENT_STOCK") return authJson({ error: "INSUFFICIENT_STOCK" }, 409);
    if (error?.message === "ORDER_TOTAL_OVERFLOW") return authJson({ error: "ORDER_TOTAL_TOO_LARGE" }, 400);
    if (idempotencyKey && /UNIQUE|constraint/i.test(String(error?.message || ""))) {
      const existing = await env.DB.prepare(
        "SELECT id, order_number, status, total_minor AS totalMinor, currency_code AS currency FROM orders WHERE buyer_user_id = ? AND idempotency_key = ? LIMIT 1"
      ).bind(user.id, idempotencyKey).first().catch(() => null);
      if (existing) return authJson({ created: true, existing: true, order: existing }, 200);
    }
    return authJson({ error: "ORDER_CREATE_FAILED" }, 503);
  }
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  const user = await getSessionUser(env.DB, request);
  if (!user) return authJson({ error: "AUTH_REQUIRED" }, 401);
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(50, Number.parseInt(url.searchParams.get("limit") || "20", 10) || 20));
  try {
    const result = await env.DB.prepare(
      "SELECT id, order_number AS orderNumber, fulfillment, recipient_name AS recipientName, contact_phone AS contactPhone, delivery_address AS deliveryAddress, buyer_note AS buyerNote, currency_code AS currency, subtotal_minor AS subtotalMinor, delivery_fee_minor AS deliveryFeeMinor, total_minor AS totalMinor, status, payment_status AS paymentStatus, created_at AS createdAt FROM orders WHERE buyer_user_id = ? ORDER BY created_at DESC LIMIT ?"
    ).bind(user.id, limit).all();
    const orders = Array.isArray(result.results) ? result.results : [];
    if (!orders.length) return authJson({ orders: [] });
    const ids = orders.map(order => order.id);
    const itemRows = await env.DB.prepare(
      "SELECT order_id AS orderId, product_title AS title, quantity, unit_price_minor AS unitPriceMinor, line_total_minor AS lineTotalMinor FROM order_items WHERE order_id IN (" + ids.map(() => "?").join(", ") + ") ORDER BY created_at ASC"
    ).bind(...ids).all();
    const grouped = new Map(orders.map(order => [order.id, { ...order, items: [] }]));
    for (const item of itemRows.results || []) grouped.get(item.orderId)?.items.push(item);
    return authJson({ orders: [...grouped.values()] });
  } catch {
    return authJson({ error: "ORDERS_UNAVAILABLE" }, 503);
  }
}
