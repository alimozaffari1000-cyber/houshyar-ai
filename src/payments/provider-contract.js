const REQUIRED_PROVIDER_METHODS = Object.freeze([
  "createInvoice",
  "getInvoiceStatus",
  "verifyWebhook"
]);

export function validatePaymentProvider(provider) {
  if (!provider || typeof provider.id !== "string" || !provider.id.trim()) return false;
  return REQUIRED_PROVIDER_METHODS.every(name => typeof provider[name] === "function");
}

export function assertPaymentProvider(provider) {
  if (!validatePaymentProvider(provider)) throw new Error("INVALID_PAYMENT_PROVIDER_ADAPTER");
  return provider;
}
