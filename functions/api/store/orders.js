import { getSessionUser, originAllowed } from "../_lib/auth.js";
import { authJson, readAuthBody, enforceAuthRateLimit } from "../_lib/auth-flow.js";

export async function onRequestGet({ request, env }) {
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  const user = await getSessionUser(env.DB, request);
  if (!user) return authJson({ error: "AUTH_REQUIRED" }, 401);
  try {
    const store = await env.DB.prepare("SELECT id FROM merchant_stores WHERE user_id = ? AND status = 'active' LIMIT 1").bind(user.id).first();
    if (!store) return authJson({ error: "STORE_NOT_FOUND" }, 404);
    const result = await env.DB.prepare(
      "SELECT o.id, o.customer_name AS customerName, o.customer_phone AS customerPhone, o.fulfillment, " +
      "o.delivery_address AS deliveryAddress, o.note, o.status, o.total_minor AS totalMinor, o.currency_code AS currency, " +
      "o.created_at AS createdAt, i.product_title AS productTitle, i.quantity, i.unit_price_minor AS unitPriceMinor, i.line_total_minor AS lineTotalMinor " +
      "FROM marketplace_orders o JOIN marketplace_order_items i ON i.order_id = o.id " +
      "WHERE o.store_id = ? ORDER BY o.created_at DESC LIMIT 100"
    ).bind(store.id).all();
    return authJson({ orders: Array.isArray(result.results) ? result.results : [] });
  } catch (error) {
    if (String(error?.message || error).includes("INSUFFICIENT_ORDER_STOCK")) {
      return authJson({ error: "ORDER_NO_LONGER_AVAILABLE" }, 409);
    }
    if (String(error?.message || error).includes("ORDER_ITEMS_MISSING")) {
      return authJson({ error: "ORDER_ITEMS_INVALID" }, 409);
    }
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
  const { orderId, status } = parsed.body;
  if (typeof orderId !== "string" || !/^[0-9a-f-]{36}$/i.test(orderId) ||
      !["accepted", "rejected", "completed"].includes(status)) {
    return authJson({ error: "INVALID_ORDER_STATUS" }, 400);
  }
  try {
    const store = await env.DB.prepare("SELECT id FROM merchant_stores WHERE user_id = ? AND status = 'active' LIMIT 1").bind(user.id).first();
    if (!store) return authJson({ error: "STORE_NOT_FOUND" }, 404);
    const allowedFrom = status === "completed" ? "accepted" : "requested";
    const result = await env.DB.prepare(
      "UPDATE marketplace_orders SET status = ?, updated_at = ? WHERE id = ? AND store_id = ? AND status = ?"
    ).bind(status, Math.floor(Date.now() / 1000), orderId, store.id, allowedFrom).run();
    if (Number(result?.meta?.changes ?? result?.changes ?? 0) !== 1) return authJson({ error: "ORDER_STATUS_CONFLICT" }, 409);
    return authJson({ updated: true, orderId, status });
  } catch {
    return authJson({ error: "STORE_ORDERS_UNAVAILABLE" }, 503);
  }
}
