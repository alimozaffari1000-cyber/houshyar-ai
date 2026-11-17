import { BILLING_PLANS } from "../_lib/billing-policy.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300", "X-Content-Type-Options": "nosniff" }
});

export async function onRequestGet() {
  return json({
    plans: BILLING_PLANS,
    currency: null,
    pricingStatus: "not_configured",
    paidCheckoutEnabled: false,
    note: "پلن‌های پولی تا تعیین قیمت، مالیات و ارائه‌دهنده پرداخت قابل خرید نیستند."
  });
}
