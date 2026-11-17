import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  CRYPTO_PAYMENT_RAILS, canTransitionPaymentStatus, isSupportedCryptoRail, validatePaymentIntentRequest
} from "../functions/api/_lib/payment-policy.js";

test("crypto rails require explicit asset and network pairs", () => {
  assert.deepEqual(CRYPTO_PAYMENT_RAILS.USDT, ["TRON-TRC20", "ETHEREUM-ERC20"]);
  assert.equal(isSupportedCryptoRail("USDT", "TRON-TRC20"), true);
  assert.equal(isSupportedCryptoRail("USDT", "TRON"), false);
  assert.equal(isSupportedCryptoRail("XRP", "XRP-LEDGER"), true);
  assert.equal(isSupportedCryptoRail("XMR", "MONERO"), true);
  assert.equal(isSupportedCryptoRail("TRX", "TRON"), true);
  assert.equal(isSupportedCryptoRail("USDT", "XRP-LEDGER"), false);
});

test("payment intent request validates order, idempotency and crypto rail", () => {
  const orderId = "123e4567-e89b-12d3-a456-426614174000";
  assert.deepEqual(validatePaymentIntentRequest({ orderId, idempotencyKey: "checkout-123", method: "manual" }), {
    valid: true, method: "manual"
  });
  assert.equal(validatePaymentIntentRequest({ orderId, idempotencyKey: "checkout-123", method: "crypto", assetCode: "usdt", networkCode: "tron-trc20" }).valid, true);
  assert.equal(validatePaymentIntentRequest({ orderId, idempotencyKey: "checkout-123", method: "crypto", assetCode: "USDT", networkCode: "TRON" }).error, "UNSUPPORTED_CRYPTO_RAIL");
  assert.equal(validatePaymentIntentRequest({ orderId: "bad", idempotencyKey: "checkout-123", method: "manual" }).valid, false);
  assert.equal(validatePaymentIntentRequest({ orderId, idempotencyKey: "x", method: "manual" }).valid, false);
});

test("payment state machine prevents client-side shortcuts and terminal-state rewrites", () => {
  assert.equal(canTransitionPaymentStatus("created", "pending"), true);
  assert.equal(canTransitionPaymentStatus("pending", "confirmed"), true);
  assert.equal(canTransitionPaymentStatus("created", "confirmed"), false);
  assert.equal(canTransitionPaymentStatus("failed", "confirmed"), false);
  assert.equal(canTransitionPaymentStatus("confirmed", "refunded"), true);
  assert.equal(canTransitionPaymentStatus("refunded", "confirmed"), false);
});

test("payment migration records idempotent intents and immutable provider events", async () => {
  const sql = await readFile(new URL("../migrations/0009_marketplace_payments.sql", import.meta.url), "utf8");
  assert.match(sql, /UNIQUE \(buyer_user_id, idempotency_key\)/);
  assert.match(sql, /UNIQUE \(provider_code, provider_event_id\)/);
  assert.match(sql, /PAYMENT_EVENTS_ARE_APPEND_ONLY/);
  assert.match(sql, /CHECK \(payment_method IN \('manual', 'crypto'\)\)/);
  assert.match(sql, /CHECK \(status IN \('created', 'pending', 'confirmed', 'failed', 'expired', 'refunded'\)\)/);
  assert.match(sql, /REFERENCES orders\(id\) ON DELETE RESTRICT/);
});
