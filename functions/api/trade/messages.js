import { getSessionUser, originAllowed } from "../_lib/auth.js";
import { authJson, readAuthBody, enforceAuthRateLimit } from "../_lib/auth-flow.js";

const text = (value, max) => typeof value === "string" ? value.trim().slice(0, max) : "";

async function participantThread(db, threadId, userId) {
  const thread = await db.prepare(
    "SELECT t.id, t.request_id AS requestId, t.buyer_user_id AS buyerUserId, " +
    "t.supplier_store_id AS supplierStoreId, t.status, s.user_id AS supplierUserId " +
    "FROM trade_negotiation_threads t JOIN merchant_stores s ON s.id = t.supplier_store_id " +
    "WHERE t.id = ? AND (t.buyer_user_id = ? OR s.user_id = ?) LIMIT 1"
  ).bind(threadId, userId, userId).first();
  return thread;
}

export async function onRequestGet({ request, env }) {
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  const user = await getSessionUser(env.DB, request);
  if (!user) return authJson({ error: "AUTH_REQUIRED" }, 401);
  const threadId = text(new URL(request.url).searchParams.get("threadId"), 80);
  if (!threadId) return authJson({ error: "THREAD_ID_REQUIRED" }, 400);
  try {
    const thread = await participantThread(env.DB, threadId, user.id);
    if (!thread) return authJson({ error: "THREAD_NOT_FOUND" }, 404);
    const result = await env.DB.prepare(
      "SELECT id, CASE WHEN sender_user_id = ? THEN 'you' " +
      "WHEN sender_user_id = ? THEN 'other' ELSE 'participant' END AS senderRole, " +
      "body, created_at AS createdAt FROM trade_negotiation_messages " +
      "WHERE thread_id = ? ORDER BY created_at ASC LIMIT 200"
    ).bind(user.id, user.id, threadId).all();
    return authJson({
      thread: { id: thread.id, requestId: thread.requestId, status: thread.status },
      messages: Array.isArray(result.results) ? result.results : [],
      note: "Messages are negotiation discussions only; they do not create an order, contract, reservation, or payment."
    });
  } catch {
    return authJson({ error: "TRADE_MESSAGES_UNAVAILABLE" }, 503);
  }
}

export async function onRequestPost({ request, env }) {
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  if (!originAllowed(request)) return authJson({ error: "ORIGIN_NOT_ALLOWED" }, 403);
  const user = await getSessionUser(env.DB, request);
  if (!user) return authJson({ error: "AUTH_REQUIRED" }, 401);
  const limited = await enforceAuthRateLimit({ env, request, action: "trade-message-create", email: user.email, limit: 30 });
  if (limited) return limited;
  const parsed = await readAuthBody(request);
  if (parsed.error) return authJson({ error: parsed.error }, parsed.status);
  const body = parsed.body;
  const threadId = text(body.threadId, 80);
  const requestId = text(body.requestId, 80);
  const offerId = text(body.offerId, 80);
  const message = text(body.message, 2000);
  if (!message) return authJson({ error: "MESSAGE_REQUIRED" }, 400);
  try {
    let thread;
    if (!threadId) {
      if (!requestId || !offerId) return authJson({ error: "REQUEST_AND_OFFER_REQUIRED" }, 400);
      const rfq = await env.DB.prepare(
        "SELECT id, buyer_user_id AS buyerUserId, country_code AS countryCode, status, expires_at AS expiresAt " +
        "FROM trade_purchase_requests WHERE id = ? AND buyer_user_id = ? LIMIT 1"
      ).bind(requestId, user.id).first();
      if (!rfq || rfq.status !== "open" || rfq.expiresAt <= Math.floor(Date.now() / 1000)) {
        return authJson({ error: "REQUEST_NOT_FOUND" }, 404);
      }
      const offer = await env.DB.prepare(
        "SELECT o.id, o.supplier_store_id AS supplierStoreId, s.user_id AS supplierUserId, s.country_code AS supplierCountryCode " +
        "FROM trade_supplier_offers o JOIN merchant_stores s ON s.id = o.supplier_store_id " +
        "WHERE o.id = ? AND o.request_id = ? AND o.status = 'submitted' AND s.status = 'active' LIMIT 1"
      ).bind(offerId, requestId).first();
      if (!offer || offer.supplierUserId === user.id) return authJson({ error: "OFFER_NOT_AVAILABLE" }, 404);
      if ((rfq.countryCode ?? null) !== (offer.supplierCountryCode ?? null)) {
        return authJson({ error: "COUNTRY_SCOPE_MISMATCH" }, 403);
      }
      if (rfq.countryCode) {
        const market = await env.DB.prepare(
          "SELECT country_code FROM country_market_configs WHERE country_code = ? AND status = 'live' LIMIT 1"
        ).bind(rfq.countryCode).first();
        if (!market) return authJson({ error: "COUNTRY_MARKET_NOT_LIVE" }, 403);
      }
      const now = Math.floor(Date.now() / 1000);
      const candidateId = crypto.randomUUID();
      await env.DB.prepare(
        "INSERT OR IGNORE INTO trade_negotiation_threads " +
        "(id, request_id, buyer_user_id, supplier_store_id, status, created_at, updated_at) " +
        "VALUES (?, ?, ?, ?, 'open', ?, ?)"
      ).bind(candidateId, requestId, user.id, offer.supplierStoreId, now, now).run();
      thread = await env.DB.prepare(
        "SELECT id, request_id AS requestId, status FROM trade_negotiation_threads " +
        "WHERE request_id = ? AND supplier_store_id = ? AND buyer_user_id = ? LIMIT 1"
      ).bind(requestId, offer.supplierStoreId, user.id).first();
    } else {
      thread = await participantThread(env.DB, threadId, user.id);
      if (!thread) return authJson({ error: "THREAD_NOT_FOUND" }, 404);
    }
    if (!thread || thread.status !== "open") return authJson({ error: "THREAD_CLOSED" }, 409);
    const id = crypto.randomUUID();
    const now = Math.floor(Date.now() / 1000);
    await env.DB.batch([
      env.DB.prepare(
        "INSERT INTO trade_negotiation_messages (id, thread_id, sender_user_id, body, created_at) VALUES (?, ?, ?, ?, ?)"
      ).bind(id, thread.id, user.id, message, now),
      env.DB.prepare(
        "UPDATE trade_negotiation_threads SET updated_at = ? WHERE id = ? AND status = 'open'"
      ).bind(now, thread.id)
    ]);
    return authJson({ sent: true, threadId: thread.id, message: { id, senderRole: "you", body: message, createdAt: now } }, 201);
  } catch {
    return authJson({ error: "TRADE_MESSAGE_CREATE_UNAVAILABLE" }, 503);
  }
}
