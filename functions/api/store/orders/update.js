import { getSessionUser, originAllowed } from "../../_lib/auth.js";
import { authJson, readAuthBody, enforceAuthRateLimit } from "../../_lib/auth-flow.js";

const uuidPattern = /^[0-9a-f-]{36}$/i;

export async function onRequestPost({ request, env }) {
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  if (!originAllowed(request)) return authJson({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const user = await getSessionUser(env.DB, request);
  if (!user) return authJson({ error: "AUTH_REQUIRED" }, 401);
  const limited = await enforceAuthRateLimit({ env, request, action: "marketplace-order-update", email: user.email, limit: 20 });
  if (limited) return limited;
  const parsed = await readAuthBody(request);
  if (parsed.error) return authJson({ error: parsed.error }, parsed.status);
  const orderId = typeof parsed.body.orderId === "string" ? parsed.body.orderId.trim() : "";
  const action = typeof parsed.body.action === "string" ? parsed.body.action.trim() : "";
  if (!uuidPattern.test(orderId)) return authJson({ error: "INVALID_ORDER_ID" }, 400);
  if (!["accept", "reject", "complete", "cancel"].includes(action)) return authJson({ error: "INVALID_ORDER_ACTION" }, 400);

  const now = Math.floor(Date.now() / 1000);
  try {
    if (action === "accept") {
      const results = await env.DB.batch([
        env.DB.prepare(
          "UPDATE products SET stock_count = stock_count - (SELECT quantity FROM marketplace_order_items WHERE order_id = ? LIMIT 1), updated_at = ? WHERE id = (SELECT product_id FROM marketplace_order_items WHERE order_id = ? LIMIT 1) AND status = 'published' AND stock_count >= (SELECT quantity FROM marketplace_order_items WHERE order_id = ? LIMIT 1) AND EXISTS (SELECT 1 FROM marketplace_orders o JOIN merchant_stores s ON s.id = o.store_id WHERE o.id = ? AND o.status = 'pending' AND s.user_id = ?)"
        ).bind(orderId, now, orderId, orderId, orderId, user.id),
        env.DB.prepare(
          "UPDATE marketplace_orders SET status = 'accepted', accepted_at = ?, updated_at = ? WHERE id = ? AND status = 'pending' AND store_id IN (SELECT id FROM merchant_stores WHERE user_id = ?) AND changes() = 1"
        ).bind(now, now, orderId, user.id)
      ]);
      if (!results?.[1]?.meta?.changes) return authJson({ error: "ORDER_NOT_ACCEPTABLE_OR_STOCK_CHANGED" }, 409);
      return authJson({ updated: true, orderId, status: "accepted" });
    }

    let statement;
    if (action === "reject") {
      statement = env.DB.prepare(
        "UPDATE marketplace_orders SET status = 'rejected', updated_at = ? WHERE id = ? AND status = 'pending' AND store_id IN (SELECT id FROM merchant_stores WHERE user_id = ?)"
      ).bind(now, orderId, user.id);
    } else if (action === "complete") {
      statement = env.DB.prepare(
        "UPDATE marketplace_orders SET status = 'completed', completed_at = ?, updated_at = ? WHERE id = ? AND status = 'accepted' AND store_id IN (SELECT id FROM merchant_stores WHERE user_id = ?)"
      ).bind(now, now, orderId, user.id);
    } else {
      statement = env.DB.prepare(
        "UPDATE marketplace_orders SET status = 'cancelled', updated_at = ? WHERE id = ? AND status = 'pending' AND buyer_user_id = ?"
      ).bind(now, orderId, user.id);
    }
    const result = await statement.run();
    if (!result?.meta?.changes) return authJson({ error: "ORDER_NOT_FOUND_OR_INVALID_STATE" }, 404);
    return authJson({ updated: true, orderId, status: ({ reject: "rejected", complete: "completed", cancel: "cancelled" })[action] });
  } catch {
    return authJson({ error: "ORDER_UPDATE_UNAVAILABLE" }, 503);
  }
}
