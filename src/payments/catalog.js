// Public payment catalogue. Every option stays disabled until a provider and
// the required legal, security, and operational gates have been verified.
export const PAYMENT_METHODS = Object.freeze([
  {
    id: "iran-card-gateway", kind: "payment_rail", category: "bank_card",
    label: "درگاه بانکی ایران", labelEn: "Iranian bank-card gateway",
    phase: "phase_1", enabled: false, providerRequired: true,
    custody: "licensed_payment_processor", countries: ["IR"],
    note: "Requires an approved domestic payment service provider and merchant onboarding."
  },
  {
    id: "internal-wallet", kind: "payment_rail", category: "account_credit",
    label: "کیف پول اعتباری هوش‌یار", labelEn: "Houshyar internal credit wallet",
    phase: "phase_1", enabled: false, providerRequired: false,
    custody: "internal_ledger", countries: ["*"],
    note: "Prepaid service-credit ledger; not a bank account, cash balance, or withdrawable wallet."
  },
  {
    id: "usdt-trc20", kind: "payment_rail", category: "crypto", asset: "USDT",
    network: "TRON (TRC-20)", label: "تتر (TRC-20 روی ترون)",
    labelEn: "Tether USD (TRC-20 on TRON)", phase: "phase_1_optional",
    enabled: false, providerRequired: true, custody: "token_issuer_controlled",
    issuerFreeze: true, countries: ["provider_and_law_dependent"],
    note: "Issuer can blacklist or freeze addresses. Network must be selected explicitly."
  },
  {
    id: "trx", kind: "payment_rail", category: "crypto", asset: "TRX",
    network: "TRON", label: "ترون (TRX)", labelEn: "TRON (TRX)",
    phase: "phase_2", enabled: false, providerRequired: true,
    custody: "non_custodial", issuerFreeze: false,
    countries: ["provider_and_law_dependent"],
    note: "Native TRX only; it is not the same asset as USDT-TRC20."
  },
  {
    id: "xrp", kind: "payment_rail", category: "crypto", asset: "XRP",
    network: "XRP Ledger", label: "ریپل (XRP Ledger)",
    labelEn: "XRP (XRP Ledger)", phase: "phase_2", enabled: false,
    providerRequired: true, custody: "non_custodial", issuerFreeze: false,
    destinationTagSupported: true, countries: ["provider_and_law_dependent"],
    note: "Native XRP only; destination tags must be validated when required."
  },
  {
    id: "xmr", kind: "payment_rail", category: "crypto", asset: "XMR",
    network: "Monero", label: "مونرو (XMR)", labelEn: "Monero (XMR)",
    phase: "restricted_review", enabled: false, providerRequired: true,
    custody: "non_custodial", issuerFreeze: false,
    countries: ["explicit_legal_review_required"],
    note: "Requires jurisdiction, provider, AML/accounting, and operational review before availability."
  },
  {
    id: "international-cards", kind: "payment_rail", category: "international_card",
    label: "کارت‌های Visa و Mastercard", labelEn: "Visa and Mastercard",
    phase: "provider_review", enabled: false, providerRequired: true,
    custody: "licensed_payment_processor",
    countries: ["provider_and_law_dependent"],
    note: "Only through a legitimate processor that supports the business and customer countries."
  }
]);

// Recurring billing is a billing model, not a separate payment network.
export const BILLING_OPTIONS = Object.freeze([
  {
    id: "one_time", kind: "billing_mode", label: "پرداخت یک‌باره",
    labelEn: "One-time payment", enabled: true,
    requiresReusablePaymentMethod: false
  },
  {
    id: "subscription_auto_renew", kind: "billing_mode",
    label: "اشتراک با تمدید خودکار", labelEn: "Auto-renewing subscription",
    enabled: false, requiresReusablePaymentMethod: true,
    note: "Enable only when the processor supports compliant recurring billing and explicit cancellation."
  }
]);

export function listPaymentMethods() {
  return PAYMENT_METHODS.map(method => ({ ...method }));
}

export function listBillingOptions() {
  return BILLING_OPTIONS.map(option => ({ ...option }));
}

export function getPaymentMethod(id) {
  return PAYMENT_METHODS.find(method => method.id === id) ?? null;
}

export function getBillingOption(id) {
  return BILLING_OPTIONS.find(option => option.id === id) ?? null;
}
