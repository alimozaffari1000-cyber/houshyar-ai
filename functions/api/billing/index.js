import { getSessionUser } from "../_lib/auth.js";
import { authJson } from "../_lib/auth-flow.js";
import { getBillingPlan, resolveEntitlement } from "../_lib/billing-policy.js";

export async function onRequestGet({ request, env }) {
  if (!env.DB) return authJson({ error: "DATABASE_NOT_CONFIGURED" }, 503);
  const user = await getSessionUser(env.DB, request);
  if (!user) return authJson({ error: "AUTH_REQUIRED" }, 401);
  try {
    const now = Math.floor(Date.now() / 1000);
    const subscription = await env.DB.prepare(
      "SELECT plan_code, status, starts_at, ends_at FROM user_subscriptions WHERE user_id = ? AND status = 'active' AND (starts_at IS NULL OR starts_at <= ?) AND (ends_at IS NULL OR ends_at > ?) ORDER BY created_at DESC LIMIT 1"
    ).bind(user.id, now, now).first();
    const entitlement = resolveEntitlement(subscription, now);
    const today = new Date(now * 1000).toISOString().slice(0, 10);
    const usage = await env.DB.prepare(
      "SELECT request_count FROM daily_usage WHERE user_id = ? AND usage_date = ?"
    ).bind(user.id, today).first();
    const credits = await env.DB.prepare(
      "SELECT COALESCE(SUM(credit_delta), 0) AS balance FROM user_credit_ledger WHERE user_id = ?"
    ).bind(user.id).first();
    const plan = getBillingPlan(entitlement.plan.code);
    return authJson({
      plan: plan.code,
      subscriptionStatus: entitlement.subscriptionStatus,
      subscription: subscription ? { startsAt: subscription.starts_at, endsAt: subscription.ends_at } : null,
      dailyChat: { used: usage?.request_count || 0, limit: plan.dailyChatLimit, remaining: Math.max(0, plan.dailyChatLimit - (usage?.request_count || 0)) },
      credits: { balance: Math.max(0, credits?.balance || 0) },
      paidCheckoutEnabled: false
    });
  } catch {
    return authJson({ error: "BILLING_UNAVAILABLE" }, 503);
  }
}
