export const BILLING_PLANS = Object.freeze([
  Object.freeze({
    code: "free", dailyChatLimit: 20, monthlyCredits: 0, price: null, purchasable: true,
    features: Object.freeze({ chat: true, specialistAgents: true, googleSearch: limited(), modelCompare: false, marketplace: true })
  }),
  Object.freeze({
    code: "plus", dailyChatLimit: 100, monthlyCredits: 1000, price: null, purchasable: false,
    features: Object.freeze({ chat: true, specialistAgents: true, googleSearch: true, modelCompare: true, marketplace: true })
  }),
  Object.freeze({
    code: "pro", dailyChatLimit: 300, monthlyCredits: 5000, price: null, purchasable: false,
    features: Object.freeze({ chat: true, specialistAgents: true, googleSearch: true, modelCompare: true, marketplace: true })
  })
]);

function limited() { return "provider-dependent"; }

export function getBillingPlan(planCode) {
  return BILLING_PLANS.find(plan => plan.code === planCode) || BILLING_PLANS[0];
}

export function resolveEntitlement(subscription, now = Math.floor(Date.now() / 1000)) {
  if (!subscription || subscription.status !== "active" ||
      (subscription.starts_at != null && subscription.starts_at > now) ||
      (subscription.ends_at != null && subscription.ends_at <= now)) {
    return { plan: getBillingPlan("free"), subscriptionStatus: "free" };
  }
  return {
    plan: getBillingPlan(subscription.plan_code),
    subscriptionStatus: subscription.status
  };
}
