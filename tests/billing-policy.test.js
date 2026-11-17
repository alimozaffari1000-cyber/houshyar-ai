import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { BILLING_PLANS, getBillingPlan, resolveEntitlement, loadUserEntitlement } from "../functions/api/_lib/billing-policy.js";

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
  assert.match(sql, /idempotency_key TEXT NOT NULL UNIQUE/);
  assert.match(sql, /CREDIT_LEDGER_IS_APPEND_ONLY/);
  assert.match(sql, /CHECK \(credit_delta <> 0\)/);
});

test("chat enforces the active plan quota and blocks compare outside eligible plans", async () => {
  const chat = await readFile(new URL("../functions/api/chat.js", import.meta.url), "utf8");
  assert.match(chat, /CHAT_PLAN_ENTITLEMENTS_ENABLED/);
  assert.match(chat, /loadUserEntitlement/);
  assert.match(chat, /quotaLimit = entitlement \? entitlement\.plan\.dailyChatLimit/);
  assert.match(chat, /entitlement\.plan\.features\.modelCompare !== true/);
  assert.match(chat, /PLAN_ENTITLEMENTS_NOT_CONFIGURED/);
});

test("loadUserEntitlement reads the current active subscription and safely defaults to free", async () => {
  const calls = [];
  const db = { prepare(sql) {
    calls.push(sql);
    return { bind(...args) { calls.push(args); return { async first() { return { plan_code: "plus", status: "active", starts_at: 100, ends_at: 300 }; } }; } };
  } };
  const result = await loadUserEntitlement({ db, userId: "user-1", now: 200 });
  assert.equal(result.plan.code, "plus");
  assert.equal(result.plan.dailyChatLimit, 100);
  assert.match(calls[0], /user_subscriptions/);
  assert.deepEqual(calls[1], ["user-1", 200, 200]);
  const noSubscriptionDb = { prepare() { return { bind() { return { async first() { return null; } }; } }; } };
  assert.equal((await loadUserEntitlement({ db: noSubscriptionDb, userId: "user-2", now: 200 })).plan.code, "free");
});
