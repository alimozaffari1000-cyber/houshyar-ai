// Payment policy only. This module does not contact providers or verify transfers.
export const CRYPTO_PAYMENT_RAILS = Object.freeze({
  USDT: Object.freeze(["TRON-TRC20", "ETHEREUM-ERC20"]),
  XRP: Object.freeze(["XRP-LEDGER"]),
  XMR: Object.freeze(["MONERO"]),
  TRX: Object.freeze(["TRON"])
});

export const PAYMENT_STATUS_TRANSITIONS = Object.freeze({
  created: Object.freeze(["pending", "failed", "expired"]),
  pending: Object.freeze(["confirmed", "failed", "expired"]),
  confirmed: Object.freeze(["refunded"]),
  failed: Object.freeze([]),
  expired: Object.freeze([]),
  refunded: Object.freeze([])
});

export function isSupportedCryptoRail(assetCode, networkCode) {
  if (typeof assetCode !== "string" || typeof networkCode !== "string") return false;
  return CRYPTO_PAYMENT_RAILS[assetCode.toUpperCase()]?.includes(networkCode.toUpperCase()) === true;
}

export function canTransitionPaymentStatus(currentStatus, nextStatus) {
  return PAYMENT_STATUS_TRANSITIONS[currentStatus]?.includes(nextStatus) === true;
}

export function validatePaymentIntentRequest(body) {
  if (!body || typeof body !== "object" || Array.isArray(body)) return { valid: false, error: "INVALID_BODY" };
  if (typeof body.orderId !== "string" || !/^[0-9a-f]{8}-[0-9a-f-]{27}$/i.test(body.orderId)) {
    return { valid: false, error: "INVALID_ORDER_ID" };
  }
  if (typeof body.idempotencyKey !== "string" || body.idempotencyKey.trim().length < 8 ||
      body.idempotencyKey.trim().length > 100) {
    return { valid: false, error: "INVALID_IDEMPOTENCY_KEY" };
  }
  if (body.method === "manual") return { valid: true, method: "manual" };
  if (body.method !== "crypto") return { valid: false, error: "UNSUPPORTED_PAYMENT_METHOD" };
  if (!isSupportedCryptoRail(body.assetCode, body.networkCode)) {
    return { valid: false, error: "UNSUPPORTED_CRYPTO_RAIL" };
  }
  return { valid: true, method: "crypto", assetCode: body.assetCode.toUpperCase(), networkCode: body.networkCode.toUpperCase() };
}
