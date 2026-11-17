import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { BILLING_PLANS, getBillingPlan, resolveEntitlement } from "../functions/api/_lib/billing-policy.js";

test("billing catalogue exposes conservative free, plus and pro limits", () => {
  assert.deepEqual(BILLING_PLANS.map(plan => plan.code), ["free", "plus", "pro"]);
  assert.equal(getBillingPlan("unknown").code, "free");
  assert.equal(getBillingPlan("free").dailyChatLimit, 20);
  assert.equal(getBillingPlan("plus").dailyChatLimit, 100);
  assert.equal(getBillingPlan("pro").dailyChatLimit, 300);
  assert.equal(getBillingPlan("plus").purchasable, false);
  assert.equal(getBillingPlan("pro").price, null);
});

test("entitlement falls back to free for absent, inactive and expired subscriptions", () => {
  assert.equal(resolveEntitlement(null).plan.code, "free");
  assert.equal(resolveEntitlement({ plan_code: "pro", status: "cancelled" }).plan.code, "free");
  assert.equal(resolveEntitlement({ plan_code: "plus", status: "active", ends_at: 99 }, 100).plan.code, "free");
  assert.equal(resolveEntitlement({ plan_code: "pro", status: "active", starts_at: 200 }, 100).plan.code, "free");
});

test("active subscription resolves only within its validity interval", () => {
  const result = resolveEntitlement({ plan_code: "plus", status: "active", starts_at: 100, ends_at: 200 }, 150);
  assert.equal(result.plan.code, "plus");
  assert.equal(result.subscriptionStatus, "active");
});

test("billing migration enforces one active subscription and append-only credits", async () => {
  const sql = await readFile(new URL("../migrations/0010_billing_entitlements.sql", import.meta.url), "utf8");
  assert.match(sql, /idx_user_subscriptions_one_active/);
  assert.match(sql, /UNIQUE \(idempotency_key\)/);
  assert.match(sql, /CREDIT_LEDGER_IS_APPEND_ONLY/);
  assert.match(sql, /CHECK \(credit_delta <> 0\)/);
});
