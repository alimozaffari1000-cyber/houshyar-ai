import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  listPaymentMethods, listBillingOptions, getPaymentMethod, getBillingOption
} from "../src/payments/catalog.js";
import { canTransitionInvoice, transitionInvoice, canGrantEntitlement } from "../src/payments/invoice-state.js";
import { validatePaymentProvider, assertPaymentProvider } from "../src/payments/provider-contract.js";
import { onRequestGet, onRequestPost } from "../functions/api/payments/methods.js";

test("catalog exposes the seven agreed payment rails with explicit network qualification", () => {
  const methods = listPaymentMethods();
  assert.equal(methods.length, 7);
  for (const id of ["iran-card-gateway", "internal-wallet", "usdt-trc20", "trx", "xrp", "xmr", "international-cards"]) {
    assert.ok(getPaymentMethod(id), `missing payment method: ${id}`);
  }
  assert.ok(methods.every(method => method.enabled === false));
});

test("wallet is service credit and is not presented as withdrawable cash", () => {
  const wallet = getPaymentMethod("internal-wallet");
  assert.equal(wallet.custody, "internal_ledger");
  assert.match(wallet.note, /not a bank account, cash balance, or withdrawable wallet/i);
});

test("USDT-TRC20 explicitly warns that the issuer can freeze addresses", () => {
  const usdt = getPaymentMethod("usdt-trc20");
  assert.equal(usdt.network, "TRON (TRC-20)");
  assert.equal(usdt.issuerFreeze, true);
  assert.equal(usdt.custody, "token_issuer_controlled");
});

test("TRX, XRP and XMR remain separate native network options", () => {
  assert.equal(getPaymentMethod("trx").network, "TRON");
  assert.equal(getPaymentMethod("xrp").network, "XRP Ledger");
  assert.equal(getPaymentMethod("xmr").network, "Monero");
  assert.equal(getPaymentMethod("xrp").destinationTagSupported, true);
});

test("auto-renew is a billing mode, not a payment rail, and stays disabled", () => {
  assert.equal(listBillingOptions().length, 2);
  assert.equal(getBillingOption("subscription_auto_renew").kind, "billing_mode");
  assert.equal(getBillingOption("subscription_auto_renew").enabled, false);
});

test("invoice state machine rejects invalid and terminal transitions", () => {
  assert.equal(canTransitionInvoice("pending", "confirming"), true);
  assert.equal(canTransitionInvoice("pending", "paid"), true);
  assert.equal(canTransitionInvoice("paid", "refunded"), true);
  assert.equal(canTransitionInvoice("paid", "pending"), false);
  assert.equal(canTransitionInvoice("expired", "paid"), false);
  assert.throws(() => transitionInvoice({ status: "expired" }, "paid"), /INVALID_INVOICE_STATE_TRANSITION/);
  assert.equal(transitionInvoice({ status: "pending", id: "inv_1" }, "confirming").status, "confirming");
});

test("entitlements can only be granted once after confirmed payment", () => {
  assert.equal(canGrantEntitlement("pending", false), false);
  assert.equal(canGrantEntitlement("paid", false), true);
  assert.equal(canGrantEntitlement("paid", true), false);
});

test("provider adapter contract requires invoice, status, and webhook verification", () => {
  const provider = {
    id: "test-provider",
    createInvoice() {},
    getInvoiceStatus() {},
    verifyWebhook() {}
  };
  assert.equal(validatePaymentProvider(provider), true);
  assert.equal(validatePaymentProvider({ id: "incomplete", createInvoice() {} }), false);
  assert.equal(assertPaymentProvider(provider), provider);
  assert.throws(() => assertPaymentProvider({ id: "incomplete" }), /INVALID_PAYMENT_PROVIDER_ADAPTER/);
});

test("public endpoint exposes catalog and billing options but never enables live payments", async () => {
  const response = await onRequestGet();
  const body = await response.json();
  assert.equal(response.status, 200);
  assert.equal(body.mode, "catalog_only");
  assert.equal(body.livePaymentsEnabled, false);
  assert.equal(body.methods.length, 7);
  assert.equal(body.methods.every(method => !method.enabled), true);
  assert.equal(body.billingOptions.find(option => option.id === "subscription_auto_renew").enabled, false);
});

test("payment mutation endpoint fails closed until a processor is configured", async () => {
  const response = await onRequestPost();
  assert.equal(response.status, 503);
  assert.equal((await response.json()).error, "PAYMENTS_NOT_CONFIGURED");
});


test("payment migration deduplicates provider events and protects the wallet ledger", () => {
  const migration = readFileSync("migrations/0004_payment_ledger.sql", "utf8");
  assert.match(migration, /UNIQUE\(provider_id, provider_event_id\)/);
  assert.match(migration, /UNIQUE\(provider_id, provider_invoice_id\)/);
  assert.match(migration, /UNIQUE\(provider_id, provider_subscription_id\)/);
  assert.match(migration, /CREATE TRIGGER IF NOT EXISTS trg_wallet_ledger_no_update/);
  assert.match(migration, /CREATE TRIGGER IF NOT EXISTS trg_wallet_ledger_no_delete/);
  assert.match(migration, /WALLET_LEDGER_IMMUTABLE/);
});


test("payment migration stores money safely and prevents duplicate invoice grants", () => {
  const migration = readFileSync("migrations/0004_payment_ledger.sql", "utf8");
  assert.match(migration, /base_amount_minor INTEGER NOT NULL CHECK \(base_amount_minor > 0\)/);
  assert.match(migration, /idempotency_key TEXT NOT NULL UNIQUE/);
  assert.match(migration, /invoice_id TEXT NOT NULL UNIQUE REFERENCES payment_invoices/);
  assert.match(migration, /auto_renew_enabled INTEGER NOT NULL DEFAULT 0/);
  assert.doesNotMatch(migration, /amount_(?:minor|units) REAL/);
});
