import { listPaymentMethods, listBillingOptions } from "../../../src/payments/catalog.js";

const json = (body, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff"
  }
});

export async function onRequestGet() {
  return json({
    service: "Houshyar payment methods",
    mode: "catalog_only",
    livePaymentsEnabled: false,
    methods: listPaymentMethods(),
    billingOptions: listBillingOptions()
  });
}

// Intentionally fail closed until reviewed processors, invoice persistence,
// webhook verification, and idempotent entitlement grants are implemented.
export async function onRequestPost() {
  return json({
    error: "PAYMENTS_NOT_CONFIGURED",
    message: "پرداخت هوش‌یار هنوز فعال نشده است؛ هیچ وجهی ارسال نکنید."
  }, 503);
}
