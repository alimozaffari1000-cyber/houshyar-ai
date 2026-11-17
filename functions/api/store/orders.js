import { getSessionUser, originAllowed } from "../_lib/auth.js";
import { authJson, readAuthBody, enforceAuthRateLimit } from "../_lib/auth-flow.js";

const transitions = {
  pending: ["confirmed", "cancelled"],
  confirmed: ["preparing", "cancelled"],
  preparing: ["ready"],
  ready: ["shipped", "completed"],
  shipped: ["completed"],
  completed: [],
  cancelled: []
};

export async function onRequestGet({ request, env }) {
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  const user = await getSessionUser(env.DB, request);
  if (!user) return authJson({ error: "AUTH_REQUIRED" }, 401);
  try {
    const store = await env.DB.prepare("SELECT id FROM merchant_stores WHERE user_id = ? LIMIT 1").bind(user.id).first();
    if (!store) return authJson({ error: "STORE_NOT_FOUND" }, 404);
    const result = await env.DB.prepare(
      "SELECT id, order_number AS orderNumber, fulfillment, recipient_name AS recipientName, contact_phone AS contactPhone, delivery_address AS deliveryAddress, buyer_note AS buyerNote, currency_code AS currency, subtotal_minor AS subtotalMinor, total_minor AS totalMinor, status, payment_status AS paymentStatus, created_at AS createdAt FROM orders WHERE store_id = ? ORDER BY created_at DESC LIMIT 100"
    ).bind(store.id).all();
    const orders = Array.isArray(result.results) ? result.results : [];
    if (!orders.length) return authJson({ orders: [] });
    const ids = orders.map(order => order.id);
    const items = await env.DB.prepare(
      "SELECT order_id AS orderId, product_title AS title, quantity, unit_price_minor AS unitPriceMinor, line_total_minor AS lineTotalMinor FROM order_items WHERE order_id IN (" + ids.map(() => "?").join(", ") + ") ORDER BY created_at ASC"
    ).bind(...ids).all();
    const grouped = new Map(orders.map(order => [order.id, { ...order, items: [] }]));
    for (const item of items.results || []) grouped.get(item.orderId)?.items.push(item);
    return authJson({ orders: [...grouped.values()] });
  } catch {
    return authJson({ error: "STORE_ORDERS_UNAVAILABLE" }, 503);
  }
}

export async function onRequestPatch({ request, env }) {
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  if (!originAllowed(request)) return authJson({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const user = await getSessionUser(env.DB, request);
  if (!user) return authJson({ error: "AUTH_REQUIRED" }, 401);
  const limited = await enforceAuthRateLimit({ env, request, action: "store-order-update", email: user.email, limit: 30 });
  if (limited) return limited;
  const parsed = await readAuthBody(request);
  if (parsed.error) return authJson({ error: parsed.error }, parsed.status);
  const { orderId, status: nextStatus } = parsed.body;
  if (typeof orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(orderId) ||
      !["confirmed", "preparing", "ready", "shipped", "completed", "cancelled"].includes(nextStatus)) {
    return authJson({ error: "INVALID_ORDER_UPDATE" }, 400);
  }
  try {
    const store = await env.DB.prepare("SELECT id FROM merchant_stores WHERE user_id = ? LIMIT 1").bind(user.id).first();
    if (!store) return authJson({ error: "STORE_NOT_FOUND" }, 404);
    const order = await env.DB.prepare(
      "SELECT id, order_number AS orderNumber, status, fulfillment FROM orders WHERE id = ? AND store_id = ? LIMIT 1"
    ).bind(orderId, store.id).first();
    if (!order) return authJson({ error: "ORDER_NOT_FOUND" }, 404);
    if (!transitions[order.status]?.includes(nextStatus)) return authJson({ error: "INVALID_ORDER_TRANSITION" }, 409);
    if (nextStatus === "shipped" && order.fulfillment !== "delivery") return authJson({ error: "SHIPPING_ONLY_FOR_DELIVERY" }, 400);
    if (nextStatus === "completed" && order.fulfillment === "delivery" && order.status !== "shipped") {
      return authJson({ error: "DELIVERY_MUST_BE_SHIPPED_FIRST" }, 409);
    }
    const now = Math.floor(Date.now() / 1000);
    if (nextStatus !== "cancelled") {
      const results = await env.DB.batch([
        env.DB.prepare(
          "UPDATE orders SET status = ?, updated_at = ? WHERE id = ? AND store_id = ? AND status = ?"
        ).bind(nextStatus, now, orderId, store.id, order.status),
        env.DB.prepare(
          "INSERT INTO user_notifications (id, recipient_user_id, kind, title, body, entity_type, entity_id, created_at) " +
          "SELECT ?, buyer_user_id, 'marketplace_order_status', 'به‌روزرسانی سفارش', ?, 'order', ?, ? " +
          "FROM orders WHERE id = ? AND status = ? AND changes() = 1"
        ).bind(crypto.randomUUID(), "وضعیت سفارش " + order.orderNumber + " به «" + nextStatus + "» تغییر کرد.", orderId, now, orderId, nextStatus)
      ]);
      if ((results?.[0]?.meta?.changes ?? 0) !== 1) return authJson({ error: "ORDER_CHANGED_RELOAD" }, 409);
    } else {
      const itemRows = await env.DB.prepare("SELECT product_id AS productId, quantity FROM order_items WHERE order_id = ? AND product_id IS NOT NULL").bind(orderId).all();
      const items = Array.isArray(itemRows.results) ? itemRows.results : [];
      const statements = [env.DB.prepare(
        "UPDATE orders SET status = 'cancelled', updated_at = ? WHERE id = ? AND store_id = ? AND status = ?"
      ).bind(now, orderId, store.id, order.status)];
      statements.push(env.DB.prepare(
        "INSERT INTO user_notifications (id, recipient_user_id, kind, title, body, entity_type, entity_id, created_at) " +
        "SELECT ?, buyer_user_id, 'marketplace_order_status', 'لغو سفارش', ?, 'order', ?, ? " +
        "FROM orders WHERE id = ? AND status = 'cancelled' AND changes() = 1"
      ).bind(crypto.randomUUID(), "سفارش " + order.orderNumber + " لغو شد.", orderId, now, orderId));
      if (items.length) {
        const ids = items.map(item => item.productId);
        statements.push(env.DB.prepare(
          "UPDATE products SET stock_count = stock_count + (SELECT oi.quantity FROM order_items oi WHERE oi.order_id = ? AND oi.product_id = products.id), updated_at = ? " +
          "WHERE id IN (" + ids.map(() => "?").join(", ") + ") AND changes() = 1"
        ).bind(orderId, now, ...ids));
      }
      const results = await env.DB.batch(statements);
      if ((results?.[0]?.meta?.changes ?? 0) !== 1) return authJson({ error: "ORDER_CHANGED_RELOAD" }, 409);
    }
    return authJson({ updated: true, orderId, status: nextStatus });
  } catch {
    return authJson({ error: "STORE_ORDER_UPDATE_FAILED" }, 503);
  }
}
